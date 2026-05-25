"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";

import { formatChartingTableCell } from "@/components/charting/charting-individual-company-table";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { SegmentedControl } from "@/components/design-system";
import { MULTICHART_BAR_WIDTH_WIDE_PX } from "@/components/stock/multichart-fundamentals-bar";
import {
  fundamentalsBarHistogramDisplayAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import {
  buildFundamentalsYAxisTicks,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  formatFundamentalsAxisTickLabel,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  EARNINGS_FORECAST_LABEL_COLOR,
  isAnnualForecastPoint,
  sliceLatestAnnualEstimates,
  sliceLatestQuarterlyEstimates,
} from "@/lib/market/earnings-annual-display";
import { cn } from "@/lib/utils";
import {
  formatChartingPeriodAxisLabel,
  formatChartingPeriodLabel,
} from "@/lib/market/charting-period-display";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockEarningsEstimatesChart, StockEarningsEstimatesPoint } from "@/lib/market/stock-earnings-types";

const REPORTED_BAR = fundamentalsBarSolidAtIndex(0);
const ESTIMATE_BAR = fundamentalsBarHistogramDisplayAtIndex(0);

const PAIR_BAR_WIDTH_QUARTERLY_PX = 11;
const PAIR_BAR_GAP_QUARTERLY_PX = 3;
const BAR_HOVER_PAD_QUARTERLY_PX = 6;

/** Wider paired bars for sparse annual columns (~5Y + forward). */
const PAIR_BAR_WIDTH_ANNUAL_PX = 22;
const PAIR_BAR_GAP_ANNUAL_PX = 5;
const BAR_HOVER_PAD_ANNUAL_PX = 8;

function estimatesBarLayout(periodMode: FundamentalsSeriesMode): {
  pairBarWidthPx: number;
  pairBarGapPx: number;
  barHoverPadPx: number;
  barHitWidthPx: number;
} {
  const pairBarWidthPx =
    periodMode === "annual" ? PAIR_BAR_WIDTH_ANNUAL_PX : PAIR_BAR_WIDTH_QUARTERLY_PX;
  const pairBarGapPx = periodMode === "annual" ? PAIR_BAR_GAP_ANNUAL_PX : PAIR_BAR_GAP_QUARTERLY_PX;
  const barHoverPadPx = periodMode === "annual" ? BAR_HOVER_PAD_ANNUAL_PX : BAR_HOVER_PAD_QUARTERLY_PX;
  const barHitWidthPx = pairBarWidthPx * 2 + pairBarGapPx + barHoverPadPx * 2;
  return { pairBarWidthPx, pairBarGapPx, barHoverPadPx, barHitWidthPx };
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
  { axisKind: "usd" | "eps"; legendEstimate: string; legendReported: string; ariaLabel: string }
> = {
  revenue: {
    axisKind: "usd",
    legendEstimate: "Estimated Revenue",
    legendReported: "Reported Revenue",
    ariaLabel: "Revenue estimates and reported",
  },
  eps: {
    axisKind: "eps",
    legendEstimate: "Estimated EPS",
    legendReported: "Reported EPS",
    ariaLabel: "EPS estimates and reported",
  },
};

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
    const estimate =
      metric === "revenue"
        ? p.revenueEstimateUsd != null && Number.isFinite(p.revenueEstimateUsd)
          ? p.revenueEstimateUsd
          : null
        : p.epsEstimate != null && Number.isFinite(p.epsEstimate)
          ? p.epsEstimate
          : null;
    const actual =
      metric === "revenue"
        ? p.revenueActualUsd != null && Number.isFinite(p.revenueActualUsd)
          ? p.revenueActualUsd
          : null
        : p.epsActual != null && Number.isFinite(p.epsActual)
          ? p.epsActual
          : null;
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
  valueLines: string[];
};

function barTooltipFromEvent(
  e: MouseEvent<HTMLElement>,
  plotEl: HTMLElement,
  periodLabel: string,
  valueLines: string[],
): BarTooltipState {
  const plot = plotEl.getBoundingClientRect();
  const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const focusX = col.left + col.width / 2 - plot.left;
  const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
    focusX,
    Math.max(1, Math.floor(plot.width)),
  );
  return { anchorX, y: e.clientY - plot.top, side, periodLabel, valueLines };
}

type EstimatesHeaderProps = {
  period: FundamentalsSeriesMode;
  onPeriodChange: (period: FundamentalsSeriesMode) => void;
  metric: EstimatesMetric;
  onMetricChange: (metric: EstimatesMetric) => void;
};

export function EarningsEstimatesHeader({ period, onPeriodChange, metric, onMetricChange }: EstimatesHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Estimates</h2>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <SegmentedControl
          aria-label="Statement period"
          options={[
            { value: "annual", label: "Annual" },
            { value: "quarterly", label: "Quarterly" },
          ]}
          value={period}
          onChange={onPeriodChange}
        />
        <SegmentedControl
          aria-label="Estimate metric"
          options={[
            { value: "revenue", label: "Revenue" },
            { value: "eps", label: "EPS" },
          ]}
          value={metric}
          onChange={onMetricChange}
        />
      </div>
    </div>
  );
}

type Props = {
  data: StockEarningsEstimatesChart;
  period: FundamentalsSeriesMode;
  metric: EstimatesMetric;
};

