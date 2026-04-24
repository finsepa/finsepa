"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import {
  computeChartHeaderMetrics,
  type ChartRangeSelection,
} from "@/components/chart/chart-display-metrics";
import { horzTimeToUnixSeconds, nearestPointByTime, pointAtChartX } from "@/components/chart/chart-selection-utils";
import {
  formatAssetChartTimestamp,
  formatChartSelectionDateRange,
} from "@/lib/market/chart-timestamp-format";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import type { StockChartRange, StockChartPoint, StockChartSeries } from "@/lib/market/stock-chart-types";

const MIN_DRAG_PX = 8;

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

/** Session high / low — solid horizontals; overview only (replaces tick-aligned `grid.horzLines`). */
function syncSessionHighLowPriceLines(
  series: MainPriceSeries,
  values: readonly { value: number }[],
  highRef: RefObject<IPriceLine | null>,
  lowRef: RefObject<IPriceLine | null>,
) {
  let hi = -Infinity;
  let lo = Infinity;
  for (const d of values) {
    if (!Number.isFinite(d.value)) continue;
    hi = Math.max(hi, d.value);
    lo = Math.min(lo, d.value);
  }
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) {
    removeSessionHighLowPriceLines(series, highRef, lowRef);
    return;
  }

  const common = {
    color: SCALE_EDGE_LINE,
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    /** Only hi/lo labels on the axis; default scale ticks are blanked via `tickmarksPriceFormatter`. */
    axisLabelVisible: true,
    axisLabelColor: "#ffffff",
    axisLabelTextColor: "#71717A",
    title: "",
    lineVisible: true,
  } as const;

  if (hi === lo) {
    removeSessionHighLowPriceLines(series, highRef, lowRef);
    if (!highRef.current) {
      highRef.current = series.createPriceLine({ price: hi, ...common });
    } else {
      highRef.current.applyOptions({ price: hi, ...common });
    }
    return;
  }

  if (!highRef.current) {
    highRef.current = series.createPriceLine({ price: hi, ...common });
  } else {
    highRef.current.applyOptions({ price: hi, ...common });
  }
  if (!lowRef.current) {
    lowRef.current = series.createPriceLine({ price: lo, ...common });
  } else {
    lowRef.current.applyOptions({ price: lo, ...common });
  }
}

