import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM_CHART } from "@/lib/data/cache-policy";
import {
  buildPortfolioEarningsDatesFromCalendar,
  PORTFOLIO_EARNINGS_DATES_MAX_SYMBOLS,
} from "@/lib/portfolio/portfolio-earnings-dates-calendar";
import { AuthRequiredError, requireAuthUserFromRequest } from "@/lib/watchlist/api-auth";

type Body = { symbols?: unknown };

/**
 * Next earnings date per holding / watchlist ticker.
 * Uses batched EODHD `calendar/earnings?symbols=` (~1 credit / 80 tickers) —
 * not per-symbol fundamentals.
 */
export async function POST(request: Request) {
  try {
    await requireAuthUserFromRequest(request);

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const raw = Array.isArray(body.symbols)
      ? body.symbols.filter((s): s is string => typeof s === "string")
      : [];
    const symbols = [
      ...new Set(raw.map((s) => s.trim().toUpperCase()).filter(Boolean)),
    ].slice(0, PORTFOLIO_EARNINGS_DATES_MAX_SYMBOLS);

    const bySymbol = await buildPortfolioEarningsDatesFromCalendar(symbols);

    return NextResponse.json(
      { bySymbol },
      {
        headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART },
      },
    );
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[portfolio earnings-dates]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
