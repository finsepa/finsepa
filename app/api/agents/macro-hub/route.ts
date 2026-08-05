import { NextResponse } from "next/server";

import { loadAgentMacroHubCards } from "@/lib/agents/agent-hub-calendars";
import { assertAgentEntitlement } from "@/lib/agents/agent-entitlement";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";
import { CACHE_CONTROL_PUBLIC_HOT_FAST } from "@/lib/data/cache-policy";

export const runtime = "nodejs";

/**
 * Hub-only macro series for Agent chat chart embeds.
 * Never cold-builds / never hits EODHD — soft-fails when the snapshot is cold.
 */
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

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids")?.trim() ?? "";
  const ids =
    idsParam.length > 0
      ? idsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8)
      : undefined;

  const result = await loadAgentMacroHubCards({ ids });
  return NextResponse.json(result, {
    headers: { "Cache-Control": CACHE_CONTROL_PUBLIC_HOT_FAST },
  });
}
