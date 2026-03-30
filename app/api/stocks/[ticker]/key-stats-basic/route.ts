import { NextResponse } from "next/server";

import { fetchEodhdKeyStatsBasic } from "@/lib/market/eodhd-key-stats-basic";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

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

  const data = await fetchEodhdKeyStatsBasic(routeTicker);
  if (!data) {
    return NextResponse.json({ ticker: routeTicker, rows: null }, { status: 200 });
  }

  return NextResponse.json({ ticker: routeTicker, rows: data.rows });
}
