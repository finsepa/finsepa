"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  overviewChartAxisRowPx,
  CHART_PLOT_DOTS_PATTERN_CLASS,
  CHART_PLOT_DOTS_PATTERN_EXPORT_CLASS,
  buildOverviewCrosshairLabelByBarTime,
  chartPointDisplayUnix,
  overviewAxisLabelsEqual,
  resolveOverviewBottomAxisMode,
  syncOverviewPeriodAxisLabels,
  periodAxisLabelLayoutStyle,
  periodAxisLabelMaxWidthClass,
  periodAxisLabelTransformClass,
  resolvePeriodAxisLabelAnchor,
  type OverviewPeriodAxisSyncOptions,
  type OverviewAxisLabel,
  type OverviewBottomAxisMode,
  type PeriodAxisLabelAnchor,
} from "@/components/chart/overview-bottom-axis";
import {
  LineSeries,
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
import {
  horzTimeToUnixSeconds,
  nearestPointByTime,
  pointAtChartX,
} from "@/components/chart/chart-selection-utils";
import {
  chartSeriesPlotInsetPct,
  fitContentWithMobilePlotGutter,
  mobileOverviewChartScaleOptions,
  mobileTimeScaleOptions,
  shouldHideMobileYAxisLabels,
} from "@/lib/chart/mobile-plot-horizontal-gutter";
import {
  appendLiveSessionNowTail,
  applyStock1DLiveSessionTimeScale,
  fitOverviewChartTimeScale,
  filterStock1DLiveSessionPointsByTimeWindow,
  liveSessionSpanWhitespaceData,
  padStock1DLiveSessionBaselineData,
  prepareStock1DLiveSessionChartPoints,
  resolveStock1DLiveSessionYmd,
  shouldUseStock1DLiveSessionChart,
  stock1DLiveSessionPlotLeftPx,
  STOCK_1D_LIVE_SESSION_CLOCK_TICK_MS,
  STOCK_1D_LIVE_PRICE_POLL_MS,
  STOCK_1D_LIVE_SESSION_TZ,
} from "@/lib/chart/stock-1d-live-session-chart";
import { attachMobilePriceChartHaptics } from "@/lib/chart/mobile-chart-haptic";
import {
  chartBarTimeForYmd,
  formatAssetChartTimestamp,
  usSessionWallClockUnix,
  usSessionYmdFromUnixSeconds,
} from "@/lib/market/chart-timestamp-format";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import { baselineRelativeGradientEnabled } from "@/lib/chart/baseline-relative-gradient";
import {
  computeQuarterBandPixelLayouts,
  findQuarterBandLayoutAtX,
  quarterBandActivityTooltipLine,
  quarterBandLayoutsEqual,
  type QuarterBandPixelLayout,
} from "@/lib/superinvestors/superinvestor-chart-quarter-bands";
import { formatEarlierActivityLines } from "@/lib/superinvestors/superinvestor-transaction-utils";
import {
  readSuperinvestorHoldingChartCache,
  superinvestorHoldingChartCacheKey,
  writeSuperinvestorHoldingChartCache,
} from "@/lib/superinvestors/superinvestor-holding-chart-client-cache";
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

type LivePriceDotLayout = {
  left: number;
  top: number;
  color: string;
  /** Regular session pulses; after-hours stays static on the line tail. */
  animated?: boolean;
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
  liveSessionPlot?: { sessionYmd: string; timeZone: string } | null,
): Pick<RangeChartPriceBadge, "left" | "top"> | null {
  let x: number | null = chart.timeScale().timeToCoordinate(point.time as UTCTimestamp);
  if (liveSessionPlot && isFiniteNumber(point.time)) {
    const mapped = stock1DLiveSessionPlotLeftPx(
      chart,
      point.time,
      liveSessionPlot.sessionYmd,
      liveSessionPlot.timeZone,
    );
    if (mapped != null) x = mapped;
  }
  const y = series.priceToCoordinate(point.value);
  if (y == null || x == null || !Number.isFinite(y) || !Number.isFinite(x)) return null;
  const paneH = chart.paneSize(0).height;
  if (y < 4 || y > paneH) return null;
  const left =
    anchor === "center"
      ? Math.max(44, Math.min(plotWidth - 44, x))
      : Math.max(0, x);
  return { left: Math.round(left), top: Math.round(y) };
}

function resolveOverviewCrosshairLeftPx(
  chart: IChartApi,
  barTime: number,
  fallbackX: number,
  stock1DLiveSession: boolean,
  liveSessionMeta: { ymd: string; timeZone: string } | null,
): number {
  if (stock1DLiveSession && liveSessionMeta && isFiniteNumber(barTime)) {
    const mapped = stock1DLiveSessionPlotLeftPx(
      chart,
      barTime,
      liveSessionMeta.ymd,
      liveSessionMeta.timeZone,
    );
    if (mapped != null) return mapped;
  }
  const xCoord = chart.timeScale().timeToCoordinate(barTime as UTCTimestamp);
  return xCoord != null && Number.isFinite(xCoord) ? xCoord : fallbackX;
}

function rangeChartPriceBadgeEqual(
  a: RangeChartPriceBadge | null,
  b: RangeChartPriceBadge | null,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return a.left === b.left && a.top === b.top && a.label === b.label && a.anchor === b.anchor;
}

function commitRangePriceBadge(
  setBadge: React.Dispatch<React.SetStateAction<RangeChartPriceBadge | null>>,
  next: RangeChartPriceBadge | null,
) {
  setBadge((prev) => (rangeChartPriceBadgeEqual(prev, next) ? prev : next));
}

function livePriceDotLayoutEqual(a: LivePriceDotLayout | null, b: LivePriceDotLayout | null): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return a.left === b.left && a.top === b.top && a.color === b.color && a.animated === b.animated;
}

function commitLivePriceDot(
  setDot: React.Dispatch<React.SetStateAction<LivePriceDotLayout | null>>,
  next: LivePriceDotLayout | null,
) {
  setDot((prev) => (livePriceDotLayoutEqual(prev, next) ? prev : next));
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
  /** Mobile chart scrub: bottom-axis date string for the header period badge. */
  scrubPeriodLabel: string | null;
};

export type HoldingsTradeMarker = { date: string; side: "buy" | "sell" };
export type HoldingsTradeTooltipItem = { date: string; lines: string[] };

/** Superinvestor holdings chart: quarterly buy/sell column (replaces circle markers). */
export type HoldingsQuarterTradeBand = {
  id: string;
  quarterLabel: string;
  /** Calendar quarter start (e.g. Q1 2026 → 2026-01-01). */
  quarterStartYmd: string;
  /** Calendar quarter end (e.g. Q1 2026 → 2026-03-31). */
  quarterEndYmd: string;
  reportDate: string;
  side: "buy" | "sell";
  actionLabel: string;
  pctLabel: string | null;
};

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
  /** Latest spot — during 1D regular session, extends the line to the current wall-clock time. */
  liveSpotUsd?: number | null;
  /**
   * Asset Holdings tab: blue area chart, no range-drag P/L selection, optional avg-cost line + trade dots.
   * Does not call `onDisplayChange` (keeps stock/crypto header on overview metrics).
   */
  holdingsStyle?: boolean;
  /** Trade dates (yyyy-MM-dd) shown as green (buy) / red (sell) dots, snapped to bars in range. */
  tradeMarkers?: readonly HoldingsTradeMarker[];
  /** Superinvestor only: quarterly activity columns (width ≈ one quarter); hides circle markers when set. */
  holdingsQuarterBands?: readonly HoldingsQuarterTradeBand[];
  /** Purchases/sells before the chart range (left “&lt; Earlier” column). */
  holdingsEarlierSummary?: { purchaseCount: number; sellCount: number } | null;
  /** Optional: lines shown when hovering on a day with trade markers. Keyed by `date` (yyyy-MM-dd). */
  tradeTooltipItems?: readonly HoldingsTradeTooltipItem[];
  /** Avg cost — dashed horizontal price line when holdingsStyle. */
  costBasisPrice?: number | null;
  /**
   * `daily` — superinvestor holding charts only: server + client cache refresh at most once per UTC day.
   */
  chartDataCadence?: "default" | "daily";
  /** JPEG export preview — fixed layout, no interaction. */
  screenshotPreviewMode?: boolean;
  screenshotChartBlockHeightPx?: number;
  screenshotDisplayOptions?: {
    showVerticalLegend?: boolean;
    showHorizontalLegend?: boolean;
    /** Range open / high price badges on the line. */
    showRangeBadges?: boolean;
  };
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const EMPTY_TRADE_MARKERS: readonly HoldingsTradeMarker[] = [];
const EMPTY_HOLDINGS_QUARTER_BANDS: readonly HoldingsQuarterTradeBand[] = [];

const GREEN = "#16A34A";
const RED = "#DC2626";

function sessionLivePriceLineColor(livePrice: number, openPrice: number): string {
  return livePrice >= openPrice ? GREEN : RED;
}

function resolveSessionLiveSpotPrice(
  liveSpotUsd: number | null | undefined,
  fallback: number | undefined,
  open: number,
): number {
  if (liveSpotUsd != null && Number.isFinite(liveSpotUsd) && liveSpotUsd > 0) {
    return liveSpotUsd;
  }
  if (fallback != null && Number.isFinite(fallback)) {
    return fallback;
  }
  return open;
}

