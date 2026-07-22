"use client";

import { forwardRef, useMemo } from "react";
import { ChartingWorkspace } from "@/components/charting/charting-workspace";
import { PriceChart } from "@/components/chart/PriceChart";
import {
  CHART_SCREENSHOT_CONTENT_SCALE,
  CHART_SCREENSHOT_FRAME_PADDING_PX,
  CHART_SCREENSHOT_HEADER_CHART_GAP_PX,
  chartScreenshotChartAreaSize,
  chartScreenshotChartBlockHeightPx,
  chartScreenshotContentBoxSize,
  chartScreenshotFrameSize,
  chartScreenshotPreviewDisplayScale,
} from "@/lib/chart/chart-screenshot-constants";
import { ChartScreenshotAssetHeader } from "@/components/chart/chart-screenshot-asset-header";
import { PortfolioAllocationScreenshotContent } from "@/components/portfolio/portfolio-allocation-screenshot-content";
import {
  MultichartFundamentalsBar,
  KEY_STATS_SCREENSHOT_PERIOD_MARGINS,
} from "@/components/stock/multichart-fundamentals-bar";
import type { ChartScreenshotExportOptions } from "@/lib/chart/chart-screenshot-export-options";
import type { ChartScreenshotSnapshot } from "@/lib/chart/chart-screenshot-types";
import { stockOverviewSeriesLabel } from "@/lib/chart/chart-screenshot-types";
import {
  ALLOCATION_RETURN_PERIOD_DEFAULT,
  type AllocationReturnPeriodId,
} from "@/lib/portfolio/allocation-return-period";
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
    const isKeyStatsMetric = snapshot.variant === "keyStatsMetric" && snapshot.keyStatsMetric;
    const isStockOverview = snapshot.variant === "stockOverview" && snapshot.stockOverview;
    const isPortfolioAllocation =
      snapshot.variant === "portfolioAllocation" && snapshot.portfolioAllocation;
    const frameSize = useMemo(
      () => chartScreenshotFrameSize(snapshot.variant),
      [snapshot.variant],
    );
    const contentBox = useMemo(
      () => chartScreenshotContentBoxSize(frameSize.height),
      [frameSize.height],
    );
    const chartArea = useMemo(() => chartScreenshotChartAreaSize(), []);
    const chartBlockHeightPx = useMemo(() => chartScreenshotChartBlockHeightPx(), []);
    const contentLogicalWidth = chartArea.width / CHART_SCREENSHOT_CONTENT_SCALE;
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
    const frameWidth = frameSize.width * previewScale;
    const frameHeight = frameSize.height * previewScale;

    return (
      <div
        className="mx-auto shrink-0"
        style={{ width: frameWidth, height: frameHeight }}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-2xl border border-[#E4E4E7]",
            isPortfolioAllocation ? "bg-[#FAFAFA]" : "bg-white",
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
              width: frameSize.width,
              height: frameSize.height,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
            }}
          >
            <div
              ref={ref}
              data-chart-screenshot-export-root
              data-chart-screenshot-width={frameSize.width}
              data-chart-screenshot-height={frameSize.height}
              className={cn(
                "pointer-events-none box-border flex select-none flex-col overflow-hidden",
                isPortfolioAllocation ? "bg-[#FAFAFA]" : "bg-white",
              )}
              style={{
                width: frameSize.width,
                height: frameSize.height,
                padding: isPortfolioAllocation ? 16 : CHART_SCREENSHOT_FRAME_PADDING_PX,
              }}
            >
              {isPortfolioAllocation ? null : (
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
              )}
              <div
                className={cn(
                  "flex min-h-0",
                  isPortfolioAllocation
                    ? "flex-1 items-center justify-center overflow-visible"
                    : isKeyStatsMetric || isStockOverview
                      ? "min-h-0 flex-1 items-stretch overflow-visible"
                      : "min-h-0 flex-1 items-center justify-center overflow-hidden",
                )}
                style={{
                  marginTop: isPortfolioAllocation ? 0 : CHART_SCREENSHOT_HEADER_CHART_GAP_PX,
                  width: isPortfolioAllocation
                    ? frameSize.width - 32
                    : contentBox.width,
                  height: isPortfolioAllocation ? undefined : chartArea.height,
                }}
              >
                <div
                  className="[&_*]:!animate-none [&_*]:!transition-none"
                  style={
                    isPortfolioAllocation
                      ? { width: "100%", minWidth: 0, alignSelf: "stretch" }
                      : isKeyStatsMetric || isStockOverview
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
                      lineTimeRange={snapshot.keyStatsMetric!.lineTimeRange}
                      periodPlotMargins={KEY_STATS_SCREENSHOT_PERIOD_MARGINS}
                      screenshotExportMode
                      showBrandWatermark
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
                  ) : isPortfolioAllocation ? (
                    <PortfolioAllocationScreenshotContent
                      rows={snapshot.portfolioAllocation!.rows}
                      portfolioName={snapshot.portfolioAllocation!.portfolioName}
                      portfolioLogoUrl={snapshot.portfolioAllocation!.portfolioLogoUrl}
                      avatarImageSrc={snapshot.portfolioAllocation!.avatarImageSrc}
                      avatarInitials={snapshot.portfolioAllocation!.avatarInitials}
                      returnPct={snapshot.portfolioAllocation!.returnPct ?? null}
                      returnPeriod={
                        (snapshot.portfolioAllocation!.returnPeriod as AllocationReturnPeriodId | undefined) ??
                        ALLOCATION_RETURN_PERIOD_DEFAULT
                      }
                      showSliceLabels={exportOptions.showAllocationSliceLabels ?? true}
                      showLegend={exportOptions.showAllocationLegend ?? true}
                      showLegendValues={exportOptions.showValues}
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
