import "server-only";

import { NextResponse } from "next/server";

import {
  CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE,
  CACHE_CONTROL_PRIVATE_NO_STORE_MUST_REVALIDATE,
  CACHE_CONTROL_PRIVATE_WARM_CHART,
} from "@/lib/data/cache-policy";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaKeyStatsBundle } from "@/lib/fixtures/nvda";
import {
  isKeyStatsFundamentalsRefreshRequest,
  loadStockKeyStatsBundleForApi,
} from "@/lib/market/stock-key-stats-bundle-cache";
import type { KeyStatsBundleSection } from "@/lib/market/stock-key-stats-bundle-types";
import { normalizeWatchlistTicker, WatchlistValidationError } from "@/lib/watchlist/operations";

function deprecationHeaders(ticker: string): Record<string, string> {
  const enc = encodeURIComponent(ticker);
  return {
    Deprecation: "true",
    Link: `</api/stocks/${enc}/key-stats-bundle>; rel="successor-version"`,
    Warning: `299 - "Use GET /api/stocks/${enc}/key-stats-bundle instead of section routes."`,
  };
}

/**
 * Deprecated section route handler — slices rows from the shared cached bundle
 * instead of fetching EODHD fundamentals independently per section.
 */
export async function respondKeyStatsSectionRoute(
  request: Request,
  params: Promise<{ ticker: string }>,
  section: KeyStatsBundleSection,
): Promise<NextResponse> {
  const url = new URL(request.url);
  const refreshFundamentals = isKeyStatsFundamentalsRefreshRequest(url);
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

  const deprecate = deprecationHeaders(routeTicker);

  if (isSingleAssetMode() && isSupportedAsset(routeTicker) && routeTicker.toUpperCase() === "NVDA") {
    const bundle = getNvdaKeyStatsBundle();
    return NextResponse.json(
      { ticker: routeTicker, rows: bundle[section] },
      { headers: { ...deprecate, "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART } },
    );
  }

  if (isSingleAssetMode() && !isSupportedAsset(routeTicker)) {
    return NextResponse.json(
      { ticker: routeTicker, rows: null },
      { headers: { ...deprecate, "Cache-Control": CACHE_CONTROL_PRIVATE_WARM_CHART } },
    );
  }

  const bundle = await loadStockKeyStatsBundleForApi(routeTicker, { refreshFundamentals });
  const cacheHeaders = refreshFundamentals
    ? { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE_MUST_REVALIDATE }
    : { "Cache-Control": CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE };

  return NextResponse.json(
    { ticker: routeTicker, rows: bundle[section] },
    { headers: { ...deprecate, ...cacheHeaders } },
  );
}
