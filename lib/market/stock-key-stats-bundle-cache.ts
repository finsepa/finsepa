import "server-only";

import { unstable_cache } from "next/cache";

import { buildStockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";

export const STOCK_KEY_STATS_BUNDLE_CACHE_KEY = "stock-key-stats-bundle-v4-insiders-short";
export const STOCK_KEY_STATS_BUNDLE_REVALIDATE_SEC = 12 * 60 * 60;

const getCachedKeyStatsBundle = unstable_cache(
  async (ticker: string) => buildStockKeyStatsBundle(ticker, { refreshFundamentals: false }),
  [STOCK_KEY_STATS_BUNDLE_CACHE_KEY],
  // Key stats are fundamentals-backed; cache long to avoid repeat tab burns.
  { revalidate: STOCK_KEY_STATS_BUNDLE_REVALIDATE_SEC },
);

export function isKeyStatsFundamentalsRefreshRequest(url: URL): boolean {
  return (
    url.searchParams.get("refresh") === "1" ||
    url.searchParams.get("hard") === "1" ||
    url.searchParams.get("nocache") === "1"
  );
}

/** Cached bundle for stock key-stats API routes (bundle + deprecated section routes). */
export async function loadStockKeyStatsBundleForApi(
  ticker: string,
  opts?: { refreshFundamentals?: boolean },
): Promise<StockKeyStatsBundle> {
  if (opts?.refreshFundamentals) {
    return buildStockKeyStatsBundle(ticker, { refreshFundamentals: true });
  }
  return getCachedKeyStatsBundle(ticker);
}
