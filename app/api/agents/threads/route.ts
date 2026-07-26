import { NextResponse } from "next/server";

import { assertAgentEntitlement } from "@/lib/agents/agent-entitlement";
import { createAgentThread, listAgentThreads } from "@/lib/agents/agent-threads";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const entitlement = await assertAgentEntitlement(user.id);
  if (!entitlement.ok) {
    return NextResponse.json(
      { error: entitlement.message, code: entitlement.code },
      { status: entitlement.code === "PAYWALL" ? 402 : 401 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const threads = await listAgentThreads(supabase, user.id);
    return NextResponse.json({ threads });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await resolveAuthUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const entitlement = await assertAgentEntitlement(user.id);
  if (!entitlement.ok) {
    return NextResponse.json(
      { error: entitlement.message, code: entitlement.code },
      { status: entitlement.code === "PAYWALL" ? 402 : 401 },
    );
  }

  let title = "New chat";
  try {
    const body = (await request.json()) as { title?: unknown };
    if (typeof body.title === "string" && body.title.trim()) title = body.title.trim();
  } catch {
    /* empty body ok */
  }

  try {
    const supabase = await getSupabaseServerClient();
    const thread = await createAgentThread(supabase, user.id, title);
    return NextResponse.json({ thread }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
