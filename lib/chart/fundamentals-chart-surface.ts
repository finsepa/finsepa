import {
  formatPercentMetric,
  formatRatio,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";
import type { ChartingMetricKind } from "@/lib/market/stock-charting-metrics";
import {
  LastPriceAnimationMode,
  LineStyle,
  LineType,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineSeriesPartialOptions,
} from "lightweight-charts";

/** Column hover band — Multicharts, Earnings, Charting. */
export const FUNDAMENTALS_CHART_HOVER_BAND_BG = "rgba(59, 130, 246, 0.14)";

/** Hollow point markers on fundamentals line charts (Key Stats modal / Multichart line). */
export const CHARTING_LINE_POINT_MARKER_RADIUS_PX = 4.5;
export const CHARTING_LINE_POINT_MARKER_BORDER_PX = 2;
export const CHARTING_LINE_POINT_MARKER_DIAMETER_PX = CHARTING_LINE_POINT_MARKER_RADIUS_PX * 2;

/** Active-point halo on line hover (not a full-height column). */
export const CHARTING_LINE_HOVER_HALO_RADIUS_PX = 14;
export const CHARTING_LINE_HOVER_HALO_BG = FUNDAMENTALS_CHART_HOVER_BAND_BG;

/** Hide LW reference lines (dashed last-price, $0 baseline) on fundamentals charts. */
export const chartingFundamentalsSeriesNoReferenceLines = {
  lastValueVisible: false,
  priceLineVisible: false,
  baseLineVisible: false,
} as const;

/** Line series styling shared by Charting workspace line mode. */
export function chartingFundamentalsLineSeriesOptions(color: string): LineSeriesPartialOptions {
  return {
    ...chartingFundamentalsSeriesNoReferenceLines,
    color,
    lineWidth: 2,
    lineStyle: LineStyle.Solid,
    lineType: LineType.Simple,
    pointMarkersVisible: false,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: CHARTING_LINE_POINT_MARKER_RADIUS_PX,
    crosshairMarkerBorderColor: "#FFFFFF",
    crosshairMarkerBackgroundColor: color,
    crosshairMarkerBorderWidth: CHARTING_LINE_POINT_MARKER_BORDER_PX,
    lastPriceAnimation: LastPriceAnimationMode.Disabled,
  };
}

export const FUNDAMENTALS_CHART_GRID_LINE_COLOR = "#F4F4F5";

/** $0 baseline under bar plots — matches {@link MultichartFundamentalsBar}. */
export const FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER = "rgba(228, 228, 231, 0.85)";

/** Plot band insets (Multicharts / Key Stats modal bar charts). */
export const FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC = 0.08;
export const FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC = 0.04;

/** Bottom row for slanted period labels (Multicharts / Charting). */
export const FUNDAMENTALS_CHART_AXIS_ROW_PX = 52;
/** Right column for Y-axis tick labels. */
export const FUNDAMENTALS_CHART_Y_AXIS_W_PX = 58;
/** Padding between plot edge and Y tick labels (left) and container border (right). */
export const FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS = "pl-5 pr-2";
export const FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG = -42;
export const FUNDAMENTALS_CHART_AXIS_TICK_COUNT = 5;

/** Line charts — modest top margin for end badges / hover. */
export const FUNDAMENTALS_CHART_SCALE_MARGIN_TOP = 0.08;
/** Bar charts — matches Key Stats / Multicharts plot band (`top-[8%]`). */
export const FUNDAMENTALS_CHART_SCALE_MARGIN_TOP_BARS = 0.08;
export const FUNDAMENTALS_CHART_SCALE_MARGIN_BOTTOM_BARS = 0;
export const FUNDAMENTALS_CHART_SCALE_MARGIN_BOTTOM_LINE = 0.08;

/** Space reserved above the tallest bar for `translate(-100%)` value labels. */
export const FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX = 12;

/** Top-only corner radius on fundamentals bar columns (bottom stays square). */
export const FUNDAMENTALS_BAR_TOP_RADIUS_PX = 4;

export type FundamentalsChartReferenceKind = "avg" | "max" | "min";

const FUNDAMENTALS_CHART_REFERENCE_BADGE_BASE_CLASS =
  "inline-block rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium leading-4 tabular-nums whitespace-nowrap";

/** Colored pills for avg / max / min reference lines (aligned with {@link PriceChart} green / red / blue). */
export const FUNDAMENTALS_CHART_REFERENCE_BADGE_CLASS: Record<FundamentalsChartReferenceKind, string> = {
  max: `${FUNDAMENTALS_CHART_REFERENCE_BADGE_BASE_CLASS} bg-[#DCFCE7] text-[#16A34A]`,
  min: `${FUNDAMENTALS_CHART_REFERENCE_BADGE_BASE_CLASS} bg-[#FEE2E2] text-[#DC2626]`,
  avg: `${FUNDAMENTALS_CHART_REFERENCE_BADGE_BASE_CLASS} bg-[#DBEAFE] text-[#2563EB]`,
};

export function fundamentalsChartScaleMarginTop(mode: "bars" | "line"): number {
  return mode === "bars" ? FUNDAMENTALS_CHART_SCALE_MARGIN_TOP_BARS : FUNDAMENTALS_CHART_SCALE_MARGIN_TOP;
}

/** Overlay grid / Y-axis labels aligned to the price scale (Multicharts). */
export function fundamentalsChartPlotInsetClassName(mode: "bars" | "line"): string {
  return mode === "bars" ? "top-[8%] bottom-0" : "top-[8%] bottom-[8%]";
}

const NICE_STEP_FACTORS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;
const MULTIPLE_RATIO_AXIS_MAX_LADDER = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000] as const;

