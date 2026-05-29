"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  overviewChartAxisRowPx,
  CHART_PLOT_DOTS_PATTERN_CLASS,
  buildOverviewCrosshairLabelByBarTime,
  chartPointDisplayUnix,
  overviewAxisLabelsEqual,
  resolveOverviewBottomAxisMode,
  syncOverviewPeriodAxisLabels,
  type OverviewAxisLabel,
  type OverviewBottomAxisMode,
} from "@/components/chart/overview-bottom-axis";
import {
  AreaSeries,
  BaselineSeries,
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineStyle,
  LineType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { computeChartHeaderMetrics } from "@/components/chart/chart-display-metrics";
import { horzTimeToUnixSeconds, nearestPointByTime } from "@/components/chart/chart-selection-utils";
import {
  fitContentWithMobilePlotGutter,
  mobileOverviewChartScaleOptions,
  mobileTimeScaleOptions,
  shouldHideMobileYAxisLabels,
} from "@/lib/chart/mobile-plot-horizontal-gutter";
import { formatAssetChartTimestamp, usSessionWallClockUnix } from "@/lib/market/chart-timestamp-format";
import { baselineRelativeGradientEnabled } from "@/lib/chart/baseline-relative-gradient";
import { cn } from "@/lib/utils";
import type { StockChartRange, StockChartPoint, StockChartSeries } from "@/lib/market/stock-chart-types";

function formatStockPriceAxis(p: number): string {
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMarketCapAxis(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Total-return index (100 = range start); show as % from start. */
function formatReturnAxis(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const rel = n - 100;
  const sign = rel > 0 ? "+" : rel < 0 ? "−" : "";
  return `${sign}${Math.abs(rel).toFixed(2)}%`;
}

function formatOverviewChartAxisValue(
  value: number,
  kind: "stock" | "crypto",
  chartSeries: StockChartSeries,
): string {
  if (kind === "stock" && chartSeries === "marketCap") return formatMarketCapAxis(value);
  if (kind === "stock" && chartSeries === "return") return formatReturnAxis(value);
  return `$${formatStockPriceAxis(value)}`;
}

type RangeChartPriceBadge = {
  left: number;
  top: number;
  label: string;
  anchor: "start" | "center";
};

const RANGE_PRICE_BADGE_CLASS =
  "inline-block rounded-[6px] bg-[#E4E4E7] px-1.5 py-0.5 text-[11px] font-medium leading-4 tabular-nums text-[#09090B]";

function findRangeHighPoint(pts: readonly StockChartPoint[]): StockChartPoint | null {
  if (!pts.length) return null;
  let best = pts[0]!;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    if (!isFiniteNumber(p.value)) continue;
    if (p.value > best.value || (p.value === best.value && p.time >= best.time)) {
      best = p;
    }
  }
  return isFiniteNumber(best.value) ? best : null;
}

function layoutRangePriceBadge(
  chart: IChartApi,
  series: MainPriceSeries,
  point: StockChartPoint,
  anchor: RangeChartPriceBadge["anchor"],
  plotWidth: number,
): Pick<RangeChartPriceBadge, "left" | "top"> | null {
  const y = series.priceToCoordinate(point.value);
  const x = chart.timeScale().timeToCoordinate(point.time as UTCTimestamp);
  if (y == null || x == null || !Number.isFinite(y) || !Number.isFinite(x)) return null;
  const paneH = chart.paneSize(0).height;
  if (y < 4 || y > paneH) return null;
  const left =
    anchor === "center"
      ? Math.max(44, Math.min(plotWidth - 44, x))
      : Math.max(8, x);
  return { left, top: y };
}

export type ChartDisplayState = {
  loading: boolean;
  empty: boolean;
  displayPrice: number | null;
  displayChangePct: number | null;
  displayChangeAbs: number | null;
  /** Set when `selectionActive`: P/L over the dragged window only. */
  selectionChangeAbs: number | null;
  selectionChangePct: number | null;
  isHovering: boolean;
  selectionActive: boolean;
  periodLabelOverride: string | null;
  /** Formatted "Month D, YYYY at h:mm AM/PM TZ, USD"; null when no display time. */
  priceTimestampLabel: string | null;
};

export type HoldingsTradeMarker = { date: string; side: "buy" | "sell" };
export type HoldingsTradeTooltipItem = { date: string; lines: string[] };

type Props = {
  kind: "stock" | "crypto";
  symbol: string;
  range: StockChartRange;
  /** Stock overview: price vs market cap (market cap uses price × latest shares outstanding per point). */
  series?: StockChartSeries;
  height?: number;
  onDisplayChange?: (state: ChartDisplayState) => void;
  /** Server-provided series for the default overview range — avoids a duplicate chart fetch on first paint. */
  initialChart?: { range: StockChartRange; points: StockChartPoint[] } | null;
  /**
   * Asset Holdings tab: blue area chart, no range-drag P/L selection, optional avg-cost line + trade dots.
   * Does not call `onDisplayChange` (keeps stock/crypto header on overview metrics).
   */
  holdingsStyle?: boolean;
  /** Trade dates (yyyy-MM-dd) shown as green (buy) / red (sell) dots, snapped to bars in range. */
  tradeMarkers?: readonly HoldingsTradeMarker[];
  /** Optional: lines shown when hovering on a day with trade markers. Keyed by `date` (yyyy-MM-dd). */
  tradeTooltipItems?: readonly HoldingsTradeTooltipItem[];
  /** Avg cost — dashed horizontal price line when holdingsStyle. */
  costBasisPrice?: number | null;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const GREEN = "#16A34A";
const RED = "#DC2626";
const VALUE_BLUE = "#2563EB";
const BASELINE_LINE = "rgba(113, 113, 122, 0.55)";
/** Horizontal rules at the top and bottom of the plot pane (replaces default price grid). */
const SCALE_EDGE_LINE = "rgba(228, 228, 231, 0.85)";

/** Plain right-axis price labels (no horizontal rules). */
const Y_AXIS_LABEL_COUNT = 6;

const HIDE_NATIVE_Y_AXIS_TICK_LABELS = (priceValue: readonly number[]) => priceValue.map(() => "");

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

type MainPriceSeries = ISeriesApi<"Baseline"> | ISeriesApi<"Area">;

function removeScaleBoundsPriceLines(
  series: MainPriceSeries | null,
  topRef: RefObject<IPriceLine | null>,
  bottomRef: RefObject<IPriceLine | null>,
) {
  if (!series) {
    topRef.current = null;
    bottomRef.current = null;
    return;
  }
  if (topRef.current) {
    try {
      series.removePriceLine(topRef.current);
    } catch {
      /* ignore */
    }
    topRef.current = null;
  }
  if (bottomRef.current) {
    try {
      series.removePriceLine(bottomRef.current);
    } catch {
      /* ignore */
    }
    bottomRef.current = null;
  }
}

function removeSessionHighLowPriceLines(
  series: MainPriceSeries | null,
  highRef: RefObject<IPriceLine | null>,
  lowRef: RefObject<IPriceLine | null>,
) {
  if (!series) {
    highRef.current = null;
    lowRef.current = null;
    return;
  }
  for (const ref of [highRef, lowRef]) {
    if (ref.current) {
      try {
        series.removePriceLine(ref.current);
      } catch {
        /* ignore */
      }
      ref.current = null;
    }
  }
}

function removeYAxisTickLabels(series: MainPriceSeries | null, ticksRef: RefObject<IPriceLine[]>) {
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

/** Evenly spaced right-axis numbers without extra grid lines. */
function syncYAxisTickLabels(
  chart: IChartApi,
  series: MainPriceSeries,
  ticksRef: RefObject<IPriceLine[]>,
  tickCount: number = Y_AXIS_LABEL_COUNT,
) {
  const h = chart.paneSize(0).height;
  if (!Number.isFinite(h) || h <= 0 || tickCount < 2) {
    removeYAxisTickLabels(series, ticksRef);
    return;
  }

  const topPrice = series.coordinateToPrice(0);
  const bottomPrice = series.coordinateToPrice(h);
  if (topPrice == null || bottomPrice == null) {
    removeYAxisTickLabels(series, ticksRef);
    return;
  }

  let top = topPrice as number;
  let bottom = bottomPrice as number;
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
    removeYAxisTickLabels(series, ticksRef);
    return;
  }
  if (top < bottom) {
    const swap = top;
    top = bottom;
    bottom = swap;
  }

  const span = top - bottom;
  if (span <= 0) {
    removeYAxisTickLabels(series, ticksRef);
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

/**
 * In-bar series markers scale with `barSpacing` (LWCharts uses clamp(barSpacing, 12, 30) for shape height).
 * Sparse ranges (e.g. 1M) get oversized dots vs dense ranges (6M). Damp toward ~16px equivalent without exceeding default.
 */
function inBarMarkerSizeMultiplier(barSpacing: number): number {
  const clamped = Math.min(Math.max(barSpacing, 12), 30);
  return Math.min(1, 16 / clamped);
}

function scheduleScaledInBarMarkers(
  chart: IChartApi,
  markers: ISeriesMarkersPluginApi<UTCTimestamp>,
  templates: SeriesMarker<UTCTimestamp>[],
) {
  const apply = () => {
    const bs = chart.timeScale().options().barSpacing;
    const sm = inBarMarkerSizeMultiplier(bs);
    markers.setMarkers(templates.map((m) => ({ ...m, size: (m.size ?? 1) * sm })));
  };
  requestAnimationFrame(() => requestAnimationFrame(apply));
}

function isTouchLikeChartDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 767px)").matches
  );
}

type OverviewHoverUi = {
  point: { x: number; y: number };
  price: number;
  axisLabel: { leftPx: number; label: string };
};

function overviewHoverUiEqual(a: OverviewHoverUi | null, b: OverviewHoverUi | null): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return (
    a.point.x === b.point.x &&
    a.point.y === b.point.y &&
    a.price === b.price &&
    a.axisLabel.leftPx === b.axisLabel.leftPx &&
    a.axisLabel.label === b.axisLabel.label
  );
}

function overviewBaselineOptions(
  open: number,
  variant: "bright" | "dim",
  lightweight = false,
  relativeGradient = false,
) {
  const base = {
    baseValue: { type: "price" as const, price: open },
    relativeGradient: relativeGradient && !lightweight,
    lineWidth: 2 as const,
    lineType: lightweight ? LineType.Simple : LineType.Curved,
    priceLineVisible: false,
    lastPriceAnimation: lightweight
      ? LastPriceAnimationMode.Disabled
      : LastPriceAnimationMode.OnDataUpdate,
  };
  if (variant === "bright") {
    return {
      ...base,
      lastValueVisible: !lightweight,
      topFillColor1: "rgba(22, 163, 74, 0.20)",
      topFillColor2: "rgba(22, 163, 74, 0.03)",
      topLineColor: GREEN,
      bottomFillColor1: "rgba(220, 38, 38, 0.03)",
      bottomFillColor2: "rgba(220, 38, 38, 0.18)",
      bottomLineColor: RED,
      crosshairMarkerVisible: !lightweight,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
      crosshairMarkerBackgroundColor: "",
      crosshairMarkerBorderWidth: 2,
    };
  }
  return {
    ...base,
    lastValueVisible: false,
    topFillColor1: "rgba(22, 163, 74, 0.08)",
    topFillColor2: "rgba(22, 163, 74, 0.02)",
    topLineColor: "rgba(22, 163, 74, 0.38)",
    bottomFillColor1: "rgba(220, 38, 38, 0.02)",
    bottomFillColor2: "rgba(220, 38, 38, 0.08)",
    bottomLineColor: "rgba(220, 38, 38, 0.38)",
    lastPriceAnimation: LastPriceAnimationMode.Disabled,
    crosshairMarkerVisible: false,
  };
}

function ymdToBarTime(ymd: string, data: readonly { time: UTCTimestamp }[]): UTCTimestamp | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, mo, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const midnight = Math.floor(Date.UTC(y, mo - 1, d) / 1000) as UTCTimestamp;
  if (data.some((p) => p.time === midnight)) return midnight;
  const dayEnd = midnight + 86400;
  const onDay = data.filter((p) => p.time >= midnight && p.time < dayEnd);
  if (onDay.length > 0) return onDay[onDay.length - 1]!.time;
  return null;
}

