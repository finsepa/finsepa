import type { StockChartPoint } from "@/lib/market/stock-chart-types";

const DAY_SEC = 86_400;
const DAILY_GAP_MIN_SEC = 20 * 3600;

function typicalBarGapSec(points: readonly StockChartPoint[]): number | null {
  const gaps: number[] = [];
  for (let i = points.length - 1; i > 0 && gaps.length < 12; i--) {
    const g = points[i]!.time - points[i - 1]!.time;
    if (g > 0) gaps.push(g);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)]!;
}

function utcYmd(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

/**
 * Crypto 5D…ALL: end the line at the header's live price. The still-open bar takes the live
 * value; once that bar has closed, a new bar (today's UTC day for dailies) is appended.
 */
export function pinCryptoRangeTipToLive(
  points: StockChartPoint[],
  live: number | null | undefined,
  nowSec: number,
): { points: StockChartPoint[]; appended: boolean } {
  if (live == null || !Number.isFinite(live) || live <= 0 || points.length < 2) {
    return { points, appended: false };
  }
  const last = points[points.length - 1]!;
  const gap = typicalBarGapSec(points);
  if (gap == null || !Number.isFinite(last.value)) return { points, appended: false };

  if (nowSec - last.time < gap) {
    if (last.value === live) return { points, appended: false };
    return { points: [...points.slice(0, -1), { ...last, value: live }], appended: false };
  }

  const daily = gap >= DAILY_GAP_MIN_SEC;
  const time = daily ? Math.floor(nowSec / DAY_SEC) * DAY_SEC : Math.floor(nowSec / gap) * gap;
  if (time <= last.time) {
    return { points: [...points.slice(0, -1), { ...last, value: live }], appended: false };
  }
  const tip: StockChartPoint = { ...last, time, value: live };
  if (last.sessionDate != null) tip.sessionDate = utcYmd(time);
  return { points: [...points, tip], appended: true };
}
