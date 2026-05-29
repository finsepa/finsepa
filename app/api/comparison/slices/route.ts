import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { CACHE_CONTROL_PRIVATE_HOT } from "@/lib/data/cache-policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSingleAssetMode, isSupportedAsset, SINGLE_ASSET_SYMBOL } from "@/lib/features/single-asset";
import { getNvdaHeaderMeta, getNvdaKeyStatsBundle, getNvdaPerformance } from "@/lib/fixtures/nvda";
import { getStockDetailHeaderMetaForPage } from "@/lib/market/stock-header-meta-server";
import { buildStockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle";
import { getStockPerformance } from "@/lib/market/stock-performance";
import {
  CHARTING_MAX_COMPARE_TICKERS,
  parseChartingTickerList,
} from "@/lib/market/stock-charting-metrics";
import type { ComparisonTickerSlice } from "@/lib/comparison/fetch-comparison-ticker-slice";

const getCachedKeyStatsBundle = unstable_cache(
  async (ticker: string) => buildStockKeyStatsBundle(ticker, { refreshFundamentals: false }),
  ["stock-key-stats-bundle-v1"],
  { revalidate: 12 * 60 * 60 },
);

async function loadSliceForTicker(ticker: string): Promise<ComparisonTickerSlice> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) {
    return { headerMeta: null, performance: null, keyStatsBundle: null };
  }

  if (isSingleAssetMode() && isSupportedAsset(sym) && sym === SINGLE_ASSET_SYMBOL) {
    const [headerMeta, performance, keyStatsBundle] = await Promise.all([
      Promise.resolve(getNvdaHeaderMeta()),
      Promise.resolve(getNvdaPerformance()),
      Promise.resolve(getNvdaKeyStatsBundle()),
    ]);
    return { headerMeta, performance, keyStatsBundle };
  }

  if (isSingleAssetMode() && !isSupportedAsset(sym)) {
    return { headerMeta: null, performance: null, keyStatsBundle: null };
  }

  const [headerMeta, performance, keyStatsBundle] = await Promise.all([
    getStockDetailHeaderMetaForPage(sym),
    getStockPerformance(sym),
    getCachedKeyStatsBundle(sym),
  ]);

  return { headerMeta, performance, keyStatsBundle };
}

/** One round-trip for comparison workspace: header + performance + key stats per ticker. */
export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("tickers")?.trim() ?? "";
  const tickers = parseChartingTickerList(raw || null).slice(0, CHARTING_MAX_COMPARE_TICKERS);

  if (!tickers.length) {
    return NextResponse.json({ slices: {} as Record<string, ComparisonTickerSlice> }, {
      headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_HOT },
    });
  }

  const entries = await Promise.all(
    tickers.map(async (t) => {
      const key = t.trim().toUpperCase();
      const slice = await loadSliceForTicker(key);
      return [key, slice] as const;
    }),
  );

  const slices = Object.fromEntries(entries) as Record<string, ComparisonTickerSlice>;

  return NextResponse.json({ slices }, { headers: { "Cache-Control": CACHE_CONTROL_PRIVATE_HOT } });
}
