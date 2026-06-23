import type { ChartScreenshotSnapshot } from "@/lib/chart/chart-screenshot-types";

export type ChartScreenshotExportOptions = {
  showValues: boolean;
  showVerticalLegend: boolean;
  showHorizontalLegend: boolean;
  showAvgLine?: boolean;
  showMaxLine?: boolean;
  showMinLine?: boolean;
};

export const DEFAULT_CHART_SCREENSHOT_EXPORT_OPTIONS: ChartScreenshotExportOptions = {
  showValues: true,
  showVerticalLegend: true,
  showHorizontalLegend: true,
};

export function chartScreenshotExportOptionsForSnapshot(
  snapshot: ChartScreenshotSnapshot,
): ChartScreenshotExportOptions {
  if (snapshot.variant === "keyStatsMetric" && snapshot.keyStatsMetric) {
    const display = snapshot.keyStatsMetric.displayOptions;
    return {
      showValues: display.showBarValues,
      showVerticalLegend: true,
      showHorizontalLegend: false,
      showAvgLine: display.showAvgLine,
      showMaxLine: display.showMaxLine,
      showMinLine: display.showMinLine,
    };
  }
  if (snapshot.variant === "stockOverview") {
    return DEFAULT_CHART_SCREENSHOT_EXPORT_OPTIONS;
  }
  return DEFAULT_CHART_SCREENSHOT_EXPORT_OPTIONS;
}
