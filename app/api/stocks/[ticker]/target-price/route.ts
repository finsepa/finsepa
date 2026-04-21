import { NextResponse } from "next/server";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { buildStockTargetPricePayload } from "@/lib/market/stock-target-price-payload";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";

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

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(buildStockTargetPricePayload(null), {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const root = await fetchEodhdFundamentalsJson(routeTicker);
  const payload = buildStockTargetPricePayload(root);

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
