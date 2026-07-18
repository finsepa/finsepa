"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { formatChartingTableCell } from "@/components/charting/charting-individual-company-table";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { SegmentedControl } from "@/components/design-system";
import { MULTICHART_BAR_WIDTH_WIDE_PX } from "@/components/stock/multichart-fundamentals-bar";
import {
  fundamentalsBarEnterProgress,
  prefersReducedFundamentalsBarMotion,
  runFundamentalsBarEnterAnimation,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import {
  buildFundamentalsYAxisTicks,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  formatFundamentalsAxisTickLabel,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  estimatesChartBarValues,
  isAnnualForecastPoint,
  sliceLatestAnnualEstimates,
  sliceLatestQuarterlyEstimates,
} from "@/lib/market/earnings-annual-display";
import {
  EARNINGS_FORECAST_BADGE_CLASS,
  EARNINGS_FORECAST_BAND_BG_STYLE,
  EARNINGS_FORECAST_BAND_EDGE_STYLE,
  EARNINGS_FORECAST_OPACITY_CLASS,
  earningsForecastBarFillStyle,
} from "@/components/stock/earnings-card-styles";
import { cn } from "@/lib/utils";
import {
  formatChartingPeriodAxisLabel,
  formatChartingPeriodLabel,
} from "@/lib/market/charting-period-display";
import type { ChartingMetricKind } from "@/lib/market/stock-charting-metrics";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import type { StockEarningsEstimatesChart, StockEarningsEstimatesPoint } from "@/lib/market/stock-earnings-types";

/** Reported bars are blue; estimates are grey; forecast keeps the grey hatch. */
const ACTUAL_BAR = "#2563EB";
const ESTIMATE_BAR = "#D4D4D8";
const FORECAST_BAR = "#A1A1AA";
const FORECAST_BAR_FILL = earningsForecastBarFillStyle(FORECAST_BAR);

const BEAT_COLOR = "#16A34A";
const MISS_COLOR = "#DC2626";

const BAR_WIDTH_QUARTERLY_PX = 11;
const BAR_WIDTH_ANNUAL_PX = 18;
const BAR_WIDTH_PAIR_QUARTERLY_PX = 9;
const BAR_WIDTH_PAIR_ANNUAL_PX = 14;
const BAR_GAP_PX = 3;
const BAR_HOVER_PAD_QUARTERLY_PX = 6;
const BAR_HOVER_PAD_ANNUAL_PX = 8;
const BEAT_MISS_ARROW_BORDER_X_PX = 5;
const BEAT_MISS_ARROW_BORDER_TOP_PX = 6;

function estimatesBarLayout(periodMode: FundamentalsSeriesMode): {
  barWidthPx: number;
  pairBarWidthPx: number;
  barHoverPadPx: number;
} {
  const annual = periodMode === "annual";
  return {
    barWidthPx: annual ? BAR_WIDTH_ANNUAL_PX : BAR_WIDTH_QUARTERLY_PX,
    pairBarWidthPx: annual ? BAR_WIDTH_PAIR_ANNUAL_PX : BAR_WIDTH_PAIR_QUARTERLY_PX,
    barHoverPadPx: annual ? BAR_HOVER_PAD_ANNUAL_PX : BAR_HOVER_PAD_QUARTERLY_PX,
  };
}

function earningsBeatMiss(
  estimate: number,
  actual: number,
): "beat" | "miss" | null {
  if (actual > estimate) return "beat";
  if (actual < estimate) return "miss";
  return null;
}

function formatBeatMissDeltaAmount(delta: number, axisKind: ChartingMetricKind): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "+";
  const abs = Math.abs(delta);
  if (axisKind === "eps") {
    return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${sign}${formatUsdCompact(abs)}`;
}

function formatBeatMissLabel(
  outcome: "beat" | "miss",
  estimate: number,
  actual: number,
  axisKind: ChartingMetricKind,
): string {
  const prefix = outcome === "beat" ? "Beat" : "Miss";
  return `${prefix} (${formatBeatMissDeltaAmount(actual - estimate, axisKind)})`;
}

function valueHeightPct(v: number | null, maxV: number): number {
  if (v == null || !Number.isFinite(v) || !Number.isFinite(maxV) || maxV <= 0) return 0;
  return (Math.max(0, v) / maxV) * 100;
}

function EarningsBeatMissIndicator({
  outcome,
  value,
  maxV,
  enterProgress,
}: {
  outcome: "beat" | "miss";
  value: number;
  maxV: number;
  enterProgress: number;
}) {
  const bottomPct = valueHeightPct(value, maxV) * enterProgress;
  if (bottomPct <= 0) return null;

  const color = outcome === "beat" ? BEAT_COLOR : MISS_COLOR;
  const gapAboveBarPx = 4;

  return (
    <div
      className="pointer-events-none absolute left-1/2 z-20 flex flex-col items-center"
      style={{
        bottom: `${bottomPct}%`,
        transform: `translateX(-50%) translateY(calc(-100% - ${gapAboveBarPx}px))`,
      }}
    >
      <span
        className="font-['Inter'] text-[13px] font-medium leading-none lowercase sm:text-[14px]"
        style={{ color }}
      >
        {outcome === "beat" ? "beat" : "miss"}
      </span>
      <span
        className="mt-1 block size-0"
        style={{
          borderLeft: `${BEAT_MISS_ARROW_BORDER_X_PX}px solid transparent`,
          borderRight: `${BEAT_MISS_ARROW_BORDER_X_PX}px solid transparent`,
          borderTop: `${BEAT_MISS_ARROW_BORDER_TOP_PX}px solid ${color}`,
        }}
        aria-hidden
      />
    </div>
  );
}

function EarningsPeriodBars({
  estimate,
  actual,
  isForecast,
  maxV,
  enterProgress,
  barWidthPx,
  pairBarWidthPx,
}: {
  estimate: number | null;
  actual: number | null;
  isForecast: boolean;
  maxV: number;
  enterProgress: number;
  barWidthPx: number;
  pairBarWidthPx: number;
}) {
  const showActual = !isForecast && actual != null && valueHeightPct(actual, maxV) > 0;
  const showEstimate = estimate != null && valueHeightPct(estimate, maxV) > 0;
  const pair = showActual && showEstimate;
  const widthPx = pair ? pairBarWidthPx : barWidthPx;

  if (!showActual && !showEstimate) return null;

  return (
    <div
      className="relative z-10 flex h-full min-h-0 items-end justify-center"
      style={{ gap: pair ? BAR_GAP_PX : 0, width: pair ? pairBarWidthPx * 2 + BAR_GAP_PX : barWidthPx }}
    >
      {showActual ? (
        <div
          className="mt-auto shrink-0 rounded-t-[4px] rounded-b-none"
          style={{
            width: widthPx,
            height: `${valueHeightPct(actual, maxV) * enterProgress}%`,
            minHeight: 2,
            backgroundColor: ACTUAL_BAR,
          }}
          aria-hidden
        />
      ) : null}
      {showEstimate ? (
        <div
          className="mt-auto shrink-0 overflow-hidden rounded-t-[4px] rounded-b-none"
          style={{
            width: widthPx,
            height: `${valueHeightPct(estimate, maxV) * enterProgress}%`,
            minHeight: 2,
            ...(isForecast ? FORECAST_BAR_FILL : { backgroundColor: ESTIMATE_BAR }),
          }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
const CHART_ZERO_BASELINE_BORDER = "rgba(228, 228, 231, 0.85)";
const AXIS_LABEL_ROTATE_DEG = -42;
const MULTICHART_AXIS_ROW_PX = 32;
const MULTICHART_AXIS_BOTTOM_PAD_PX = 10;
const Y_AXIS_W_PX = 50;

/** Match Key Stats revenue modal chart height on mobile. */
const CHART_HEIGHT_PX = 268;

export type EstimatesMetric = "revenue" | "eps";

const METRIC_CONFIG: Record<
  EstimatesMetric,
  {
    axisKind: "usd" | "eps";
    tooltipEstimate: string;
    tooltipReported: string;
    ariaLabel: string;
  }
> = {
  revenue: {
    axisKind: "usd",
    tooltipEstimate: "Est. Revenue",
    tooltipReported: "Rep. Revenue",
    ariaLabel: "Revenue estimates and reported",
  },
  eps: {
    axisKind: "eps",
    tooltipEstimate: "Est. EPS",
    tooltipReported: "Rep. EPS",
    ariaLabel: "EPS estimates and reported",
  },
};

type BarTooltipLineTone = "neutral" | "beat" | "miss";

type BarTooltipLine = {
  text: string;
  tone: BarTooltipLineTone;
};

function tooltipLineClass(tone: BarTooltipLineTone, isFirst: boolean): string {
  const base = isFirst
    ? "mt-1.5 max-w-[min(100vw-2rem,14rem)] truncate text-[12px] leading-4"
    : "mt-0.5 max-w-[min(100vw-2rem,14rem)] truncate text-[12px] leading-4";
  if (tone === "beat") return `${base} font-semibold text-[#16A34A]`;
  if (tone === "miss") return `${base} font-semibold text-[#DC2626]`;
  return `${base} font-normal text-[#0F0F0F]`;
}

type PeriodBar = {
  key: string;
  axisLabel: string;
  title: string;
  estimate: number | null;
  actual: number | null;
  isForecast: boolean;
};

function periodCenterLeftPercent(i: number, n: number): number {
  if (n <= 0) return 50;
  if (n === 1) return 50;
  return ((i + 0.5) / n) * 100;
}

function buildPeriodBars(
  points: StockEarningsEstimatesPoint[],
  periodMode: FundamentalsSeriesMode,
  metric: EstimatesMetric,
): PeriodBar[] {
  const sliced =
    periodMode === "annual" ? sliceLatestAnnualEstimates(points) : sliceLatestQuarterlyEstimates(points);
  return sliced.map((p) => {
    const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(p.sortKey) ? p.sortKey : null;
    const { estimate, actual } = estimatesChartBarValues(p, metric);
    return {
      key: p.sortKey,
      axisLabel: periodEnd ? formatChartingPeriodAxisLabel(periodEnd, periodMode) : p.label,
      title: periodEnd ? formatChartingPeriodLabel(periodEnd, periodMode) : p.label,
      estimate,
      actual,
      isForecast: isAnnualForecastPoint(p),
    };
  });
}

type BarTooltipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  lines: BarTooltipLine[];
};

function barTooltipFromEvent(
  e: MouseEvent<HTMLElement>,
  plotEl: HTMLElement,
  periodLabel: string,
  lines: BarTooltipLine[],
): BarTooltipState {
  const plot = plotEl.getBoundingClientRect();
  const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const focusX = col.left + col.width / 2 - plot.left;
  const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
    focusX,
    Math.max(1, Math.floor(plot.width)),
  );
  return { anchorX, y: e.clientY - plot.top, side, periodLabel, lines };
}

