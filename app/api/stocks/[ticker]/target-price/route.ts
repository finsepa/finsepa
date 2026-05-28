import { NextResponse } from "next/server";

import { unstable_cache } from "next/cache";

import { CACHE_CONTROL_PRIVATE_NO_STORE, CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { buildStockTargetPricePayload } from "@/lib/market/stock-target-price-payload";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";

type Ctx = { params: Promise<{ ticker: string }> };

const getCachedTargetPrice = unstable_cache(
  async (ticker: string) => {
    const root = await fetchEodhdFundamentalsJson(ticker);
    return buildStockTargetPricePayload(root);
  },
  ["stock-target-price-v1"],
  // Fundamentals-backed payload: cache long to avoid repeat tab burns.
  { revalidate: 12 * 60 * 60 },
);

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
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE },
    });
  }

  const payload = await getCachedTargetPrice(routeTicker);

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": CACHE_CONTROL_PRIVATE_WARM,
    },
  });
}
