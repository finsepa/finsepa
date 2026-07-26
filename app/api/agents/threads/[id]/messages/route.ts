import { NextResponse } from "next/server";

import { assertAgentEntitlement } from "@/lib/agents/agent-entitlement";
import { getAgentThread, listAgentMessages } from "@/lib/agents/agent-threads";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
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

  const { id } = await ctx.params;
  try {
    const supabase = await getSupabaseServerClient();
    const thread = await getAgentThread(supabase, user.id, id);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    const messages = await listAgentMessages(supabase, user.id, id);
    return NextResponse.json({ thread, messages });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
