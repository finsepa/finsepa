import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  estimateCostUsd,
  type AgentMonthlyUsageSnapshot,
  type AgentUsageSnapshot,
  utcMonthDateRange,
  utcUsageDate,
  utcUsageMonth,
} from "@/lib/agents/agent-caps";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type UsageRow = {
  message_count: number;
  input_tokens: number | string;
  output_tokens: number | string;
  estimated_cost_usd: number | string;
};

function toSnapshot(usageDate: string, row: UsageRow | null): AgentUsageSnapshot {
  if (!row) {
    return {
      usageDate,
      messageCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
  }
  return {
    usageDate,
    messageCount: Number(row.message_count) || 0,
    inputTokens: Number(row.input_tokens) || 0,
    outputTokens: Number(row.output_tokens) || 0,
    estimatedCostUsd: Number(row.estimated_cost_usd) || 0,
  };
}

function adminOrThrow(): SupabaseClient {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Agent usage metering.");
  }
  return admin;
}

export async function getAgentUsageToday(userId: string): Promise<AgentUsageSnapshot> {
  const usageDate = utcUsageDate();
  const admin = adminOrThrow();
  const { data, error } = await admin
    .from("agent_usage_daily")
    .select("message_count,input_tokens,output_tokens,estimated_cost_usd")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle<UsageRow>();
  if (error) throw new Error(error.message);
  return toSnapshot(usageDate, data);
}

/** Sum estimated LLM spend for the current UTC calendar month. */
export async function getAgentUsageThisMonth(userId: string): Promise<AgentMonthlyUsageSnapshot> {
  const usageMonth = utcUsageMonth();
  const { startDate, endDate } = utcMonthDateRange();
  const admin = adminOrThrow();
  const { data, error } = await admin
    .from("agent_usage_daily")
    .select("estimated_cost_usd")
    .eq("user_id", userId)
    .gte("usage_date", startDate)
    .lte("usage_date", endDate);
  if (error) throw new Error(error.message);

  let estimatedCostUsd = 0;
  for (const row of data ?? []) {
    estimatedCostUsd += Number((row as { estimated_cost_usd: number | string }).estimated_cost_usd) || 0;
  }
  estimatedCostUsd = Math.round(estimatedCostUsd * 1_000_000) / 1_000_000;

  return { usageMonth, estimatedCostUsd };
}

export async function recordAgentUsage(args: {
  userId: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<AgentUsageSnapshot> {
  const usageDate = utcUsageDate();
  const admin = adminOrThrow();
  const inputTokens = Math.max(0, Math.floor(args.inputTokens));
  const outputTokens = Math.max(0, Math.floor(args.outputTokens));
  const addCost = estimateCostUsd(inputTokens, outputTokens);

  const current = await getAgentUsageToday(args.userId);
  const next: AgentUsageSnapshot = {
    usageDate,
    messageCount: current.messageCount + 1,
    inputTokens: current.inputTokens + inputTokens,
    outputTokens: current.outputTokens + outputTokens,
    estimatedCostUsd: Math.round((current.estimatedCostUsd + addCost) * 1_000_000) / 1_000_000,
  };

  const { error } = await admin.from("agent_usage_daily").upsert(
    {
      user_id: args.userId,
      usage_date: usageDate,
      message_count: next.messageCount,
      input_tokens: next.inputTokens,
      output_tokens: next.outputTokens,
      estimated_cost_usd: next.estimatedCostUsd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,usage_date" },
  );
  if (error) throw new Error(error.message);
  return next;
}
