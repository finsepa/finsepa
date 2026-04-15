import { NextResponse } from "next/server";

import { getNvdaStockEarningsTabPayload } from "@/lib/fixtures/nvda";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { fetchStockEarningsTabPayload } from "@/lib/market/stock-earnings-tab-data";
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

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.toUpperCase() === "NVDA") {
    return NextResponse.json(getNvdaStockEarningsTabPayload(), {
      headers: { "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      { ticker: routeTicker, upcoming: null, history: [], estimatesChart: null },
      { headers: { "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600" } },
    );
  }

  const payload = await fetchStockEarningsTabPayload(routeTicker);
  if (!payload) {
    return NextResponse.json(
      { ticker: routeTicker, upcoming: null, history: [], estimatesChart: null },
      { status: 200, headers: { "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600" } },
    );
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600" },
  });
}
