import type { StockChartPoint } from "@/lib/market/stock-chart-types";

/**
 * Min $ move across crypto WS minute bars before we treat them as a real live series.
 * Below this (or a single distinct cent), heartbeats can flatten the 1D chart — fall back to REST.
 */
export const CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_USD = 1;

/** Flat polled/heartbeat closes are not a live chart — ignore WS overlay. */
export function cryptoMinuteBarsHavePriceVariation(
  bars: readonly StockChartPoint[],
  minDistinctCents = 2,
  minSpreadUsd = CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_USD,
): boolean {
  if (bars.length < 2) return false;
  const cents = new Set<number>();
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;
  for (const p of bars) {
    if (!Number.isFinite(p.value) || p.value <= 0) continue;
    cents.add(Math.round(p.value * 100));
    minVal = Math.min(minVal, p.value);
    maxVal = Math.max(maxVal, p.value);
  }
  if (cents.size < minDistinctCents) return false;
  return maxVal - minVal >= minSpreadUsd;
}
