import type { ChartTimeRange, ChartType } from "@/components/charting/charting-workspace";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import type { FundamentalsChartDisplayOptions } from "@/lib/chart/fundamentals-chart-display-options";
import type { FundamentalsChartTimeRange } from "@/lib/market/fundamentals-chart-time-range";
import type { MultichartVisual } from "@/components/stock/multichart-fundamentals-bar";
import type { PeriodPlotEdgeMargin } from "@/components/stock/multichart-fundamentals-bar";
import type { StockChartRange, StockChartPoint, StockChartSeries } from "@/lib/market/stock-chart-types";

export type ChartScreenshotSnapshotVariant = "charting" | "keyStatsMetric" | "stockOverview";

export type StockOverviewScreenshotConfig = {
  range: StockChartRange;
  series: StockChartSeries;
  points: StockChartPoint[];
};

export function stockOverviewSeriesLabel(series: StockChartSeries): string {
  if (series === "marketCap") return "Market cap";
  if (series === "return") return "Return";
  return "Price";
}

export function stockOverviewExportMetricSlug(
  series: StockChartSeries,
  range: StockChartRange,
): string {
  const seriesSlug = series === "marketCap" ? "market-cap" : series;
  return `${seriesSlug}-${range.toLowerCase()}`;
}

export type KeyStatsMetricScreenshotConfig = {
  metricId: ChartingMetricId;
  metricLabel: string;
  chartVisual: MultichartVisual;
  timeRange: FundamentalsChartTimeRange;
  displayOptions: FundamentalsChartDisplayOptions;
  maxBars: number;
  barWidthPx: number;
  denseQuarterlyBars: boolean;
  horizontalPeriodAxisLabels: boolean;
  periodPlotMargins?: PeriodPlotEdgeMargin;
  lineTimeRange?: FundamentalsChartTimeRange;
};

export type ChartScreenshotSnapshot = {
  variant?: ChartScreenshotSnapshotVariant;
  ticker: string;
  companyName?: string | null;
  logoUrl?: string | null;
  periodMode: "annual" | "quarterly";
  timeRange: ChartTimeRange;
  chartType: ChartType;
  selectedMetrics: ChartingMetricId[];
  /** Full loaded series for the active period mode (before time-range slice). */
  fullPoints: ChartingSeriesPoint[];
  /** Key Stats metric modal — single-metric Multichart export. */
  keyStatsMetric?: KeyStatsMetricScreenshotConfig;
  /** Stock overview — Price / market cap / return line chart export. */
  stockOverview?: StockOverviewScreenshotConfig;
};