function syncScaleBoundsPriceLines(
  chart: IChartApi,
  series: MainPriceSeries,
  topRef: RefObject<IPriceLine | null>,
  bottomRef: RefObject<IPriceLine | null>,
) {
  const h = chart.paneSize(0).height;
  if (!Number.isFinite(h) || h <= 0) return;

  const topPrice = series.coordinateToPrice(0);
  const bottomPrice = series.coordinateToPrice(h);
  if (topPrice == null || bottomPrice == null) return;
  const top = topPrice as number;
  const bottom = bottomPrice as number;
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;

  const common = {
    color: SCALE_EDGE_LINE,
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: false,
    lineVisible: true,
  } as const;

  if (!topRef.current) {
    topRef.current = series.createPriceLine({ price: top, ...common });
  } else {
    topRef.current.applyOptions({ price: top, ...common });
  }
  if (!bottomRef.current) {
    bottomRef.current = series.createPriceLine({ price: bottom, ...common });
  } else {
    bottomRef.current.applyOptions({ price: bottom, ...common });
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

function overviewBaselineOptions(open: number, variant: "bright" | "dim") {
  const base = {
    baseValue: { type: "price" as const, price: open },
    relativeGradient: true,
    lineWidth: 2 as const,
    lineType: LineType.Curved,
    priceLineVisible: false,
  };
  if (variant === "bright") {
    return {
      ...base,
      lastValueVisible: true,
      topFillColor1: "rgba(22, 163, 74, 0.20)",
      topFillColor2: "rgba(22, 163, 74, 0.03)",
      topLineColor: GREEN,
      bottomFillColor1: "rgba(220, 38, 38, 0.03)",
      bottomFillColor2: "rgba(220, 38, 38, 0.18)",
      bottomLineColor: RED,
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
      crosshairMarkerVisible: true,
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

function selectionBarIndices(
  data: readonly { time: UTCTimestamp }[],
  startT: number,
  endT: number,
): { iLo: number; iHi: number } | null {
  const iA = data.findIndex((d) => d.time === startT);
  const iB = data.findIndex((d) => d.time === endT);
  if (iA < 0 || iB < 0) return null;
  return { iLo: Math.min(iA, iB), iHi: Math.max(iA, iB) };
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

type BandGeom = { left: number; width: number; positive: boolean };

function layoutSelectionTooltip(
  band: BandGeom,
  containerWidth: number,
  chartHeight: number,
  estimatedHeight: number,
): { left: number; top: number; transform: string } {
  const centerX = band.left + band.width / 2;
  const halfW = TOOLTIP_MAX_W / 2;
  const left = Math.min(
    Math.max(halfW + TOOLTIP_EDGE_PAD, centerX),
    Math.max(halfW + TOOLTIP_EDGE_PAD, containerWidth - halfW - TOOLTIP_EDGE_PAD),
  );
  const hoverY = chartHeight * 0.2;
  const minTop = TOOLTIP_EDGE_PAD;
  const bottomLimit = chartHeight - TOOLTIP_EDGE_PAD;
  const placeAbove = hoverY >= estimatedHeight + TOOLTIP_GAP_PX + minTop;
  if (placeAbove) {
    return { left, top: hoverY - TOOLTIP_GAP_PX, transform: "translate(-50%, -100%)" };
  }
  const top = Math.max(minTop, Math.min(hoverY + TOOLTIP_GAP_PX, bottomLimit - estimatedHeight));
  return { left, top, transform: "translateX(-50%)" };
}

function SelectionLayers({
  containerWidth,
  band,
  hideOutsideDim,
}: {
  containerWidth: number;
  band: BandGeom;
  /** When true, only the selection band is tinted; sides rely on faded series (Google Finance–style). */
  hideOutsideDim?: boolean;
}) {
  if (containerWidth <= 0 || band.width <= 0) return null;
  const l = (band.left / containerWidth) * 100;
  const w = (band.width / containerWidth) * 100;
  const dim = "rgba(9, 9, 11, 0.06)";
  const hi = band.positive ? "rgba(22, 163, 74, 0.10)" : "rgba(220, 38, 38, 0.10)";
  return (
    <>
      {!hideOutsideDim && band.left > 0 ? (
        <div className="absolute inset-y-0 left-0" style={{ width: `${l}%`, background: dim }} />
      ) : null}
      <div
        className="absolute inset-y-0 border-x border-[rgba(9,9,11,0.08)]"
        style={{ left: `${l}%`, width: `${w}%`, background: hi }}
      />
      {!hideOutsideDim && band.left + band.width < containerWidth ? (
        <div
          className="absolute inset-y-0 right-0"
          style={{
            width: `${100 - l - w}%`,
            background: dim,
          }}
        />
      ) : null}
    </>
  );
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
  holdingsStyleRef.current = holdingsStyle;

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
  const costBasisLineRef = useRef<IPriceLine | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  /** Base in-bar marker templates (before bar-spacing scale) for overview + range selection. */
  const overviewInBarMarkersRef = useRef<SeriesMarker<UTCTimestamp>[] | null>(null);
  const rescaleOverviewInBarMarkersRef = useRef<(() => void) | null>(null);
  const splitSeriesBundleRef = useRef<{
    left: ISeriesApi<"Baseline">;
    mid: ISeriesApi<"Baseline">;
    right: ISeriesApi<"Baseline">;
  } | null>(null);
  const pointsRef = useRef<StockChartPoint[]>([]);
  const dragActiveRef = useRef(false);
  const rafRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<StockChartPoint[]>([]);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTimeUnix, setHoverTimeUnix] = useState<number | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverPointRafRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<ChartRangeSelection>(null);
  const [dragPreview, setDragPreview] = useState<BandGeom | null>(null);
  const [selectionBand, setSelectionBand] = useState<BandGeom | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const crosshairForHeader = useMemo((): { price: number; timeUnix: number } | null => {
    if (!holdingsStyle) return null;
    if (hoverPrice == null || !Number.isFinite(hoverPrice)) return null;
    if (hoverTimeUnix == null || !Number.isFinite(hoverTimeUnix)) return null;
    return { price: hoverPrice, timeUnix: hoverTimeUnix };
  }, [holdingsStyle, hoverPrice, hoverTimeUnix]);

  const metrics = useMemo(
    () => computeChartHeaderMetrics(points, selection, crosshairForHeader),
    [points, selection, crosshairForHeader],
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
      loading,
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
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /** Clear range-drag selection immediately when series/range/etc. change so header metrics don’t keep stale selection prices (e.g. $258) while the series switches to market cap / return). */
  useLayoutEffect(() => {
    setSelection(null);
    setSelectionBand(null);
    setDragPreview(null);
    setHoverTimeUnix(null);
    initialConsumedRef.current = false;
  }, [kind, symbol, range, series, holdingsStyle]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!selection) return;
      if (containerRef.current?.contains(e.target as Node)) return;
      setSelection(null);
      setSelectionBand(null);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !selection) return;
      setSelection(null);
      setSelectionBand(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  // Create chart once.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: "#71717A",
        fontSize: 11,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        attributionLogo: false,
      },
      ...(holdingsStyle
        ? {}
        : {
            localization: {
              tickmarksPriceFormatter: (priceValue: readonly number[]) => priceValue.map(() => ""),
            },
          }),
      grid: {
        vertLines: { visible: false },
        // Overview: no tick grid — session high/low + dashed open use `createPriceLine` instead. Holdings: off.
        horzLines: { visible: false, color: SCALE_EDGE_LINE, style: LineStyle.Solid },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "rgba(9, 9, 11, 0.06)",
          labelVisible: false,
          width: 1,
          style: LineStyle.Solid,
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
          lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
          crosshairMarkerBackgroundColor: VALUE_BLUE,
          crosshairMarkerBorderWidth: 2,
        })
      : chart.addSeries(BaselineSeries, {
          baseValue: { type: "price", price: 0 },
          relativeGradient: true,
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
          lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
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

    const onCrosshairMove = (param: MouseEventParams) => {
      if (dragActiveRef.current) return;
      const s = seriesRef.current;
      if (!s) return;
      if (param.point === undefined || param.point.x < 0 || param.point.y < 0 || param.time === undefined) {
        setHoverPrice(null);
        setHoverTimeUnix(null);
        hoverPointRef.current = null;
        if (hoverPointRafRef.current) {
          cancelAnimationFrame(hoverPointRafRef.current);
          hoverPointRafRef.current = 0;
        }
        setHoverPoint(null);
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
      if (holdingsStyle) {
        const data = param.seriesData.get(s);
        if (data && typeof data === "object" && "value" in data && isFiniteNumber((data as { value: number }).value)) {
          hoverValue = (data as { value: number }).value;
          const row = data as { value: number; time?: UTCTimestamp };
          tunix =
            typeof row.time === "number" && Number.isFinite(row.time) ? row.time : horzTimeToUnixSeconds(param.time as Time);
        } else {
          const sec = horzTimeToUnixSeconds(param.time as Time);
          const near = sec != null ? nearestPointByTime(pointsRef.current, sec) : null;
          if (near && isFiniteNumber(near.time) && isFiniteNumber(near.value)) {
            hoverValue = near.value;
            tunix = near.time;
          }
        }
      } else {
        const sec = horzTimeToUnixSeconds(param.time as Time);
        const near = sec != null ? nearestPointByTime(pointsRef.current, sec) : null;
        if (near && isFiniteNumber(near.time) && isFiniteNumber(near.value)) {
          hoverValue = near.value;
          tunix = near.time;
        }
      }
      if (hoverValue != null && tunix != null) {
        setHoverPrice(hoverValue);
        setHoverTimeUnix(tunix);
      } else {
        setHoverPrice(null);
        setHoverTimeUnix(null);
        hoverPointRef.current = null;
        if (hoverPointRafRef.current) {
          cancelAnimationFrame(hoverPointRafRef.current);
          hoverPointRafRef.current = 0;
        }
        setHoverPoint(null);
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
    const syncBoundsLines = () => {
      const c = chartRef.current;
      const s = seriesRef.current;
      if (!c || !s) return;
      requestAnimationFrame(() => {
        const c2 = chartRef.current;
        const s2 = seriesRef.current;
        if (!c2 || !s2) return;
        if (holdingsStyle) {
          syncScaleBoundsPriceLines(c2, s2, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        } else {
          removeScaleBoundsPriceLines(s2, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        }
      });
    };
    const onVisRangeForMarkers = () => {
      rescaleOverviewInBarMarkersRef.current?.();
      syncBoundsLines();
    };
    const ts = chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(onVisRangeForMarkers);
    ts.subscribeVisibleTimeRangeChange(onVisRangeForMarkers);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) chart.resize(w, height);
      onVisRangeForMarkers();
    });
    ro.observe(el);
    chart.resize(el.clientWidth, height);

    return () => {
      ro.disconnect();
      ts.unsubscribeVisibleLogicalRangeChange(onVisRangeForMarkers);
      ts.unsubscribeVisibleTimeRangeChange(onVisRangeForMarkers);
      rescaleOverviewInBarMarkersRef.current = null;
      overviewInBarMarkersRef.current = null;
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      markersRef.current = null;
      const sUnmount = seriesRef.current;
      if (sUnmount) {
        removeScaleBoundsPriceLines(sUnmount, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        removeSessionHighLowPriceLines(sUnmount, sessionHighPriceLineRef, sessionLowPriceLineRef);
      }
      baselinePriceLineRef.current = null;
      costBasisLineRef.current = null;
      splitSeriesBundleRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, holdingsStyle]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const fmt =
      kind === "stock" && series === "marketCap"
        ? formatMarketCapAxis
        : kind === "stock" && series === "return"
          ? formatReturnAxis
          : formatStockPriceAxis;
    const hideScaleTicks = !holdingsStyleRef.current;
    chart.applyOptions({
      localization: {
        priceFormatter: fmt,
        ...(hideScaleTicks
          ? { tickmarksPriceFormatter: (priceValue: readonly number[]) => priceValue.map(() => "") }
          : { tickmarksPriceFormatter: undefined }),
      },
    });
  }, [kind, series]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (holdingsStyle) {
      chart.applyOptions({ localization: { tickmarksPriceFormatter: undefined } });
    } else {
      chart.applyOptions({
        localization: {
          tickmarksPriceFormatter: (priceValue: readonly number[]) => priceValue.map(() => ""),
        },
      });
    }
  }, [holdingsStyle]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || loading || !pointsRef.current.length || !chartRef.current || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < 0 || x > rect.width) return;
      e.preventDefault();
      setSelection(null);
      setSelectionBand(null);
      dragActiveRef.current = true;
      setHoverPrice(null);
      setHoverTimeUnix(null);
      const startX = x;
      try {
        wrapRef.current.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const onMove = (ev: PointerEvent) => {
        const r = wrapRef.current?.getBoundingClientRect();
        const chart = chartRef.current;
        const pts = pointsRef.current;
        if (!r || !chart || pts.length < 1) return;
        const cx = Math.max(0, Math.min(r.width, ev.clientX - r.left));
        const left = Math.min(startX, cx);
        const width = Math.abs(cx - startX);
        const pA = pointAtChartX(chart, pts, startX);
        const pB = pointAtChartX(chart, pts, cx);
        const positive =
          pA && pB ? (pA.time <= pB.time ? pB.value >= pA.value : pA.value >= pB.value) : true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          if (width < 1) setDragPreview(null);
          else setDragPreview({ left, width, positive });
        });
      };

      const finish = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        dragActiveRef.current = false;
        setDragPreview(null);
        try {
          wrapRef.current?.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }

        const r = wrapRef.current?.getBoundingClientRect();
        const chart = chartRef.current;
        const pts = pointsRef.current;
        if (!r || !chart || pts.length < 1) return;
        const endX = Math.max(0, Math.min(r.width, ev.clientX - r.left));
        const w = Math.abs(endX - startX);
        if (w < MIN_DRAG_PX) return;
        const p0 = pointAtChartX(chart, pts, startX);
        const p1 = pointAtChartX(chart, pts, endX);
        if (!p0 || !p1) return;
        const left = Math.min(startX, endX);
        const pStart = p0.time <= p1.time ? p0 : p1;
        const pEnd = p0.time <= p1.time ? p1 : p0;
        const positive = pEnd.value >= pStart.value;
        setSelection({
          startPrice: pStart.value,
          endPrice: pEnd.value,
          startTimeUnix: pStart.time,
          endTimeUnix: pEnd.time,
        });
        setSelectionBand({ left, width: w, positive });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [loading],
  );

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
        setHoverPrice(null);
        setHoverTimeUnix(null);
        setSelection(null);
        setSelectionBand(null);
        setReady(false);
        setPoints(initialChart.points);
        setLoading(false);
        requestAnimationFrame(() => setReady(true));
        return;
      }

      setLoading(true);
      setHoverPrice(null);
      setHoverTimeUnix(null);
      setSelection(null);
      setSelectionBand(null);
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

    const ensureOverviewSingleSeries = (open: number): ISeriesApi<"Baseline"> => {
      if (splitSeriesBundleRef.current) {
        removeSplitBundle();
      }
      const existing = seriesRef.current;
      if (existing && !splitSeriesBundleRef.current) {
        return existing as ISeriesApi<"Baseline">;
      }
      const s = chart.addSeries(BaselineSeries, overviewBaselineOptions(open, "bright"));
      seriesRef.current = s;
      markersRef.current = createSeriesMarkers(s, [], { autoScale: true }) as ISeriesMarkersPluginApi<UTCTimestamp>;
      return s;
    };

    const createSplitTriple = (open: number) => {
      const cur = seriesRef.current;
      if (cur && !splitSeriesBundleRef.current) {
        removeScaleBoundsPriceLines(cur, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        removeSessionHighLowPriceLines(cur, sessionHighPriceLineRef, sessionLowPriceLineRef);
        removeOverviewSingleBaselineLine(cur);
        markersRef.current = null;
        try {
          chart.removeSeries(cur);
        } catch {
          /* ignore */
        }
        seriesRef.current = null;
      }
      removeSplitBundle();

      const left = chart.addSeries(BaselineSeries, overviewBaselineOptions(open, "dim"));
      const mid = chart.addSeries(BaselineSeries, overviewBaselineOptions(open, "bright"));
      const right = chart.addSeries(BaselineSeries, overviewBaselineOptions(open, "dim"));
      splitSeriesBundleRef.current = { left, mid, right };
      seriesRef.current = mid;
      markersRef.current = createSeriesMarkers(mid, [], { autoScale: true }) as ISeriesMarkersPluginApi<UTCTimestamp>;
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
      removeOverviewSingleBaselineLine(series);
      series.setData(data);
      chart.timeScale().fitContent();

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
            title,
          });
          costBasisLineRef.current = cbl;
        } else {
          cbl.applyOptions({ price: costBasisPrice, title });
        }
      } else {
        removeCostLine();
      }

      markersRef.current?.setMarkers(tradeMarkersForChart(tradeMarkers, data));
      syncScaleBoundsPriceLines(chart, series, scaleTopPriceLineRef, scaleBottomPriceLineRef);
      return;
    }

    removeCostLine();

    const sel =
      selection &&
      isFiniteNumber(selection.startTimeUnix) &&
      isFiniteNumber(selection.endTimeUnix)
        ? selection
        : null;
    const barIdx = sel ? selectionBarIndices(data, sel.startTimeUnix, sel.endTimeUnix) : null;
    const useSplit = Boolean(sel && barIdx && barIdx.iHi > barIdx.iLo);

    if (useSplit && sel && barIdx) {
      if (!splitSeriesBundleRef.current) {
        createSplitTriple(open);
      }
      const bundle = splitSeriesBundleRef.current;
      markers = markersRef.current;
      if (!bundle || !markers) return;

      const { iLo, iHi } = barIdx;
      const leftData = data.slice(0, iLo + 1);
      const midData = data.slice(iLo, iHi + 1);
      const rightData = data.slice(iHi, data.length);

      bundle.left.applyOptions(overviewBaselineOptions(open, "dim"));
      bundle.mid.applyOptions(overviewBaselineOptions(open, "bright"));
      bundle.right.applyOptions(overviewBaselineOptions(open, "dim"));

      bundle.left.setData(leftData);
      bundle.mid.setData(midData);
      bundle.right.setData(rightData);

      let bl = baselinePriceLineRef.current;
      if (!bl) {
        bl = bundle.mid.createPriceLine({
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

      chart.timeScale().fitContent();

      const a = data[iLo]!;
      const b = data[iHi]!;
      const splitTemplates: SeriesMarker<UTCTimestamp>[] = [
        {
          time: a.time,
          position: "inBar",
          shape: "circle",
          color: a.value >= open ? GREEN : RED,
          size: 2,
        },
        {
          time: b.time,
          position: "inBar",
          shape: "circle",
          color: b.value >= open ? GREEN : RED,
          size: 2,
        },
      ];
      overviewInBarMarkersRef.current = splitTemplates;
      scheduleScaledInBarMarkers(chart, markers, splitTemplates);
      removeScaleBoundsPriceLines(bundle.mid, scaleTopPriceLineRef, scaleBottomPriceLineRef);
      syncSessionHighLowPriceLines(bundle.mid, data, sessionHighPriceLineRef, sessionLowPriceLineRef);
      return;
    }

    removeSplitBundle();
    const single = ensureOverviewSingleSeries(open);
    markers = markersRef.current;
    if (!markers) return;

    single.applyOptions(overviewBaselineOptions(open, "bright"));

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
    chart.timeScale().fitContent();

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
    syncSessionHighLowPriceLines(single, data, sessionHighPriceLineRef, sessionLowPriceLineRef);
  }, [points, lastPointStroke, holdingsStyle, tradeMarkers, costBasisPrice, selection]);

  const empty = !loading && points.length === 0;
  const hoverYmd = useMemo(
    () => (holdingsStyle && hoverTimeUnix != null ? ymdFromUnixSeconds(hoverTimeUnix) : null),
    [holdingsStyle, hoverTimeUnix],
  );
  const hoverTradeLines = hoverYmd ? tooltipByDate.get(hoverYmd) ?? null : null;

  const overviewHoverTooltip = useMemo(() => {
    if (holdingsStyle) return null;
    if (selection) return null;
    if (hoverPoint == null || hoverPrice == null || hoverTimeUnix == null) return null;
    if (!Number.isFinite(hoverPrice) || !Number.isFinite(hoverTimeUnix)) return null;
    const dateLabel = formatAssetChartTimestamp(hoverTimeUnix, {
      kind,
      timeZone: dataTimeZoneHint,
    });
    const valueLabel =
      kind === "stock" && series === "marketCap"
        ? formatMarketCapAxis(hoverPrice)
        : kind === "stock" && series === "return"
          ? formatReturnAxis(hoverPrice)
          : `$${formatStockPriceAxis(hoverPrice)}`;
    return { dateLabel, valueLabel };
  }, [holdingsStyle, selection, hoverPoint, hoverPrice, hoverTimeUnix, kind, series, dataTimeZoneHint]);

  const selectionRangeTooltip = useMemo(() => {
    if (holdingsStyle || !selection) return null;
    const abs = metrics.selectionChangeAbs;
    const pct = metrics.selectionChangePct;
    if (abs == null || pct == null || !Number.isFinite(abs) || !Number.isFinite(pct)) return null;
    const isPos = abs >= 0;
    const rangeLabel = formatChartSelectionDateRange(selection.startTimeUnix, selection.endTimeUnix, {
      kind,
      timeZone: dataTimeZoneHint,
    });
    const changeLine =
      kind === "stock" && series === "marketCap"
        ? `${isPos ? "+" : ""}${formatUsdCompact(abs)} (${isPos ? "+" : ""}${pct.toFixed(2)}%)`
        : `${isPos ? "+" : ""}${abs.toFixed(2)} (${isPos ? "+" : ""}${pct.toFixed(2)}%)`;
    return { isPos, changeLine, rangeLabel };
  }, [holdingsStyle, selection, metrics.selectionChangeAbs, metrics.selectionChangePct, kind, series, dataTimeZoneHint]);

  const selectionTooltipPos = useMemo(() => {
    if (!selectionRangeTooltip || !selectionBand || containerWidth <= 0) return null;
    return layoutSelectionTooltip(selectionBand, containerWidth, height, 88);
  }, [selectionRangeTooltip, selectionBand, containerWidth, height]);

  const holdingsTooltipEstHeight = useMemo(() => {
    const n = hoverTradeLines?.length ?? 0;
    if (n === 0) return 72;
    const shown = Math.min(6, n);
    const moreLine = n > 6 ? 18 : 0;
    return Math.min(240, 34 + shown * 22 + moreLine);
  }, [hoverTradeLines]);

  const holdingsTooltipPos = useMemo(() => {
    if (!holdingsStyle || hoverPoint == null || containerWidth <= 0) return null;
    if (!hoverTradeLines?.length) return null;
    return layoutPointTooltip(hoverPoint, containerWidth, height, holdingsTooltipEstHeight);
  }, [holdingsStyle, hoverPoint, containerWidth, height, hoverTradeLines, holdingsTooltipEstHeight]);

  const overviewTooltipPos = useMemo(() => {
    if (holdingsStyle || hoverPoint == null || containerWidth <= 0 || !overviewHoverTooltip) return null;
    return layoutPointTooltip(hoverPoint, containerWidth, height, 72);
  }, [holdingsStyle, hoverPoint, containerWidth, height, overviewHoverTooltip]);

  return (
    <div ref={containerRef} className="relative z-0 bg-transparent select-none" style={{ height }}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {containerWidth > 0 && !holdingsStyle && dragPreview && dragPreview.width > 1 ? (
          <SelectionLayers containerWidth={containerWidth} band={dragPreview} />
        ) : null}
        {containerWidth > 0 && !holdingsStyle && selection && selectionBand && !dragPreview ? (
          <SelectionLayers containerWidth={containerWidth} band={selectionBand} hideOutsideDim />
        ) : null}
      </div>
      <div
        ref={wrapRef}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out ${
          loading || !ready ? "opacity-0" : "opacity-100"
        }`}
        onPointerDown={holdingsStyle ? undefined : handlePointerDown}
      />
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
      {!holdingsStyle && overviewHoverTooltip && hoverPoint && overviewTooltipPos ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[200px] max-w-[min(100%,280px)] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] leading-4 text-[#09090B] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)]"
          style={{
            left: overviewTooltipPos.left,
            top: overviewTooltipPos.top,
            transform: overviewTooltipPos.transform,
          }}
          role="tooltip"
        >
          <div className="font-normal text-[#71717A]">{overviewHoverTooltip.dateLabel}</div>
          <div className="mt-1 tabular-nums font-semibold text-[#09090B]">{overviewHoverTooltip.valueLabel}</div>
        </div>
      ) : null}
      {!holdingsStyle && selectionRangeTooltip && selectionTooltipPos ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[200px] max-w-[min(100%,280px)] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] leading-4 shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)]"
          style={{
            left: selectionTooltipPos.left,
            top: selectionTooltipPos.top,
            transform: selectionTooltipPos.transform,
          }}
          role="status"
        >
          <div
            className={`tabular-nums font-semibold ${
              selectionRangeTooltip.isPos ? "text-[#16A34A]" : "text-[#DC2626]"
            }`}
          >
            {selectionRangeTooltip.changeLine}
          </div>
          {selectionRangeTooltip.rangeLabel ? (
            <div className="mt-1 font-normal text-[#71717A]">{selectionRangeTooltip.rangeLabel}</div>
          ) : null}
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
  );
}