function niceCeilPositive(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const f = n / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

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

function axisMaxForMultiplesAndRatios(rawMax: number): number {
  const padded = rawMax <= 0 ? 1 : rawMax * 1.08;
  const naive = niceCeilPositive(rawMax);
  if (naive > 300 && rawMax <= 250) return 300;
  for (const cap of MULTIPLE_RATIO_AXIS_MAX_LADDER) {
    if (cap >= padded) return cap;
  }
  return naive;
}

function axisMaxForFiveTicks(rawMax: number, kind: ChartingMetricKind): number {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return 1;
  if (kind === "usd" || kind === "shares") {
    const padded = rawMax * 1.04;
    const step = niceCeilStep(padded / 4);
    return step * 4;
  }
  if (kind === "percent") {
    const padded = rawMax * 1.08;
    const step = niceCeilStep(padded / 4);
    return Math.min(1, step * 4);
  }
  if (kind === "multiple" || kind === "ratio") return axisMaxForMultiplesAndRatios(rawMax);
  return niceCeilPositive(rawMax * 1.08);
}

export type FundamentalsYAxisDomain = {
  min: number;
  max: number;
  ticks: number[];
  /** True when the axis spans below zero (e.g. negative YoY / CAGR). */
  bipolar: boolean;
};

/** 0% = top of plot band, 100% = bottom — for positioning bars, grid zero line, and Y labels. */
export function valueToPlotBandTopPercent(v: number, min: number, max: number): number {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) return 100;
  return ((max - v) / range) * 100;
}

function buildFundamentalsYAxisTicksBetween(min: number, max: number): number[] {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) && max > lo ? max : lo + 1;
  const tickCount = FUNDAMENTALS_CHART_AXIS_TICK_COUNT;
  return Array.from({ length: tickCount }, (_, i) => hi - (i / (tickCount - 1)) * (hi - lo));
}

function axisMaxForTightNumeric(rawMax: number): number {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return 1;
  const padded = rawMax * 1.12;
  const step = niceCeilStep(padded / 4);
  return step * 4;
}

/**
 * Y-axis for values already in display units (macro % points, treasury yields)
 * without the 50+ ratio/multiple ladder.
 */
