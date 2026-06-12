import type { ChartTimeRange, ChartType } from "@/components/charting/charting-workspace";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";

export type ChartScreenshotSnapshot = {
  ticker: string;
  companyName?: string | null;
  logoUrl?: string | null;
  periodMode: "annual" | "quarterly";
  timeRange: ChartTimeRange;
  chartType: ChartType;
  selectedMetrics: ChartingMetricId[];
  /** Full loaded series for the active period mode (before time-range slice). */
  fullPoints: ChartingSeriesPoint[];
};
