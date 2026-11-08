import type { StockChartPoint } from "@/lib/market/stock-chart-types";

/**
 * Absolute floor for high-priced coins (BTC/ETH). Lower-priced assets use a relative
 * threshold instead — a flat $1 gate rejected real XRP/SOL WS tips (~¢ moves).
 */
export const CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_USD = 1;

/** ~5 bps of price — enough to reject pure heartbeats, loose enough for XRP/SOL/PEPE. */
export const CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_BPS = 5;

/**
 * Absolute floor only for mid/high coins. Micro-priced coins (PEPE ~5e-6) must use a
 * relative floor — a fixed $0.0001 gate is larger than the whole PEPE price and rejected
 * every real move.
 */
export const CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_ABS_FLOOR_USD = 0.0001;

/** Adaptive min $ move for a live WS overlay, based on the series mid-price. */
export function cryptoWsMinuteBarMinSpreadUsd(midPriceUsd: number): number {
  if (!(midPriceUsd > 0) || !Number.isFinite(midPriceUsd)) {
    return CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_USD;
  }
  const relative =
    (midPriceUsd * CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_BPS) / 10_000;
  // Below ~$0.02 the old $0.0001 floor exceeds typical 5bps moves (and PEPE entirely).
  const absFloor =
    midPriceUsd < 0.02
      ? midPriceUsd * 1e-4 // 1 bp of mid — still above float noise
      : CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_ABS_FLOOR_USD;
  return Math.min(CRYPTO_WS_MINUTE_BAR_MIN_SPREAD_USD, Math.max(absFloor, relative));
}

/**
 * Quantize closes into distinct buckets without collapsing meme prices to 0.
 * Old `* 10_000` made every PEPE close round to 0 → variation always false.
 */
export function cryptoWsMinuteBarQuantum(priceUsd: number): number {
  if (!(priceUsd > 0) || !Number.isFinite(priceUsd)) return 100;
  if (priceUsd < 1e-4) return 1e12;
  if (priceUsd < 1e-2) return 1e8;
  if (priceUsd < 10) return 10_000;
  return 100;
}

/** Flat polled/heartbeat closes are not a live chart — ignore WS overlay. */
export function cryptoMinuteBarsHavePriceVariation(
  bars: readonly StockChartPoint[],
  minDistinctCents = 2,
  minSpreadUsd?: number,
): boolean {
  if (bars.length < 2) return false;
  const buckets = new Set<number>();
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;
  for (const p of bars) {
    if (!Number.isFinite(p.value) || p.value <= 0) continue;
    buckets.add(Math.round(p.value * cryptoWsMinuteBarQuantum(p.value)));
    minVal = Math.min(minVal, p.value);
    maxVal = Math.max(maxVal, p.value);
  }
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) return false;
  if (buckets.size < minDistinctCents) return false;
  const spread = maxVal - minVal;
  const threshold =
    minSpreadUsd ?? cryptoWsMinuteBarMinSpreadUsd((minVal + maxVal) / 2);
  return spread >= threshold;
}
