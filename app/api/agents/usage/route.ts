import { NextResponse } from "next/server";

import {
  AGENT_USAGE_LIMIT_MESSAGE,
  getAgentMonthlyCaps,
  isOverMonthlyCap,
} from "@/lib/agents/agent-caps";
import { assertAgentEntitlement } from "@/lib/agents/agent-entitlement";
import { getAgentUsageThisMonth } from "@/lib/agents/agent-usage";
import { resolveAuthUserFromRequest } from "@/lib/auth/resolve-auth-user";

export const runtime = "nodejs";

/** Lightweight usage gate for the Agent UI (monthly spend cap). */
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
    const monthly = await getAgentUsageThisMonth(user.id);
    const caps = getAgentMonthlyCaps();
    const cap = isOverMonthlyCap(monthly);
    return NextResponse.json({
      usageMonth: monthly.usageMonth,
      estimatedCostUsd: monthly.estimatedCostUsd,
      maxCostUsdPerMonth: caps.maxCostUsdPerMonth,
      blocked: cap.over,
      message: cap.over ? AGENT_USAGE_LIMIT_MESSAGE : null,
    });
  } catch (e) {
    console.error("[agent] monthly usage read failed", e);
    return NextResponse.json(
      { error: "Usage metering unavailable. Try again later.", code: "USAGE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