/**
 * Revenue / EPS estimate bar chart — same DOM layout as Key Stats {@link MultichartFundamentalsBar},
 * with a translucent bar per period for consensus estimates alongside reported actuals.
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
  const showChart = n > 0;

  const clearHover = () => {
    setHoveredIndex(null);
    setTip(null);
  };

  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden">
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
                  <div
                    className="absolute inset-x-0 bottom-0 border-t"
                    style={{ borderColor: CHART_ZERO_BASELINE_BORDER }}
                  />
                </div>

                {/* Bars live in the same inset band as the $0 baseline (Multicharts). */}
                <div
                  className="absolute inset-x-0 top-[8%] bottom-[4%] min-h-0 w-full min-w-0"
                  role="img"
                  aria-label={metricConfig.ariaLabel}
                >
                {periods.map((p, i) => {
                  const leftPct = periodCenterLeftPercent(i, n);
                  const estH =
                    p.estimate != null && maxV > 0 ? (Math.max(0, p.estimate) / maxV) * 100 : 0;
                  const actH = p.actual != null && maxV > 0 ? (Math.max(0, p.actual) / maxV) * 100 : 0;
                  const valueLines: string[] = [];
                  if (p.estimate != null) {
                    valueLines.push(
                      `${metricConfig.legendEstimate}: ${formatChartingTableCell(metricConfig.axisKind, p.estimate)}`,
                    );
                  }
                  if (p.actual != null) {
                    valueLines.push(
                      `${metricConfig.legendReported}: ${formatChartingTableCell(metricConfig.axisKind, p.actual)}`,
                    );
                  }

                  return (
                    <div
                      key={p.key}
                      className="absolute bottom-0 z-0 flex h-full min-h-0 -translate-x-1/2 flex-col items-center justify-end"
                      style={{ left: `${leftPct}%`, width: barLayout.barHitWidthPx }}
                      onMouseEnter={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        setHoveredIndex(i);
                        setTip(barTooltipFromEvent(e, plot, p.title, valueLines));
                      }}
                      onMouseMove={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        setHoveredIndex(i);
                        setTip(barTooltipFromEvent(e, plot, p.title, valueLines));
                      }}
                    >
                      {hoveredIndex === i ? (
                        <div
                          className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-full -translate-x-1/2"
                          style={{
                            width: Math.max(barLayout.barHitWidthPx, MULTICHART_BAR_WIDTH_WIDE_PX),
                            backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG,
                          }}
                          aria-hidden
                        />
                      ) : null}
                      <div
                        className="relative z-10 flex h-full min-h-0 items-end justify-center pb-0"
                        style={{ gap: barLayout.pairBarGapPx }}
                      >
                        {p.estimate != null ? (
                          <div
                            className="mt-auto shrink-0 rounded-t-[2px] rounded-b-none"
                            style={{
                              width: barLayout.pairBarWidthPx,
                              height: `${estH}%`,
                              minHeight: estH > 0 ? 2 : 0,
                              backgroundColor: ESTIMATE_BAR,
                            }}
                          />
                        ) : null}
                        {p.actual != null ? (
                          <div
                            className="mt-auto shrink-0 rounded-t-[2px] rounded-b-none"
                            style={{
                              width: barLayout.pairBarWidthPx,
                              height: `${actH}%`,
                              minHeight: actH > 0 ? 2 : 0,
                              backgroundColor: REPORTED_BAR,
                            }}
                          />
                        ) : null}
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
                    <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{tip.periodLabel}</p>
                    {tip.valueLines.map((line, i) => (
                      <p
                        key={line}
                        className={
                          i === 0
                            ? "mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4 text-[#09090B]"
                            : "mt-0.5 whitespace-nowrap text-[12px] font-normal leading-4 text-[#09090B]"
                        }
                      >
                        {line}
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
                {periods.map((p, i) => (
                  <div
                    key={`axis-${p.key}`}
                    className="absolute bottom-0.5 flex max-w-[min(100%,4.5rem)] -translate-x-1/2 justify-center overflow-visible"
                    style={{ left: `${periodCenterLeftPercent(i, n)}%` }}
                    title={p.title}
                  >
                    <span
                      className={cn(
                        "inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none sm:text-[12px]",
                        p.isForecast ? "font-medium" : "text-[#71717A]",
                      )}
                      style={{
                        transform: `rotate(${AXIS_LABEL_ROTATE_DEG}deg)`,
                        transformOrigin: "center bottom",
                        color: p.isForecast ? EARNINGS_FORECAST_LABEL_COLOR : undefined,
                      }}
                    >
                      {p.axisLabel}
                    </span>
                  </div>
                ))}
              </div>
              <div className="shrink-0 pl-1.5" style={{ width: Y_AXIS_W_PX }} aria-hidden />
            </div>
            <div className="shrink-0" style={{ height: MULTICHART_AXIS_BOTTOM_PAD_PX }} aria-hidden />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ESTIMATE_BAR }} />
              <span className="text-[13px] leading-5 text-[#71717A]">{metricConfig.legendEstimate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: REPORTED_BAR }} />
              <span className="text-[13px] leading-5 text-[#71717A]">{metricConfig.legendReported}</span>
            </div>
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