export function buildTightNumericYAxisDomain(rawMin: number, rawMax: number): FundamentalsYAxisDomain {
  const dataMin = Number.isFinite(rawMin) ? rawMin : 0;
  const dataMax = Number.isFinite(rawMax) ? rawMax : 0;
  const max = Math.max(dataMax, 0);
  const min = Math.min(dataMin, 0);

  if (min < 0) {
    const extent = Math.max(axisMaxForTightNumeric(max), axisMaxForTightNumeric(Math.abs(min)), 1);
    return {
      min: -extent,
      max: extent,
      ticks: buildFundamentalsYAxisTicksBetween(-extent, extent),
      bipolar: true,
    };
  }

  const yMax = axisMaxForTightNumeric(max || 1);
  return {
    min: 0,
    max: yMax,
    ticks: buildFixedFundamentalsYAxisTicks(yMax),
    bipolar: false,
  };
}

export function buildFundamentalsYAxisDomain(
  rawMin: number,
  rawMax: number,
  kind: ChartingMetricKind,
): FundamentalsYAxisDomain {
  const dataMin = Number.isFinite(rawMin) ? rawMin : 0;
  const dataMax = Number.isFinite(rawMax) ? rawMax : 0;
  const max = Math.max(dataMax, 0);
  const min = Math.min(dataMin, 0);

  if (min < 0) {
    const yMax = axisMaxForFiveTicks(max || 1, kind);
    const yMin = -axisMaxForFiveTicks(Math.abs(min) || 1, kind);
    return {
      min: yMin,
      max: yMax,
      ticks: buildFundamentalsYAxisTicksBetween(yMin, yMax),
      bipolar: true,
    };
  }

  const yMax = axisMaxForFiveTicks(max || 1, kind);
  return {
    min: 0,
    max: yMax,
    ticks: buildFixedFundamentalsYAxisTicks(yMax),
    bipolar: false,
  };
}

/** Five evenly spaced Y ticks from 0..max (Multicharts). */
export function buildFundamentalsYAxisTicks(rawMax: number, kind: ChartingMetricKind): number[] {
  return buildFundamentalsYAxisDomain(0, rawMax, kind).ticks;
}

/** Five evenly spaced ticks from 0..`max` (e.g. percent axis 0–50%). */
export function buildFixedFundamentalsYAxisTicks(max: number): number[] {
  const top = Number.isFinite(max) && max > 0 ? max : 1;
  const tickCount = FUNDAMENTALS_CHART_AXIS_TICK_COUNT;
  return Array.from({ length: tickCount }, (_, i) => (top * (tickCount - 1 - i)) / (tickCount - 1));
}

/** Values stored as decimal ratios (0.13) or percent points (13) — normalize to percent points. */
export function chartingPercentPlotValue(raw: number): number {
  if (!Number.isFinite(raw)) return raw;
  return Math.abs(raw) <= 1 && raw !== 0 ? raw * 100 : raw;
}

function axisMaxForChartingPercentPoints(rawMaxPlot: number): number {
  const max = Number.isFinite(rawMaxPlot) && rawMaxPlot > 0 ? rawMaxPlot : 1;
  const padded = max * 1.08;
  const step = padded <= 30 ? 5 : padded <= 60 ? 10 : padded <= 150 ? 25 : 50;
  const tickSpan = (FUNDAMENTALS_CHART_AXIS_TICK_COUNT - 1) * step;
  const fromData = Math.ceil(padded / step) * step;
  return Math.max(tickSpan, fromData);
}

/** Charting percent metrics plotted as percent points — tight 5% / 10% steps when max is small. */
export function buildChartingPercentYAxisTicks(rawMaxPlot: number): number[] {
  return buildFixedFundamentalsYAxisTicks(axisMaxForChartingPercentPoints(rawMaxPlot));
}

