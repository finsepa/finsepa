import { isStockChartRange } from "@/lib/market/stock-chart-api";
import type { StockChartRange } from "@/lib/market/stock-chart-types";

/**
 * Crypto week slot — UI keeps the `5D` control value (same segmented set as stocks);
 * API query + display use `1W` (7 calendar days). Matches iOS `AssetChartRange.apiRangeParam`.
 */
export const CRYPTO_WEEK_RANGE_API = "1W" as const;

/** Rolling week window for crypto `5D` / `1W` charts (24/7, not US sessions). */
export const CRYPTO_WEEK_LOOKBACK_SEC = 7 * 86400;

export function parseCryptoChartRangeParam(v: string | null): StockChartRange {
  if (v === CRYPTO_WEEK_RANGE_API) return "5D";
  if (isStockChartRange(v)) return v;
  return "1Y";
}

export function cryptoChartApiRangeParam(range: StockChartRange): string {
  return range === "5D" ? CRYPTO_WEEK_RANGE_API : range;
}

export function cryptoChartRangeDisplayLabel(
  range: StockChartRange,
  opts?: { live24h?: boolean },
): string {
  if (opts?.live24h && range === "1D") return "24H";
  if (range === "5D") return "1W";
  return range;
}

/** Range-control label overrides for crypto overview charts. */
export function cryptoChartRangeLabels(opts?: {
  live24h?: boolean;
}): Partial<Record<StockChartRange, string>> {
  return {
    ...(opts?.live24h ? { "1D": "24H" as const } : {}),
    "5D": "1W",
  };
}
