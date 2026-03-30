import type { IChartApi, Time } from "lightweight-charts";
import { isBusinessDay, isUTCTimestamp } from "lightweight-charts";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

/** Map horizontal scale time from coordinateToTime to unix seconds for nearest-bar lookup. */
export function horzTimeToUnixSeconds(t: Time | null): number | null {
  if (t == null) return null;
  if (isUTCTimestamp(t)) return t;
  if (isBusinessDay(t)) {
    return Math.floor(Date.UTC(t.year, t.month - 1, t.day) / 1000);
  }
  if (typeof t === "string") {
    const ms = Date.parse(t.includes("T") ? t : `${t}T12:00:00.000Z`);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  return null;
}

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

export function pointAtChartX(chart: IChartApi, points: StockChartPoint[], x: number): StockChartPoint | null {
  const t = chart.timeScale().coordinateToTime(x);
  const sec = horzTimeToUnixSeconds(t);
  if (sec == null) return null;
  return nearestPointByTime(points, sec);
}
