import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { FundamentalsChartTimeRange } from "@/lib/market/fundamentals-chart-time-range";
import { maxPeriodsForFundamentalsChartTimeRange } from "@/lib/market/fundamentals-chart-time-range";
import {
  MULTICHART_BAR_WIDTH_ALL_QUARTERLY_PX,
  MULTICHART_BAR_WIDTH_DENSE_QUARTERLY_PX,
  MULTICHART_BAR_WIDTH_EXTRA_WIDE_PX,
  MULTICHART_BAR_WIDTH_WIDE_PX,
  MULTICHART_MAX_ANNUAL_BARS,
  MULTICHART_MAX_QUARTERLY_BARS,
} from "@/components/stock/multichart-fundamentals-bar";
import type { ChartingFundamentalsLineTimeRange } from "@/lib/chart/fundamentals-line-chart-series";

export type FundamentalsLineCompatibleChartTimeRange =
  | "1Y"
  | "2Y"
  | "3Y"
  | "5Y"
  | "10Y"
  | "all";

export function chartingFundamentalsLineTimeRange(
  range: FundamentalsLineCompatibleChartTimeRange,
): ChartingFundamentalsLineTimeRange {
  if (range === "3Y" || range === "5Y" || range === "10Y" || range === "all") return range;
  return "3Y";
}

export function maxBarsForFundamentalsLineChart(
  mode: FundamentalsSeriesMode,
  timeRange: FundamentalsChartTimeRange | ChartingFundamentalsLineTimeRange,
): number {
  const platformCap =
    mode === "quarterly" ? MULTICHART_MAX_QUARTERLY_BARS : MULTICHART_MAX_ANNUAL_BARS;
  if (timeRange === "3Y") return Math.min(platformCap, 12);
  const rangeCap = maxPeriodsForFundamentalsChartTimeRange(
    mode,
    timeRange as FundamentalsChartTimeRange,
  );
  return Math.min(platformCap, rangeCap);
}

export function barWidthPxForFundamentalsLineChart(
  timeRange: FundamentalsChartTimeRange | ChartingFundamentalsLineTimeRange,
): number {
  const denseQuarterlyBars =
    timeRange === "3Y" || timeRange === "5Y" || timeRange === "10Y";
  if (timeRange === "all") return MULTICHART_BAR_WIDTH_ALL_QUARTERLY_PX;
  if (denseQuarterlyBars) return MULTICHART_BAR_WIDTH_DENSE_QUARTERLY_PX;
  if (timeRange === "10Y") return MULTICHART_BAR_WIDTH_WIDE_PX;
  return MULTICHART_BAR_WIDTH_EXTRA_WIDE_PX;
}
