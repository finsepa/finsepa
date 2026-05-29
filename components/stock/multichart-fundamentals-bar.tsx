"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  type ChartingMetricKind,
} from "@/lib/market/stock-charting-metrics";
import {
  isFinancialsExtraChartingMetricId,
  readFinancialsExtraChartingMetricValue,
} from "@/lib/market/stock-charting-metrics-financials-ext";
import { formatBarChartDataLabel, formatChartingTableCell } from "@/components/charting/charting-individual-company-table";
import type { FundamentalsChartDisplayOptions } from "@/lib/chart/fundamentals-chart-display-options";
import { DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS } from "@/lib/chart/fundamentals-chart-display-options";
import {
  FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX,
  FUNDAMENTALS_CHART_REFERENCE_BADGE_CLASS,
  type FundamentalsChartReferenceKind,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  formatChartingPeriodAxisLabel,
  formatChartingPeriodLabel,
  fundamentalsPeriodAxisShowsLabel,
} from "@/lib/market/charting-period-display";
import {
  formatPercentMetric,
  formatRatio,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { smoothAreaPathD, smoothLinePathD } from "@/lib/chart/smooth-line-path";
import {
  fundamentalsBarColorAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import {
  FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS,
  FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS,
} from "@/lib/market/fundamentals-history-limit";

/** Default bar width (px); extra horizontal space becomes even gaps between columns. */
export const MULTICHART_BAR_WIDTH_PX = 14;

/** Wider bars for sparse ranges (e.g. Key Stats 10Y). */
export const MULTICHART_BAR_WIDTH_WIDE_PX = MULTICHART_BAR_WIDTH_PX * 2;

/** Extra-wide bars for very few columns (Key Stats 1Y–5Y). */
export const MULTICHART_BAR_WIDTH_EXTRA_WIDE_PX = MULTICHART_BAR_WIDTH_WIDE_PX * 2;

/** 5Y / 10Y quarterly — many columns; keep bars narrower than {@link MULTICHART_BAR_WIDTH_WIDE_PX}. */
export const MULTICHART_BAR_WIDTH_DENSE_QUARTERLY_PX = 16;

/** All + quarterly — dense columns; thinner than default so bars do not touch. */
export const MULTICHART_BAR_WIDTH_ALL_QUARTERLY_PX = 10;

/** Right column for Y-axis tick labels; `pl-*` gaps tick text from the plot / grid strokes. */
const MULTICHART_Y_AXIS_W_PX = 50;
const MULTICHART_Y_AXIS_W_COMPACT_PX = 42;

export type PeriodPlotEdgeMargin = { left: number; right: number };

/** Center of period `i` in `n` equal columns (`inset` = half-column fraction; 0.5 = default). */
function periodCenterX(i: number, n: number, w: number, inset: number): number {
  if (n <= 0) return 0;
  if (n === 1) return w / 2;
  return ((i + inset) / n) * w;
}

function periodCenterXWithMargins(
  i: number,
  n: number,
  w: number,
  margins: PeriodPlotEdgeMargin,
): number {
  if (n <= 0) return 0;
  if (n === 1) return w / 2;
  const x0 = margins.left * w;
  const x1 = w - margins.right * w;
  return x0 + ((x1 - x0) * i) / (n - 1);
}

function periodCenterLeftPercent(i: number, n: number, inset: number): number {
  if (n <= 0) return 50;
  if (n === 1) return 50;
  return ((i + inset) / n) * 100;
}

function periodCenterLeftPercentWithMargins(
  i: number,
  n: number,
  margins: PeriodPlotEdgeMargin,
): number {
  if (n <= 0) return 50;
  if (n === 1) return 50;
  const x0 = margins.left * 100;
  const x1 = 100 - margins.right * 100;
  return x0 + ((x1 - x0) * i) / (n - 1);
}

function resolvePeriodCenterX(
  i: number,
  n: number,
  w: number,
  inset: number,
  margins?: PeriodPlotEdgeMargin,
): number {
  return margins ? periodCenterXWithMargins(i, n, w, margins) : periodCenterX(i, n, w, inset);
}

function resolvePeriodCenterLeftPercent(
  i: number,
  n: number,
  inset: number,
  margins?: PeriodPlotEdgeMargin,
): number {
  return margins
    ? periodCenterLeftPercentWithMargins(i, n, margins)
    : periodCenterLeftPercent(i, n, inset);
}

/** Insets (% of plot height): top breathing room; bottom gap above x-axis labels. */
const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;

/** Bottom row for period labels (px) — room for {@link AXIS_LABEL_ROTATE_DEG}-rotated text. */
const MULTICHART_AXIS_ROW_PX = 32;

/** Padding below slanted x-axis labels. */
const MULTICHART_AXIS_BOTTOM_PAD_PX = 10;

/** Slanted x-axis ticks (deg) — saves horizontal space in narrow Multichart cards. */
const AXIS_LABEL_ROTATE_DEG = -42;

/** Latest fiscal periods to show — both modes span **20 years** (annual = 20 points, quarterly = 80). */
export const MULTICHART_MAX_ANNUAL_BARS = FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS;
export const MULTICHART_MAX_QUARTERLY_BARS = FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS;

/** Hover halo behind the active line point (not a full-height column). */
const HOVER_DOT_HALO_BG = "rgba(59, 130, 246, 0.14)";
const HOVER_DOT_HALO_RADIUS_PX = 14;
/** Vertical guide from hovered dot down to the period label row. */
const LINE_HOVER_CROSSHAIR_CLASS = "border-l border-dashed border-[#2563EB]";

/** Area fill under line — matches portfolio overview `AreaSeries` (top 22% → bottom 2%). */
const LINE_AREA_GRADIENT_TOP_OPACITY = 0.22;
const LINE_AREA_GRADIENT_BOTTOM_OPACITY = 0.02;

/** Matches portfolio overview Value `AreaSeries` (`lineWidth: 2`, `LineType.Curved`). */
export const MULTICHART_LINE_STROKE_WIDTH_PX = 2;

/** $0 baseline only — same as overview price chart scale edge. */
const CHART_ZERO_BASELINE_BORDER = "rgba(228, 228, 231, 0.85)";

/** Reuse Earnings (Estimates) crosshair-to-tooltip layout — `anchorX` in px, relative to plot (left) edge. */
function computeTooltipHorizontalPlacement(
  focusX: number,
  containerWidthPx: number,
): { anchorX: number; side: "left" | "right" } {
  const pad = 8;
  const gap = 10;
  const estW = Math.min(280, Math.max(140, containerWidthPx - 2 * pad));

  if (focusX - gap - estW >= pad) {
    return { anchorX: focusX, side: "left" };
  }

  let anchorX = focusX;
  if (anchorX + gap + estW > containerWidthPx - pad) {
    anchorX = containerWidthPx - pad - gap - estW;
  }
  anchorX = Math.max(pad, anchorX);
  return { anchorX, side: "right" };
}

export function readChartingMetricValue(row: ChartingSeriesPoint, id: ChartingMetricId): number | null {
  if (isFinancialsExtraChartingMetricId(id)) {
    return readFinancialsExtraChartingMetricValue(row, id);
  }
  const k = CHARTING_METRIC_FIELD[id];
  const v = row[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Last `n` annual rows with a value for `metricId`, oldest → newest. */
export function sliceLastAnnualWithMetric(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  n: number,
): ChartingSeriesPoint[] {
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const withVal = sorted.filter((r) => readChartingMetricValue(r, metricId) != null);
  return withVal.slice(-n);
}

/** Tooltip values — two decimal places in K/M/B/T (e.g. `$258.24B`). */
function formatTooltipValue(kind: ChartingMetricKind, p: number): string {
  return formatChartingTableCell(kind, p);
}

function formatAxisValue(kind: ChartingMetricKind, p: number): string {
  if (!Number.isFinite(p)) return "";
  switch (kind) {
    case "usd": {
      const abs = Math.abs(p);
      if (abs < 1e-9) return "$0";
      const neg = p < 0 ? "-" : "";
      if (abs >= 1e9) return `${neg}$${Math.round(abs / 1e9)}B`;
      if (abs >= 1e6) return `${neg}$${Math.round(abs / 1e6)}M`;
      if (abs >= 1e3) return `${neg}$${Math.round(abs / 1e3)}K`;
      return `${neg}$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    }
    case "eps":
      return formatUsdPrice(p);
    case "percent":
      return formatPercentMetric(p);
    case "multiple":
    case "ratio":
      return formatRatio(p);
    default:
      return formatUsdCompact(p);
  }
}

function niceCeilPositive(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const f = n / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

/** Smallest `c * 10^exp` with `c` from a compact ladder and `c * 10^exp >= step`. */
const NICE_STEP_FACTORS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

function niceCeilStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1;
  const exp = Math.floor(Math.log10(step));
  const base = 10 ** exp;
  const f = step / base;
  for (const c of NICE_STEP_FACTORS) {
    if (c >= f) return c * base;
  }
  return 10 * base;
}

/** Caps for P/E and other multiples — avoids `niceCeilPositive` jumping ~215 → 500. */
const MULTIPLE_RATIO_AXIS_MAX_LADDER = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000] as const;

function axisMaxForMultiplesAndRatios(rawMax: number): number {
  const padded = rawMax <= 0 ? 1 : rawMax * 1.08;
  const naive = niceCeilPositive(rawMax);
  if (naive > 300 && rawMax <= 250) return 300;
  for (const cap of MULTIPLE_RATIO_AXIS_MAX_LADDER) {
    if (cap >= padded) return cap;
  }
  return naive;
}

/**
 * Y-axis max for exactly 5 ticks (4 equal bands from 0).
 * USD / shares: tighter headroom than {@link niceCeilPositive} alone (e.g. ~$240B vs $500B for ~$215B).
 */
function axisMaxForFiveTicks(rawMax: number, kind: ChartingMetricKind): number {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return 1;
  if (kind === "usd" || kind === "shares") {
    const padded = rawMax * 1.04;
    const step = niceCeilStep(padded / 4);
    return step * 4;
  }
  if (kind === "multiple" || kind === "ratio") {
    return axisMaxForMultiplesAndRatios(rawMax);
  }
  return niceCeilPositive(rawMax);
}

export type MultichartVisual = "bar" | "line";

type Props = {
  metricId: ChartingMetricId;
  points: ChartingSeriesPoint[];
  height?: number;
  periodMode?: FundamentalsSeriesMode;
  /** Bar columns (default) or connected line over the same series. */
  visual?: MultichartVisual;
  /** Override default 20 annual / 80 quarterly bar cap (e.g. mobile Key Stats modal: 10 years). */
  maxBars?: number;
  /** Bar column width in px (default {@link MULTICHART_BAR_WIDTH_PX}). */
  barWidthPx?: number;
  /** Tighter plot + y-axis horizontal gutters (Key Stats 1Y–10Y). */
  compactHorizontalLayout?: boolean;
  /**
   * Horizontal center of each period as a fraction of one column (0.5 = default).
   * Lower values pull first/last points toward the plot edges (Key Stats “All”).
   */
  periodCenterInset?: number;
  /** Asymmetric plot edge gaps as a fraction of plot width (overrides inset when set). */
  periodPlotMargins?: PeriodPlotEdgeMargin;
  /** Avg / max / min guides and bar value labels. */
  displayOptions?: FundamentalsChartDisplayOptions;
};

function plotValueTopPercent(v: number, maxV: number, kind: ChartingMetricKind): number {
  const top = PLOT_INSET_TOP_FRAC * 100;
  const bottom = PLOT_INSET_BOTTOM_FRAC * 100;
  const span = 100 - top - bottom;
  const plotV = kind === "percent" ? v : Math.max(0, v);
  const frac = maxV > 0 ? Math.min(1, Math.max(0, plotV / maxV)) : 0;
  return top + span * (1 - frac);
}

const REFERENCE_BADGE_PREFIX: Record<FundamentalsChartReferenceKind, string> = {
  max: "Max",
  min: "Min",
  avg: "Avg.",
};

function formatReferenceBadgeLabel(
  kind: FundamentalsChartReferenceKind,
  metricId: ChartingMetricId,
  value: number,
): string {
  return `${REFERENCE_BADGE_PREFIX[kind]} ${formatBarChartDataLabel(metricId, value)}`;
}

function FundamentalsReferenceLine({
  topPercent,
  kind,
  badgeLabel,
}: {
  topPercent: number;
  kind: FundamentalsChartReferenceKind;
  badgeLabel: string;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 z-[4] border-t border-dashed border-[#A1A1AA]"
        style={{ top: `${topPercent}%` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-2 z-[5] max-w-[min(55%,12rem)] -translate-y-1/2"
        style={{ top: `${topPercent}%` }}
        title={badgeLabel}
      >
        <span className={FUNDAMENTALS_CHART_REFERENCE_BADGE_CLASS[kind]}>{badgeLabel}</span>
      </div>
    </>
  );
}

/** Matches Charting workspace bar value labels ({@link charting-workspace.tsx}). */
const BAR_VALUE_LABEL_CLASS =
  "pointer-events-none absolute z-[15] max-w-[5.5rem] truncate text-center text-[11px] font-semibold leading-none tabular-nums text-[#09090B]";

const BAR_VALUE_LABEL_TEXT_SHADOW =
  "0 0 3px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.8)";

function barValueLabelTopStyle(hPct: number): string {
  const innerFrac = 1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC;
  const barTopFrac = PLOT_INSET_TOP_FRAC + innerFrac * (1 - Math.min(100, Math.max(0, hPct)) / 100);
  const minTopPx = FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX + 4;
  return `max(${minTopPx}px, calc(${barTopFrac * 100}% - 4px))`;
}

type BarTooltipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  valueLine: string;
};

function barTooltipStateFromEvent(
  e: MouseEvent<HTMLElement>,
  plotEl: HTMLElement,
  periodLabel: string,
  valueLine: string,
): BarTooltipState {
  const plot = plotEl.getBoundingClientRect();
  const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const focusX = col.left + col.width / 2 - plot.left;
  const { anchorX, side } = computeTooltipHorizontalPlacement(
    focusX,
    Math.max(1, Math.floor(plot.width)),
  );
  return { anchorX, y: e.clientY - plot.top, side, periodLabel, valueLine };
}

export function MultichartFundamentalsBar({
  metricId,
  points,
  height = 196,
  periodMode = "annual",
  visual = "bar",
  maxBars: maxBarsProp,
  barWidthPx = MULTICHART_BAR_WIDTH_PX,
  compactHorizontalLayout = false,
  periodCenterInset = 0.5,
  periodPlotMargins,
  displayOptions: displayOptionsProp,
}: Props) {
  const display = displayOptionsProp ?? DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS;
  const tightYAxis = compactHorizontalLayout || periodPlotMargins != null;
  const yAxisWidthPx = tightYAxis ? MULTICHART_Y_AXIS_W_COMPACT_PX : MULTICHART_Y_AXIS_W_PX;
  const yAxisPlClass = periodPlotMargins
    ? "pl-0 pr-3"
    : compactHorizontalLayout
      ? "pl-1.5"
      : "pl-3";
  const yAxisLabelPadClass = compactHorizontalLayout ? "px-0.5" : "px-1";
  const barHoverPadPx =
    barWidthPx <= MULTICHART_BAR_WIDTH_ALL_QUARTERLY_PX ? 3 : 6;
  const barHitWidthPx = barWidthPx + barHoverPadPx * 2;
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<BarTooltipState | null>(null);

  const kind = CHARTING_METRIC_KIND[metricId];
  const maxBars =
    maxBarsProp ??
    (periodMode === "quarterly" ? MULTICHART_MAX_QUARTERLY_BARS : MULTICHART_MAX_ANNUAL_BARS);
  const rows = useMemo(
    () => sliceLastAnnualWithMetric(points, metricId, maxBars),
    [points, metricId, maxBars],
  );

  const plotHeight = height - MULTICHART_AXIS_ROW_PX - MULTICHART_AXIS_BOTTOM_PAD_PX;

  const { values, labels, axisLabels, maxV, yTicks } = useMemo(() => {
    const vals: number[] = [];
    const labs: string[] = [];
    const axisLabs: string[] = [];
    for (const r of rows) {
      const v = readChartingMetricValue(r, metricId);
      if (v == null) continue;
      vals.push(v);
      labs.push(formatChartingPeriodLabel(r.periodEnd, periodMode));
      axisLabs.push(formatChartingPeriodAxisLabel(r.periodEnd, periodMode));
    }
    const rawMax = vals.length ? Math.max(...vals.map((x) => Math.abs(x))) : 0;
    const top = axisMaxForFiveTicks(rawMax || 1, kind);
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => (top * (tickCount - 1 - i)) / (tickCount - 1));
    return { values: vals, labels: labs, axisLabels: axisLabs, maxV: top, yTicks: ticks };
  }, [rows, metricId, periodMode, kind]);

  const referenceLevels = useMemo(() => {
    if (values.length === 0 || maxV <= 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [values, maxV]);

  const metricLabel = CHARTING_METRIC_LABEL[metricId];
  /** One metric × many periods — bars share the primary palette color (not per-period cycling). */
  const seriesBarColor = fundamentalsBarSolidAtIndex(0);
  const linePlotRef = useRef<HTMLDivElement>(null);
  const [linePlotPx, setLinePlotPx] = useState({ w: 0, h: 0 });
  const lineAreaGradientId = useId();
  const lineAreaGradientTop = fundamentalsBarColorAtIndex(0, LINE_AREA_GRADIENT_TOP_OPACITY);
  const lineAreaGradientBottom = fundamentalsBarColorAtIndex(0, LINE_AREA_GRADIENT_BOTTOM_OPACITY);

  useLayoutEffect(() => {
    if (visual !== "line") return;
    const el = linePlotRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setLinePlotPx({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visual, values.length, height, plotHeight]);

  const lineSvg = useMemo(() => {
    const w = linePlotPx.w;
    const h = linePlotPx.h;
    const n = values.length;
    if (n === 0 || w <= 0 || h <= 0) {
      return {
        d: "",
        areaD: "",
        gradY0: 0,
        gradY1: 0,
        pts: [] as { x: number; y: number; v: number; i: number }[],
      };
    }
    const padT = h * PLOT_INSET_TOP_FRAC;
    const padB = h * PLOT_INSET_BOTTOM_FRAC;
    const innerH = Math.max(1, h - padT - padB);
    /** Plot bottom — matches $0 baseline on the inset band. */
    const areaFloorY = h;
    // Match bar x-axis grid: each period label is centered in 1/n of the plot width.
    const pts = values.map((v, i) => {
      const x = resolvePeriodCenterX(i, n, w, periodCenterInset, periodPlotMargins);
      const frac = maxV > 0 ? Math.max(0, v) / maxV : 0;
      const y = padT + innerH * (1 - frac);
      return { x, y, v, i };
    });
    const curvePts = pts.map((p) => ({ x: p.x, y: p.y }));
    const d = smoothLinePathD(curvePts);
    const areaD = smoothAreaPathD(curvePts, areaFloorY);
    return { d, areaD, gradY0: padT, gradY1: areaFloorY, pts };
  }, [linePlotPx.h, linePlotPx.w, values, maxV, periodCenterInset, periodPlotMargins]);

  if (rows.length === 0 || values.length === 0) {
    return (
      <div className="w-full">
        <div
          className="flex h-[196px] items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
          aria-hidden
        >
          No data
        </div>
      </div>
    );
  }

  const n = values.length;

  const clearChartHover = () => {
    setHoveredIndex(null);
    setTip(null);
  };

  const hoveredLinePt =
    visual === "line" && hoveredIndex != null ? lineSvg.pts[hoveredIndex] : undefined;
  const lineHoverCrosshair =
    hoveredLinePt != null
      ? {
          left: hoveredLinePt.x,
          top: plotHeight * PLOT_INSET_TOP_FRAC,
          height: plotHeight * (1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC),
        }
      : null;

  return (
    <div ref={wrapRef} className="w-full min-w-0 max-w-full overflow-visible">
      <div className="relative flex w-full min-w-0 max-w-full flex-col overflow-visible" style={{ height }}>
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
          <div
            ref={plotAreaRef}
            className="relative min-h-0 min-w-0 flex-1"
            onPointerLeave={clearChartHover}
          >
            {/* Dot grid + single $0 baseline (no other horizontal rules). */}
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
            {lineHoverCrosshair ? (
              <div
                aria-hidden
                className={`pointer-events-none absolute z-[1] w-0 ${LINE_HOVER_CROSSHAIR_CLASS}`}
                style={{
                  left: lineHoverCrosshair.left,
                  top: lineHoverCrosshair.top,
                  height: lineHoverCrosshair.height,
                }}
              />
            ) : null}
            {display.showAvgLine && referenceLevels ? (
              <FundamentalsReferenceLine
                kind="avg"
                topPercent={plotValueTopPercent(referenceLevels.avg, maxV, kind)}
                badgeLabel={formatReferenceBadgeLabel("avg", metricId, referenceLevels.avg)}
              />
            ) : null}
            {display.showMaxLine && referenceLevels ? (
              <FundamentalsReferenceLine
                kind="max"
                topPercent={plotValueTopPercent(referenceLevels.max, maxV, kind)}
                badgeLabel={formatReferenceBadgeLabel("max", metricId, referenceLevels.max)}
              />
            ) : null}
            {display.showMinLine && referenceLevels ? (
              <FundamentalsReferenceLine
                kind="min"
                topPercent={plotValueTopPercent(referenceLevels.min, maxV, kind)}
                badgeLabel={formatReferenceBadgeLabel("min", metricId, referenceLevels.min)}
              />
            ) : null}
            {visual === "line" ? (
              <div
                ref={linePlotRef}
                className="absolute inset-x-0 top-[8%] bottom-[4%] z-0 min-h-0 w-full min-w-0"
                role="img"
                aria-label={`${metricLabel} line chart`}
              >
                {lineSvg.d ? (
                  <svg
                    width={linePlotPx.w}
                    height={linePlotPx.h}
                    className="relative z-[2] block overflow-visible"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient
                        id={lineAreaGradientId}
                        x1="0"
                        y1={lineSvg.gradY0}
                        x2="0"
                        y2={lineSvg.gradY1}
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop offset="0" stopColor={lineAreaGradientTop} />
                        <stop offset="1" stopColor={lineAreaGradientBottom} />
                      </linearGradient>
                    </defs>
                    {lineSvg.areaD ? (
                      <path d={lineSvg.areaD} fill={`url(#${lineAreaGradientId})`} />
                    ) : null}
                    <path
                      d={lineSvg.d}
                      fill="none"
                      stroke={seriesBarColor}
                      strokeWidth={MULTICHART_LINE_STROKE_WIDTH_PX}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {hoveredIndex != null && lineSvg.pts[hoveredIndex] ? (
                      <circle
                        cx={lineSvg.pts[hoveredIndex]!.x}
                        cy={lineSvg.pts[hoveredIndex]!.y}
                        r={HOVER_DOT_HALO_RADIUS_PX}
                        fill={HOVER_DOT_HALO_BG}
                        className="pointer-events-none"
                      />
                    ) : null}
                    {lineSvg.pts.map(({ x, y, v, i }) => {
                      const ptColor = seriesBarColor;
                      return (
                        <g key={`pt-${labels[i]}-${i}`}>
                          <circle
                            cx={x}
                            cy={y}
                            r={14}
                            fill="transparent"
                            className="cursor-default"
                            onMouseEnter={(e) => {
                              const plot = plotAreaRef.current;
                              const lineEl = linePlotRef.current;
                              if (!plot || !lineEl) return;
                              const plotR = plot.getBoundingClientRect();
                              const lineR = lineEl.getBoundingClientRect();
                              const focusX = x + (lineR.left - plotR.left);
                              const { anchorX, side } = computeTooltipHorizontalPlacement(
                                focusX,
                                Math.max(1, Math.floor(plotR.width)),
                              );
                              setHoveredIndex(i);
                              setTip({
                                anchorX,
                                y: e.clientY - plotR.top,
                                side,
                                periodLabel: labels[i]!,
                                valueLine: `${metricLabel}: ${formatTooltipValue(kind, v)}`,
                              });
                            }}
                            onMouseMove={(e) => {
                              const plot = plotAreaRef.current;
                              const lineEl = linePlotRef.current;
                              if (!plot || !lineEl) return;
                              const plotR = plot.getBoundingClientRect();
                              const lineR = lineEl.getBoundingClientRect();
                              const focusX = x + (lineR.left - plotR.left);
                              const { anchorX, side } = computeTooltipHorizontalPlacement(
                                focusX,
                                Math.max(1, Math.floor(plotR.width)),
                              );
                              setHoveredIndex(i);
                              setTip({
                                anchorX,
                                y: e.clientY - plotR.top,
                                side,
                                periodLabel: labels[i]!,
                                valueLine: `${metricLabel}: ${formatTooltipValue(kind, v)}`,
                              });
                            }}
                          />
                          <circle
                            cx={x}
                            cy={y}
                            r={4.5}
                            fill="white"
                            stroke={ptColor}
                            strokeWidth={2}
                            className="pointer-events-none"
                          />
                        </g>
                      );
                    })}
                  </svg>
                ) : null}
              </div>
            ) : (
              <div
                className="absolute inset-x-0 top-[8%] bottom-[4%] min-h-0 w-full min-w-0 px-0"
                role="img"
                aria-label={`${metricLabel} bar chart`}
              >
                {values.map((v, i) => {
                  const hPct = maxV > 0 ? (Math.max(0, v) / maxV) * 100 : 0;
                  const barColor = seriesBarColor;
                  const valueLine = `${metricLabel}: ${formatTooltipValue(kind, v)}`;
                  const leftPct = resolvePeriodCenterLeftPercent(
                    i,
                    n,
                    periodCenterInset,
                    periodPlotMargins,
                  );
                  return (
                    <div
                      key={`${labels[i]}-${i}`}
                      className="absolute bottom-0 z-0 flex h-full min-h-0 -translate-x-1/2 flex-col items-center justify-end"
                      style={{ left: `${leftPct}%`, width: barHitWidthPx }}
                      onMouseEnter={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        setHoveredIndex(i);
                        setTip(
                          barTooltipStateFromEvent(e, plot, labels[i]!, valueLine),
                        );
                      }}
                      onMouseMove={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        setHoveredIndex(i);
                        setTip(barTooltipStateFromEvent(e, plot, labels[i]!, valueLine));
                      }}
                    >
                      {hoveredIndex === i ? (
                        <div
                          className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-full -translate-x-1/2"
                          style={{
                            width: barHitWidthPx,
                            backgroundColor: HOVER_DOT_HALO_BG,
                          }}
                          aria-hidden
                        />
                      ) : null}
                      <div
                        className="relative z-10 flex h-full min-h-0 w-full flex-col items-center justify-end"
                      >
                        <div
                          className="mt-auto shrink-0 rounded-t-[2px] rounded-b-none transition-[height] duration-75"
                          style={{
                            width: barWidthPx,
                            maxWidth: "100%",
                            height: `${hPct}%`,
                            minHeight: hPct > 0 ? 2 : 0,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {display.showBarValues && visual === "bar"
              ? values.map((v, i) => {
                  if (v == null || !Number.isFinite(v) || v === 0) return null;
                  const hPct = maxV > 0 ? (Math.max(0, v) / maxV) * 100 : 0;
                  if (hPct <= 0) return null;
                  const leftPct = resolvePeriodCenterLeftPercent(
                    i,
                    n,
                    periodCenterInset,
                    periodPlotMargins,
                  );
                  const text = formatBarChartDataLabel(metricId, v);
                  return (
                    <div
                      key={`bar-val-${labels[i]}-${i}`}
                      className={BAR_VALUE_LABEL_CLASS}
                      style={{
                        left: `${leftPct}%`,
                        top: barValueLabelTopStyle(hPct),
                        transform: "translate(-50%, -100%)",
                        textShadow: BAR_VALUE_LABEL_TEXT_SHADOW,
                      }}
                      title={text}
                    >
                      {text}
                    </div>
                  );
                })
              : null}

            {tip ? (
              <div
                className="pointer-events-none absolute z-30 max-w-[min(280px,calc(100%-16px))] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2.5 pr-3.5 text-left shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
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
                <p className="mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4 text-[#09090B]">
                  {tip.valueLine}
                </p>
              </div>
            ) : null}
          </div>

          <div
            className={`relative h-full shrink-0 ${yAxisPlClass} text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]`}
            style={{ width: yAxisWidthPx }}
            aria-hidden
          >
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%]">
              {yTicks.map((t, i) => {
                const nt = yTicks.length;
                const pct = nt <= 1 ? 0 : (i / (nt - 1)) * 100;
                return (
                  <span
                    key={i}
                    className={`absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white py-px ${yAxisLabelPadClass}`}
                    style={{ top: `${pct}%` }}
                  >
                    {formatAxisValue(kind, t)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 overflow-visible" style={{ height: MULTICHART_AXIS_ROW_PX }}>
          <div className="relative mb-1 min-w-0 flex-1 px-0" style={{ height: MULTICHART_AXIS_ROW_PX }}>
            {axisLabels.map((axisLab, i) => {
              const showAxisText = fundamentalsPeriodAxisShowsLabel(i, axisLabels.length, periodMode);
              if (!showAxisText) return null;
              const leftPct = resolvePeriodCenterLeftPercent(
                i,
                n,
                periodCenterInset,
                periodPlotMargins,
              );
              return (
                <div
                  key={`${labels[i]}-${i}`}
                  className="absolute bottom-0.5 flex max-w-[min(100%,4.5rem)] -translate-x-1/2 justify-center overflow-visible"
                  style={{ left: `${leftPct}%` }}
                  title={labels[i]}
                >
                  <span
                    className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                    style={{
                      transform: `rotate(${AXIS_LABEL_ROTATE_DEG}deg)`,
                      transformOrigin: "center bottom",
                    }}
                  >
                    {axisLab}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ width: yAxisWidthPx }} className={`shrink-0 ${yAxisPlClass}`} aria-hidden />
        </div>
        <div className="shrink-0" style={{ height: MULTICHART_AXIS_BOTTOM_PAD_PX }} aria-hidden />

      </div>
    </div>
  );
}