function applyLiveSessionSeriesPriceLineOptions(
  series: ISeriesApi<"Baseline"> | ISeriesApi<"Area">,
  open: number,
  liveSpotUsd: number | null | undefined,
  fallbackPrice: number | undefined,
  hideYAxisLabels: boolean,
) {
  const livePrice = resolveSessionLiveSpotPrice(liveSpotUsd, fallbackPrice, open);
  const color = sessionLivePriceLineColor(livePrice, open);
  series.applyOptions({
    lastValueVisible: !hideYAxisLabels,
    priceLineVisible: true,
    priceLineStyle: LineStyle.Dashed,
    priceLineColor: color,
  });
}

const VALUE_BLUE = "#2563EB";
/** Holdings expand chart: opaque white underlay masks quarter bars; blue gradient draws on top. */
const HOLDINGS_FILL_WHITE_TOP = "rgba(255, 255, 255, 0.97)";
const HOLDINGS_FILL_WHITE_BOTTOM = "#ffffff";
const HOLDINGS_FILL_BLUE_TOP = "rgba(37, 99, 235, 0.22)";
const HOLDINGS_FILL_BLUE_BOTTOM = "rgba(37, 99, 235, 0.02)";
/** Quarter activity columns: compact pill above each quarter's local price peak. */
const HOLDINGS_QUARTER_BAND_HEIGHT_RATIO = 0.14;
const HOLDINGS_QUARTER_BAND_BUY_GRADIENT =
  "linear-gradient(180deg, #F0FDF4 0%, #F0FDF4 90%, #ffffff 97%, #ffffff 100%)";
const HOLDINGS_QUARTER_BAND_SELL_GRADIENT =
  "linear-gradient(180deg, #FEF2F2 0%, #FEF2F2 90%, #ffffff 97%, #ffffff 100%)";
const HOLDINGS_EARLIER_BAND_WIDTH_PX = 58;
const HOLDINGS_EARLIER_BAND_HEIGHT = "42%";
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

type MainPriceSeries = ISeriesApi<"Baseline"> | ISeriesApi<"Area"> | ISeriesApi<"Line">;

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
  const t = chartBarTimeForYmd(ymd, data);
  return t == null ? null : (t as UTCTimestamp);
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

type HoldingsBandsOverlayProps = {
  layouts: readonly QuarterBandPixelLayout[];
  earlierSummary: { purchaseCount: number; sellCount: number } | null;
  earlierLines: readonly string[];
  plotInsetTop: string;
  plotInsetBottom: string;
};

