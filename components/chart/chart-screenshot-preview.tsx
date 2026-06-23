"use client";

import { forwardRef, useMemo } from "react";
import { ChartingWorkspace } from "@/components/charting/charting-workspace";
import { PriceChart } from "@/components/chart/PriceChart";
import { ChartScreenshotAssetHeader } from "@/components/chart/chart-screenshot-asset-header";
import {
  MultichartFundamentalsBar,
  KEY_STATS_SCREENSHOT_PERIOD_MARGINS,
} from "@/components/stock/multichart-fundamentals-bar";
import {
  CHART_SCREENSHOT_CONTENT_SCALE,
  CHART_SCREENSHOT_FRAME_PADDING_PX,
  CHART_SCREENSHOT_HEADER_CHART_GAP_PX,
  CHART_SCREENSHOT_HEIGHT_PX,
  CHART_SCREENSHOT_WIDTH_PX,
  chartScreenshotChartAreaSize,
  chartScreenshotChartBlockHeightPx,
  chartScreenshotContentBoxSize,
  chartScreenshotPreviewDisplayScale,
} from "@/lib/chart/chart-screenshot-constants";
import type { ChartScreenshotExportOptions } from "@/lib/chart/chart-screenshot-export-options";
import type { ChartScreenshotSnapshot } from "@/lib/chart/chart-screenshot-types";
import { stockOverviewSeriesLabel } from "@/lib/chart/chart-screenshot-types";
import { chartingMetricsToParam } from "@/lib/market/stock-charting-metrics";
import { APP_MODAL_SHELL_SHADOW_CLASS } from "@/components/ui/app-modal-shell";
import { cn } from "@/lib/utils";

type ChartScreenshotPreviewProps = {
  snapshot: ChartScreenshotSnapshot;
  /** Auto scale to fit the preview pane at 100% zoom. */
  fitScale: number;
  /** User zoom 0–200% — preview display only. */
  previewZoomPercent: number;
  exportOptions: ChartScreenshotExportOptions;
};

