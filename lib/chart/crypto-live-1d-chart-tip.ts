import type { StockChartPoint } from "@/lib/market/stock-chart-types";

/**
 * Pin only the latest visible point of a crypto 24H (1D) series to the same live WS
 * price + timestamp the header already shows.
 *
 * Historical 2-minute points are never rewritten. If the live tip is invalid or older
 * than the series tip, the input series is returned unchanged.
 */
export function pinCryptoLive1DChartTip(
  points: readonly StockChartPoint[],
  liveSpotUsd: number | null | undefined,
  liveQuotedAtSec: number | null | undefined,
): StockChartPoint[] {
  if (!points.length) return [...points];
  if (liveSpotUsd == null || !Number.isFinite(liveSpotUsd) || liveSpotUsd <= 0) {
    return [...points];
  }
  if (
    liveQuotedAtSec == null ||
    !Number.isFinite(liveQuotedAtSec) ||
    liveQuotedAtSec <= 0
  ) {
    return [...points];
  }

  const tipTime = Math.floor(liveQuotedAtSec);
  const last = points[points.length - 1]!;
  // Never rewrite or insert behind history — that would move older candles.
  if (tipTime < last.time) {
    return [...points];
  }

  const tip: StockChartPoint = {
    time: tipTime,
    value: liveSpotUsd,
    timeZone: last.timeZone ?? "UTC",
  };

  if (last.time === tipTime) {
    return [...points.slice(0, -1), tip];
  }
  return [...points, tip];
}
