import { NextResponse } from "next/server";

import { fetchEodhdFundamentalsHighlights } from "@/lib/market/eodhd-fundamentals";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { countWatchlistEntriesForStockTicker } from "@/lib/watchlist/stock-watchlist-count";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { ticker: raw } = await params;

  let routeTicker: string;
  try {
    routeTicker = normalizeWatchlistTicker(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const [fund, watchlistCount] = await Promise.all([
    fetchEodhdFundamentalsHighlights(routeTicker),
    countWatchlistEntriesForStockTicker(routeTicker),
  ]);

  return NextResponse.json({
    ticker: routeTicker,
    sector: fund?.sector ?? null,
    industry: fund?.industry ?? null,
    earningsDateDisplay: fund?.nextEarningsDateDisplay ?? null,
    watchlistCount,
  });
}
