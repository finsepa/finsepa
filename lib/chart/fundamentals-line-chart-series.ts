import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  chartingPeriodSortYear,
  isChartingTtmPeriodEnd,
  parseChartingPeriodEndUtc,
} from "@/lib/market/charting-period-display";
import { applyFundamentalsChartTimeRange } from "@/lib/market/fundamentals-chart-time-range";
import type { FundamentalsChartTimeRange } from "@/lib/market/fundamentals-chart-time-range";
import { FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS } from "@/lib/market/fundamentals-history-limit";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import { readChartingMetricValue } from "@/lib/market/stock-charting-metrics";

const LINE_SUBSAMPLE_MONTHS = new Set([2, 5, 8, 11]);

function periodEndUtcMonth(periodEnd: string): number | null {
  const d = parseChartingPeriodEndUtc(periodEnd);
  return d ? d.getUTCMonth() + 1 : null;
}

function isFebMayAugNov(periodEnd: string): boolean {
  const m = periodEndUtcMonth(periodEnd);
  return m != null && LINE_SUBSAMPLE_MONTHS.has(m);
}

/** Spread each quarter across its three calendar months (same metric value) for denser 5Y lines. */
function expandQuarterlyPointsToMonthlyRows(points: ChartingSeriesPoint[]): ChartingSeriesPoint[] {
  const byEnd = new Map<string, ChartingSeriesPoint>();
  for (const p of points) {
    const d = parseChartingPeriodEndUtc(p.periodEnd);
    if (!d) {
      byEnd.set(p.periodEnd, p);
      continue;
    }
    const endMonth = d.getUTCMonth();
    for (let offset = 2; offset >= 0; offset -= 1) {
      const monthIndex = endMonth - offset;
      const anchor = new Date(Date.UTC(d.getUTCFullYear(), monthIndex + 1, 0));
      const periodEnd = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}-${String(anchor.getUTCDate()).padStart(2, "0")}`;
      if (!byEnd.has(periodEnd)) {
        byEnd.set(periodEnd, { ...p, periodEnd });
      }
    }
  }
  return [...byEnd.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

function yearLabelStep(timeRange: FundamentalsChartTimeRange): number {
  if (timeRange === "5Y") return 1;
  if (timeRange === "10Y") return 2;
  return 5;
}

function lineChartEarliestCalendarYear(periodEnds: readonly string[]): number | null {
  let min = Infinity;
  for (const pe of periodEnds) {
    const y = Number(chartingPeriodSortYear(pe));
    if (Number.isFinite(y)) min = Math.min(min, y);
  }
  return Number.isFinite(min) ? min : null;
}

/** Line charts: 5Y window on 5Y selector; full 10Y on 10Y selector (bars unchanged). */
function lineChartDataTimeRange(timeRange: FundamentalsChartTimeRange): FundamentalsChartTimeRange {
  if (timeRange === "all") return "all";
  return timeRange;
}

/** Charting tab line mode — 3Y / 5Y / 10Y / All (matches bar range toggles). */
export type ChartingFundamentalsLineTimeRange = "3Y" | "5Y" | "10Y" | "all";

const CHARTING_LINE_QUARTERLY_PERIODS: Record<ChartingFundamentalsLineTimeRange, number> = {
  "3Y": 12,
  "5Y": 20,
  "10Y": 40,
  all: FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS,
};

/** Line charts on Charting tab — same ranges as bar mode toggles. */
export function filterPointsForChartingFundamentalsLineChart(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  timeRange: ChartingFundamentalsLineTimeRange,
): ChartingSeriesPoint[] {
  if (timeRange === "3Y") {
    const sliced = points.slice(-CHARTING_LINE_QUARTERLY_PERIODS["3Y"]);
    const withMetric = sliced.filter((p) => {
      if (isChartingTtmPeriodEnd(p.periodEnd)) return false;
      return readChartingMetricValue(p, metricId) != null;
    });
    return expandQuarterlyPointsToMonthlyRows(withMetric);
  }
  return filterPointsForFundamentalsLineChart(points, metricId, "quarterly", timeRange);
}

/** Line charts on Key Stats modal — subsample fiscal rows (bars unchanged). */
export function filterPointsForFundamentalsLineChart(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  periodMode: FundamentalsSeriesMode,
  timeRange: FundamentalsChartTimeRange,
): ChartingSeriesPoint[] {
  const ranged = applyFundamentalsChartTimeRange(
    points,
    periodMode,
    lineChartDataTimeRange(timeRange),
  );
  const withMetric = ranged.filter((p) => {
    if (isChartingTtmPeriodEnd(p.periodEnd)) return false;
    return readChartingMetricValue(p, metricId) != null;
  });

  if (timeRange === "5Y") {
    if (periodMode === "quarterly") {
      return expandQuarterlyPointsToMonthlyRows(withMetric);
    }
    return withMetric;
  }

  if (periodMode === "quarterly") {
    const subsampled = withMetric.filter((p) => isFebMayAugNov(p.periodEnd));
    return subsampled.length > 0 ? subsampled : withMetric;
  }

  return withMetric;
}

/** X-axis year labels for line mode (empty string = hide tick). */
export function formatFundamentalsLineChartAxisLabel(
  periodEnd: string,
  index: number,
  periodEnds: readonly string[],
  timeRange: FundamentalsChartTimeRange | "3Y",
): string {
  const axisRange: FundamentalsChartTimeRange = timeRange === "3Y" ? "5Y" : timeRange;
  if (isChartingTtmPeriodEnd(periodEnd)) return "";
  const year = chartingPeriodSortYear(periodEnd);
  if (!year) return "";
  const y = Number(year);
  if (!Number.isFinite(y)) return "";

  const firstIndexForYear = periodEnds.findIndex((pe) => chartingPeriodSortYear(pe) === year);
  if (firstIndexForYear !== index) return "";

  if (timeRange === "10Y") {
    // yCharts 10Y — even calendar years only (2018, 2020, 2022, …).
    if (y % 2 !== 0) return "";
    return year;
  }

  const firstYearRaw = chartingPeriodSortYear(periodEnds[0] ?? periodEnd);
  const firstYear = Number(firstYearRaw);
  if (!Number.isFinite(firstYear)) return year;

  const step = yearLabelStep(axisRange);
  if ((y - firstYear) % step !== 0) return "";

  if (axisRange === "5Y") {
    const earliest = lineChartEarliestCalendarYear(periodEnds);
    if (earliest != null && y === earliest) return "";
  }

  return year;
}
