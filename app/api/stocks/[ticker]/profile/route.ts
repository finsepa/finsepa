import { NextResponse } from "next/server";

import { fetchEodhdStockProfile } from "@/lib/market/eodhd-stock-profile";
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

  const profile = await fetchEodhdStockProfile(routeTicker);
  if (!profile) {
    return NextResponse.json({ ticker: routeTicker, profile: null }, { status: 200 });
  }

  return NextResponse.json({ ticker: routeTicker, profile });
}
