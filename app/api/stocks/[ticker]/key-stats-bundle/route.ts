import { NextResponse } from "next/server";

import {
  CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE,
  CACHE_CONTROL_PRIVATE_NO_STORE_MUST_REVALIDATE,
  CACHE_CONTROL_PRIVATE_WARM_CHART,
} from "@/lib/data/cache-policy";
import { buildStockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaKeyStatsBundle } from "@/lib/fixtures/nvda";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const url = new URL(request.url);
  const refreshFundamentals =
    url.searchParams.get("refresh") === "1" ||
    url.searchParams.get("hard") === "1" ||
    url.searchParams.get("nocache") === "1";

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
    return NextResponse.json(
      { ticker: routeTicker, bundle: getNvdaKeyStatsBundle() },
      {
        headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART },
      },
    );
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      {
        ticker: routeTicker,
        bundle: null,
      },
      {
        headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART },
      },
    );
  }

  const bundle = await buildStockKeyStatsBundle(routeTicker, { refreshFundamentals });

  const cacheHeaders = refreshFundamentals
    ? { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE_MUST_REVALIDATE }
    : { "Cache-Control": CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE };

  return NextResponse.json({ ticker: routeTicker, bundle }, { headers: cacheHeaders });
}
