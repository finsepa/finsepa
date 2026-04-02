import "server-only";

import type { CryptoAssetRow } from "@/lib/market/crypto-asset";
import { getCryptoAsset } from "@/lib/market/crypto-asset";
import { getCryptoChartPoints } from "@/lib/market/crypto-chart-data";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import type { StockChartRange } from "@/lib/market/stock-chart-types";

const DEFAULT_RANGE: StockChartRange = "1Y";

export type CryptoPageInitialData = {
  routeSymbol: string;
  asset: CryptoAssetRow | null;
  chart: { range: StockChartRange; points: StockChartPoint[] };
};

/**
 * Server pass for crypto detail: cached asset row + default-range chart (same paths as API routes).
 */
export async function loadCryptoPageInitialData(routeSymbol: string): Promise<CryptoPageInitialData | null> {
  const raw = routeSymbol.trim();
  if (!raw) return null;

  const range = DEFAULT_RANGE;
  const [asset, points] = await Promise.all([getCryptoAsset(raw), getCryptoChartPoints(raw, range)]);

  return {
    routeSymbol: raw,
    asset,
    chart: { range, points },
  };
}
