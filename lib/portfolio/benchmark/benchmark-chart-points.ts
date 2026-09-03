import type { StockChartPoint } from "@/lib/market/stock-chart-types";

export function sortBenchmarkChartPoints(
  raw: readonly StockChartPoint[],
): StockChartPoint[] {
  return [...raw]
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);
}

/** Last mark with `time <= ts` (intraday overlay). */
export function lastBenchmarkValueOnOrBeforeTime(
  sorted: readonly StockChartPoint[],
  ts: number,
): number | null {
  if (!Number.isFinite(ts) || sorted.length === 0) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.time <= ts) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < 0) return null;
  const v = sorted[ans]!.value;
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Keep daily EOD before the intraday window (cash-flow replay) and replace the
 * visible window with asset-style intraday marks so 1D/5D/1M overlays are not daily steps.
 */
export function mergeEodWithIntradayBenchmarkPoints(
  eod: readonly StockChartPoint[],
  intraday: readonly StockChartPoint[],
): StockChartPoint[] {
  const intra = sortBenchmarkChartPoints(intraday);
  const daily = sortBenchmarkChartPoints(eod);
  if (intra.length === 0) return daily;
  if (daily.length === 0) return intra;
  const firstIntra = intra[0]!.time;
  const priorEod = daily.filter((p) => p.time < firstIntra);
  return sortBenchmarkChartPoints([...priorEod, ...intra]);
}