export const ChartScreenshotPreview = forwardRef<HTMLDivElement, ChartScreenshotPreviewProps>(
  function ChartScreenshotPreview({ snapshot, fitScale, previewZoomPercent, exportOptions }, ref) {
    const previewScale = chartScreenshotPreviewDisplayScale(fitScale, previewZoomPercent);
    const contentBox = useMemo(() => chartScreenshotContentBoxSize(), []);
    const chartArea = useMemo(() => chartScreenshotChartAreaSize(), []);
    const chartBlockHeightPx = useMemo(() => chartScreenshotChartBlockHeightPx(), []);
    const contentLogicalWidth = chartArea.width / CHART_SCREENSHOT_CONTENT_SCALE;
    const isKeyStatsMetric = snapshot.variant === "keyStatsMetric" && snapshot.keyStatsMetric;
    const isStockOverview = snapshot.variant === "stockOverview" && snapshot.stockOverview;
    const keyStatsPreviewDisplayOptions = useMemo(() => {
      if (!snapshot.keyStatsMetric) return null;
      return {
        ...snapshot.keyStatsMetric.displayOptions,
        showBarValues: exportOptions.showValues,
        showAvgLine: exportOptions.showAvgLine ?? snapshot.keyStatsMetric.displayOptions.showAvgLine,
        showMaxLine: exportOptions.showMaxLine ?? snapshot.keyStatsMetric.displayOptions.showMaxLine,
        showMinLine: exportOptions.showMinLine ?? snapshot.keyStatsMetric.displayOptions.showMinLine,
      };
    }, [
      snapshot.keyStatsMetric,
      exportOptions.showValues,
      exportOptions.showAvgLine,
      exportOptions.showMaxLine,
      exportOptions.showMinLine,
    ]);

    /** Preview card grows/shrinks with zoom — 100% = fit-to-pane size. */
    const frameWidth = CHART_SCREENSHOT_WIDTH_PX * previewScale;
    const frameHeight = CHART_SCREENSHOT_HEIGHT_PX * previewScale;

    return (
      <div
        className="mx-auto shrink-0"
        style={{ width: frameWidth, height: frameHeight }}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white",
            APP_MODAL_SHELL_SHADOW_CLASS,
          )}
          style={{
            width: frameWidth,
            height: frameHeight,
          }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: CHART_SCREENSHOT_WIDTH_PX,
              height: CHART_SCREENSHOT_HEIGHT_PX,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
            }}
          >
            <div
              ref={ref}
              data-chart-screenshot-export-root
              className="pointer-events-none box-border flex select-none flex-col overflow-hidden bg-white"
              style={{
                width: CHART_SCREENSHOT_WIDTH_PX,
                height: CHART_SCREENSHOT_HEIGHT_PX,
                padding: CHART_SCREENSHOT_FRAME_PADDING_PX,
              }}
            >
              <ChartScreenshotAssetHeader
                ticker={snapshot.ticker}
                companyName={snapshot.companyName}
                logoUrl={snapshot.logoUrl}
                metricTitle={
                  isKeyStatsMetric
                    ? snapshot.keyStatsMetric!.metricLabel
                    : isStockOverview
                      ? stockOverviewSeriesLabel(snapshot.stockOverview!.series)
                      : null
                }
              />
              <div
                className={cn(
                  "flex min-h-0 flex-1",
                  isKeyStatsMetric || isStockOverview
                    ? "items-stretch overflow-visible"
                    : "items-center justify-center overflow-hidden",
                )}
                style={{
                  marginTop: CHART_SCREENSHOT_HEADER_CHART_GAP_PX,
                  width: contentBox.width,
                  height: chartArea.height,
                }}
              >
                <div
                  className="[&_*]:!animate-none [&_*]:!transition-none"
                  style={
                    isKeyStatsMetric || isStockOverview
                      ? { width: "100%", minWidth: 0 }
                      : {
                          width: contentLogicalWidth,
                          transform: `scale(${CHART_SCREENSHOT_CONTENT_SCALE})`,
                          transformOrigin: "center center",
                        }
                  }
                >
                  {isKeyStatsMetric && keyStatsPreviewDisplayOptions ? (
                    <MultichartFundamentalsBar
                      metricId={snapshot.keyStatsMetric!.metricId}
                      points={snapshot.fullPoints}
                      height={chartBlockHeightPx}
                      periodMode={snapshot.periodMode}
                      visual={snapshot.keyStatsMetric!.chartVisual}
                      maxBars={snapshot.keyStatsMetric!.maxBars}
                      barWidthPx={snapshot.keyStatsMetric!.barWidthPx}
                      compactHorizontalLayout
                      displayOptions={keyStatsPreviewDisplayOptions}
                      animateBarsOnAppear={false}
                      horizontalPeriodAxisLabels={snapshot.keyStatsMetric!.horizontalPeriodAxisLabels}
                      periodPlotMargins={KEY_STATS_SCREENSHOT_PERIOD_MARGINS}
                      screenshotExportMode
                    />
                  ) : isStockOverview ? (
                    <PriceChart
                      kind="stock"
                      symbol={snapshot.ticker}
                      range={snapshot.stockOverview!.range}
                      series={snapshot.stockOverview!.series}
                      height={chartArea.height}
                      initialChart={{
                        range: snapshot.stockOverview!.range,
                        points: snapshot.stockOverview!.points,
                      }}
                      screenshotPreviewMode
                      screenshotChartBlockHeightPx={chartArea.height}
                      screenshotDisplayOptions={{
                        showVerticalLegend: exportOptions.showVerticalLegend,
                        showHorizontalLegend: exportOptions.showHorizontalLegend,
                        showRangeBadges: exportOptions.showValues,
                      }}
                    />
                  ) : (
                  <ChartingWorkspace
                    ticker={snapshot.ticker}
                    metricParam={chartingMetricsToParam(snapshot.selectedMetrics)}
                    initialAnnualPoints={
                      snapshot.periodMode === "annual" ? snapshot.fullPoints : undefined
                    }
                    initialQuarterlyPoints={
                      snapshot.periodMode === "quarterly" ? snapshot.fullPoints : undefined
                    }
                    metricControlsPlacement="legend"
                    omitTickerInLegend
                    histogramLayout="stockFullWidthFixedBars"
                    animateBarsOnAppear={false}
                    screenshotPreviewMode
                    screenshotDisplayOptions={exportOptions}
                    screenshotChartBlockHeightPx={chartBlockHeightPx}
                    previewLockedState={{
                      periodMode: snapshot.periodMode,
                      timeRange: snapshot.timeRange,
                      chartType: snapshot.chartType,
                      selectedMetrics: snapshot.selectedMetrics,
                    }}
                  />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
