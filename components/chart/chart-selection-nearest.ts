import type { StockChartPoint } from "@/lib/market/stock-chart-types";

export function nearestPointByTime(points: StockChartPoint[], unixSec: number): StockChartPoint | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.time < unixSec) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const cur = points[i]!;
  const prev = i > 0 ? points[i - 1]! : null;
  if (!prev) return cur;
  return Math.abs(cur.time - unixSec) <= Math.abs(prev.time - unixSec) ? cur : prev;
}

/** Nearest bar by pixel distance when `coordinateToTime` has no hit (sparse 5Y/ALL). */
export function nearestPointByChartX(
  points: StockChartPoint[],
  x: number,
  timeToX: (time: number) => number | null,
): StockChartPoint | null {
  let best: StockChartPoint | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.time)) continue;
    const cx = timeToX(p.time);
    if (cx == null || !Number.isFinite(cx)) continue;
    const d = Math.abs(cx - x);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}
