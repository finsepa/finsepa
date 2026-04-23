import "server-only";

import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { STOCK_CHART_RANGES, type StockChartRange } from "@/lib/market/stock-chart-types";

export function isStockChartRange(v: string | null): v is StockChartRange {
  return v != null && (STOCK_CHART_RANGES as readonly string[]).includes(v);
}

export function rangeStartUnixSeconds(range: StockChartRange, now: Date): number | null {
  const nowSec = Math.floor(now.getTime() / 1000);
  if (range === "1D") return nowSec - 1 * 24 * 60 * 60;
  /**
   * Five **trading** sessions need up to ~7 calendar days; daily points use `YYYY-MM-DD` → midnight UTC,
   * so a naive `now - 5×24h` cut-off can sit *after* Mon/Tue mid-week and drop those bars (only Wed–Fri left).
   * Use a wider calendar window so the slice still includes the oldest of the last five sessions.
   */
  if (range === "5D") return nowSec - 10 * 24 * 60 * 60;
  if (range === "1M") return nowSec - 30 * 24 * 60 * 60;
  if (range === "6M") return nowSec - 183 * 24 * 60 * 60;
  if (range === "1Y") return nowSec - 365 * 24 * 60 * 60;
  if (range === "5Y") return nowSec - 5 * 365 * 24 * 60 * 60;
  if (range === "YTD") {
    const ytd = Date.UTC(now.getUTCFullYear(), 0, 1);
    return Math.floor(ytd / 1000);
  }
  return null;
}

function sliceFromNearestTradingPoint(points: Array<{ time: number; value: number }>, startSec: number | null) {
  if (startSec == null) return points;
  const idx = points.findIndex((p) => p.time >= startSec);
  return idx === -1 ? [] : points.slice(idx);
}

/**
 * Match `/api/stocks/[ticker]/chart` response `points` after loading raw EODHD-backed series.
 */
export function sliceStockChartPointsForRange(
  rawPoints: StockChartPoint[],
  range: StockChartRange,
  now: Date = new Date(),
): StockChartPoint[] {
  const startSec = rangeStartUnixSeconds(range, now);
  let points = sliceFromNearestTradingPoint(rawPoints, startSec);
  if ((range === "1D" || range === "5D") && points.length === 0 && rawPoints.length > 0) {
    points = rawPoints;
  }
  return points;
}
