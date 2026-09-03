import type { IChartApi, Time } from "lightweight-charts";
import { isBusinessDay, isUTCTimestamp } from "lightweight-charts";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

import { nearestPointByChartX, nearestPointByTime } from "@/components/chart/chart-selection-nearest";

export { nearestPointByChartX, nearestPointByTime };

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

export function pointAtChartX(chart: IChartApi, points: StockChartPoint[], x: number): StockChartPoint | null {
  if (!points.length) return null;
  const t = chart.timeScale().coordinateToTime(x);
  const sec = horzTimeToUnixSeconds(t);
  if (sec != null) return nearestPointByTime(points, sec);

  return nearestPointByChartX(points, x, (time) => {
    const cx = chart.timeScale().timeToCoordinate(time as Time);
    if (cx == null || !Number.isFinite(Number(cx))) return null;
    return Number(cx);
  });
}
