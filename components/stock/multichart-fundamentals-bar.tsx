"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";

import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  readChartingMetricValue,
  type ChartingMetricId,
  type ChartingMetricKind,
} from "@/lib/market/stock-charting-metrics";
import { formatBarChartDataLabel, formatChartingTableCell } from "@/components/charting/charting-individual-company-table";
import type { FundamentalsChartDisplayOptions } from "@/lib/chart/fundamentals-chart-display-options";
import { DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS } from "@/lib/chart/fundamentals-chart-display-options";
import {
  FUNDAMENTALS_BAR_VALUE_LABEL_STAGGER_MS,
  fundamentalsBarEnterProgress,
  fundamentalsBarStaggerDelaySec,
  runFundamentalsBarEnterAnimation,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import { isTouchDeviceNow, triggerMobileChartHaptic } from "@/lib/haptic";
import {
  buildFundamentalsYAxisDomain,
  CHARTING_LINE_HOVER_HALO_BG,
  CHARTING_LINE_POINT_MARKER_DIAMETER_PX,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_REFERENCE_BADGE_CLASS,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  valueToPlotBandTopPercent,
  type FundamentalsChartReferenceKind,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  formatChartingPeriodAxisLabel,
  formatChartingPeriodLabel,
  fundamentalsPeriodAxisShowsLabel,
  isChartingTtmPeriodEnd,
} from "@/lib/market/charting-period-display";
import {
  formatPercentMetric,
  formatRatio,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { ChartBrandWatermark } from "@/components/chart/chart-brand-watermark";
import { smoothAreaPathD, smoothLinePathD } from "@/lib/chart/smooth-line-path";
import {
  fundamentalsBarColorAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import {
  FUNDAMENTALS_HISTORY_MAX_ANNUAL_PERIODS,
  FUNDAMENTALS_HISTORY_MAX_QUARTERLY_PERIODS,
} from "@/lib/market/fundamentals-history-limit";
import {
  formatFundamentalsLineChartAxisLabel,
} from "@/lib/chart/fundamentals-line-chart-series";
import type { FundamentalsChartTimeRange } from "@/lib/market/fundamentals-chart-time-range";
import { cn } from "@/lib/utils";

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
/** Line chart — room for $8B-style ticks after the plot→axis gap. */
const MULTICHART_Y_AXIS_W_LINE_PX = 46;
/** Screenshot export — room for wide tick labels (e.g. 500.00) without clipping. */
const MULTICHART_Y_AXIS_W_SCREENSHOT_PX = 52;

export type PeriodPlotEdgeMargin = { left: number; right: number };

/** Key Stats screenshot export — inset plot + period labels from frame edges. */
export const KEY_STATS_SCREENSHOT_PERIOD_MARGINS: PeriodPlotEdgeMargin = {
  left: 0.022,
  right: 0.028,
};

/** Key Stats line — plot spans full plot width (yCharts-style edge-to-edge). */
const KEY_STATS_COMPACT_LINE_PERIOD_MARGINS: PeriodPlotEdgeMargin = {
  left: 0,
  right: 0,
};

/** Key Stats line x-axis year labels — inset from plot edges (line data stays full width). */
const KEY_STATS_LINE_AXIS_LABEL_MARGINS: PeriodPlotEdgeMargin = {
  left: 0.022,
  right: 0.022,
};

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

/** Full period column width (%) — hover band tiles between adjacent period centers. */
function periodColumnWidthPercent(
  i: number,
  n: number,
  inset: number,
  margins?: PeriodPlotEdgeMargin,
): number {
  if (n <= 0) return 100;
  if (n === 1) return margins ? (1 - margins.left - margins.right) * 100 : 100;

  const center = resolvePeriodCenterLeftPercent(i, n, inset, margins);
  const prev =
    i > 0
      ? resolvePeriodCenterLeftPercent(i - 1, n, inset, margins)
      : center - (resolvePeriodCenterLeftPercent(1, n, inset, margins) - center);
  const next =
    i < n - 1
      ? resolvePeriodCenterLeftPercent(i + 1, n, inset, margins)
      : center + (center - resolvePeriodCenterLeftPercent(n - 2, n, inset, margins));

  const left = i === 0 ? (margins ? margins.left * 100 : 0) : (prev + center) / 2;
  const right = i === n - 1 ? (margins ? 100 - margins.right * 100 : 100) : (center + next) / 2;
  return Math.max(0, right - left);
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

/** Non-hovered period bars while a column is hovered — matches Charting workspace. */
const BAR_HOVER_DIM_OPACITY = 0.6;

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

const NEGATIVE_BAR_COLOR = "#DC2626";

export { readChartingMetricValue };

/** Last `n` annual rows with a value for `metricId`, oldest → newest. LTM/TTM stays trailing when present. */
export function sliceLastAnnualWithMetric(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  n: number,
): ChartingSeriesPoint[] {
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const ttmRows = sorted.filter(
    (r) => isChartingTtmPeriodEnd(r.periodEnd) && readChartingMetricValue(r, metricId) != null,
  );
  const annualRows = sorted.filter((r) => !isChartingTtmPeriodEnd(r.periodEnd));
  const withVal = annualRows.filter((r) => readChartingMetricValue(r, metricId) != null);
  const annualCap = ttmRows.length > 0 ? Math.max(0, n - ttmRows.length) : n;
  const sliced = withVal.slice(-annualCap);
  return ttmRows.length ? [...sliced, ...ttmRows] : sliced;
}

/** Tooltip values — two decimal places in K/M/B/T (e.g. `$258.24B`). */
function formatTooltipValue(kind: ChartingMetricKind, p: number): string {
  return formatChartingTableCell(kind, p);
}

function resolveBarFillColor(baseColor: string, dimmed: boolean): string {
  if (!dimmed) return baseColor;
  if (baseColor === NEGATIVE_BAR_COLOR) {
    return `rgba(220, 38, 38, ${BAR_HOVER_DIM_OPACITY})`;
  }
  return fundamentalsBarColorAtIndex(0, BAR_HOVER_DIM_OPACITY);
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
  /** Grow bars / reveal line from left on appear (Key Stats metric modal). */
  animateBarsOnAppear?: boolean;
  /** Level period labels (e.g. Key Stats annual 10Y) instead of the default slant. */
  horizontalPeriodAxisLabels?: boolean;
  /** Key Stats line chart — year-only x-axis ticks by time range (5Y / 10Y / All). Charting 3Y uses 5Y-style ticks. */
  lineTimeRange?: FundamentalsChartTimeRange | "3Y";
  /** Wide export frame — side padding, wider y-axis, and plot insets for labels. */
  screenshotExportMode?: boolean;
  /** Hollow point markers on the line (default on; off in Key Stats metric modal). */
  showLinePointMarkers?: boolean;
  /** Value labels above line points when Values is on (default on; off in Key Stats metric modal). */
  enableLineValueLabels?: boolean;
  /** Centered Finsepa mark behind the series (Key Stats modal + screenshot export). */
  showBrandWatermark?: boolean;
};

function plotValueTopPercent(
  v: number,
  yMin: number,
  yMax: number,
  kind: ChartingMetricKind,
): number {
  const top = PLOT_INSET_TOP_FRAC * 100;
  const bottom = PLOT_INSET_BOTTOM_FRAC * 100;
  const span = 100 - top - bottom;
  const plotV = kind === "percent" ? v : Math.max(0, v);
  const range = yMax - yMin;
  const frac = range > 0 ? (yMax - plotV) / range : 0;
  return top + span * Math.min(1, Math.max(0, frac));
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
const BAR_VALUE_LABEL_ANCHOR_CLASS =
  "pointer-events-none absolute z-[15] max-w-[5.5rem] -translate-x-1/2 text-center";

const BAR_VALUE_LABEL_TEXT_CLASS =
  "block truncate text-[11px] font-semibold leading-none tabular-nums text-[#09090B]";

const BAR_VALUE_LABEL_TEXT_SHADOW =
  "0 0 3px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.8)";

function barValueLabelTopStyle(hPct: number): string {
  const innerFrac = 1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC;
  // `hPct` is {@link valueToPlotBandTopPercent}: 0% = band top, 100% = band bottom — same as bar `top`.
  const barTopFrac =
    PLOT_INSET_TOP_FRAC + innerFrac * (Math.min(100, Math.max(0, hPct)) / 100);
  const minTopPx = FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX + 4;
  return `max(${minTopPx}px, calc(${barTopFrac * 100}% - 4px))`;
}

type BarTooltipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  metricLabel: string;
  value: string;
};

function barTooltipStateFromEvent(
  e: MouseEvent<HTMLElement>,
  plotEl: HTMLElement,
  periodLabel: string,
  metricLabel: string,
  value: string,
): BarTooltipState {
  const plot = plotEl.getBoundingClientRect();
  const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const focusX = col.left + col.width / 2 - plot.left;
  const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
    focusX,
    Math.max(1, Math.floor(plot.width)),
  );
  return { anchorX, y: e.clientY - plot.top, side, periodLabel, metricLabel, value };
}

function fundamentalsChartTooltipAtFocus(
  plotEl: HTMLElement,
  focusX: number,
  pointerY: number,
  periodLabel: string,
  metricLabel: string,
  value: string,
): BarTooltipState {
  const plot = plotEl.getBoundingClientRect();
  const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
    focusX,
    Math.max(1, Math.floor(plot.width)),
  );
  return { anchorX, y: pointerY - plot.top, side, periodLabel, metricLabel, value };
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
  animateBarsOnAppear = false,
  horizontalPeriodAxisLabels = false,
  lineTimeRange,
  screenshotExportMode = false,
  showLinePointMarkers = true,
  enableLineValueLabels = true,
  showBrandWatermark = false,
}: Props) {
  const brandWatermark = showBrandWatermark || screenshotExportMode;
  const lineAxisMode = visual === "line" && lineTimeRange != null;
  const effectiveHorizontalPeriodAxisLabels = horizontalPeriodAxisLabels || lineAxisMode;
  const display = displayOptionsProp ?? DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS;
  const tightYAxis = compactHorizontalLayout || periodPlotMargins != null;
  const yAxisWidthPx = screenshotExportMode
    ? MULTICHART_Y_AXIS_W_SCREENSHOT_PX
    : lineAxisMode
      ? MULTICHART_Y_AXIS_W_LINE_PX
      : tightYAxis
        ? MULTICHART_Y_AXIS_W_COMPACT_PX
        : MULTICHART_Y_AXIS_W_PX;
  /** Visible whitespace between the plot edge and y-axis tick labels (line charts only). */
  const lineYAxisGapClass = lineAxisMode ? "gap-3" : "";
  const yAxisPlClass = lineAxisMode
    ? "pl-0 pr-0"
    : screenshotExportMode
      ? "pl-0 pr-1"
      : periodPlotMargins
        ? "pl-0 pr-3"
        : compactHorizontalLayout
          ? "pl-1.5"
          : "pl-3";
  const chartSidePadClass = screenshotExportMode ? "px-2.5" : "";
  const yAxisLabelPadClass = compactHorizontalLayout ? "px-0.5" : "px-1";
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const barChartTouchGestureRef = useRef(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<BarTooltipState | null>(null);

  const kind = CHARTING_METRIC_KIND[metricId];
  const maxBars =
    maxBarsProp ??
    (periodMode === "quarterly" ? MULTICHART_MAX_QUARTERLY_BARS : MULTICHART_MAX_ANNUAL_BARS);
  const rows = useMemo(() => {
    if (lineAxisMode) {
      const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
      return sorted.filter((r) => readChartingMetricValue(r, metricId) != null);
    }
    return sliceLastAnnualWithMetric(points, metricId, maxBars);
  }, [points, metricId, maxBars, lineAxisMode]);

  const plotHeight = height - MULTICHART_AXIS_ROW_PX - MULTICHART_AXIS_BOTTOM_PAD_PX;

  const { values, labels, axisLabels, yDomain } = useMemo(() => {
    const vals: number[] = [];
    const labs: string[] = [];
    const axisLabs: string[] = [];
    const periodEnds = rows.map((r) => r.periodEnd);
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i]!;
      const v = readChartingMetricValue(r, metricId);
      if (v == null) continue;
      vals.push(v);
      labs.push(formatChartingPeriodLabel(r.periodEnd, periodMode));
      if (lineAxisMode && lineTimeRange) {
        axisLabs.push(
          formatFundamentalsLineChartAxisLabel(r.periodEnd, i, periodEnds, lineTimeRange),
        );
      } else {
        axisLabs.push(formatChartingPeriodAxisLabel(r.periodEnd, periodMode));
      }
    }
    const rawMax = vals.length ? Math.max(...vals) : 0;
    const rawMin = vals.length ? Math.min(...vals) : 0;
    const domain = buildFundamentalsYAxisDomain(rawMin, rawMax, kind);
    return { values: vals, labels: labs, axisLabels: axisLabs, yDomain: domain };
  }, [rows, metricId, periodMode, kind, lineAxisMode, lineTimeRange]);

  const yMin = yDomain.min;
  const yMax = yDomain.max;
  const yTicks = yDomain.ticks;
  const yBipolar = yDomain.bipolar;

  const referenceLevels = useMemo(() => {
    if (values.length === 0 || yMax <= yMin) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [values, yMin, yMax]);

  const metricLabel = CHARTING_METRIC_LABEL[metricId];
  /** One metric × many periods — bars share the primary palette color (not per-period cycling). */
  const seriesBarColor = fundamentalsBarSolidAtIndex(0);
  const linePlotRef = useRef<HTMLDivElement>(null);
  const [linePlotPx, setLinePlotPx] = useState({ w: 0, h: 0 });
  const lineAreaGradientId = useId();
  const lineEnterClipId = useId();

  const linePeriodPlotMargins = useMemo((): PeriodPlotEdgeMargin | undefined => {
    if (visual !== "line") return periodPlotMargins;
    return KEY_STATS_COMPACT_LINE_PERIOD_MARGINS;
  }, [periodPlotMargins, visual]);
  const lineAxisLabelMargins = useMemo((): PeriodPlotEdgeMargin | undefined => {
    if (!lineAxisMode) return undefined;
    return KEY_STATS_LINE_AXIS_LABEL_MARGINS;
  }, [lineAxisMode]);
  const lineAreaGradientTop = fundamentalsBarColorAtIndex(0, LINE_AREA_GRADIENT_TOP_OPACITY);
  const lineAreaGradientBottom = fundamentalsBarColorAtIndex(0, LINE_AREA_GRADIENT_BOTTOM_OPACITY);

  useLayoutEffect(() => {
    if (visual !== "line") return;
    const el = linePlotRef.current;
    if (!el) return;
    const measure = () => {
      // clientWidth/Height ignore ancestor transform:scale (getBoundingClientRect does not).
      setLinePlotPx({ w: Math.max(0, el.clientWidth), h: Math.max(0, el.clientHeight) });
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
      const x = resolvePeriodCenterX(i, n, w, periodCenterInset, linePeriodPlotMargins);
      const bandTop = valueToPlotBandTopPercent(v, yMin, yMax);
      const y = padT + innerH * (bandTop / 100);
      return { x, y, v, i };
    });
    const curvePts = pts.map((p) => ({ x: p.x, y: p.y }));
    const d = smoothLinePathD(curvePts);
    const areaD = smoothAreaPathD(curvePts, areaFloorY);
    return { d, areaD, gradY0: padT, gradY1: areaFloorY, pts };
  }, [linePlotPx.h, linePlotPx.w, values, yMin, yMax, periodCenterInset, linePeriodPlotMargins]);

  const n = values.length;
  const shouldAnimateBars = animateBarsOnAppear && visual === "bar" && n > 0;
  const shouldAnimateLine = animateBarsOnAppear && visual === "line" && n > 0;
  const [barValueLabelsVisible, setBarValueLabelsVisible] = useState(!shouldAnimateBars);
  const [lineRevealProgress, setLineRevealProgress] = useState(shouldAnimateLine ? 0 : 1);
  const lineValueLabelsVisible = !shouldAnimateLine || lineRevealProgress >= 1;

  useEffect(() => {
    if (!shouldAnimateBars) {
      setBarValueLabelsVisible(true);
      return;
    }
    setBarValueLabelsVisible(false);
    return runFundamentalsBarEnterAnimation({
      periodCount: n,
      onFrame: () => {},
      onComplete: () => setBarValueLabelsVisible(true),
    });
  }, [shouldAnimateBars, n, metricId, periodMode, visual, maxBars, points]);

  useEffect(() => {
    if (!shouldAnimateLine || linePlotPx.w <= 0) {
      setLineRevealProgress(1);
      return;
    }
    setLineRevealProgress(0);
    return runFundamentalsBarEnterAnimation({
      periodCount: 1,
      onFrame: (elapsedMs) => {
        setLineRevealProgress(fundamentalsBarEnterProgress(0, 1, elapsedMs));
      },
      onComplete: () => setLineRevealProgress(1),
    });
  }, [shouldAnimateLine, n, metricId, periodMode, visual, maxBars, points, linePlotPx.w]);

  const noteBarHoveredIndex = useCallback((next: number) => {
    setHoveredIndex((prev) => {
      if (
        isTouchDeviceNow() &&
        visual === "bar" &&
        prev != null &&
        prev !== next
      ) {
        triggerMobileChartHaptic();
      }
      return next;
    });
  }, [visual]);

  const onBarPlotPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isTouchDeviceNow() || event.pointerType === "mouse" || visual !== "bar") return;
      if (barChartTouchGestureRef.current) return;
      barChartTouchGestureRef.current = true;
      triggerMobileChartHaptic();
    },
    [visual],
  );

  const onBarPlotPointerUp = useCallback(() => {
    barChartTouchGestureRef.current = false;
  }, []);

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

  const barStaggerDelaySec = fundamentalsBarStaggerDelaySec(n);

  const clearChartHover = () => {
    barChartTouchGestureRef.current = false;
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
    <div
      ref={wrapRef}
      className={cn(
        "w-full min-w-0 max-w-full overflow-visible",
        screenshotExportMode && "pr-2",
      )}
    >
      <div className="relative flex w-full min-w-0 max-w-full flex-col overflow-visible" style={{ height }}>
        <div
          className={cn("flex min-h-0 w-full min-w-0 flex-1", lineYAxisGapClass, chartSidePadClass)}
          style={{ height: plotHeight }}
        >
          <div
            ref={plotAreaRef}
            className="relative min-h-0 min-w-0 flex-1"
            onPointerDown={onBarPlotPointerDown}
            onPointerUp={onBarPlotPointerUp}
            onPointerCancel={onBarPlotPointerUp}
            onPointerLeave={clearChartHover}
          >
            {/* Dot grid + single $0 baseline (no other horizontal rules). */}
            <div
              className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%] z-0 bg-white"
              aria-hidden
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
              <div
                className="absolute inset-x-0 border-t"
                style={{
                  borderColor: CHART_ZERO_BASELINE_BORDER,
                  top: yBipolar ? `${valueToPlotBandTopPercent(0, yMin, yMax)}%` : undefined,
                  bottom: yBipolar ? undefined : 0,
                }}
              />
            </div>
            {brandWatermark ? (
              <ChartBrandWatermark size={screenshotExportMode ? "compact" : "default"} />
            ) : null}
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
                topPercent={plotValueTopPercent(referenceLevels.avg, yMin, yMax, kind)}
                badgeLabel={formatReferenceBadgeLabel("avg", metricId, referenceLevels.avg)}
              />
            ) : null}
            {display.showMaxLine && referenceLevels ? (
              <FundamentalsReferenceLine
                kind="max"
                topPercent={plotValueTopPercent(referenceLevels.max, yMin, yMax, kind)}
                badgeLabel={formatReferenceBadgeLabel("max", metricId, referenceLevels.max)}
              />
            ) : null}
            {display.showMinLine && referenceLevels ? (
              <FundamentalsReferenceLine
                kind="min"
                topPercent={plotValueTopPercent(referenceLevels.min, yMin, yMax, kind)}
                badgeLabel={formatReferenceBadgeLabel("min", metricId, referenceLevels.min)}
              />
            ) : null}
            {visual === "line" ? (
              <div
                ref={linePlotRef}
                className="absolute inset-x-0 top-[8%] bottom-[4%] z-[2] min-h-0 w-full min-w-0"
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
                      {shouldAnimateLine && lineRevealProgress < 1 ? (
                        <clipPath id={lineEnterClipId}>
                          <rect
                            x={0}
                            y={0}
                            width={Math.max(0, linePlotPx.w * lineRevealProgress)}
                            height={linePlotPx.h}
                          />
                        </clipPath>
                      ) : null}
                    </defs>
                    <g
                      clipPath={
                        shouldAnimateLine && lineRevealProgress < 1
                          ? `url(#${lineEnterClipId})`
                          : undefined
                      }
                    >
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
                      {showLinePointMarkers
                        ? lineSvg.pts.map(({ x, y, i }) => (
                            <circle
                              key={`line-dot-${labels[i]}-${i}`}
                              cx={x}
                              cy={y}
                              r={4.5}
                              fill="white"
                              stroke={seriesBarColor}
                              strokeWidth={2}
                              className="pointer-events-none"
                            />
                          ))
                        : null}
                      {hoveredIndex != null && lineSvg.pts[hoveredIndex] ? (
                        <>
                          <circle
                            cx={lineSvg.pts[hoveredIndex]!.x}
                            cy={lineSvg.pts[hoveredIndex]!.y}
                            r={HOVER_DOT_HALO_RADIUS_PX}
                            fill={CHARTING_LINE_HOVER_HALO_BG}
                            className="pointer-events-none"
                          />
                          <circle
                            cx={lineSvg.pts[hoveredIndex]!.x}
                            cy={lineSvg.pts[hoveredIndex]!.y}
                            r={4.5}
                            fill="white"
                            stroke={seriesBarColor}
                            strokeWidth={2}
                            className="pointer-events-none"
                          />
                        </>
                      ) : null}
                      {lineSvg.pts.map(({ x, y, v, i }) => {
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
                              setHoveredIndex(i);
                              setTip(
                                fundamentalsChartTooltipAtFocus(
                                  plot,
                                  focusX,
                                  e.clientY,
                                  labels[i]!,
                                  metricLabel,
                                  formatTooltipValue(kind, v),
                                ),
                              );
                            }}
                            onMouseMove={(e) => {
                              const plot = plotAreaRef.current;
                              const lineEl = linePlotRef.current;
                              if (!plot || !lineEl) return;
                              const plotR = plot.getBoundingClientRect();
                              const lineR = lineEl.getBoundingClientRect();
                              const focusX = x + (lineR.left - plotR.left);
                              setHoveredIndex(i);
                              setTip(
                                fundamentalsChartTooltipAtFocus(
                                  plot,
                                  focusX,
                                  e.clientY,
                                  labels[i]!,
                                  metricLabel,
                                  formatTooltipValue(kind, v),
                                ),
                              );
                            }}
                          />
                        </g>
                      );
                    })}
                    </g>
                  </svg>
                ) : null}
                {display.showBarValues &&
                enableLineValueLabels &&
                visual === "line" &&
                lineValueLabelsVisible
                  ? lineSvg.pts.map(({ x, y, v, i }) => {
                      if (v == null || !Number.isFinite(v) || v === 0) return null;
                      const text = formatBarChartDataLabel(metricId, v);
                      const dotClearance = CHARTING_LINE_POINT_MARKER_DIAMETER_PX / 2 + 4;
                      const minTop = FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX + 4;
                      const labelOnPositive = v >= 0;
                      return (
                        <div
                          key={`line-val-${labels[i]}-${i}`}
                          className={cn(
                            BAR_VALUE_LABEL_ANCHOR_CLASS,
                            labelOnPositive ? "-translate-y-full" : "",
                          )}
                          style={{
                            left: x,
                            top: labelOnPositive
                              ? Math.max(minTop, y - dotClearance)
                              : y + dotClearance,
                          }}
                          title={text}
                        >
                          <span
                            className={cn(
                              BAR_VALUE_LABEL_TEXT_CLASS,
                              shouldAnimateLine && "fundamentals-bar-value-label-in",
                            )}
                            style={{
                              animationDelay: shouldAnimateLine
                                ? `${i * FUNDAMENTALS_BAR_VALUE_LABEL_STAGGER_MS}ms`
                                : undefined,
                              textShadow: BAR_VALUE_LABEL_TEXT_SHADOW,
                            }}
                          >
                            {text}
                          </span>
                        </div>
                      );
                    })
                  : null}
              </div>
            ) : (
              <div
                className="absolute inset-x-0 top-[8%] bottom-[4%] z-[2] min-h-0 w-full min-w-0 px-0"
                role="img"
                aria-label={`${metricLabel} bar chart`}
              >
                {values.map((v, i) => {
                  const zeroTop = valueToPlotBandTopPercent(0, yMin, yMax);
                  const vTop = valueToPlotBandTopPercent(v, yMin, yMax);
                  const barHeightPct = v >= 0 ? Math.max(0, zeroTop - vTop) : Math.max(0, vTop - zeroTop);
                  const barTopPct = v >= 0 ? vTop : zeroTop;
                  const baseBarColor = v < 0 ? NEGATIVE_BAR_COLOR : seriesBarColor;
                  const barColor = resolveBarFillColor(
                    baseBarColor,
                    hoveredIndex != null && hoveredIndex !== i,
                  );
                  const tooltipValue = formatTooltipValue(kind, v);
                  const leftPct = resolvePeriodCenterLeftPercent(
                    i,
                    n,
                    periodCenterInset,
                    periodPlotMargins,
                  );
                  const columnWidthPct = periodColumnWidthPercent(
                    i,
                    n,
                    periodCenterInset,
                    periodPlotMargins,
                  );
                  return (
                    <div
                      key={`${labels[i]}-${i}`}
                      className="absolute top-0 z-0 h-full min-h-0 -translate-x-1/2"
                      style={{ left: `${leftPct}%`, width: `${columnWidthPct}%` }}
                      onMouseEnter={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        noteBarHoveredIndex(i);
                        setTip(
                          barTooltipStateFromEvent(
                            e,
                            plot,
                            labels[i]!,
                            metricLabel,
                            tooltipValue,
                          ),
                        );
                      }}
                      onMouseMove={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        noteBarHoveredIndex(i);
                        setTip(
                          barTooltipStateFromEvent(
                            e,
                            plot,
                            labels[i]!,
                            metricLabel,
                            tooltipValue,
                          ),
                        );
                      }}
                    >
                      {hoveredIndex === i ? (
                        <div
                          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-full"
                          style={{ backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG }}
                          aria-hidden
                        />
                      ) : null}
                      {barHeightPct > 0 ? (
                        <div
                          className={cn(
                            "absolute left-1/2 z-10 -translate-x-1/2",
                            v >= 0 ? "rounded-t-[4px] rounded-b-none" : "rounded-b-[4px] rounded-t-none",
                            shouldAnimateBars
                              ? "fundamentals-bar-grow-in"
                              : "transition-[height,top] duration-75",
                          )}
                          style={{
                            ...(shouldAnimateBars
                              ? ({
                                  ["--bar-grow-origin-top"]: `${zeroTop}%`,
                                  ["--bar-target-height"]: `${barHeightPct}%`,
                                  ["--bar-target-top"]: `${barTopPct}%`,
                                  animationDelay: `${i * barStaggerDelaySec}s`,
                                } as CSSProperties)
                              : {
                                  top: `${barTopPct}%`,
                                  height: `${barHeightPct}%`,
                                  minHeight: 2,
                                }),
                            width: barWidthPx,
                            maxWidth: "100%",
                            backgroundColor: barColor,
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {display.showBarValues && visual === "bar" && barValueLabelsVisible
              ? values.map((v, i) => {
                  if (v == null || !Number.isFinite(v) || v === 0) return null;
                  const zeroTop = valueToPlotBandTopPercent(0, yMin, yMax);
                  const vTop = valueToPlotBandTopPercent(v, yMin, yMax);
                  const leftPct = resolvePeriodCenterLeftPercent(
                    i,
                    n,
                    periodCenterInset,
                    periodPlotMargins,
                  );
                  const text = formatBarChartDataLabel(metricId, v);
                  const labelOnPositive = v >= 0;
                  const labelTop = labelOnPositive
                    ? barValueLabelTopStyle(vTop)
                    : `${Math.min(98, vTop + 1)}%`;
                  return (
                    <div
                      key={`bar-val-${labels[i]}-${i}`}
                      className={cn(
                        BAR_VALUE_LABEL_ANCHOR_CLASS,
                        labelOnPositive ? "-translate-y-full" : "",
                      )}
                      style={{
                        left: `${leftPct}%`,
                        top: labelTop,
                      }}
                      title={text}
                    >
                      <span
                        className={cn(
                          BAR_VALUE_LABEL_TEXT_CLASS,
                          shouldAnimateBars && "fundamentals-bar-value-label-in",
                        )}
                        style={{
                          animationDelay: shouldAnimateBars
                            ? `${i * FUNDAMENTALS_BAR_VALUE_LABEL_STAGGER_MS}ms`
                            : undefined,
                          textShadow: BAR_VALUE_LABEL_TEXT_SHADOW,
                        }}
                      >
                        {text}
                      </span>
                    </div>
                  );
                })
              : null}

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
                role="tooltip"
                aria-label="Chart tooltip"
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
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: seriesBarColor }}
                        aria-hidden
                      />
                      <span className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                        {tip.metricLabel}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-[#09090B]">
                      {tip.value}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={`relative h-full shrink-0 ${yAxisPlClass} text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]`}
            style={{ width: yAxisWidthPx }}
            aria-hidden
          >
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%]">
              {yTicks.map((t, i) => (
                <span
                  key={i}
                  className={`absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white py-px ${yAxisLabelPadClass}`}
                  style={{ top: `${valueToPlotBandTopPercent(t, yMin, yMax)}%` }}
                >
                  {formatAxisValue(kind, t)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn("flex w-full min-w-0 overflow-visible", lineYAxisGapClass, chartSidePadClass)}
          style={{ height: MULTICHART_AXIS_ROW_PX }}
        >
          <div
            className="relative mb-1 min-w-0 flex-1 px-0"
            style={{ height: MULTICHART_AXIS_ROW_PX }}
          >
            {axisLabels.map((axisLab, i) => {
              const showAxisText = lineAxisMode
                ? axisLab.length > 0
                : fundamentalsPeriodAxisShowsLabel(i, axisLabels.length, periodMode);
              if (!showAxisText) return null;
              const leftPct = resolvePeriodCenterLeftPercent(
                i,
                n,
                periodCenterInset,
                lineAxisMode ? lineAxisLabelMargins : periodPlotMargins,
              );
              const axisLabelRotateDeg = effectiveHorizontalPeriodAxisLabels ? 0 : AXIS_LABEL_ROTATE_DEG;
              return (
                <div
                  key={`${labels[i]}-${i}`}
                  className={cn(
                    "absolute flex max-w-[min(100%,4.5rem)] -translate-x-1/2 justify-center overflow-visible",
                    effectiveHorizontalPeriodAxisLabels ? "top-1.5" : "bottom-0.5",
                  )}
                  style={{ left: `${leftPct}%` }}
                  title={labels[i]}
                >
                  <span
                    className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                    style={{
                      transform: axisLabelRotateDeg === 0 ? undefined : `rotate(${axisLabelRotateDeg}deg)`,
                      transformOrigin: effectiveHorizontalPeriodAxisLabels ? undefined : "center bottom",
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
