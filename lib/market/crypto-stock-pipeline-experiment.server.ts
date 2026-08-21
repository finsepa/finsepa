import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { eodhdSymbolsForMeta } from "@/lib/market/crypto-meta";
import { usesCryptoStockPipelineExperiment } from "@/lib/market/crypto-stock-pipeline-experiment";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { loadStockStyleChartPointsForProviderSymbol } from "@/lib/market/stock-chart-data";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";

/**
 * Crypto symbol → EODHD `.CC` pair(s) → stock range loaders with US RTH filters disabled.
 * Cached like stock chart points (HOT). Tries primary + alt pairs (same as other crypto loaders).
 */
const getCached = unstable_cache(
  async (providerSymbol: string, range: StockChartRange): Promise<StockChartPoint[]> => {
    return loadStockStyleChartPointsForProviderSymbol(providerSymbol, range);
  },
  ["crypto-stock-pipeline-v3-universe-no-rth"],
  { revalidate: REVALIDATE_HOT },
);

export async function getCryptoChartPointsViaStockPipeline(
  symbol: string,
  range: StockChartRange,
): Promise<StockChartPoint[] | null> {
  if (!usesCryptoStockPipelineExperiment(symbol)) return null;
  const meta = await resolveCryptoMetaForProvider(symbol);
  if (!meta?.eodhdSymbol) return [];
  for (const pair of eodhdSymbolsForMeta(meta)) {
    const pts = await getCached(pair, range);
    if (pts.length) return pts;
  }
  return [];
}
