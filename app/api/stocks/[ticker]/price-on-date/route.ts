import { NextResponse } from "next/server";

import { fetchEodhdOpenPriceOnOrBefore } from "@/lib/market/eodhd-eod";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { ticker: raw } = await params;
  const date = new URL(request.url).searchParams.get("date");

  let routeTicker: string;
  try {
    routeTicker = normalizeWatchlistTicker(decodeURIComponent(raw));
  } catch (e) {
    if (e instanceof WatchlistValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date (use YYYY-MM-DD)." }, { status: 400 });
  }

  const result = await fetchEodhdOpenPriceOnOrBefore(routeTicker, date);
  if (!result) {
    return NextResponse.json({ price: null, barDate: null, source: null }, { status: 404 });
  }

  return NextResponse.json({
    price: result.price,
    barDate: result.barDate,
    source: result.source,
  });
}
