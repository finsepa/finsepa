import type { StockChartPoint } from "@/lib/market/stock-chart-types";

/**
 * Absolute floor for high-priced coins (BTC/ETH). Lower-priced assets use a relative
 * threshold instead — a flat $1 gate rejected real XRP/SOL WS tips (~¢ moves).
 */
export const CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_USD = 1;

/** ~5 bps of price — enough to reject pure heartbeats, loose enough for XRP/SOL. */
export const CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_BPS = 5;

/** Floor so sub-dollar dust still needs a visible tick (not float noise). */
export const CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_ABS_FLOOR_USD = 0.0001;

/** Adaptive min $ move for a live WS overlay, based on the series mid-price. */
export function cryptoWsMinuteBarMinSpreadUsd(midPriceUsd: number): number {
  if (!(midPriceUsd > 0) || !Number.isFinite(midPriceUsd)) {
    return CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_USD;
  }
  const relative =
    (midPriceUsd * CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_BPS) / 10_000;
  return Math.min(
    CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_USD,
    Math.max(CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_ABS_FLOOR_USD, relative),
  );
}

/** Flat polled/heartbeat closes are not a live chart — ignore WS overlay. */
export function cryptoMinuteBarsHavePriceVariation(
  bars: readonly StockChartPoint[],
  minDistinctCents = 2,
  minSpreadUsd?: number,
): boolean {
  if (bars.length < 2) return false;
  const cents = new Set<number>();
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;
  for (const p of bars) {
    if (!Number.isFinite(p.value) || p.value <= 0) continue;
    // Sub-dollar coins need finer than 1¢ buckets (XRP ~$1.42 moves in 0.0001s).
    const quantum = p.value < 10 ? 10_000 : 100;
    cents.add(Math.round(p.value * quantum));
    minVal = Math.min(minVal, p.value);
    maxVal = Math.max(maxVal, p.value);
  }
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) return false;
  if (cents.size < minDistinctCents) return false;
  const spread = maxVal - minVal;
  const threshold =
    minSpreadUsd ?? cryptoWsMinuteBarMinSpreadUsd((minVal + maxVal) / 2);
  return spread >= threshold;
}