/** Isolated from PriceChart hover state so crosshair moves do not re-render quarter fills. */
const HoldingsQuarterBandsOverlay = memo(function HoldingsQuarterBandsOverlay({
  layouts,
  earlierSummary,
  earlierLines,
  plotInsetTop,
  plotInsetBottom,
}: HoldingsBandsOverlayProps) {
  if (layouts.length === 0 && !earlierSummary) return null;

  const insetStyle = { top: plotInsetTop, bottom: plotInsetBottom };

  return (
    <>
      <div
        className="pointer-events-none absolute right-0 left-0 z-[5] overflow-hidden [contain:strict]"
        style={insetStyle}
        aria-hidden
      >
        {earlierSummary ? (
          <div
            className="absolute top-0 left-0 rounded-sm border-t-[3px] border-[#A1A1AA] bg-[rgba(113,113,122,0.14)]"
            style={{ width: HOLDINGS_EARLIER_BAND_WIDTH_PX, height: HOLDINGS_EARLIER_BAND_HEIGHT }}
          />
        ) : null}
        {layouts.map(({ key, left, width, topPx, band }) => {
          const isBuy = band.side === "buy";
          return (
            <div
              key={`${key}-fill`}
              className="absolute [contain:paint]"
              style={{ left, width, top: topPx, bottom: 0 }}
            >
              <div
                className={cn("h-full border-t-[3px]", isBuy ? "border-[#16A34A]" : "border-[#DC2626]")}
                style={{
                  background: isBuy ? HOLDINGS_QUARTER_BAND_BUY_GRADIENT : HOLDINGS_QUARTER_BAND_SELL_GRADIENT,
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="pointer-events-none absolute right-0 left-0 z-[11] overflow-visible"
        style={insetStyle}
        aria-hidden
      >
        {earlierSummary ? (
          <div
            className="absolute top-0 left-0 flex flex-col items-center gap-0.5 px-1 pt-2 text-center leading-tight"
            style={{ width: HOLDINGS_EARLIER_BAND_WIDTH_PX }}
          >
            <span className="text-[9px] font-semibold text-[#52525B] sm:text-[10px]">&lt; Earlier</span>
            {earlierLines.map((line) => (
              <span key={line} className="text-[9px] font-medium text-[#71717A] sm:text-[10px]">
                {line}
              </span>
            ))}
          </div>
        ) : null}
        {layouts.map(({ key, left, width, topPx, heightPx, band }) => {
          const isBuy = band.side === "buy";
          return (
            <div
              key={`${key}-label`}
              className="absolute flex justify-center px-0.5 pt-2"
              style={{ left, width, top: topPx, height: heightPx }}
            >
              <div
                className={cn(
                  "flex flex-col items-center gap-0 px-0.5 text-center leading-tight",
                  isBuy ? "text-[#16A34A]" : "text-[#DC2626]",
                )}
                style={{ textShadow: "0 0 4px #fff, 0 0 8px #fff, 0 1px 2px #fff" }}
              >
                <span className="text-[9px] font-semibold sm:text-[10px]">{band.actionLabel}</span>
                {band.pctLabel ? (
                  <span className="text-[9px] font-medium tabular-nums sm:text-[10px]">{band.pctLabel}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

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
  liveSpotUsd = null,
  holdingsStyle = false,
  tradeMarkers = EMPTY_TRADE_MARKERS,
  holdingsQuarterBands = EMPTY_HOLDINGS_QUARTER_BANDS,
  holdingsEarlierSummary = null,
  tradeTooltipItems = [],
  costBasisPrice = null,
  chartDataCadence = "default",
  screenshotPreviewMode = false,
  screenshotChartBlockHeightPx,
  screenshotDisplayOptions,
}: Props) {
  const holdingsStyleRef = useRef(holdingsStyle);
  const chartMetricSeriesRef = useRef(series);
  const kindRef = useRef(kind);
  const rangeRef = useRef(range);
  const loadingRef = useRef(true);
  const screenshotPreviewModeRef = useRef(screenshotPreviewMode);
  const screenshotShowVerticalLegendRef = useRef(screenshotDisplayOptions?.showVerticalLegend ?? true);
  const screenshotShowHorizontalLegendRef = useRef(screenshotDisplayOptions?.showHorizontalLegend ?? true);
  const screenshotShowRangeBadgesRef = useRef(screenshotDisplayOptions?.showRangeBadges ?? true);

  const screenshotShowVerticalLegend = screenshotDisplayOptions?.showVerticalLegend ?? true;
  const screenshotShowHorizontalLegend = screenshotDisplayOptions?.showHorizontalLegend ?? true;
  const screenshotShowRangeBadges = screenshotDisplayOptions?.showRangeBadges ?? true;
  const chartHeight =
    screenshotPreviewMode && screenshotChartBlockHeightPx != null
      ? screenshotChartBlockHeightPx
      : height;

  useEffect(() => {
    screenshotPreviewModeRef.current = screenshotPreviewMode;
  }, [screenshotPreviewMode]);

  useEffect(() => {
    screenshotShowVerticalLegendRef.current = screenshotShowVerticalLegend;
    screenshotShowHorizontalLegendRef.current = screenshotShowHorizontalLegend;
    screenshotShowRangeBadgesRef.current = screenshotShowRangeBadges;
  }, [screenshotShowVerticalLegend, screenshotShowHorizontalLegend, screenshotShowRangeBadges]);

  useEffect(() => {
    holdingsStyleRef.current = holdingsStyle;
  }, [holdingsStyle]);

  useEffect(() => {
    holdingsQuarterBandsRef.current = holdingsQuarterBands;
    syncQuarterBandLayoutsRef.current?.();
  }, [holdingsQuarterBands]);

  useEffect(() => {
    chartMetricSeriesRef.current = series;
  }, [series]);

  const containerRef = useRef<HTMLDivElement>(null);
  const initialConsumedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Baseline"> | ISeriesApi<"Area"> | null>(null);
  /** Holdings only: white area underlay (below blue gradient + line). */
  const holdingsFillUnderlayRef = useRef<ISeriesApi<"Area"> | null>(null);
  const liveSessionSpanSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const baselinePriceLineRef = useRef<IPriceLine | null>(null);
  const sessionOpenPriceRef = useRef<number | null>(null);
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
  const syncQuarterBandLayoutsRef = useRef<(() => void) | null>(null);
  const holdingsQuarterBandsRef = useRef(holdingsQuarterBands);
  const [quarterBandLayouts, setQuarterBandLayouts] = useState<QuarterBandPixelLayout[]>([]);
  const splitSeriesBundleRef = useRef<{
    left: ISeriesApi<"Baseline">;
    mid: ISeriesApi<"Baseline">;
    right: ISeriesApi<"Baseline">;
  } | null>(null);
  const pointsRef = useRef<StockChartPoint[]>([]);
  const liveSessionChartMetaRef = useRef<{
    ymd: string;
    dataLen: number;
    timeZone: string;
  } | null>(null);
  const containerWidthRef = useRef(0);
  const hideMobileYAxisLabelsRef = useRef(false);
  const mobileHoverBarTimeRef = useRef<number | null>(null);
  const mobileHoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const mobileScrubApplyRef = useRef<
    ((point: { x: number; y: number }, bar: StockChartPoint) => void) | null
  >(null);
  const mobileScrubClearRef = useRef<(() => void) | null>(null);

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<StockChartPoint[]>([]);

  const dataTimeZoneHint = useMemo(
    () =>
      points.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone ??
      (kind === "stock" ? "America/New_York" : "UTC"),
    [points, kind],
  );

  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (kind !== "stock" || range !== "1D" || holdingsStyle) return;
    if (getUsEquityMarketSession(new Date()) !== "regular") return;
    setSessionNowMs(Date.now());
    const id = window.setInterval(() => setSessionNowMs(Date.now()), STOCK_1D_LIVE_SESSION_CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, [kind, range, holdingsStyle]);

  useEffect(() => {
    if (kind !== "stock" || range !== "1D" || holdingsStyle) return;
    if (liveSpotUsd == null || !Number.isFinite(liveSpotUsd) || liveSpotUsd <= 0) return;
    if (getUsEquityMarketSession(new Date()) !== "regular") return;
    setSessionNowMs(Date.now());
  }, [kind, range, holdingsStyle, liveSpotUsd]);

  const chartPoints = useMemo(() => {
    if (
      kind !== "stock" ||
      range !== "1D" ||
      holdingsStyle ||
      !shouldUseStock1DLiveSessionChart(kind, range, points, holdingsStyle)
    ) {
      return points;
    }
    const now = new Date(sessionNowMs);
    const prepared = prepareStock1DLiveSessionChartPoints(
      points,
      liveSpotUsd,
      STOCK_1D_LIVE_SESSION_TZ,
      now,
    );
    if (prepared.length) return prepared;
    const sessionYmd = resolveStock1DLiveSessionYmd(points, STOCK_1D_LIVE_SESSION_TZ, now);
    if (!sessionYmd) return points;
    const filtered = filterStock1DLiveSessionPointsByTimeWindow(
      points,
      sessionYmd,
      STOCK_1D_LIVE_SESSION_TZ,
      now,
    );
    if (!filtered.length) return points;
    const last = filtered[filtered.length - 1]!;
    const useLiveSpot =
      getUsEquityMarketSession(now) === "regular" &&
      liveSpotUsd != null &&
      Number.isFinite(liveSpotUsd) &&
      liveSpotUsd > 0;
    const tailValue = useLiveSpot ? liveSpotUsd : last.value;
    return appendLiveSessionNowTail(filtered, tailValue, sessionYmd, STOCK_1D_LIVE_SESSION_TZ, now);
  }, [kind, range, holdingsStyle, points, liveSpotUsd, sessionNowMs]);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTimeUnix, setHoverTimeUnix] = useState<number | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverPointRafRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [rangeOpenBadge, setRangeOpenBadge] = useState<RangeChartPriceBadge | null>(null);
  const [rangeHighBadge, setRangeHighBadge] = useState<RangeChartPriceBadge | null>(null);
  const [livePriceDot, setLivePriceDot] = useState<LivePriceDotLayout | null>(null);
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
  /** Mobile overview scrub: drives header price via `crosshairForHeader` (no in-chart tooltip). */
  const [mobileOverviewHeaderCrosshair, setMobileOverviewHeaderCrosshair] = useState<{
    price: number;
    timeUnix: number;
    periodLabel: string | null;
  } | null>(null);
  const setMobileOverviewHeaderCrosshairRef = useRef(setMobileOverviewHeaderCrosshair);
  setMobileOverviewHeaderCrosshairRef.current = setMobileOverviewHeaderCrosshair;
  const holdingsHoverDraftRef = useRef<{
    price: number | null;
    timeUnix: number | null;
    point: { x: number; y: number } | null;
    axisLabel: { leftPx: number; label: string } | null;
  } | null>(null);
  const holdingsHoverRafRef = useRef(0);
  const holdingsTradeTooltipLastKeyRef = useRef<string | null>(null);
  const quarterBandLayoutsRef = useRef<QuarterBandPixelLayout[]>([]);
  const holdingsPriceTooltipRef = useRef<HTMLDivElement>(null);
  const holdingsPriceTooltipTextRef = useRef<HTMLParagraphElement>(null);
  const holdingsTradeTooltipRef = useRef<HTMLDivElement>(null);
  const holdingsTradeTooltipBodyRef = useRef<HTMLDivElement>(null);
  const holdingsHoverAxisLabelRef = useRef<HTMLSpanElement>(null);
  const holdingsPeriodAxisRowRef = useRef<HTMLDivElement>(null);
  const holdingsClearHoverDomRef = useRef<(() => void) | null>(null);
  const tooltipByDateRef = useRef<Map<string, string[]>>(new Map());
  const dimOverlayRef = useRef<HTMLDivElement>(null);
  const stock1DLiveSession = useMemo(
    () => shouldUseStock1DLiveSessionChart(kind, range, points, holdingsStyle),
    [kind, range, points, holdingsStyle],
  );

  const overviewBottomAxisMode = useMemo(() => {
    if (stock1DLiveSession) return "hour" as const;
    return resolveOverviewBottomAxisMode(range, chartPoints);
  }, [range, chartPoints, stock1DLiveSession]);

  const stock1DLiveSessionRef = useRef(stock1DLiveSession);
  useEffect(() => {
    stock1DLiveSessionRef.current = stock1DLiveSession;
  }, [stock1DLiveSession]);

  const liveSpotUsdRef = useRef(liveSpotUsd);
  useEffect(() => {
    liveSpotUsdRef.current = liveSpotUsd;
  }, [liveSpotUsd]);

  const periodAxisSyncOptions = useMemo(
    (): OverviewPeriodAxisSyncOptions => ({
      stock1DLiveSession,
    }),
    [stock1DLiveSession],
  );

  const syncLiveSessionAxisLabels = useCallback(() => {
    if (!stock1DLiveSessionRef.current) return;
    const c = chartRef.current;
    const meta = liveSessionChartMetaRef.current;
    if (!c || !meta || holdingsStyleRef.current || hoverTimeRef.current != null) return;
    if (pointsRef.current.length === 0) return;
    setPeriodAxisLabelsGuarded(
      syncOverviewPeriodAxisLabels(
        c,
        pointsRef.current,
        meta.timeZone,
        "hour",
        containerWidthRef.current,
        { stock1DLiveSession: true },
      ),
    );
    syncRangePriceBadgesRef.current?.();
  }, []);

  const syncLiveSessionAxisLabelsRef = useRef(syncLiveSessionAxisLabels);
  syncLiveSessionAxisLabelsRef.current = syncLiveSessionAxisLabels;

  const pinLiveSessionTimeScaleAndSyncAxis = useCallback(() => {
    if (!stock1DLiveSessionRef.current) return;
    const c = chartRef.current;
    const meta = liveSessionChartMetaRef.current;
    if (!c || !meta || holdingsStyleRef.current || hoverTimeRef.current != null) return;
    applyStock1DLiveSessionTimeScale(
      c,
      meta.ymd,
      meta.timeZone,
      meta.dataLen,
      () => syncLiveSessionAxisLabelsRef.current?.(),
    );
  }, []);

  const pinLiveSessionTimeScaleAndSyncAxisRef = useRef(pinLiveSessionTimeScaleAndSyncAxis);
  pinLiveSessionTimeScaleAndSyncAxisRef.current = pinLiveSessionTimeScaleAndSyncAxis;

  const fitChartTimeScale = useCallback((chart: IChartApi, containerWidthPx: number, pointCount: number) => {
    if (stock1DLiveSessionRef.current) {
      const meta = liveSessionChartMetaRef.current;
      const ymd =
        meta?.ymd ?? resolveStock1DLiveSessionYmd(pointsRef.current, dataTimeZoneRef.current);
      if (ymd) {
        applyStock1DLiveSessionTimeScale(
          chart,
          ymd,
          meta?.timeZone ?? dataTimeZoneRef.current,
          meta?.dataLen ?? pointCount,
          () => syncLiveSessionAxisLabelsRef.current?.(),
        );
        return;
      }
    }
    fitOverviewChartTimeScale(
      chart,
      containerWidthPx,
      pointCount,
      {
        kind: kindRef.current,
        range: rangeRef.current,
        points: pointsRef.current,
        timeZone: dataTimeZoneRef.current,
        holdingsStyle: holdingsStyleRef.current,
      },
    );
  }, [pinLiveSessionTimeScaleAndSyncAxis]);

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
  const plotHeight = useCustomBottomAxis ? Math.max(120, chartHeight - axisRowPx) : chartHeight;
  const useMobileOverviewCrosshair =
    !screenshotPreviewMode && useCustomBottomAxis && shouldHideMobileYAxisLabels(containerWidth);

  useEffect(() => {
    pointsRef.current = chartPoints;
  }, [chartPoints]);

  useEffect(() => {
    if (chartPoints.length === 0) {
      overviewCrosshairLabelByBarTimeRef.current = null;
      return;
    }
    overviewCrosshairLabelByBarTimeRef.current = buildOverviewCrosshairLabelByBarTime(
      chartPoints,
      dataTimeZoneHint,
      range,
      overviewBottomAxisMode,
    );
  }, [range, kind, chartPoints, overviewBottomAxisMode, dataTimeZoneHint]);

  useEffect(() => {
    containerWidthRef.current = containerWidth;
    hideMobileYAxisLabelsRef.current = shouldHideMobileYAxisLabels(containerWidth);
  }, [containerWidth]);

  useEffect(() => {
    if (!useMobileOverviewCrosshair || !ready) return;
    const host = wrapRef.current;
    if (!host) return;
    return attachMobilePriceChartHaptics(host, {
      getChart: () => chartRef.current,
      getPoints: () => pointsRef.current,
      onScrub: (clientX, clientY) => {
        const chart = chartRef.current;
        const apply = mobileScrubApplyRef.current;
        if (!chart || !apply) return;
        const rect = host.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const bar = pointAtChartX(chart, pointsRef.current, x);
        if (bar && isFiniteNumber(bar.time) && isFiniteNumber(bar.value)) {
          apply({ x, y }, bar);
        }
      },
      onScrubEnd: () => {
        mobileScrubClearRef.current?.();
      },
    });
  }, [useMobileOverviewCrosshair, ready]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart) return;
    const hide = shouldHideMobileYAxisLabels(containerWidth);
    hideMobileYAxisLabelsRef.current = hide;
    const liveSession = stock1DLiveSessionRef.current;
    chart.applyOptions({
      ...mobileOverviewChartScaleOptions(containerWidth),
      // Keep native time ticks off when using the custom bottom axis; otherwise we render
      // both native ticks and our labels (causes overlapping like "6AM 6AM").
      timeScale: {
        ...(liveSession
          ? {
              fixLeftEdge: true,
              fixRightEdge: false,
              rightOffset: 0,
              lockVisibleTimeRangeOnResize: true,
              shiftVisibleRangeOnNewBar: false,
              allowShiftVisibleRangeOnWhitespaceReplacement: false,
            }
          : mobileTimeScaleOptions(containerWidth)),
        ticksVisible: !useCustomBottomAxis,
        tickMarkFormatter: useCustomBottomAxis ? () => "" : undefined,
        minimumHeight: useCustomBottomAxis ? 0 : undefined,
      },
      crosshair: {
        mode: holdingsStyle ? CrosshairMode.Normal : hide ? CrosshairMode.Normal : CrosshairMode.Magnet,
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
        const sessionOpen = sessionOpenPriceRef.current;
        if (stock1DLiveSessionRef.current && sessionOpen != null && Number.isFinite(sessionOpen)) {
          const pts = pointsRef.current.filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value));
          const chartLiveSpot =
            getUsEquityMarketSession(new Date()) === "regular" ? liveSpotUsdRef.current : null;
          applyLiveSessionSeriesPriceLineOptions(
            series,
            sessionOpen,
            chartLiveSpot,
            pts.at(-1)?.value,
            hide,
          );
        } else {
          series.applyOptions({ priceLineVisible: false });
        }
      }
      if (hide) {
        removeYAxisTickLabels(series, yAxisTickLinesRef);
      } else if (!screenshotPreviewModeRef.current || screenshotShowVerticalLegendRef.current) {
        syncYAxisTickLabels(chart, series, yAxisTickLinesRef);
      } else {
        removeYAxisTickLabels(series, yAxisTickLinesRef);
      }
      if (pointsRef.current.some((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))) {
        fitChartTimeScale(chart, containerWidth, pointsRef.current.length);
      }
    }
  }, [containerWidth, plotHeight, holdingsStyle, useCustomBottomAxis]);

  useEffect(() => {
    dataTimeZoneRef.current =
      points.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone ??
      (kind === "stock" ? "America/New_York" : "UTC");
  }, [points, kind]);

  useEffect(() => {
    if (!useCustomBottomAxis || holdingsStyle || loading) return;
    const c = chartRef.current;
    if (!c || hoverTimeRef.current != null || pointsRef.current.length === 0) return;
    if (stock1DLiveSessionRef.current) {
      pinLiveSessionTimeScaleAndSyncAxisRef.current?.();
      return;
    }
    setPeriodAxisLabelsGuarded(
      syncOverviewPeriodAxisLabels(
        c,
        pointsRef.current,
        dataTimeZoneRef.current,
        overviewBottomAxisMode,
        containerWidthRef.current,
        periodAxisSyncOptions,
      ),
    );
  }, [overviewBottomAxisMode, useCustomBottomAxis, holdingsStyle, points, containerWidth, loading, periodAxisSyncOptions]);

  // Holdings charts never drive the page header. Mobile overview scrub updates the header price.
  const crosshairForHeader = useMemo((): { price: number; timeUnix: number } | null => {
    if (holdingsStyle || !useMobileOverviewCrosshair) return null;
    return mobileOverviewHeaderCrosshair;
  }, [holdingsStyle, useMobileOverviewCrosshair, mobileOverviewHeaderCrosshair]);

  const metrics = useMemo(() => {
    const fromChart = computeChartHeaderMetrics(chartPoints, null, crosshairForHeader);
    if (
      kind === "stock" &&
      range === "1D" &&
      !holdingsStyle &&
      liveSpotUsd != null &&
      Number.isFinite(liveSpotUsd) &&
      liveSpotUsd > 0 &&
      getUsEquityMarketSession(new Date()) === "regular" &&
      !fromChart.isHovering &&
      (fromChart.displayPrice == null || chartPoints.length === 0)
    ) {
      return { ...fromChart, displayPrice: liveSpotUsd };
    }
    return fromChart;
  }, [kind, range, holdingsStyle, chartPoints, crosshairForHeader, liveSpotUsd]);

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

  useEffect(() => {
    tooltipByDateRef.current = tooltipByDate;
  }, [tooltipByDate]);

  useEffect(() => {
    quarterBandLayoutsRef.current = quarterBandLayouts;
  }, [quarterBandLayouts]);

  const lastPointStroke = useMemo(() => {
    const first = chartPoints.find((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value));
    if (first == null || chartPoints.length < 1) return GREEN;
    const last = chartPoints[chartPoints.length - 1]?.value;
    return isFiniteNumber(last) && last < first.value ? RED : GREEN;
  }, [chartPoints]);
  const lastPointStrokeRef = useRef(lastPointStroke);
  lastPointStrokeRef.current = lastPointStroke;

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
      empty: !loading && chartPoints.length === 0,
      displayPrice: metrics.displayPrice,
      displayChangePct: metrics.displayChangePct,
      displayChangeAbs: metrics.displayChangeAbs,
      selectionChangeAbs: metrics.selectionChangeAbs,
      selectionChangePct: metrics.selectionChangePct,
      isHovering: metrics.isHovering,
      selectionActive: metrics.selectionActive,
      periodLabelOverride: metrics.periodLabelOverride,
      priceTimestampLabel,
      scrubPeriodLabel: metrics.scrubPeriodLabel,
    });
  }, [loading, chartPoints.length, metrics, onDisplayChange, kind, dataTimeZoneHint]);

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
    setMobileOverviewHeaderCrosshairRef.current(null);
    setHoverAxisLabelGuarded(null);
    if (dimOverlayRef.current) dimOverlayRef.current.style.display = "none";
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
      holdingsClearHoverDomRef.current?.();
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
        shiftVisibleRangeOnNewBar: false,
        ticksVisible: !useCustomBottomAxis,
        tickMarkFormatter: useCustomBottomAxis ? () => "" : undefined,
        minimumHeight: useCustomBottomAxis ? 0 : undefined,
      },
      crosshair: {
        mode: holdingsStyleRef.current
          ? CrosshairMode.Normal
          : screenshotPreviewMode || hideMobileYAxisLabelsRef.current
            ? CrosshairMode.Normal
            : CrosshairMode.Magnet,
        vertLine: {
          color: "rgba(9, 9, 11, 0.28)",
          labelVisible: false,
          width: 1,
          style: LineStyle.Dashed,
          visible: !screenshotPreviewMode,
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
      ? (() => {
          holdingsFillUnderlayRef.current = chart.addSeries(AreaSeries, {
            lineColor: "rgba(255,255,255,0)",
            topColor: HOLDINGS_FILL_WHITE_TOP,
            bottomColor: HOLDINGS_FILL_WHITE_BOTTOM,
            lineWidth: 1,
            lineVisible: false,
            lineType: LineType.Curved,
            priceLineVisible: false,
            lastValueVisible: false,
            lastPriceAnimation: LastPriceAnimationMode.Disabled,
            crosshairMarkerVisible: false,
          });
          return chart.addSeries(AreaSeries, {
            lineColor: VALUE_BLUE,
            topColor: HOLDINGS_FILL_BLUE_TOP,
            bottomColor: HOLDINGS_FILL_BLUE_BOTTOM,
            lineWidth: 2,
            lineType: LineType.Curved,
            priceLineVisible: false,
            lastValueVisible: false,
            lastPriceAnimation: LastPriceAnimationMode.Disabled,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 5,
            crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
            crosshairMarkerBackgroundColor: VALUE_BLUE,
            crosshairMarkerBorderWidth: 2,
          });
        })()
      : (() => {
          holdingsFillUnderlayRef.current = null;
          return chart.addSeries(BaselineSeries, {
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
        })();

    const markers = createSeriesMarkers(series, [], { autoScale: true });
    markersRef.current = markers as ISeriesMarkersPluginApi<UTCTimestamp>;

    chartRef.current = chart;
    seriesRef.current = series;

    const resyncPeriodAxisLabels = () => {
      if (!useCustomBottomAxis || loadingRef.current) return;
      const c = chartRef.current;
      if (!c || hoverTimeRef.current != null || pointsRef.current.length === 0) return;
      if (stock1DLiveSessionRef.current) {
        pinLiveSessionTimeScaleAndSyncAxisRef.current?.();
        return;
      }
      setPeriodAxisLabelsGuarded(
        syncOverviewPeriodAxisLabels(
          c,
          pointsRef.current,
          dataTimeZoneRef.current,
          overviewBottomAxisModeRef.current,
          containerWidthRef.current,
          { stock1DLiveSession: false },
        ),
      );
    };

    const clearHoldingsHoverDom = () => {
      holdingsHoverDraftRef.current = null;
      holdingsTradeTooltipLastKeyRef.current = null;
      if (holdingsHoverRafRef.current) {
        cancelAnimationFrame(holdingsHoverRafRef.current);
        holdingsHoverRafRef.current = 0;
      }
      if (holdingsPriceTooltipRef.current) holdingsPriceTooltipRef.current.style.display = "none";
      if (holdingsTradeTooltipRef.current) holdingsTradeTooltipRef.current.style.display = "none";
      if (holdingsHoverAxisLabelRef.current) holdingsHoverAxisLabelRef.current.style.display = "none";
      if (holdingsPeriodAxisRowRef.current) holdingsPeriodAxisRowRef.current.style.visibility = "";
    };
    holdingsClearHoverDomRef.current = clearHoldingsHoverDom;

    const formatHoldingsHoverValue = (price: number) =>
      kindRef.current === "stock" && chartMetricSeriesRef.current === "marketCap"
        ? formatMarketCapAxis(price)
        : kindRef.current === "stock" && chartMetricSeriesRef.current === "return"
          ? formatReturnAxis(price)
          : `$${formatStockPriceAxis(price)}`;

    const applyHoldingsHoverDom = () => {
      const draft = holdingsHoverDraftRef.current;
      if (!draft?.point || draft.price == null || draft.timeUnix == null) return;

      const plotW = containerWidthRef.current;
      const point = draft.point;
      const ymd = ymdFromUnixSeconds(draft.timeUnix);
      const bandLayout =
        holdingsQuarterBandsRef.current.length > 0
          ? findQuarterBandLayoutAtX(quarterBandLayoutsRef.current, point.x)
          : null;
      const tradeLines =
        !bandLayout && ymd ? (tooltipByDateRef.current.get(ymd) ?? null) : null;

      const renderHoldingsTradeTooltip = (title: string, lines: string[], tooltipKey: string) => {
        if (!holdingsTradeTooltipRef.current) return;
        if (holdingsPriceTooltipRef.current) holdingsPriceTooltipRef.current.style.display = "none";
        const tradeTip = holdingsTradeTooltipRef.current;
        const shown = Math.min(6, lines.length);
        const estH = Math.min(240, 34 + shown * 22 + (lines.length > 6 ? 18 : 0));
        const pos = layoutPointTooltip(point, plotW, plotHeight, estH);
        tradeTip.style.display = "block";
        tradeTip.style.left = `${pos.left}px`;
        tradeTip.style.top = `${pos.top}px`;
        tradeTip.style.transform = pos.transform;

        if (holdingsTradeTooltipLastKeyRef.current !== tooltipKey) {
          holdingsTradeTooltipLastKeyRef.current = tooltipKey;
          const body = holdingsTradeTooltipBodyRef.current;
          if (body) {
            body.replaceChildren();
            const titleEl = document.createElement("div");
            titleEl.className = "font-semibold tabular-nums text-[#09090B]";
            titleEl.textContent = title;
            body.appendChild(titleEl);
            const list = document.createElement("div");
            list.className = "mt-1 space-y-1 text-[#71717A]";
            for (let i = 0; i < shown; i++) {
              const line = document.createElement("div");
              line.className = "whitespace-normal break-words";
              line.textContent = lines[i]!;
              list.appendChild(line);
            }
            if (lines.length > 6) {
              const more = document.createElement("div");
              more.className = "text-[#71717A]";
              more.textContent = `+${lines.length - 6} more`;
              list.appendChild(more);
            }
            body.appendChild(list);
          }
        }
      };

      if (bandLayout) {
        const line = quarterBandActivityTooltipLine(bandLayout.band);
        const priceTitle = formatHoldingsHoverValue(draft.price);
        renderHoldingsTradeTooltip(priceTitle, [line], `${bandLayout.key}|${priceTitle}|${line}`);
      } else if (tradeLines?.length && ymd) {
        renderHoldingsTradeTooltip(formatTradeTooltipDateHeader(ymd), tradeLines, ymd);
      } else if (holdingsPriceTooltipRef.current && holdingsPriceTooltipTextRef.current) {
        if (holdingsTradeTooltipRef.current) holdingsTradeTooltipRef.current.style.display = "none";
        holdingsTradeTooltipLastKeyRef.current = null;
        const pos = layoutPointTooltip(point, plotW, plotHeight, 40);
        const tip = holdingsPriceTooltipRef.current;
        holdingsPriceTooltipTextRef.current.textContent = `Price: ${formatHoldingsHoverValue(draft.price)}`;
        tip.style.display = "block";
        tip.style.left = `${pos.left}px`;
        tip.style.top = `${pos.top}px`;
        tip.style.transform = pos.transform;
      }

      const axis = holdingsHoverAxisLabelRef.current;
      const axisLabel = draft.axisLabel;
      if (axis && axisLabel?.label) {
        if (holdingsPeriodAxisRowRef.current) holdingsPeriodAxisRowRef.current.style.visibility = "hidden";
        axis.textContent = axisLabel.label;
        const anchor = resolvePeriodAxisLabelAnchor(axisLabel.leftPx, {
          isLeftmost: axisLabel.leftPx <= (periodAxisLabelsRef.current[0]?.leftPx ?? axisLabel.leftPx) + 4,
        });
        Object.assign(
          axis.style,
          periodAxisLabelLayoutStyle(axisLabel.leftPx, anchor, containerWidthRef.current),
        );
        axis.style.transform = anchor === "left" ? "none" : "translateX(-50%)";
        axis.style.display = "";
      }
    };

    const scheduleHoldingsHoverDom = () => {
      if (!holdingsHoverRafRef.current) {
        holdingsHoverRafRef.current = requestAnimationFrame(() => {
          holdingsHoverRafRef.current = 0;
          applyHoldingsHoverDom();
        });
      }
    };

    const applyMobileOverviewCrosshair = (
      point: { x: number; y: number },
      nearBar: StockChartPoint,
    ) => {
      mobileHoverPointRef.current = point;
      if (dimOverlayRef.current) {
        dimOverlayRef.current.style.display = "";
        dimOverlayRef.current.style.left = `${Math.max(0, point.x)}px`;
      }
      const timeUnix = chartPointDisplayUnix(nearBar, overviewBottomAxisModeRef.current);
      const periodLabel = overviewCrosshairLabelByBarTimeRef.current?.get(nearBar.time)?.trim() || null;
      if (isFiniteNumber(nearBar.value) && isFiniteNumber(timeUnix)) {
        setMobileOverviewHeaderCrosshairRef.current({
          price: nearBar.value,
          timeUnix,
          periodLabel,
        });
      }
      if (mobileHoverBarTimeRef.current !== nearBar.time) {
        mobileHoverBarTimeRef.current = nearBar.time;
        const xCoord = chart.timeScale().timeToCoordinate(nearBar.time as UTCTimestamp);
        const leftPx = resolveOverviewCrosshairLeftPx(
          chart,
          nearBar.time,
          xCoord != null && Number.isFinite(xCoord) ? xCoord : point.x,
          stock1DLiveSessionRef.current,
          liveSessionChartMetaRef.current,
        );
        const label = periodLabel ?? "";
        setHoverAxisLabelGuarded({ leftPx, label });
      }
    };

    mobileScrubApplyRef.current = (point, nearBar) => {
      crosshairHoveredRef.current = true;
      hoverTimeRef.current = nearBar.time as Time;
      applyMobileOverviewCrosshair(point, nearBar);
    };
    mobileScrubClearRef.current = () => {
      crosshairHoveredRef.current = false;
      hoverTimeRef.current = null;
      clearMobileOverviewCrosshairDom();
    };

    const onCrosshairMove = (param: MouseEventParams) => {
      const s = seriesRef.current;
      if (!s) return;
      if (param.point === undefined || param.point.x < 0 || param.point.y < 0 || param.time === undefined) {
        const wasHovered = crosshairHoveredRef.current;
        crosshairHoveredRef.current = false;
        hoverTimeRef.current = null;
        if (holdingsStyleRef.current) {
          clearHoldingsHoverDom();
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
            const leftPx = resolveOverviewCrosshairLeftPx(
              chart,
              nearBar.time,
              xCoord != null && Number.isFinite(xCoord) ? xCoord : param.point.x,
              stock1DLiveSessionRef.current,
              liveSessionChartMetaRef.current,
            );
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
        const barTime = nearBar && isFiniteNumber(nearBar.time) ? nearBar.time : tunix;
        const xCoord = chart.timeScale().timeToCoordinate(barTime as UTCTimestamp);
        const leftPx = resolveOverviewCrosshairLeftPx(
          chart,
          barTime,
          xCoord != null && Number.isFinite(xCoord) ? xCoord : nextPt.x,
          stock1DLiveSessionRef.current,
          liveSessionChartMetaRef.current,
        );
        const label = overviewCrosshairLabelByBarTimeRef.current?.get(barTime) ?? "";
        holdingsHoverDraftRef.current = {
          price: hoverValue,
          timeUnix: tunix,
          point: nextPt,
          axisLabel: { leftPx, label },
        };
        scheduleHoldingsHoverDom();
      } else {
        const wasHovered = crosshairHoveredRef.current;
        crosshairHoveredRef.current = false;
        hoverTimeRef.current = null;
        clearHoldingsHoverDom();
        if (wasHovered) resyncPeriodAxisLabels();
      }
    };
    if (!screenshotPreviewMode) {
      chart.subscribeCrosshairMove(onCrosshairMove);
    }

    rescaleOverviewInBarMarkersRef.current = () => {
      const c = chartRef.current;
      const m = markersRef.current;
      const templates = overviewInBarMarkersRef.current;
      if (!c || !m || !templates?.length) return;
      scheduleScaledInBarMarkers(c, m, templates);
    };
    syncQuarterBandLayoutsRef.current = () => {
      const chart = chartRef.current;
      const bands = holdingsQuarterBandsRef.current;
      if (!chart || !holdingsStyleRef.current || bands.length === 0) {
        setQuarterBandLayouts((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      const pts = pointsRef.current.filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value));
      const series = seriesRef.current;
      const ts = chart.timeScale();
      const plotHeightPx = chart.paneSize(0).height;
      const layouts = computeQuarterBandPixelLayouts(
        (time) => {
          const x = ts.timeToCoordinate(time as Time);
          return x == null ? null : Number(x);
        },
        pts.map((p) => ({ time: p.time, value: p.value })),
        bands,
        series && plotHeightPx > 0
          ? {
              priceToY: (price) => {
                const y = series.priceToCoordinate(price);
                return y == null ? null : Number(y);
              },
              plotHeightPx,
              bandHeightRatio: HOLDINGS_QUARTER_BAND_HEIGHT_RATIO,
            }
          : undefined,
      );
      setQuarterBandLayouts((prev) => (quarterBandLayoutsEqual(prev, layouts) ? prev : layouts));
    };
    syncRangePriceBadgesRef.current = () => {
      if (hideMobileYAxisLabelsRef.current && crosshairHoveredRef.current) {
        commitLivePriceDot(setLivePriceDot, null);
        return;
      }
      if (
        screenshotPreviewModeRef.current &&
        !screenshotShowRangeBadgesRef.current
      ) {
        commitRangePriceBadge(setRangeOpenBadge, null);
        commitRangePriceBadge(setRangeHighBadge, null);
        commitLivePriceDot(setLivePriceDot, null);
        return;
      }
      if (holdingsStyleRef.current) {
        commitRangePriceBadge(setRangeOpenBadge, null);
        commitRangePriceBadge(setRangeHighBadge, null);
        commitLivePriceDot(setLivePriceDot, null);
        return;
      }
      const chart = chartRef.current;
      const s = seriesRef.current;
      if (!chart || !s) {
        commitRangePriceBadge(setRangeOpenBadge, null);
        commitRangePriceBadge(setRangeHighBadge, null);
        commitLivePriceDot(setLivePriceDot, null);
        return;
      }
      const pts = pointsRef.current.filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value));
      const first = pts[0];
      if (!first) {
        commitRangePriceBadge(setRangeOpenBadge, null);
        commitRangePriceBadge(setRangeHighBadge, null);
        commitLivePriceDot(setLivePriceDot, null);
        return;
      }
      const plotWidth = containerRef.current?.clientWidth ?? chart.paneSize(0).width;
      const metric = chartMetricSeriesRef.current;
      const liveSessionPlot =
        stock1DLiveSessionRef.current && liveSessionChartMetaRef.current
          ? {
              sessionYmd: liveSessionChartMetaRef.current.ymd,
              timeZone: liveSessionChartMetaRef.current.timeZone,
            }
          : null;
      const openLayout = layoutRangePriceBadge(chart, s, first, "start", plotWidth, liveSessionPlot);
      commitRangePriceBadge(
        setRangeOpenBadge,
        openLayout
          ? {
              ...openLayout,
              label: formatOverviewChartAxisValue(first.value, kindRef.current, metric),
              anchor: "start",
            }
          : null,
      );

      const highPt = findRangeHighPoint(pts);
      if (
        !highPt ||
        (highPt.time === first.time && Math.abs(highPt.value - first.value) < 1e-9)
      ) {
        commitRangePriceBadge(setRangeHighBadge, null);
      } else {
        const highLayout = layoutRangePriceBadge(chart, s, highPt, "center", plotWidth, liveSessionPlot);
        commitRangePriceBadge(
          setRangeHighBadge,
          highLayout
            ? {
                ...highLayout,
                label: formatOverviewChartAxisValue(highPt.value, kindRef.current, metric),
                anchor: "center",
              }
            : null,
        );
      }

      const marketSession = getUsEquityMarketSession(new Date());
      const showLiveSessionDot = marketSession === "regular";
      if (
        screenshotPreviewModeRef.current ||
        holdingsStyleRef.current ||
        !stock1DLiveSessionRef.current ||
        !showLiveSessionDot ||
        crosshairHoveredRef.current
      ) {
        commitLivePriceDot(setLivePriceDot, null);
        return;
      }
      const lastPt = pts[pts.length - 1];
      if (!lastPt) {
        commitLivePriceDot(setLivePriceDot, null);
        return;
      }
      const dotLayout = layoutRangePriceBadge(
        chart,
        s,
        lastPt,
        "center",
        plotWidth,
        liveSessionPlot,
      );
      commitLivePriceDot(
        setLivePriceDot,
        dotLayout
          ? {
              left: dotLayout.left,
              top: dotLayout.top,
              color: lastPointStrokeRef.current,
              animated: true,
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
        const showYAxisLabels =
          !hideMobileYAxisLabelsRef.current &&
          (!screenshotPreviewModeRef.current || screenshotShowVerticalLegendRef.current);
        if (showYAxisLabels) {
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
      syncQuarterBandLayoutsRef.current?.();
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
          fitChartTimeScale(chart, plotW, pointsRef.current.length);
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
      mobileScrubApplyRef.current = null;
      mobileScrubClearRef.current = null;
      clearHoldingsHoverDom();
      holdingsClearHoverDomRef.current = null;
      if (visRangeTimer) clearTimeout(visRangeTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      ts.unsubscribeVisibleLogicalRangeChange(onVisRangeForMarkers);
      ts.unsubscribeVisibleTimeRangeChange(onVisRangeForMarkers);
      rescaleOverviewInBarMarkersRef.current = null;
      syncRangePriceBadgesRef.current = null;
      syncQuarterBandLayoutsRef.current = null;
      setQuarterBandLayouts([]);
      overviewInBarMarkersRef.current = null;
      commitRangePriceBadge(setRangeOpenBadge, null);
      commitRangePriceBadge(setRangeHighBadge, null);
      if (!screenshotPreviewMode) {
        chart.unsubscribeCrosshairMove(onCrosshairMove);
      }
      markersRef.current = null;
      const sUnmount = seriesRef.current;
      if (sUnmount) {
        removeScaleBoundsPriceLines(sUnmount, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        removeSessionHighLowPriceLines(sUnmount, sessionHighPriceLineRef, sessionLowPriceLineRef);
        removeYAxisTickLabels(sUnmount, yAxisTickLinesRef);
      }
      baselinePriceLineRef.current = null;
      sessionOpenPriceRef.current = null;
      costBasisLineRef.current = null;
      splitSeriesBundleRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      holdingsFillUnderlayRef.current = null;
      liveSessionSpanSeriesRef.current = null;
    };
  }, [
    plotHeight,
    holdingsStyle,
    useCustomBottomAxis,
    clearOverviewHover,
    scheduleOverviewHoverFlush,
    clearMobileOverviewCrosshairDom,
    screenshotPreviewMode,
  ]);

  useEffect(() => {
    if (!screenshotPreviewMode || !ready) return;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    const hide = shouldHideMobileYAxisLabels(containerWidth);
    if (!hide && screenshotShowVerticalLegend) {
      syncYAxisTickLabels(chart, series, yAxisTickLinesRef);
    } else {
      removeYAxisTickLabels(series, yAxisTickLinesRef);
    }
    syncRangePriceBadgesRef.current?.();
  }, [
    screenshotPreviewMode,
    screenshotShowVerticalLegend,
    screenshotShowRangeBadges,
    ready,
    containerWidth,
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
      const live1DRegular =
        kind === "stock" &&
        range === "1D" &&
        series === "price" &&
        !holdingsStyle &&
        getUsEquityMarketSession(new Date()) === "regular";

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

        if (live1DRegular) {
          try {
            const path = `/api/stocks/${encodeURIComponent(symbol)}/chart?range=1D&series=${encodeURIComponent(series)}`;
            const res = await fetch(path, { credentials: "include", cache: "no-store" });
            if (res.ok && mounted) {
              const json = (await res.json()) as { points?: StockChartPoint[] };
              const nextPoints = Array.isArray(json.points) ? json.points : [];
              if (nextPoints.length) setPoints(nextPoints);
            }
          } catch {
            /* keep SSR placeholder until poll */
          }
        }
        return;
      }

      setLoading(true);
      setPeriodAxisLabelsGuarded([]);
      setHoverPriceGuarded(null);
      setHoverTimeUnixGuarded(null);
      setReady(false);
      const dailyCadence = chartDataCadence === "daily";
      const cacheKey =
        dailyCadence && kind === "stock"
          ? superinvestorHoldingChartCacheKey(symbol, range, series)
          : null;
      if (cacheKey) {
        const cached = readSuperinvestorHoldingChartCache(cacheKey);
        if (cached?.length) {
          if (!mounted) return;
          setPoints(cached);
          setLoading(false);
          requestAnimationFrame(() => setReady(true));
          return;
        }
      }
      const cadenceQ = dailyCadence ? "&cadence=daily" : "";
      const path =
        kind === "stock"
          ? `/api/stocks/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}&series=${encodeURIComponent(series)}${cadenceQ}`
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
        const nextPoints = Array.isArray(json.points) ? json.points : [];
        if (cacheKey && nextPoints.length) writeSuperinvestorHoldingChartCache(cacheKey, nextPoints);
        setPoints(nextPoints);
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
  }, [kind, symbol, range, series, initialChart, chartDataCadence]);

  // Refresh intraday history every minute during the regular session.
  useEffect(() => {
    if (holdingsStyle || kind !== "stock" || range !== "1D" || screenshotPreviewMode) return;
    if (getUsEquityMarketSession(new Date()) !== "regular") return;
    let cancelled = false;
    const poll = async () => {
      const path = `/api/stocks/${encodeURIComponent(symbol)}/chart?range=1D&series=${encodeURIComponent(series)}`;
      try {
        const res = await fetch(path, { credentials: "include", cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { points?: StockChartPoint[] };
        const next = Array.isArray(json.points) ? json.points : [];
        if (next.length && !cancelled) setPoints(next);
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), STOCK_1D_LIVE_PRICE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [holdingsStyle, kind, range, series, symbol, screenshotPreviewMode]);

  // Series data, price lines, markers
  useLayoutEffect(() => {
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

    if (!chartPoints.length) {
      removeSplitBundle();
      overviewInBarMarkersRef.current = null;
      series?.setData([]);
      holdingsFillUnderlayRef.current?.setData([]);
      markers?.setMarkers([]);
      if (series) {
        removeScaleBoundsPriceLines(series, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        removeSessionHighLowPriceLines(series, sessionHighPriceLineRef, sessionLowPriceLineRef);
        removeYAxisTickLabels(series, yAxisTickLinesRef);
        removeOverviewSingleBaselineLine(series);
      }
      sessionOpenPriceRef.current = null;
      removeCostLine();
      return;
    }

    const useLiveSessionChart = stock1DLiveSession;
    const timeZone = useLiveSessionChart ? STOCK_1D_LIVE_SESSION_TZ : dataTimeZoneRef.current;
    const liveSessionYmd = useLiveSessionChart
      ? resolveStock1DLiveSessionYmd(chartPoints, timeZone)
      : null;
    const sessionChartPoints = chartPoints;
    const data = sessionChartPoints
      .filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))
      .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));

    const open = data.find((p) => isFiniteNumber(p.value))?.value;
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
      holdingsFillUnderlayRef.current?.setData([]);
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
      holdingsFillUnderlayRef.current?.setData(data);
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

      if (holdingsQuarterBands.length > 0) {
        markersRef.current?.setMarkers([]);
      } else {
        markersRef.current?.setMarkers(tradeMarkersForChart(tradeMarkers, data));
      }
      requestAnimationFrame(() => syncQuarterBandLayoutsRef.current?.());
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
    const relGrad = baselineRelativeGradientEnabled(
      sessionChartPoints.filter((p) => isFiniteNumber(p.value)),
      open,
    );
    const single = ensureOverviewSingleSeries(open, relGrad);
    markers = markersRef.current;
    if (!markers) return;

    single.applyOptions(overviewBaselineOptions(open, "bright", isTouchLikeChartDevice(), relGrad));

    if (useLiveSessionChart && liveSessionYmd) {
      let span = liveSessionSpanSeriesRef.current;
      if (!span) {
        span = chart.addSeries(LineSeries, {
          visible: true,
          color: "rgba(0,0,0,0)",
          lineWidth: 1,
          lineVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: () => null,
        });
        liveSessionSpanSeriesRef.current = span;
      }
      span.setData(liveSessionSpanWhitespaceData(liveSessionYmd, timeZone));
    } else {
      liveSessionSpanSeriesRef.current?.setData([]);
    }

    const baselineData =
      useLiveSessionChart && liveSessionYmd
        ? padStock1DLiveSessionBaselineData(data, liveSessionYmd, open, timeZone)
        : data;

    chart.timeScale().applyOptions({
      shiftVisibleRangeOnNewBar: false,
      allowShiftVisibleRangeOnWhitespaceReplacement: false,
      ...(useLiveSessionChart && liveSessionYmd
        ? {
            fixLeftEdge: true,
            fixRightEdge: false,
            rightOffset: 0,
            lockVisibleTimeRangeOnResize: true,
          }
        : mobileTimeScaleOptions(containerWidthRef.current)),
    });

    single.setData(baselineData);

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

    const last = [...data].reverse().find((p) => isFiniteNumber(p.value));
    if (useLiveSessionChart) {
      sessionOpenPriceRef.current = open;
      const chartLiveSpot =
        getUsEquityMarketSession(new Date()) === "regular" ? liveSpotUsd : null;
      applyLiveSessionSeriesPriceLineOptions(
        single,
        open,
        chartLiveSpot,
        last?.value,
        hideMobileYAxisLabelsRef.current,
      );
    } else {
      sessionOpenPriceRef.current = null;
      single.applyOptions({ priceLineVisible: false });
    }

    if (useLiveSessionChart && liveSessionYmd) {
      liveSessionChartMetaRef.current = {
        ymd: liveSessionYmd,
        dataLen: baselineData.length,
        timeZone,
      };
      const pinSessionScale = () => {
        applyStock1DLiveSessionTimeScale(
          chart,
          liveSessionYmd,
          timeZone,
          baselineData.length,
          () => syncLiveSessionAxisLabelsRef.current?.(),
        );
      };
      // Pin after setData — time scale must include the 16:00 whitespace anchor first.
      requestAnimationFrame(() => {
        pinSessionScale();
        requestAnimationFrame(pinSessionScale);
      });
    } else {
      liveSessionChartMetaRef.current = null;
      const plotW = containerRef.current?.clientWidth ?? chart.paneSize(0).width;
      fitChartTimeScale(chart, plotW, data.length);
    }

    if (last && !useLiveSessionChart) {
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
    syncRangePriceBadgesRef.current?.();
    removeScaleBoundsPriceLines(single, scaleTopPriceLineRef, scaleBottomPriceLineRef);
    removeSessionHighLowPriceLines(single, sessionHighPriceLineRef, sessionLowPriceLineRef);
    if (!hideMobileYAxisLabelsRef.current) {
      syncYAxisTickLabels(chart, single, yAxisTickLinesRef);
    } else {
      removeYAxisTickLabels(single, yAxisTickLinesRef);
    }
    if (!useLiveSessionChart) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!holdingsStyle && !loading && chartRef.current && hoverTimeRef.current == null) {
            setPeriodAxisLabelsGuarded(
              syncOverviewPeriodAxisLabels(
                chartRef.current,
                pointsRef.current,
                dataTimeZoneRef.current,
                overviewBottomAxisModeRef.current,
                containerWidthRef.current,
                periodAxisSyncOptions,
              ),
            );
          }
        });
      });
    }
  }, [chartPoints, liveSpotUsd, lastPointStroke, holdingsStyle, tradeMarkers, holdingsQuarterBands, costBasisPrice, kind, series, loading, periodAxisSyncOptions, range, fitChartTimeScale, stock1DLiveSession]);

  useEffect(() => {
    if (!stock1DLiveSession || holdingsStyle) return;
    if (getUsEquityMarketSession(new Date()) !== "regular") return;
    const s = seriesRef.current;
    const openPrice = sessionOpenPriceRef.current;
    if (!s || openPrice == null || !Number.isFinite(openPrice)) return;
    const pts = pointsRef.current.filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value));
    applyLiveSessionSeriesPriceLineOptions(
      s,
      openPrice,
      liveSpotUsd,
      pts.at(-1)?.value,
      hideMobileYAxisLabelsRef.current,
    );
  }, [stock1DLiveSession, liveSpotUsd, holdingsStyle]);

  const empty = !loading && chartPoints.length === 0;

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

  const overviewTooltipPos = useMemo(() => {
    if (holdingsStyle || !overviewHover || containerWidth <= 0 || !overviewHoverTooltip) return null;
    return layoutPointTooltip(overviewHover.point, containerWidth, plotHeight, 40);
  }, [holdingsStyle, overviewHover, containerWidth, plotHeight, overviewHoverTooltip]);

  const quarterBandPlotInset = useMemo(() => {
    const { top, bottom } = chartSeriesPlotInsetPct(containerWidth);
    return { top: `${top}%`, bottom: `${bottom}%` };
  }, [containerWidth]);

  const holdingsEarlierLines = useMemo(
    () => (holdingsEarlierSummary ? formatEarlierActivityLines(holdingsEarlierSummary) : []),
    [holdingsEarlierSummary],
  );

  const showHoldingsActivityOverlay =
    holdingsStyle && (quarterBandLayouts.length > 0 || holdingsEarlierSummary != null);

  const activeBottomAxisLabel = useMobileOverviewCrosshair
    ? hoverAxisLabel
    : holdingsStyle
      ? null
      : (overviewHover?.axisLabel ?? null);

  const visiblePeriodAxisLabels = useMemo(() => {
    if (periodAxisLabels.length === 0) return [];
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return periodAxisLabels;
    const clampLeft = (x: number) =>
      Math.min(Math.max(0, x), Math.max(0, containerWidth - 8));

    const isLive1DSessionAxis =
      periodAxisLabels.length > 0 &&
      periodAxisLabels.every((lab) => lab.key.startsWith("live-1d-"));

    if (screenshotPreviewMode || isLive1DSessionAxis) {
      return periodAxisLabels.map((lab) => ({
        ...lab,
        leftPx: clampLeft(lab.leftPx),
      }));
    }

    const out: OverviewAxisLabel[] = [];
    let last = -Infinity;
    // Avoid overlaps near the edges where multiple labels clamp to the same left position.
    for (const lab of periodAxisLabels) {
      const left = clampLeft(lab.leftPx);
      if (left - last < 24) continue;
      out.push({ ...lab, leftPx: left });
      last = left;
    }
    return out;
  }, [periodAxisLabels, containerWidth, screenshotPreviewMode]);

  const leftmostPeriodAxisLeftPx = useMemo(() => {
    if (!periodAxisLabels.length) return null;
    return periodAxisLabels.reduce((min, lab) => Math.min(min, lab.leftPx), periodAxisLabels[0]!.leftPx);
  }, [periodAxisLabels]);

  const activeBottomAxisAnchor = useMemo((): PeriodAxisLabelAnchor => {
    if (!activeBottomAxisLabel) return "center";
    const isLeftmostTick =
      leftmostPeriodAxisLeftPx != null &&
      activeBottomAxisLabel.leftPx <= leftmostPeriodAxisLeftPx + 4;
    return resolvePeriodAxisLabelAnchor(activeBottomAxisLabel.leftPx, {
      isLeftmost: isLeftmostTick || activeBottomAxisLabel.leftPx <= 24,
    });
  }, [activeBottomAxisLabel, leftmostPeriodAxisLeftPx]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative z-0 min-w-0 select-none",
        useCustomBottomAxis ? "flex flex-col" : "",
        useMobileOverviewCrosshair && "touch-pan-y",
      )}
      style={{ height: chartHeight }}
      onMouseLeave={
        useCustomBottomAxis && !screenshotPreviewMode
          ? () => {
              crosshairHoveredRef.current = false;
              hoverTimeRef.current = null;
              clearOverviewHover();
              if (!useMobileOverviewCrosshair) {
                if (stock1DLiveSessionRef.current) {
                  pinLiveSessionTimeScaleAndSyncAxisRef.current?.();
                } else {
                  const c = chartRef.current;
                  if (c && points.length > 0) {
                    setPeriodAxisLabelsGuarded(
                      syncOverviewPeriodAxisLabels(
                        c,
                        points,
                        dataTimeZoneRef.current,
                        overviewBottomAxisModeRef.current,
                        containerWidthRef.current,
                        periodAxisSyncOptions,
                      ),
                    );
                  }
                }
              }
            }
          : undefined
      }
    >
      <div className={cn("relative min-h-0", useCustomBottomAxis ? "min-w-0 flex-1" : "absolute inset-0")} style={useCustomBottomAxis ? { height: plotHeight } : undefined}>
      <div className="pointer-events-none absolute inset-0 z-0 max-md:bg-[#FAFAFA] bg-white" aria-hidden>
        {!useMobileOverviewCrosshair ? (
          <div
            className={
              screenshotPreviewMode ? CHART_PLOT_DOTS_PATTERN_EXPORT_CLASS : CHART_PLOT_DOTS_PATTERN_CLASS
            }
          />
        ) : null}
      </div>
      {showHoldingsActivityOverlay ? (
        <HoldingsQuarterBandsOverlay
          layouts={quarterBandLayouts}
          earlierSummary={holdingsEarlierSummary}
          earlierLines={holdingsEarlierLines}
          plotInsetTop={quarterBandPlotInset.top}
          plotInsetBottom={quarterBandPlotInset.bottom}
        />
      ) : null}
      <div
        ref={wrapRef}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out ${
          loading || !ready ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        ref={dimOverlayRef}
        className="pointer-events-none absolute inset-y-0 right-0 z-[15] max-md:bg-[#FAFAFA]/55 bg-white/55"
        style={{ display: "none", left: 0 }}
        aria-hidden
      />
      {holdingsStyle ? (
        <>
          <div
            ref={holdingsPriceTooltipRef}
            className="pointer-events-none absolute z-30 min-w-[148px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)] will-change-[left,top]"
            style={{ display: "none" }}
            role="tooltip"
          >
            <p ref={holdingsPriceTooltipTextRef} className="text-xs font-semibold tabular-nums text-[#09090B]" />
          </div>
          <div
            ref={holdingsTradeTooltipRef}
            className="pointer-events-none absolute z-30 min-w-[220px] max-w-[280px] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] leading-4 text-[#09090B] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)] will-change-[left,top]"
            style={{ display: "none" }}
            role="status"
          >
            <div ref={holdingsTradeTooltipBodyRef} />
          </div>
        </>
      ) : null}
      {!holdingsStyle && !loading && ready && (!screenshotPreviewMode || screenshotShowRangeBadges)
        ? [rangeOpenBadge, rangeHighBadge]
            .filter((b): b is RangeChartPriceBadge => b != null)
            .map((badge) => (
              <div
                key={badge.anchor === "start" ? "open" : "high"}
                className={`pointer-events-none absolute max-w-[min(100%,120px)] -translate-y-full pb-1 ${
                  screenshotPreviewMode ? "z-50" : "z-20"
                } ${badge.anchor === "center" ? "-translate-x-1/2" : ""}`}
                style={{ left: badge.left, top: badge.top }}
                aria-hidden={screenshotPreviewMode ? undefined : true}
              >
                <span className={RANGE_PRICE_BADGE_CLASS}>{badge.label}</span>
              </div>
            ))
        : null}
      {livePriceDot &&
      stock1DLiveSession &&
      getUsEquityMarketSession(new Date()) === "regular" &&
      !holdingsStyle &&
      !loading &&
      ready &&
      !screenshotPreviewMode &&
      !overviewHover ? (
        <div
          className="pointer-events-none absolute z-[25] -translate-x-1/2 -translate-y-1/2"
          style={{ left: livePriceDot.left, top: livePriceDot.top }}
          aria-hidden
        >
          <span className="relative block h-2.5 w-2.5">
            <span
              className={
                livePriceDot.animated !== false
                  ? "chart-live-price-dot-bounce absolute inset-0 rounded-full ring-2 ring-white"
                  : "absolute inset-0 rounded-full ring-2 ring-white"
              }
              style={{ backgroundColor: livePriceDot.color }}
            />
          </span>
        </div>
      ) : null}
      {!holdingsStyle &&
      !screenshotPreviewMode &&
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
      {useCustomBottomAxis && !loading && (!screenshotPreviewMode || screenshotShowHorizontalLegend) ? (
        <div
          className={cn(
            "relative w-full shrink-0 overflow-visible",
            screenshotPreviewMode && "z-30",
          )}
          style={{ height: axisRowPx }}
          aria-hidden={periodAxisLabels.length === 0 && !activeBottomAxisLabel}
        >
          {holdingsStyle ? (
            <>
              <div ref={holdingsPeriodAxisRowRef} className="absolute inset-0">
                {visiblePeriodAxisLabels.map((lab, i) => {
                  const anchor = resolvePeriodAxisLabelAnchor(lab.leftPx, { isLeftmost: i === 0 });
                  return (
                  <span
                    key={lab.key}
                    className={cn(
                      "absolute bottom-1 inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]",
                      periodAxisLabelMaxWidthClass(anchor),
                      periodAxisLabelTransformClass(anchor),
                    )}
                    style={periodAxisLabelLayoutStyle(
                      lab.leftPx,
                      anchor,
                      screenshotPreviewMode ? containerWidth : 0,
                    )}
                  >
                    {lab.label}
                  </span>
                  );
                })}
              </div>
              <span
                ref={holdingsHoverAxisLabelRef}
                className="absolute bottom-1 max-w-[min(100%,calc(100%-16px))] -translate-x-1/2 whitespace-nowrap font-['Inter'] text-[11px] font-medium tabular-nums leading-none text-[#09090B] sm:text-[12px]"
                style={{ display: "none" }}
              />
            </>
          ) : activeBottomAxisLabel ? (
            <span
              className={cn(
                "absolute bottom-1 inline-block whitespace-nowrap font-['Inter'] text-[11px] font-medium tabular-nums leading-none text-[#09090B] sm:text-[12px]",
                periodAxisLabelMaxWidthClass(activeBottomAxisAnchor),
                periodAxisLabelTransformClass(activeBottomAxisAnchor),
              )}
              style={periodAxisLabelLayoutStyle(
                activeBottomAxisLabel.leftPx,
                activeBottomAxisAnchor,
                screenshotPreviewMode ? containerWidth : 0,
              )}
            >
              {activeBottomAxisLabel.label}
            </span>
          ) : (
            visiblePeriodAxisLabels.map((lab, i) => {
              const isLive1DLabel = lab.key.startsWith("live-1d-");
              const anchor = resolvePeriodAxisLabelAnchor(lab.leftPx, {
                isLeftmost: !isLive1DLabel && i === 0,
              });
              return (
              <span
                key={lab.key}
                className={cn(
                  "absolute top-1/2 inline-block -translate-y-1/2 whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]",
                  periodAxisLabelMaxWidthClass(anchor),
                  periodAxisLabelTransformClass(anchor),
                )}
                style={periodAxisLabelLayoutStyle(
                  lab.leftPx,
                  anchor,
                  screenshotPreviewMode ? containerWidth : 0,
                )}
              >
                {lab.label}
              </span>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
