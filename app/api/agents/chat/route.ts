import { openai } from "@ai-sdk/openai";
import { stepCountIs, streamText, type ModelMessage } from "ai";
import { NextResponse } from "next/server";

import {
  AGENT_MODEL_ID,
  AGENT_USAGE_LIMIT_MESSAGE,
  getAgentDailyCaps,
  getAgentMonthlyCaps,
  isOverDailyCap,
  isOverMonthlyCap,
} from "@/lib/agents/agent-caps";
import { assertAgentEntitlement } from "@/lib/agents/agent-entitlement";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agents/agent-prompt";
import { appendAgentMessages, getAgentThread } from "@/lib/agents/agent-threads";
import { createCheapAgentTools } from "@/lib/agents/agent-tools";
import {
  getAgentUsageThisMonth,
  getAgentUsageToday,
  recordAgentUsage,
} from "@/lib/agents/agent-usage";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { getOpenAiApiKey } from "@/lib/env/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type Body = {
  messages?: ChatMessage[];
  /** Persist this turn on the given thread (required for history). */
  threadId?: string;
};

function trimMessages(messages: ChatMessage[], maxChars: number): ModelMessage[] {
  const out: ChatMessage[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === "system") continue;
    const approx = m.content.length + 16;
    if (out.length > 0 && used + approx > maxChars) break;
    out.push({ role: m.role, content: m.content });
    used += approx;
  }
  return out.reverse().map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export async function POST(request: Request) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to use Agent.", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const entitlement = await assertAgentEntitlement(user.id);
  if (!entitlement.ok) {
    return NextResponse.json(
      { error: entitlement.message, code: entitlement.code },
      { status: entitlement.code === "PAYWALL" ? 402 : 401 },
    );
  }

  if (!getOpenAiApiKey()) {
    return NextResponse.json(
      { error: "Agent is not configured (missing OPENAI_API_KEY).", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const caps = getAgentDailyCaps();
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const cleaned = rawMessages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0);

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "messages required.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const lastUser = [...cleaned].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "A user message is required.", code: "BAD_REQUEST" }, { status: 400 });
  }
  if (lastUser.content.length > caps.maxUserMessageChars) {
    return NextResponse.json(
      {
        error: `Message too long (max ${caps.maxUserMessageChars} characters).`,
        code: "MESSAGE_TOO_LONG",
      },
      { status: 400 },
    );
  }

  const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
  if (!threadId) {
    return NextResponse.json({ error: "threadId required.", code: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const thread = await getAgentThread(supabase, user.id, threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found.", code: "NOT_FOUND" }, { status: 404 });
    }
  } catch (e) {
    console.error("[agent] thread lookup failed", e);
    return NextResponse.json(
      { error: "Could not load chat thread.", code: "THREAD_UNAVAILABLE" },
      { status: 503 },
    );
  }

  let usage;
  let monthlyUsage;
  try {
    [usage, monthlyUsage] = await Promise.all([
      getAgentUsageToday(user.id),
      getAgentUsageThisMonth(user.id),
    ]);
  } catch (e) {
    console.error("[agent] usage read failed", e);
    return NextResponse.json(
      { error: "Usage metering unavailable. Try again later.", code: "USAGE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const monthlyCap = isOverMonthlyCap(monthlyUsage);
  if (monthlyCap.over) {
    const monthlyCaps = getAgentMonthlyCaps();
    return NextResponse.json(
      {
        error: AGENT_USAGE_LIMIT_MESSAGE,
        code: "MONTHLY_LIMIT",
        usage: {
          estimatedCostUsdMonth: monthlyUsage.estimatedCostUsd,
          maxCostUsdPerMonth: monthlyCaps.maxCostUsdPerMonth,
        },
      },
      { status: 429 },
    );
  }

  const cap = isOverDailyCap(usage);
  if (cap.over) {
    return NextResponse.json(
      {
        error: cap.reason,
        code: "DAILY_LIMIT",
        usage: {
          messageCount: usage.messageCount,
          estimatedCostUsd: usage.estimatedCostUsd,
          maxMessagesPerDay: caps.maxMessagesPerDay,
          maxCostUsdPerDay: caps.maxCostUsdPerDay,
        },
      },
      { status: 429 },
    );
  }

  const messages = trimMessages(cleaned, caps.maxHistoryChars);
  const userId = user.id;
  const persistUserContent = lastUser.content;

  // Cheap tools only (Supabase + warm hub snapshots). No EODHD / writes.
  const result = streamText({
    model: openai(AGENT_MODEL_ID),
    system: AGENT_SYSTEM_PROMPT,
    messages,
    tools: createCheapAgentTools(userId),
    stopWhen: stepCountIs(6),
    maxOutputTokens: 1024,
    onFinish: async ({ usage: u, text }) => {
      try {
        await recordAgentUsage({
          userId,
          inputTokens: u.inputTokens ?? 0,
          outputTokens: u.outputTokens ?? 0,
        });
      } catch (e) {
        console.error("[agent] usage write failed", e);
      }

      const assistantText = (text ?? "").trim();
      if (!assistantText) return;

      try {
        const supabase = await getSupabaseServerClient();
        await appendAgentMessages(supabase, {
          userId,
          threadId,
          messages: [
            { role: "user", content: persistUserContent },
            { role: "assistant", content: assistantText },
          ],
          autoTitleFromFirstUserMessage: true,
        });
      } catch (e) {
        console.error("[agent] thread persist failed", e);
      }
    },
  });

  return result.toTextStreamResponse();
}