type EstimatesHeaderProps = {
  period: FundamentalsSeriesMode;
  onPeriodChange: (period: FundamentalsSeriesMode) => void;
  metric: EstimatesMetric;
  onMetricChange: (metric: EstimatesMetric) => void;
};

export function EarningsEstimatesHeader({
  period,
  onPeriodChange,
  metric,
  onMetricChange,
}: EstimatesHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <SegmentedControl
        aria-label="Estimate metric"
        options={[
          { value: "revenue", label: "Revenue" },
          { value: "eps", label: "EPS" },
        ]}
        value={metric}
        onChange={onMetricChange}
      />
      <SegmentedControl
        aria-label="Statement period"
        options={[
          { value: "annual", label: "Annual" },
          { value: "quarterly", label: "Quarterly" },
        ]}
        value={period}
        onChange={onPeriodChange}
      />
    </div>
  );
}

type Props = {
  data: StockEarningsEstimatesChart;
  period: FundamentalsSeriesMode;
  metric: EstimatesMetric;
};

/**
 * Revenue / EPS estimate bar chart — grey reported + estimate bars, hatched forecast bars,
 * plus beat/miss markers above the reported bar.
 */
export function EarningsEstimatesChart({ data, period, metric }: Props) {
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<BarTooltipState | null>(null);

  const metricConfig = METRIC_CONFIG[metric];

  const periods = useMemo(
    () =>
      buildPeriodBars(period === "annual" ? data.annual : data.quarterly, period, metric),
    [data, period, metric],
  );

  const barLayout = useMemo(() => estimatesBarLayout(period), [period]);

  const plotHeight = CHART_HEIGHT_PX - MULTICHART_AXIS_ROW_PX - MULTICHART_AXIS_BOTTOM_PAD_PX;

  const { maxV, yTicks } = useMemo(() => {
    let rawMax = 0;
    for (const p of periods) {
      if (p.estimate != null) rawMax = Math.max(rawMax, p.estimate);
      if (p.actual != null) rawMax = Math.max(rawMax, p.actual);
    }
    const tickValues = buildFundamentalsYAxisTicks(rawMax || 1, metricConfig.axisKind);
    const top = tickValues[0] ?? 1;
    return { maxV: top, yTicks: tickValues };
  }, [periods, metricConfig.axisKind]);

  const n = periods.length;
  /** Left edge (%) of the forecast band — from the first forecast column to the plot's right edge. */
  const forecastBandLeftPct = useMemo(() => {
    const firstForecast = periods.findIndex((p) => p.isForecast);
    if (firstForecast < 0 || n <= 0) return null;
    return (firstForecast / n) * 100;
  }, [periods, n]);
  const showChart = n > 0;
  const shouldAnimateBars = showChart && !prefersReducedFundamentalsBarMotion();
  const [barEnterElapsedMs, setBarEnterElapsedMs] = useState(() =>
    prefersReducedFundamentalsBarMotion() ? Number.POSITIVE_INFINITY : 0,
  );
  const [barsEnterComplete, setBarsEnterComplete] = useState(() => prefersReducedFundamentalsBarMotion());

  useEffect(() => {
    if (!showChart || prefersReducedFundamentalsBarMotion()) {
      setBarEnterElapsedMs(Number.POSITIVE_INFINITY);
      setBarsEnterComplete(true);
      return;
    }
    setBarEnterElapsedMs(0);
    setBarsEnterComplete(false);
    return runFundamentalsBarEnterAnimation({
      periodCount: n,
      onFrame: (elapsedMs) => setBarEnterElapsedMs(elapsedMs),
      onComplete: () => {
        setBarEnterElapsedMs(Number.POSITIVE_INFINITY);
        setBarsEnterComplete(true);
      },
    });
  }, [showChart, n, period, metric, data]);

  const clearHover = () => {
    setHoveredIndex(null);
    setTip(null);
  };

  return (
    <section className="w-full min-w-0 max-w-full overflow-x-clip overflow-y-visible">
      {showChart ? (
        <div className="w-full min-w-0">
          <div className="relative flex w-full min-w-0 flex-col overflow-visible" style={{ height: CHART_HEIGHT_PX }}>
            <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
              <div ref={plotAreaRef} className="relative min-h-0 min-w-0 flex-1" onPointerLeave={clearHover}>
                <div
                  className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%] z-0 bg-white"
                  aria-hidden
                >
                  <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
                  {forecastBandLeftPct != null ? (
                    <div
                      className="absolute inset-y-0 overflow-hidden"
                      style={{ left: `${forecastBandLeftPct}%`, right: 0 }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          ...EARNINGS_FORECAST_BAND_BG_STYLE,
                          ...EARNINGS_FORECAST_BAND_EDGE_STYLE,
                        }}
                      />
                      <span className={cn("absolute bottom-2 left-1/2 z-[1] -translate-x-1/2", EARNINGS_FORECAST_BADGE_CLASS)}>
                        Forecast
                      </span>
                    </div>
                  ) : null}
                  <div
                    className="absolute inset-x-0 bottom-0 border-t"
                    style={{ borderColor: CHART_ZERO_BASELINE_BORDER }}
                  />
                </div>

                {/* Bars + beat/miss markers (anchored just above the reported bar). */}
                <div
                  key={`${period}-${metric}-${n}`}
                  className="absolute inset-x-0 top-[8%] bottom-[4%] min-h-0 w-full min-w-0 overflow-visible"
                  role="img"
                  aria-label={metricConfig.ariaLabel}
                >
                {periods.map((p, i) => {
                  const leftPct = periodCenterLeftPercent(i, n);
                  const enterProgress = shouldAnimateBars
                    ? fundamentalsBarEnterProgress(i, n, barEnterElapsedMs)
                    : 1;
                  const beatMiss =
                    !p.isForecast && p.estimate != null && p.actual != null
                      ? earningsBeatMiss(p.estimate, p.actual)
                      : null;
                  const showActual = !p.isForecast && p.actual != null;
                  const showEstimate = p.estimate != null;
                  const pair = showActual && showEstimate;
                  const groupWidthPx = pair
                    ? barLayout.pairBarWidthPx * 2 + BAR_GAP_PX
                    : barLayout.barWidthPx;
                  const hitWidthPx = groupWidthPx + barLayout.barHoverPadPx * 2;
                  const tooltipLines: BarTooltipLine[] = [];
                  if (p.estimate != null) {
                    tooltipLines.push({
                      tone: "neutral",
                      text: `${metricConfig.tooltipEstimate}: ${formatChartingTableCell(metricConfig.axisKind, p.estimate)}`,
                    });
                  }
                  if (p.actual != null) {
                    tooltipLines.push({
                      tone: "neutral",
                      text: `${metricConfig.tooltipReported}: ${formatChartingTableCell(metricConfig.axisKind, p.actual)}`,
                    });
                  }
                  if (beatMiss && p.estimate != null && p.actual != null) {
                    tooltipLines.push({
                      tone: beatMiss,
                      text: formatBeatMissLabel(beatMiss, p.estimate, p.actual, metricConfig.axisKind),
                    });
                  }

                  return (
                    <div
                      key={p.key}
                      className="absolute bottom-0 z-0 flex h-full min-h-0 -translate-x-1/2 flex-col items-center justify-end"
                      style={{ left: `${leftPct}%`, width: hitWidthPx }}
                      onMouseEnter={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        setHoveredIndex(i);
                        setTip(barTooltipFromEvent(e, plot, p.title, tooltipLines));
                      }}
                      onMouseMove={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        setHoveredIndex(i);
                        setTip(barTooltipFromEvent(e, plot, p.title, tooltipLines));
                      }}
                    >
                      {hoveredIndex === i ? (
                        <div
                          className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-full -translate-x-1/2"
                          style={{
                            width: Math.max(hitWidthPx, MULTICHART_BAR_WIDTH_WIDE_PX),
                            backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG,
                          }}
                          aria-hidden
                        />
                      ) : null}
                      <div className="relative z-10 h-full min-h-0 overflow-visible" style={{ width: groupWidthPx }}>
                        {barsEnterComplete && beatMiss && p.actual != null ? (
                          <EarningsBeatMissIndicator
                            outcome={beatMiss}
                            value={p.actual}
                            maxV={maxV}
                            enterProgress={enterProgress}
                          />
                        ) : null}
                        <EarningsPeriodBars
                          estimate={p.estimate}
                          actual={p.actual}
                          isForecast={p.isForecast}
                          maxV={maxV}
                          enterProgress={enterProgress}
                          barWidthPx={barLayout.barWidthPx}
                          pairBarWidthPx={barLayout.pairBarWidthPx}
                        />
                      </div>
                    </div>
                  );
                })}
                </div>

                {tip ? (
                  <div
                    className={FUNDAMENTALS_CHART_TOOLTIP_CLASS}
                    style={{
                      left: `clamp(8px, ${tip.anchorX}px, calc(100% - 8px))`,
                      top: tip.y,
                      transform:
                        tip.side === "left"
                          ? "translate(calc(-100% - 10px), -50%)"
                          : "translate(10px, -50%)",
                    }}
                  >
                    {tip.side === "left" ? (
                      <span className="absolute top-1/2 left-full -translate-y-1/2" aria-hidden>
                        <span className="block border-y-[7px] border-y-transparent border-l-[8px] border-l-[#E4E4E7]" />
                        <span className="absolute top-1/2 left-px -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[7px] border-l-white" />
                      </span>
                    ) : (
                      <span className="absolute top-1/2 right-full -translate-y-1/2" aria-hidden>
                        <span className="block border-y-[7px] border-y-transparent border-r-[8px] border-r-[#E4E4E7]" />
                        <span className="absolute top-1/2 right-px -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[7px] border-r-white" />
                      </span>
                    )}
                    <p className="text-[12px] font-semibold leading-4 text-[#0F0F0F]">{tip.periodLabel}</p>
                    {tip.lines.map((line, i) => (
                      <p key={`${line.tone}-${line.text}`} className={tooltipLineClass(line.tone, i === 0)} title={line.text}>
                        {line.text}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>

              <div
                className="relative h-full shrink-0 pl-1.5 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
                style={{ width: Y_AXIS_W_PX }}
                aria-hidden
              >
                <div className="pointer-events-none absolute inset-0">
                  {yTicks.map((t, i) => {
                    const nt = yTicks.length;
                    const pct = nt <= 1 ? 0 : i / (nt - 1);
                    const insetSpan = 0.92;
                    return (
                      <span
                        key={i}
                        className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-0.5 py-px"
                        style={{ top: `${(PLOT_INSET_TOP_FRAC + pct * insetSpan) * 100}%` }}
                      >
                        {formatFundamentalsAxisTickLabel(metricConfig.axisKind, t)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex w-full min-w-0 overflow-visible" style={{ height: MULTICHART_AXIS_ROW_PX }}>
              <div className="relative mb-1 min-w-0 flex-1 px-0" style={{ height: MULTICHART_AXIS_ROW_PX }}>
                {periods.map((p, i) => {
                  const horizontalAxisLabels = period === "annual";
                  const axisLabelRotateDeg = horizontalAxisLabels ? 0 : AXIS_LABEL_ROTATE_DEG;
                  return (
                    <div
                      key={`axis-${p.key}`}
                      className={cn(
                        "absolute flex max-w-[min(100%,4.5rem)] -translate-x-1/2 justify-center overflow-visible",
                        horizontalAxisLabels ? "top-1.5" : "bottom-0.5",
                      )}
                      style={{ left: `${periodCenterLeftPercent(i, n)}%` }}
                      title={p.title}
                    >
                      <span
                        className={cn(
                          "inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]",
                          p.isForecast && EARNINGS_FORECAST_OPACITY_CLASS,
                        )}
                        style={{
                          transform: axisLabelRotateDeg === 0 ? undefined : `rotate(${axisLabelRotateDeg}deg)`,
                          transformOrigin: horizontalAxisLabels ? undefined : "center bottom",
                        }}
                      >
                        {p.axisLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="shrink-0 pl-1.5" style={{ width: Y_AXIS_W_PX }} aria-hidden />
            </div>
            <div className="shrink-0" style={{ height: MULTICHART_AXIS_BOTTOM_PAD_PX }} aria-hidden />
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
          style={{ height: CHART_HEIGHT_PX }}
        >
          No estimate data for this view.
        </div>
      )}
    </section>
  );
}
