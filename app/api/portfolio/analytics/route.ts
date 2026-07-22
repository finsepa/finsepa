import { NextResponse } from "next/server";

import {
  computePortfolioAnalyticsSnapshot,
  parsePortfolioAnalyticsBody,
} from "@/lib/portfolio/analytics/portfolio-analytics.server";
import { requireAuthUser, AuthRequiredError } from "@/lib/watchlist/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Manual Portfolio Key Stats analytics (Phase 4).
 * Failure → unavailable metrics; never blocks portfolio UI.
 */
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    await requireAuthUser(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = parsePortfolioAnalyticsBody(body);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const snapshot = await computePortfolioAnalyticsSnapshot({
      holdings: parsed.holdings,
      transactions: parsed.transactions,
      benchmarkTicker: parsed.benchmark,
    });

    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio analytics]", message);
    // Soft-fail envelope so UI can stay muted unavailable
    return NextResponse.json(
      {
        asOf: new Date().toISOString().slice(0, 10),
        error: message,
        sharpe: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        sortino: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        volatility: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        beta: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        turnover: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        pe: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        grossMargin: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        operatingMargin: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        roce: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        cashConversion: { value: null, status: "unavailable", observations: 0, period: "1Y", coverage: null, asOf: null, reason: "PROVIDER_FAILURE" },
        benchmark: null,
      },
      { status: 200 },
    );
  }
}