/** Right-axis tick text — Multicharts-style compact units. */
export function formatFundamentalsAxisTickLabel(kind: ChartingMetricKind, p: number): string {
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

export const FUNDAMENTALS_CHART_TOOLTIP_CLASS =
  "pointer-events-none absolute z-30 max-w-[min(280px,calc(100%-16px))] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2.5 pr-3.5 text-left shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]";

export const FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT = 6;

export const HIDE_NATIVE_Y_AXIS_TICK_LABELS = (priceValue: readonly number[]) => priceValue.map(() => "");

/** `anchorX` in px relative to plot left edge. */
export function computeFundamentalsChartTooltipPlacement(
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

const Y_AXIS_LABEL_ONLY = {
  color: "transparent",
  lineWidth: 1,
  lineStyle: LineStyle.Solid,
  axisLabelVisible: true,
  axisLabelColor: "#ffffff",
  axisLabelTextColor: "#71717A",
  lineVisible: false,
  title: "",
} as const;

type YAxisSeries = ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | ISeriesApi<"Area"> | ISeriesApi<"Baseline">;

const GRID_PRICE_LINE_OPTIONS = {
  color: FUNDAMENTALS_CHART_GRID_LINE_COLOR,
  lineWidth: 1,
  lineStyle: LineStyle.Solid,
  lineVisible: true,
  axisLabelVisible: false,
  title: "",
} as const;

const GRID_PRICE_LINE_DASHED_OPTIONS = {
  color: "#A1A1AA",
  lineWidth: 1,
  lineStyle: LineStyle.Dashed,
  lineVisible: true,
  axisLabelVisible: false,
  title: "",
} as const;

export type FundamentalsChartGridLineVariant = "solid" | "dashed";

/** Horizontal guides at fixed Y ticks — aligned with custom right-axis labels (Multicharts / Key Stats). */
export function syncFundamentalsChartGridPriceLines(
  series: YAxisSeries | null,
  linesRef: { current: IPriceLine[] },
  ticks: readonly number[],
  variant: FundamentalsChartGridLineVariant = "solid",
) {
  removeFundamentalsChartYAxisTickLabels(series, linesRef);
  if (!series) return;
  const lineOpts = variant === "dashed" ? GRID_PRICE_LINE_DASHED_OPTIONS : GRID_PRICE_LINE_OPTIONS;
  for (const price of ticks) {
    if (!Number.isFinite(price)) continue;
    linesRef.current.push(series.createPriceLine({ price, ...lineOpts }));
  }
}

export function removeFundamentalsChartYAxisTickLabels(
  series: YAxisSeries | null,
  ticksRef: { current: IPriceLine[] },
) {
  if (!series) {
    ticksRef.current = [];
    return;
  }
  for (const line of ticksRef.current) {
    try {
      series.removePriceLine(line);
    } catch {
      /* ignore */
    }
  }
  ticksRef.current = [];
}

/** Evenly spaced right-axis numbers without extra grid lines (Multicharts-style). */
export function syncFundamentalsChartYAxisTickLabels(
  chart: IChartApi,
  series: YAxisSeries,
  ticksRef: { current: IPriceLine[] },
  tickCount: number = FUNDAMENTALS_CHART_Y_AXIS_LABEL_COUNT,
) {
  const h = chart.paneSize(0).height;
  if (!Number.isFinite(h) || h <= 0 || tickCount < 2) {
    removeFundamentalsChartYAxisTickLabels(series, ticksRef);
    return;
  }

  const topPrice = series.coordinateToPrice(0);
  const bottomPrice = series.coordinateToPrice(h);
  if (topPrice == null || bottomPrice == null) {
    removeFundamentalsChartYAxisTickLabels(series, ticksRef);
    return;
  }

  let top = topPrice as number;
  let bottom = bottomPrice as number;
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
    removeFundamentalsChartYAxisTickLabels(series, ticksRef);
    return;
  }
  if (top < bottom) {
    const swap = top;
    top = bottom;
    bottom = swap;
  }

  const span = top - bottom;
  if (span <= 0) {
    removeFundamentalsChartYAxisTickLabels(series, ticksRef);
    return;
  }

  const prices: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    prices.push(bottom + (span * i) / (tickCount - 1));
  }

  while (ticksRef.current.length > prices.length) {
    const line = ticksRef.current.pop();
    if (line) {
      try {
        series.removePriceLine(line);
      } catch {
        /* ignore */
      }
    }
  }

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i]!;
    const existing = ticksRef.current[i];
    if (existing) {
      existing.applyOptions({ price, ...Y_AXIS_LABEL_ONLY });
    } else {
      ticksRef.current.push(series.createPriceLine({ price, ...Y_AXIS_LABEL_ONLY }));
    }
  }
}
