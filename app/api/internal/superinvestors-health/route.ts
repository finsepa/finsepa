import { NextResponse } from "next/server";

import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { computeSuperinvestor13fHealthMetrics } from "@/lib/superinvestors/superinvestor-13f-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret = pickProcessEnv("CRON_SECRET");
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Internal Superinvestors Phase 1 health metrics (no UI).
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const m = await computeSuperinvestor13fHealthMetrics();
    return NextResponse.json({
      managersTotal: m.managersTotal,
      managersFresh: m.managersFresh,
      managersMissingSnapshots: m.managersMissingSnapshots,
      unresolvedTickers: m.unresolvedTickers,
      portfoliosFailingValidation: m.portfoliosFailingValidation,
      lastSuccessfulIngest: m.lastSuccessfulIngest,
      newestSECAccession: m.newestSECAccession,
      latestPortfolioAge: m.latestPortfolioAgeHours,
      averageProcessingTime: m.averageProcessingTimeMs,
      managers: m.managers,
      generatedAt: m.generatedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "health_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