function tradeMarkersForChart(
  tradeMarkers: readonly HoldingsTradeMarker[],
  data: readonly { time: UTCTimestamp }[],
): SeriesMarker<UTCTimestamp>[] {
  const out: SeriesMarker<UTCTimestamp>[] = [];
  for (const tm of tradeMarkers) {
    const time = ymdToBarTime(tm.date, data);
    if (time == null) continue;
    out.push({
      time,
      position: "inBar",
      shape: "circle",
      color: tm.side === "buy" ? GREEN : RED,
      size: 2,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

function costBasisPriceLineTitle(price: number): string {
  const s = price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `My cost / sh: $${s}`;
}

function ymdFromUnixSeconds(sec: number): string | null {
  if (!Number.isFinite(sec)) return null;
  try {
    return new Date(sec * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/** `ymd` is yyyy-MM-dd (UTC calendar day of the bar). */
function formatTradeTooltipDateHeader(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, mo, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const TOOLTIP_MAX_W = 280;
const TOOLTIP_GAP_PX = 6;
const TOOLTIP_EDGE_PAD = 8;

/** Keeps tooltips inside the chart box, flips below the crosshair when there is not enough room above (avoids clipping + large offset). */
function layoutPointTooltip(
  hover: { x: number; y: number },
  containerWidth: number,
  chartHeight: number,
  estimatedHeight: number,
): { left: number; top: number; transform: string } {
  const left = Math.min(
    Math.max(TOOLTIP_EDGE_PAD, hover.x + TOOLTIP_GAP_PX),
    Math.max(TOOLTIP_EDGE_PAD, containerWidth - TOOLTIP_MAX_W - TOOLTIP_EDGE_PAD),
  );
  const minTop = TOOLTIP_EDGE_PAD;
  const bottomLimit = chartHeight - TOOLTIP_EDGE_PAD;
  const placeAbove = hover.y >= estimatedHeight + TOOLTIP_GAP_PX + minTop;

  if (placeAbove) {
    return { left, top: hover.y - TOOLTIP_GAP_PX, transform: "translateY(-100%)" };
  }
  const top = Math.max(minTop, Math.min(hover.y + TOOLTIP_GAP_PX, bottomLimit - estimatedHeight));
  return { left, top, transform: "none" };
}

export function PriceChart({
  kind,
  symbol,
  range,
  series = "price",
  height = 320,
  onDisplayChange,
  initialChart,
  holdingsStyle = false,
  tradeMarkers = [],
  tradeTooltipItems = [],
  costBasisPrice = null,
}: Props) {
  const holdingsStyleRef = useRef(holdingsStyle);
  const chartMetricSeriesRef = useRef(series);
  const kindRef = useRef(kind);
  const rangeRef = useRef(range);
  const loadingRef = useRef(true);

  useEffect(() => {
    holdingsStyleRef.current = holdingsStyle;
  }, [holdingsStyle]);

  useEffect(() => {
    chartMetricSeriesRef.current = series;
  }, [series]);

  const containerRef = useRef<HTMLDivElement>(null);
  const initialConsumedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Baseline"> | ISeriesApi<"Area"> | null>(null);
  const baselinePriceLineRef = useRef<IPriceLine | null>(null);
  const sessionHighPriceLineRef = useRef<IPriceLine | null>(null);
  const sessionLowPriceLineRef = useRef<IPriceLine | null>(null);
  const scaleTopPriceLineRef = useRef<IPriceLine | null>(null);
  const scaleBottomPriceLineRef = useRef<IPriceLine | null>(null);
  const yAxisTickLinesRef = useRef<IPriceLine[]>([]);
  const costBasisLineRef = useRef<IPriceLine | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  /** Base in-bar marker templates (before bar-spacing scale) for overview. */
  const overviewInBarMarkersRef = useRef<SeriesMarker<UTCTimestamp>[] | null>(null);
  const rescaleOverviewInBarMarkersRef = useRef<(() => void) | null>(null);
  const syncRangePriceBadgesRef = useRef<(() => void) | null>(null);
  const splitSeriesBundleRef = useRef<{
    left: ISeriesApi<"Baseline">;
    mid: ISeriesApi<"Baseline">;
    right: ISeriesApi<"Baseline">;
  } | null>(null);
  const pointsRef = useRef<StockChartPoint[]>([]);
  const containerWidthRef = useRef(0);
  const hideMobileYAxisLabelsRef = useRef(false);
  const mobileHoverBarTimeRef = useRef<number | null>(null);
  const mobileHoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const overviewTooltipRef = useRef<HTMLDivElement>(null);
  const overviewTooltipTextRef = useRef<HTMLParagraphElement>(null);

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<StockChartPoint[]>([]);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTimeUnix, setHoverTimeUnix] = useState<number | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverPointRafRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [rangeOpenBadge, setRangeOpenBadge] = useState<RangeChartPriceBadge | null>(null);
  const [rangeHighBadge, setRangeHighBadge] = useState<RangeChartPriceBadge | null>(null);
  const [periodAxisLabels, setPeriodAxisLabels] = useState<OverviewAxisLabel[]>([]);
  const periodAxisLabelsRef = useRef<OverviewAxisLabel[]>([]);
  const [hoverAxisLabel, setHoverAxisLabel] = useState<{ leftPx: number; label: string } | null>(
    null,
  );
  const hoverTimeRef = useRef<Time | null>(null);
  const hoverPriceValueRef = useRef<number | null>(null);
  const hoverTimeUnixValueRef = useRef<number | null>(null);
  const hoverAxisLabelStateRef = useRef<{ leftPx: number; label: string } | null>(null);
  const crosshairHoveredRef = useRef(false);
  const dataTimeZoneRef = useRef("America/New_York");
  const overviewBottomAxisModeRef = useRef<OverviewBottomAxisMode>("calendar");
  const overviewCrosshairLabelByBarTimeRef = useRef<Map<number, string> | null>(null);
  const [overviewHover, setOverviewHover] = useState<OverviewHoverUi | null>(null);
  const overviewHoverDraftRef = useRef<OverviewHoverUi | null>(null);
  const overviewHoverRafRef = useRef(0);
  const dimOverlayRef = useRef<HTMLDivElement>(null);
  const overviewBottomAxisMode = useMemo(
    () => resolveOverviewBottomAxisMode(range, points),
    [range, points],
  );

  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);

  useEffect(() => {
    rangeRef.current = range;
  }, [range]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    overviewBottomAxisModeRef.current = overviewBottomAxisMode;
  }, [overviewBottomAxisMode]);

  const setPeriodAxisLabelsGuarded = (next: OverviewAxisLabel[]) => {
    if (overviewAxisLabelsEqual(periodAxisLabelsRef.current, next)) return;
    periodAxisLabelsRef.current = next;
    setPeriodAxisLabels(next);
  };

  const setHoverPriceGuarded = (value: number | null) => {
    if (hoverPriceValueRef.current === value) return;
    hoverPriceValueRef.current = value;
    setHoverPrice(value);
  };

  const setHoverTimeUnixGuarded = (value: number | null) => {
    if (hoverTimeUnixValueRef.current === value) return;
    hoverTimeUnixValueRef.current = value;
    setHoverTimeUnix(value);
  };

  const setHoverAxisLabelGuarded = (next: { leftPx: number; label: string } | null) => {
    const prev = hoverAxisLabelStateRef.current;
    if (prev == null && next == null) return;
    if (prev != null && next != null && prev.leftPx === next.leftPx && prev.label === next.label) return;
    hoverAxisLabelStateRef.current = next;
    setHoverAxisLabel(next);
  };

  // Portfolio (holdingsStyle) should behave like Overview: custom bottom axis + hover/badges.
  const useCustomBottomAxis = true;
  const axisRowPx = overviewChartAxisRowPx(containerWidth);
  const plotHeight = useCustomBottomAxis ? Math.max(120, height - axisRowPx) : height;
  const useMobileOverviewCrosshair =
    useCustomBottomAxis && shouldHideMobileYAxisLabels(containerWidth);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (points.length === 0) {
      overviewCrosshairLabelByBarTimeRef.current = null;
      return;
    }
    const tz =
      points.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone ??
      (kind === "stock" ? "America/New_York" : "UTC");
    overviewCrosshairLabelByBarTimeRef.current = buildOverviewCrosshairLabelByBarTime(
      points,
      tz,
      range,
      overviewBottomAxisMode,
    );
  }, [range, kind, points, overviewBottomAxisMode]);

  useEffect(() => {
    containerWidthRef.current = containerWidth;
    hideMobileYAxisLabelsRef.current = shouldHideMobileYAxisLabels(containerWidth);
  }, [containerWidth]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart) return;
    const hide = shouldHideMobileYAxisLabels(containerWidth);
    hideMobileYAxisLabelsRef.current = hide;
    chart.applyOptions({
      ...mobileOverviewChartScaleOptions(containerWidth),
      // Keep native time ticks off when using the custom bottom axis; otherwise we render
      // both native ticks and our labels (causes overlapping like "6AM 6AM").
      timeScale: {
        ...mobileTimeScaleOptions(containerWidth),
        ticksVisible: !useCustomBottomAxis,
        tickMarkFormatter: useCustomBottomAxis ? () => "" : undefined,
        minimumHeight: useCustomBottomAxis ? 0 : undefined,
      },
      crosshair: {
        mode: hide ? CrosshairMode.Normal : CrosshairMode.Magnet,
      },
    });
    const wrapEl = wrapRef.current;
    if (wrapEl) {
      chart.resize(Math.max(2, wrapEl.clientWidth), plotHeight);
    }
    if (series) {
      if (holdingsStyle) {
        series.applyOptions({ lastValueVisible: !hide });
      } else {
        const pts = pointsRef.current;
        const openPt = pts.find((p) => isFiniteNumber(p.value));
        const relGrad =
          !hide &&
          openPt != null &&
          baselineRelativeGradientEnabled(
            pts.filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value)).map((p) => ({
              value: p.value,
            })),
            openPt.value,
          );
        series.applyOptions({
          lastValueVisible: !hide,
          relativeGradient: relGrad,
          lineType: hide ? LineType.Simple : LineType.Curved,
          lastPriceAnimation: hide
            ? LastPriceAnimationMode.Disabled
            : LastPriceAnimationMode.OnDataUpdate,
          crosshairMarkerVisible: !hide,
        });
      }
      if (hide) {
        removeYAxisTickLabels(series, yAxisTickLinesRef);
      } else {
        syncYAxisTickLabels(chart, series, yAxisTickLinesRef);
      }
      if (pointsRef.current.some((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))) {
        fitContentWithMobilePlotGutter(chart, containerWidth, pointsRef.current.length);
      }
    }
  }, [containerWidth, plotHeight]);

  useEffect(() => {
    dataTimeZoneRef.current =
      points.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone ??
      (kind === "stock" ? "America/New_York" : "UTC");
  }, [points, kind]);

  useEffect(() => {
    if (!useCustomBottomAxis || holdingsStyle || loading) return;
    const c = chartRef.current;
    if (!c || hoverTimeRef.current != null || pointsRef.current.length === 0) return;
    setPeriodAxisLabelsGuarded(
      syncOverviewPeriodAxisLabels(
        c,
        pointsRef.current,
        dataTimeZoneRef.current,
        overviewBottomAxisMode,
        containerWidthRef.current,
      ),
    );
  }, [overviewBottomAxisMode, useCustomBottomAxis, holdingsStyle, points, containerWidth, loading]);

  // Even on holdings (Portfolio) charts, hover should NOT drive the page header price.
  // Hover is used only for in-chart UI (tooltip, bottom axis label, dim overlay).
  const crosshairForHeader = useMemo((): { price: number; timeUnix: number } | null => null, []);

  const metrics = useMemo(
    () => computeChartHeaderMetrics(points, null, crosshairForHeader),
    [points, crosshairForHeader],
  );

  const tooltipByDate = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const it of tradeTooltipItems) {
      const k = it.date.trim();
      if (!k) continue;
      const lines = Array.isArray(it.lines) ? it.lines.filter((s) => typeof s === "string" && s.trim()) : [];
      if (lines.length) m.set(k, lines);
    }
    return m;
  }, [tradeTooltipItems]);

  const dataTimeZoneHint = useMemo(
    () => points.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone,
    [points],
  );

  const lastPointStroke = useMemo(() => {
    const first = points.find((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value));
    if (first == null || points.length < 1) return GREEN;
    const last = points[points.length - 1]?.value;
    return isFiniteNumber(last) && last < first.value ? RED : GREEN;
  }, [points]);

  const pushDisplay = useCallback(() => {
    if (!onDisplayChange) return;
    const priceTimestampLabel =
      metrics.displayTimeUnix != null && Number.isFinite(metrics.displayTimeUnix)
        ? formatAssetChartTimestamp(metrics.displayTimeUnix, {
            kind,
            timeZone: dataTimeZoneHint,
          })
        : null;
    onDisplayChange({
      // Keep header stable during background refetch — still have prior bars to display.
      loading: loading && metrics.displayPrice == null,
      empty: !loading && points.length === 0,
      displayPrice: metrics.displayPrice,
      displayChangePct: metrics.displayChangePct,
      displayChangeAbs: metrics.displayChangeAbs,
      selectionChangeAbs: metrics.selectionChangeAbs,
      selectionChangePct: metrics.selectionChangePct,
      isHovering: metrics.isHovering,
      selectionActive: metrics.selectionActive,
      periodLabelOverride: metrics.periodLabelOverride,
      priceTimestampLabel,
    });
  }, [loading, points.length, metrics, onDisplayChange, kind, dataTimeZoneHint]);

  useEffect(() => {
    pushDisplay();
  }, [pushDisplay]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let widthTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (widthTimer) clearTimeout(widthTimer);
      widthTimer = setTimeout(() => setContainerWidth(el.clientWidth), 100);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => {
      if (widthTimer) clearTimeout(widthTimer);
      ro.disconnect();
    };
  }, []);

  /** Reset hover + bottom axis when series/range/etc. change (avoid stale label smear while loading). */
  const clearMobileOverviewCrosshairDom = useCallback(() => {
    mobileHoverBarTimeRef.current = null;
    mobileHoverPointRef.current = null;
    setHoverAxisLabelGuarded(null);
    if (dimOverlayRef.current) dimOverlayRef.current.style.display = "none";
    if (overviewTooltipRef.current) overviewTooltipRef.current.style.display = "none";
  }, []);

  const flushOverviewHover = useCallback(() => {
    overviewHoverRafRef.current = 0;
    const draft = overviewHoverDraftRef.current;
    setOverviewHover((prev) => (overviewHoverUiEqual(prev, draft) ? prev : draft));
    if (dimOverlayRef.current) {
      if (draft) {
        dimOverlayRef.current.style.display = "";
        dimOverlayRef.current.style.left = `${Math.max(0, draft.point.x)}px`;
      } else {
        dimOverlayRef.current.style.display = "none";
      }
    }
  }, []);

  const scheduleOverviewHoverFlush = useCallback(() => {
    if (!overviewHoverRafRef.current) {
      overviewHoverRafRef.current = requestAnimationFrame(flushOverviewHover);
    }
  }, [flushOverviewHover]);

  const clearOverviewHover = useCallback(() => {
    overviewHoverDraftRef.current = null;
    if (overviewHoverRafRef.current) {
      cancelAnimationFrame(overviewHoverRafRef.current);
      overviewHoverRafRef.current = 0;
    }
    setOverviewHover(null);
    clearMobileOverviewCrosshairDom();
  }, [clearMobileOverviewCrosshairDom]);

  useLayoutEffect(() => {
    hoverTimeRef.current = null;
    crosshairHoveredRef.current = false;
    initialConsumedRef.current = false;

    overviewHoverDraftRef.current = null;
    if (overviewHoverRafRef.current) {
      cancelAnimationFrame(overviewHoverRafRef.current);
      overviewHoverRafRef.current = 0;
    }

    // Defer React state updates to avoid cascading render warnings in effects.
    requestAnimationFrame(() => {
      setHoverTimeUnixGuarded(null);
      setHoverAxisLabelGuarded(null);
      setPeriodAxisLabelsGuarded([]);
      setOverviewHover(null);
      clearMobileOverviewCrosshairDom();
    });
  }, [kind, symbol, range, series, holdingsStyle, clearMobileOverviewCrosshairDom]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: Math.max(2, el.clientWidth),
      height: plotHeight,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: "#71717A",
        fontSize: 11,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        attributionLogo: false,
      },
      localization: {
        tickmarksPriceFormatter: HIDE_NATIVE_Y_AXIS_TICK_LABELS,
      },
      grid: {
        vertLines: { visible: false },
        // Overview: no tick grid — session high/low + dashed open use `createPriceLine` instead. Holdings: off.
        horzLines: { visible: false, color: SCALE_EDGE_LINE, style: LineStyle.Solid },
      },
      ...mobileOverviewChartScaleOptions(containerWidthRef.current),
      timeScale: {
        borderVisible: false,
        ...mobileTimeScaleOptions(containerWidthRef.current),
        ticksVisible: !useCustomBottomAxis,
        tickMarkFormatter: useCustomBottomAxis ? () => "" : undefined,
        minimumHeight: useCustomBottomAxis ? 0 : undefined,
      },
      crosshair: {
        mode: hideMobileYAxisLabelsRef.current ? CrosshairMode.Normal : CrosshairMode.Magnet,
        vertLine: {
          color: "rgba(9, 9, 11, 0.28)",
          labelVisible: false,
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = holdingsStyle
      ? chart.addSeries(AreaSeries, {
          lineColor: VALUE_BLUE,
          topColor: "rgba(37, 99, 235, 0.22)",
          bottomColor: "rgba(37, 99, 235, 0.02)",
          lineWidth: 2,
          lineType: LineType.Curved,
          priceLineVisible: false,
          lastValueVisible: false,
          lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
          crosshairMarkerBackgroundColor: VALUE_BLUE,
          crosshairMarkerBorderWidth: 2,
        })
      : chart.addSeries(BaselineSeries, {
          baseValue: { type: "price", price: 0 },
          relativeGradient: false,
          topFillColor1: "rgba(22, 163, 74, 0.20)",
          topFillColor2: "rgba(22, 163, 74, 0.03)",
          topLineColor: GREEN,
          bottomFillColor1: "rgba(220, 38, 38, 0.03)",
          bottomFillColor2: "rgba(220, 38, 38, 0.18)",
          bottomLineColor: RED,
          lineWidth: 2,
          lineType: LineType.Curved,
          priceLineVisible: false,
          lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
      crosshairMarkerBackgroundColor: "",
      crosshairMarkerBorderWidth: 2,
    });

    const markers = createSeriesMarkers(series, [], { autoScale: true });
    markersRef.current = markers as ISeriesMarkersPluginApi<UTCTimestamp>;

    chartRef.current = chart;
    seriesRef.current = series;

    const resyncPeriodAxisLabels = () => {
      if (!useCustomBottomAxis || loadingRef.current) return;
      const c = chartRef.current;
      if (!c || hoverTimeRef.current != null || pointsRef.current.length === 0) return;
      setPeriodAxisLabelsGuarded(
        syncOverviewPeriodAxisLabels(
          c,
          pointsRef.current,
          dataTimeZoneRef.current,
          overviewBottomAxisModeRef.current,
          containerWidthRef.current,
        ),
      );
    };

    const overviewMetricTitleForTooltip =
      chartMetricSeriesRef.current === "marketCap"
        ? "Market cap"
        : chartMetricSeriesRef.current === "return"
          ? "Return"
          : "Price";

    const applyMobileOverviewCrosshair = (
      point: { x: number; y: number },
      nearBar: StockChartPoint,
    ) => {
      mobileHoverPointRef.current = point;
      if (dimOverlayRef.current) {
        dimOverlayRef.current.style.display = "";
        dimOverlayRef.current.style.left = `${Math.max(0, point.x)}px`;
      }
      const tip = overviewTooltipRef.current;
      const tipText = overviewTooltipTextRef.current;
      const plotW = containerWidthRef.current;
      if (tip && tipText && plotW > 0) {
        const valueLabel = formatOverviewChartAxisValue(
          nearBar.value,
          kindRef.current,
          chartMetricSeriesRef.current,
        );
        tipText.textContent = `${overviewMetricTitleForTooltip}: ${valueLabel}`;
        const pos = layoutPointTooltip(point, plotW, plotHeight, 40);
        tip.style.display = "block";
        tip.style.left = `${pos.left}px`;
        tip.style.top = `${pos.top}px`;
        tip.style.transform = pos.transform;
      }
      if (mobileHoverBarTimeRef.current !== nearBar.time) {
        mobileHoverBarTimeRef.current = nearBar.time;
        const xCoord = chart.timeScale().timeToCoordinate(nearBar.time as UTCTimestamp);
        const leftPx = xCoord != null && Number.isFinite(xCoord) ? xCoord : point.x;
        const label = overviewCrosshairLabelByBarTimeRef.current?.get(nearBar.time) ?? "";
        setHoverAxisLabelGuarded({ leftPx, label });
      }
    };

    const onCrosshairMove = (param: MouseEventParams) => {
      const s = seriesRef.current;
      if (!s) return;
      if (param.point === undefined || param.point.x < 0 || param.point.y < 0 || param.time === undefined) {
        const wasHovered = crosshairHoveredRef.current;
        crosshairHoveredRef.current = false;
        hoverTimeRef.current = null;
        if (holdingsStyleRef.current) {
          setHoverPriceGuarded(null);
          setHoverTimeUnixGuarded(null);
          hoverPointRef.current = null;
          setHoverAxisLabelGuarded(null);
          if (hoverPointRafRef.current) {
            cancelAnimationFrame(hoverPointRafRef.current);
            hoverPointRafRef.current = 0;
          }
          setHoverPoint(null);
        } else if (hideMobileYAxisLabelsRef.current) {
          clearMobileOverviewCrosshairDom();
        } else {
          clearOverviewHover();
        }
        return;
      }

      if (!holdingsStyleRef.current) {
        const sec = horzTimeToUnixSeconds(param.time as Time);
        const nearBar = sec != null ? nearestPointByTime(pointsRef.current, sec) : null;
        if (nearBar && isFiniteNumber(nearBar.time) && isFiniteNumber(nearBar.value)) {
          crosshairHoveredRef.current = true;
          hoverTimeRef.current = param.time as Time;
          if (hideMobileYAxisLabelsRef.current) {
            applyMobileOverviewCrosshair(
              { x: param.point.x, y: param.point.y },
              nearBar,
            );
          } else {
            const xCoord = chart.timeScale().timeToCoordinate(nearBar.time as UTCTimestamp);
            const leftPx = xCoord != null && Number.isFinite(xCoord) ? xCoord : param.point.x;
            const label = overviewCrosshairLabelByBarTimeRef.current?.get(nearBar.time) ?? "";
            overviewHoverDraftRef.current = {
              point: { x: param.point.x, y: param.point.y },
              price: nearBar.value,
              axisLabel: { leftPx, label },
            };
            scheduleOverviewHoverFlush();
          }
        } else {
          const wasHovered = crosshairHoveredRef.current;
          crosshairHoveredRef.current = false;
          hoverTimeRef.current = null;
          if (hideMobileYAxisLabelsRef.current) {
            clearMobileOverviewCrosshairDom();
          } else {
            clearOverviewHover();
            if (wasHovered) resyncPeriodAxisLabels();
          }
        }
        return;
      }

      const nextPt = { x: param.point.x, y: param.point.y };
      const prev = hoverPointRef.current;
      if (!prev || prev.x !== nextPt.x || prev.y !== nextPt.y) {
        hoverPointRef.current = nextPt;
        if (!hoverPointRafRef.current) {
          hoverPointRafRef.current = requestAnimationFrame(() => {
            hoverPointRafRef.current = 0;
            setHoverPoint(hoverPointRef.current);
          });
        }
      }
      let hoverValue: number | null = null;
      let tunix: number | null = null;
      let nearBar: StockChartPoint | null = null;
      const data = param.seriesData.get(s);
      if (data && typeof data === "object" && "value" in data && isFiniteNumber((data as { value: number }).value)) {
        hoverValue = (data as { value: number }).value;
        const row = data as { value: number; time?: UTCTimestamp };
        tunix =
          typeof row.time === "number" && Number.isFinite(row.time) ? row.time : horzTimeToUnixSeconds(param.time as Time);
        if (typeof row.time === "number" && Number.isFinite(row.time)) {
          nearBar = { time: row.time, value: hoverValue };
        }
      } else {
        const sec = horzTimeToUnixSeconds(param.time as Time);
        nearBar = sec != null ? nearestPointByTime(pointsRef.current, sec) : null;
        if (nearBar && isFiniteNumber(nearBar.time) && isFiniteNumber(nearBar.value)) {
          hoverValue = nearBar.value;
          tunix = chartPointDisplayUnix(nearBar, overviewBottomAxisModeRef.current);
        }
      }
      if (hoverValue != null && tunix != null) {
        crosshairHoveredRef.current = true;
        setHoverPriceGuarded(hoverValue);
        setHoverTimeUnixGuarded(tunix);

        // Match overview hover UX: dim overlay, tooltip, and bottom axis label.
        if (hoverPointRef.current) {
          const barTime = nearBar && isFiniteNumber(nearBar.time) ? nearBar.time : tunix;
          const xCoord = chart.timeScale().timeToCoordinate(barTime as UTCTimestamp);
          const leftPx = xCoord != null && Number.isFinite(xCoord) ? xCoord : hoverPointRef.current.x;
          const label = overviewCrosshairLabelByBarTimeRef.current?.get(barTime) ?? "";
          setHoverAxisLabelGuarded({ leftPx, label });
          overviewHoverDraftRef.current = {
            point: hoverPointRef.current,
            price: hoverValue,
            axisLabel: { leftPx, label },
          };
          scheduleOverviewHoverFlush();
        }
      } else {
        const wasHovered = crosshairHoveredRef.current;
        crosshairHoveredRef.current = false;
        setHoverPriceGuarded(null);
        setHoverTimeUnixGuarded(null);
        hoverPointRef.current = null;
        hoverTimeRef.current = null;
        if (hoverPointRafRef.current) {
          cancelAnimationFrame(hoverPointRafRef.current);
          hoverPointRafRef.current = 0;
        }
        setHoverPoint(null);
        setHoverAxisLabelGuarded(null);
        clearOverviewHover();
        if (wasHovered) resyncPeriodAxisLabels();
      }
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    rescaleOverviewInBarMarkersRef.current = () => {
      const c = chartRef.current;
      const m = markersRef.current;
      const templates = overviewInBarMarkersRef.current;
      if (!c || !m || !templates?.length) return;
      scheduleScaledInBarMarkers(c, m, templates);
    };
    syncRangePriceBadgesRef.current = () => {
      if (hideMobileYAxisLabelsRef.current && crosshairHoveredRef.current) return;
      const chart = chartRef.current;
      const s = seriesRef.current;
      if (!chart || !s) {
        setRangeOpenBadge(null);
        setRangeHighBadge(null);
        return;
      }
      const pts = pointsRef.current.filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value));
      const first = pts[0];
      if (!first) {
        setRangeOpenBadge(null);
        setRangeHighBadge(null);
        return;
      }
      const plotWidth = containerRef.current?.clientWidth ?? chart.paneSize(0).width;
      const metric = chartMetricSeriesRef.current;
      const openLayout = layoutRangePriceBadge(chart, s, first, "start", plotWidth);
      setRangeOpenBadge(
        openLayout
          ? {
              ...openLayout,
              label: formatOverviewChartAxisValue(first.value, kind, metric),
              anchor: "start",
            }
          : null,
      );

      const highPt = findRangeHighPoint(pts);
      if (
        !highPt ||
        (highPt.time === first.time && Math.abs(highPt.value - first.value) < 1e-9)
      ) {
        setRangeHighBadge(null);
        return;
      }
      const highLayout = layoutRangePriceBadge(chart, s, highPt, "center", plotWidth);
      setRangeHighBadge(
        highLayout
          ? {
              ...highLayout,
              label: formatOverviewChartAxisValue(highPt.value, kind, metric),
              anchor: "center",
            }
          : null,
      );
    };
    const syncBoundsLines = () => {
      const c = chartRef.current;
      const s = seriesRef.current;
      if (!c || !s) return;
      requestAnimationFrame(() => {
        const c2 = chartRef.current;
        const s2 = seriesRef.current;
        if (!c2 || !s2) return;
        removeScaleBoundsPriceLines(s2, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        if (!hideMobileYAxisLabelsRef.current) {
          syncYAxisTickLabels(c2, s2, yAxisTickLinesRef);
        } else {
          removeYAxisTickLabels(s2, yAxisTickLinesRef);
        }
        syncRangePriceBadgesRef.current?.();
      });
    };
    let visRangeTimer: ReturnType<typeof setTimeout> | null = null;
    const runVisRangeSideEffects = () => {
      rescaleOverviewInBarMarkersRef.current?.();
      syncBoundsLines();
    };
    const onVisRangeForMarkers = () => {
      if (hideMobileYAxisLabelsRef.current && crosshairHoveredRef.current) return;
      if (visRangeTimer) clearTimeout(visRangeTimer);
      visRangeTimer = setTimeout(runVisRangeSideEffects, hideMobileYAxisLabelsRef.current ? 200 : 100);
    };
    const ts = chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(onVisRangeForMarkers);
    ts.subscribeVisibleTimeRangeChange(onVisRangeForMarkers);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = Math.max(2, el.clientWidth);
        chart.resize(w, plotHeight);
        const plotW = containerRef.current?.clientWidth ?? w;
        if (pointsRef.current.some((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))) {
          fitContentWithMobilePlotGutter(chart, plotW, pointsRef.current.length);
        }
        onVisRangeForMarkers();
        if (!holdingsStyleRef.current && hoverTimeRef.current != null) {
          const sec = horzTimeToUnixSeconds(hoverTimeRef.current);
          const near = sec != null ? nearestPointByTime(pointsRef.current, sec) : null;
          if (near && isFiniteNumber(near.time) && isFiniteNumber(near.value)) {
            if (hideMobileYAxisLabelsRef.current) {
              const pt = mobileHoverPointRef.current ?? { x: 0, y: 0 };
              applyMobileOverviewCrosshair(pt, near);
            } else {
              const x = chart.timeScale().timeToCoordinate(near.time as UTCTimestamp);
              if (x != null && Number.isFinite(x)) {
                const label = overviewCrosshairLabelByBarTimeRef.current?.get(near.time) ?? "";
                const prev = overviewHoverDraftRef.current;
                overviewHoverDraftRef.current = {
                  point: prev?.point ?? { x, y: 0 },
                  price: near.value,
                  axisLabel: { leftPx: x, label },
                };
                scheduleOverviewHoverFlush();
              }
            }
          }
        } else if (!hideMobileYAxisLabelsRef.current || hoverTimeRef.current == null) {
          resyncPeriodAxisLabels();
        }
      }, 100);
    });
    ro.observe(el);
    chart.resize(Math.max(2, el.clientWidth), plotHeight);

    return () => {
      if (visRangeTimer) clearTimeout(visRangeTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      ts.unsubscribeVisibleLogicalRangeChange(onVisRangeForMarkers);
      ts.unsubscribeVisibleTimeRangeChange(onVisRangeForMarkers);
      rescaleOverviewInBarMarkersRef.current = null;
      syncRangePriceBadgesRef.current = null;
      overviewInBarMarkersRef.current = null;
      setRangeOpenBadge(null);
      setRangeHighBadge(null);
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      markersRef.current = null;
      const sUnmount = seriesRef.current;
      if (sUnmount) {
        removeScaleBoundsPriceLines(sUnmount, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        removeSessionHighLowPriceLines(sUnmount, sessionHighPriceLineRef, sessionLowPriceLineRef);
        removeYAxisTickLabels(sUnmount, yAxisTickLinesRef);
      }
      baselinePriceLineRef.current = null;
      costBasisLineRef.current = null;
      splitSeriesBundleRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [
    plotHeight,
    holdingsStyle,
    useCustomBottomAxis,
    clearOverviewHover,
    scheduleOverviewHoverFlush,
    clearMobileOverviewCrosshairDom,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const fmt =
      kind === "stock" && series === "marketCap"
        ? formatMarketCapAxis
        : kind === "stock" && series === "return"
          ? formatReturnAxis
          : formatStockPriceAxis;
    chart.applyOptions({
      localization: {
        priceFormatter: fmt,
        tickmarksPriceFormatter: HIDE_NATIVE_Y_AXIS_TICK_LABELS,
      },
    });
  }, [kind, series]);

  useEffect(() => {
    initialConsumedRef.current = false;
  }, [kind, symbol, range, series]);

  // Fetch
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (
        series === "price" &&
        initialChart &&
        initialChart.range === range &&
        initialChart.points.length > 0 &&
        !initialConsumedRef.current
      ) {
        initialConsumedRef.current = true;
        setLoading(true);
        setPeriodAxisLabelsGuarded([]);
        setHoverPriceGuarded(null);
        setHoverTimeUnixGuarded(null);
        setReady(false);
        setPoints(initialChart.points);
        setLoading(false);
        requestAnimationFrame(() => setReady(true));
        return;
      }

      setLoading(true);
      setPeriodAxisLabelsGuarded([]);
      setHoverPriceGuarded(null);
      setHoverTimeUnixGuarded(null);
      setReady(false);
      const path =
        kind === "stock"
          ? `/api/stocks/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}&series=${encodeURIComponent(series)}`
          : `/api/crypto/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}`;
      try {
        const res = await fetch(path, { credentials: "include" });
        if (!res.ok) {
          if (!mounted) return;
          setPoints([]);
          setLoading(false);
          requestAnimationFrame(() => setReady(true));
          return;
        }
        const json = (await res.json()) as { points?: StockChartPoint[] };
        if (!mounted) return;
        setPoints(Array.isArray(json.points) ? json.points : []);
        setLoading(false);
        requestAnimationFrame(() => setReady(true));
      } catch {
        if (!mounted) return;
        setPoints([]);
        setLoading(false);
        requestAnimationFrame(() => setReady(true));
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [kind, symbol, range, series, initialChart]);

  // Series data, price lines, markers
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const removeSplitBundle = () => {
      const bundle = splitSeriesBundleRef.current;
      if (!bundle) return;
      if (baselinePriceLineRef.current) {
        try {
          bundle.mid.removePriceLine(baselinePriceLineRef.current);
        } catch {
          /* ignore */
        }
        baselinePriceLineRef.current = null;
      }
      removeScaleBoundsPriceLines(bundle.mid, scaleTopPriceLineRef, scaleBottomPriceLineRef);
      removeSessionHighLowPriceLines(bundle.mid, sessionHighPriceLineRef, sessionLowPriceLineRef);
      markersRef.current = null;
      overviewInBarMarkersRef.current = null;
      try {
        chart.removeSeries(bundle.left);
        chart.removeSeries(bundle.right);
        chart.removeSeries(bundle.mid);
      } catch {
        /* ignore */
      }
      splitSeriesBundleRef.current = null;
      seriesRef.current = null;
    };

    const removeOverviewSingleBaselineLine = (s: ISeriesApi<"Baseline"> | ISeriesApi<"Area">) => {
      if (baselinePriceLineRef.current) {
        try {
          s.removePriceLine(baselinePriceLineRef.current);
        } catch {
          /* ignore */
        }
        baselinePriceLineRef.current = null;
      }
    };

    const removeCostLine = () => {
      const s = seriesRef.current;
      if (!s || !costBasisLineRef.current) return;
      try {
        s.removePriceLine(costBasisLineRef.current);
      } catch {
        /* ignore */
      }
      costBasisLineRef.current = null;
    };

    const ensureOverviewSingleSeries = (
      open: number,
      relGrad: boolean,
    ): ISeriesApi<"Baseline"> => {
      if (splitSeriesBundleRef.current) {
        removeSplitBundle();
      }
      const existing = seriesRef.current;
      if (existing && !splitSeriesBundleRef.current) {
        return existing as ISeriesApi<"Baseline">;
      }
      const s = chart.addSeries(
        BaselineSeries,
        overviewBaselineOptions(open, "bright", isTouchLikeChartDevice(), relGrad),
      );
      seriesRef.current = s;
      markersRef.current = createSeriesMarkers(s, [], { autoScale: true }) as ISeriesMarkersPluginApi<UTCTimestamp>;
      return s;
    };

    let series = seriesRef.current;
    let markers = markersRef.current;

    if (!points.length) {
      removeSplitBundle();
      overviewInBarMarkersRef.current = null;
      series?.setData([]);
      markers?.setMarkers([]);
      if (series) {
        removeScaleBoundsPriceLines(series, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        removeSessionHighLowPriceLines(series, sessionHighPriceLineRef, sessionLowPriceLineRef);
        removeYAxisTickLabels(series, yAxisTickLinesRef);
        removeOverviewSingleBaselineLine(series);
      }
      removeCostLine();
      return;
    }

    const data = points
      .filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))
      .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));

    const open = data[0]?.value;
    if (!isFiniteNumber(open)) {
      removeSplitBundle();
      overviewInBarMarkersRef.current = null;
      const sInv = seriesRef.current;
      if (sInv) {
        removeScaleBoundsPriceLines(sInv, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        removeSessionHighLowPriceLines(sInv, sessionHighPriceLineRef, sessionLowPriceLineRef);
        removeYAxisTickLabels(sInv, yAxisTickLinesRef);
      }
      seriesRef.current?.setData([]);
      markersRef.current?.setMarkers([]);
      return;
    }

    if (holdingsStyle) {
      overviewInBarMarkersRef.current = null;
      removeSplitBundle();
      series = seriesRef.current;
      if (!series) return;
      removeSessionHighLowPriceLines(series, sessionHighPriceLineRef, sessionLowPriceLineRef);
      // Portfolio chart should also show the dashed "open" baseline line (same as Overview).
      // Reuse `baselinePriceLineRef` so it is cleaned up when the chart re-inits.
      let bl = baselinePriceLineRef.current;
      if (!bl) {
        bl = series.createPriceLine({
          price: open,
          color: BASELINE_LINE,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          lineVisible: true,
        });
        baselinePriceLineRef.current = bl;
      } else {
        bl.applyOptions({ price: open });
      }
      series.setData(data);
      fitContentWithMobilePlotGutter(
        chart,
        containerRef.current?.clientWidth ?? chart.paneSize(0).width,
        data.length,
      );

      if (costBasisPrice != null && Number.isFinite(costBasisPrice) && costBasisPrice > 0) {
        const title = costBasisPriceLineTitle(costBasisPrice);
        let cbl = costBasisLineRef.current;
        if (!cbl) {
          cbl = series.createPriceLine({
            price: costBasisPrice,
            color: BASELINE_LINE,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            lineVisible: true,
            title,
          });
          costBasisLineRef.current = cbl;
        } else {
          cbl.applyOptions({ price: costBasisPrice, title, lineVisible: true });
        }
      } else {
        removeCostLine();
      }

      markersRef.current?.setMarkers(tradeMarkersForChart(tradeMarkers, data));
      // Portfolio chart: hide top/bottom plot border lines (keep right-axis numbers).
      removeScaleBoundsPriceLines(series, scaleTopPriceLineRef, scaleBottomPriceLineRef);
      if (!hideMobileYAxisLabelsRef.current) {
        syncYAxisTickLabels(chart, series, yAxisTickLinesRef);
      } else {
        removeYAxisTickLabels(series, yAxisTickLinesRef);
      }
      return;
    }

    removeCostLine();

    removeSplitBundle();
    const relGrad = baselineRelativeGradientEnabled(data, open);
    const single = ensureOverviewSingleSeries(open, relGrad);
    markers = markersRef.current;
    if (!markers) return;

    single.applyOptions(overviewBaselineOptions(open, "bright", isTouchLikeChartDevice(), relGrad));

    let bl = baselinePriceLineRef.current;
    if (!bl) {
      bl = single.createPriceLine({
        price: open,
        color: BASELINE_LINE,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        lineVisible: true,
      });
      baselinePriceLineRef.current = bl;
    } else {
      bl.applyOptions({ price: open });
    }

    single.setData(data);
    fitContentWithMobilePlotGutter(
      chart,
      containerRef.current?.clientWidth ?? chart.paneSize(0).width,
      data.length,
    );

    const last = data[data.length - 1];
    if (last) {
      const lastTemplates: SeriesMarker<UTCTimestamp>[] = [
        {
          time: last.time,
          position: "inBar",
          shape: "circle",
          color: lastPointStroke,
          size: 1,
        },
      ];
      overviewInBarMarkersRef.current = lastTemplates;
      scheduleScaledInBarMarkers(chart, markers, lastTemplates);
    } else {
      overviewInBarMarkersRef.current = null;
      markers.setMarkers([]);
    }
    removeScaleBoundsPriceLines(single, scaleTopPriceLineRef, scaleBottomPriceLineRef);
    removeSessionHighLowPriceLines(single, sessionHighPriceLineRef, sessionLowPriceLineRef);
    if (!hideMobileYAxisLabelsRef.current) {
      syncYAxisTickLabels(chart, single, yAxisTickLinesRef);
    } else {
      removeYAxisTickLabels(single, yAxisTickLinesRef);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncRangePriceBadgesRef.current?.();
        if (!holdingsStyle && !loading && chartRef.current && hoverTimeRef.current == null) {
          setPeriodAxisLabelsGuarded(
            syncOverviewPeriodAxisLabels(
              chartRef.current,
              points,
              dataTimeZoneRef.current,
              overviewBottomAxisModeRef.current,
              containerWidthRef.current,
            ),
          );
        }
      });
    });
  }, [points, lastPointStroke, holdingsStyle, tradeMarkers, costBasisPrice, kind, series, loading]);

  const empty = !loading && points.length === 0;
  const hoverYmd = useMemo(
    () => (holdingsStyle && hoverTimeUnix != null ? ymdFromUnixSeconds(hoverTimeUnix) : null),
    [holdingsStyle, hoverTimeUnix],
  );
  const hoverTradeLines = hoverYmd ? tooltipByDate.get(hoverYmd) ?? null : null;

  const overviewHoverTooltip = useMemo(() => {
    if (holdingsStyle || !overviewHover) return null;
    const hoverPrice = overviewHover.price;
    if (!Number.isFinite(hoverPrice)) return null;
    const valueLabel =
      kind === "stock" && series === "marketCap"
        ? formatMarketCapAxis(hoverPrice)
        : kind === "stock" && series === "return"
          ? formatReturnAxis(hoverPrice)
          : `$${formatStockPriceAxis(hoverPrice)}`;
    return { valueLabel };
  }, [holdingsStyle, overviewHover, kind, series]);

  const overviewMetricTitle =
    series === "marketCap" ? "Market cap" : series === "return" ? "Return" : "Price";

  const holdingsTooltipEstHeight = useMemo(() => {
    const n = hoverTradeLines?.length ?? 0;
    if (n === 0) return 72;
    const shown = Math.min(6, n);
    const moreLine = n > 6 ? 18 : 0;
    return Math.min(240, 34 + shown * 22 + moreLine);
  }, [hoverTradeLines]);

  const holdingsHoverTooltip = useMemo(() => {
    if (!holdingsStyle) return null;
    if (hoverPrice == null || !Number.isFinite(hoverPrice)) return null;
    const valueLabel =
      kind === "stock" && series === "marketCap"
        ? formatMarketCapAxis(hoverPrice)
        : kind === "stock" && series === "return"
          ? formatReturnAxis(hoverPrice)
          : `$${formatStockPriceAxis(hoverPrice)}`;
    return { title: holdingsStyle ? "Price" : overviewMetricTitle, valueLabel };
  }, [holdingsStyle, hoverPrice, kind, series, overviewMetricTitle]);

  const holdingsHoverTooltipPos = useMemo(() => {
    if (!holdingsStyle || hoverPoint == null || containerWidth <= 0) return null;
    if (hoverPrice == null || !Number.isFinite(hoverPrice)) return null;
    // Match overview tooltip sizing.
    return layoutPointTooltip(hoverPoint, containerWidth, height, 40);
  }, [holdingsStyle, hoverPoint, containerWidth, height, hoverPrice]);

  const holdingsTooltipPos = useMemo(() => {
    if (!holdingsStyle || hoverPoint == null || containerWidth <= 0) return null;
    if (!hoverTradeLines?.length) return null;
    return layoutPointTooltip(hoverPoint, containerWidth, height, holdingsTooltipEstHeight);
  }, [holdingsStyle, hoverPoint, containerWidth, height, hoverTradeLines, holdingsTooltipEstHeight]);

  const overviewTooltipPos = useMemo(() => {
    if (holdingsStyle || !overviewHover || containerWidth <= 0 || !overviewHoverTooltip) return null;
    return layoutPointTooltip(overviewHover.point, containerWidth, plotHeight, 40);
  }, [holdingsStyle, overviewHover, containerWidth, plotHeight, overviewHoverTooltip]);

  const activeBottomAxisLabel = holdingsStyle
    ? hoverAxisLabel
    : useMobileOverviewCrosshair
      ? hoverAxisLabel
      : (overviewHover?.axisLabel ?? null);

  const visiblePeriodAxisLabels = useMemo(() => {
    if (periodAxisLabels.length === 0) return [];
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return periodAxisLabels;
    const clampLeft = (x: number) => Math.min(Math.max(8, x), Math.max(8, containerWidth - 8));

    const out: OverviewAxisLabel[] = [];
    let last = -Infinity;
    // Avoid overlaps near the edges where multiple labels clamp to the same left position.
    for (const lab of periodAxisLabels) {
      const left = clampLeft(lab.leftPx);
      if (left - last < 24) continue;
      out.push(lab);
      last = left;
    }
    return out;
  }, [periodAxisLabels, containerWidth]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative z-0 min-w-0 select-none",
        useCustomBottomAxis ? "flex flex-col" : "",
        useMobileOverviewCrosshair && "touch-pan-y",
      )}
      style={{ height }}
      onMouseLeave={
        useCustomBottomAxis
          ? () => {
              crosshairHoveredRef.current = false;
              hoverTimeRef.current = null;
              clearOverviewHover();
              if (!useMobileOverviewCrosshair) {
                const c = chartRef.current;
                if (c && points.length > 0) {
                  setPeriodAxisLabelsGuarded(
                    syncOverviewPeriodAxisLabels(
                      c,
                      points,
                      dataTimeZoneRef.current,
                      overviewBottomAxisModeRef.current,
                      containerWidthRef.current,
                    ),
                  );
                }
              }
            }
          : undefined
      }
    >
      <div className={cn("relative min-h-0", useCustomBottomAxis ? "min-w-0 flex-1" : "absolute inset-0")} style={useCustomBottomAxis ? { height: plotHeight } : undefined}>
      <div className="pointer-events-none absolute inset-0 z-0 bg-white" aria-hidden>
        {!useMobileOverviewCrosshair ? <div className={CHART_PLOT_DOTS_PATTERN_CLASS} /> : null}
      </div>
      <div
        ref={wrapRef}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out ${
          loading || !ready ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        ref={dimOverlayRef}
        className="pointer-events-none absolute inset-y-0 right-0 z-[15] bg-white/55"
        style={{ display: "none", left: 0 }}
        aria-hidden
      />
      {holdingsStyle &&
      holdingsHoverTooltip &&
      hoverPoint &&
      (!hoverTradeLines || hoverTradeLines.length === 0) &&
      holdingsHoverTooltipPos ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[148px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
          style={{
            left: holdingsHoverTooltipPos.left,
            top: holdingsHoverTooltipPos.top,
            transform: holdingsHoverTooltipPos.transform,
          }}
          role="tooltip"
        >
          <p className="text-xs font-semibold tabular-nums text-[#09090B]">
            {holdingsHoverTooltip.title}: {holdingsHoverTooltip.valueLabel}
          </p>
        </div>
      ) : null}
      {holdingsStyle && hoverPoint && hoverYmd && hoverTradeLines && hoverTradeLines.length > 0 && holdingsTooltipPos ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[220px] max-w-[280px] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] leading-4 text-[#09090B] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)]"
          style={{
            left: holdingsTooltipPos.left,
            top: holdingsTooltipPos.top,
            transform: holdingsTooltipPos.transform,
          }}
          role="status"
        >
          <div className="font-semibold text-[#09090B]">{formatTradeTooltipDateHeader(hoverYmd)}</div>
          <div className="mt-1 space-y-1 text-[#71717A]">
            {hoverTradeLines.slice(0, 6).map((line, i) => (
              <div key={`${hoverYmd}-${i}`} className="whitespace-normal break-words">
                {line}
              </div>
            ))}
            {hoverTradeLines.length > 6 ? <div className="text-[#71717A]">+{hoverTradeLines.length - 6} more</div> : null}
          </div>
        </div>
      ) : null}
      {!loading && ready
        ? [rangeOpenBadge, rangeHighBadge]
            .filter((b): b is RangeChartPriceBadge => b != null)
            .map((badge) => (
              <div
                key={badge.anchor === "start" ? "open" : "high"}
                className={`pointer-events-none absolute z-20 max-w-[min(100%,120px)] -translate-y-full pb-1 ${
                  badge.anchor === "center" ? "-translate-x-1/2" : ""
                }`}
                style={{ left: badge.left, top: badge.top }}
                aria-hidden
              >
                <span className={RANGE_PRICE_BADGE_CLASS}>{badge.label}</span>
              </div>
            ))
        : null}
      {!holdingsStyle && useMobileOverviewCrosshair ? (
        <div
          ref={overviewTooltipRef}
          className="pointer-events-none absolute z-30 min-w-[148px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
          style={{ display: "none" }}
          role="tooltip"
        >
          <p ref={overviewTooltipTextRef} className="text-xs font-semibold tabular-nums text-[#09090B]" />
        </div>
      ) : null}
      {!holdingsStyle &&
      !useMobileOverviewCrosshair &&
      overviewHoverTooltip &&
      overviewHover &&
      overviewTooltipPos ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[148px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
          style={{
            left: overviewTooltipPos.left,
            top: overviewTooltipPos.top,
            transform: overviewTooltipPos.transform,
          }}
          role="tooltip"
        >
          <p className="text-xs font-semibold tabular-nums text-[#09090B]">
            {overviewMetricTitle}: {overviewHoverTooltip.valueLabel}
          </p>
        </div>
      ) : null}
      {loading ? (
        <div className="absolute inset-0 z-20 flex flex-col px-1 py-1">
          <ChartSkeleton fill variant="minimal" />
        </div>
      ) : null}
      {empty ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-[14px] text-[#71717A]">
          {kind === "stock" && series === "marketCap"
            ? "No market cap data for this range (shares outstanding unavailable)."
            : kind === "stock" && series === "return"
              ? "No return data for this range."
              : "No price data for this range."}
        </div>
      ) : null}
      </div>
      {useCustomBottomAxis && !loading ? (
        <div
          className="relative w-full shrink-0 overflow-visible"
          style={{ height: axisRowPx }}
          aria-hidden={periodAxisLabels.length === 0 && !activeBottomAxisLabel}
        >
          {activeBottomAxisLabel ? (
            <span
              className="absolute bottom-1 inline-block max-w-[min(100%,calc(100%-16px))] -translate-x-1/2 whitespace-nowrap font-['Inter'] text-[11px] font-medium tabular-nums leading-none text-[#09090B] sm:text-[12px]"
              style={{ left: `clamp(8px, ${activeBottomAxisLabel.leftPx}px, calc(100% - 8px))` }}
            >
              {activeBottomAxisLabel.label}
            </span>
          ) : (
            visiblePeriodAxisLabels.map((lab) => (
              <span
                key={lab.key}
                className="absolute bottom-1 inline-block max-w-[72px] -translate-x-1/2 truncate whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                style={{ left: `clamp(8px, ${lab.leftPx}px, calc(100% - 8px))` }}
              >
                {lab.label}
              </span>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
