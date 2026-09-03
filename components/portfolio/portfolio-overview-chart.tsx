"use client";

import { chartMarkerDiscFillColor, resolveFsColor } from "@/lib/theme/resolve-fs-color";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { format, parseISO, subDays } from "date-fns";
import {
  AreaSeries,
  BaselineSeries,
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineSeries,
  LineStyle,
  LineType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { LineChart, Settings } from "@/lib/icons";

import { applyLastPointCircleMarkers } from "@/lib/chart/hollow-in-bar-circle-markers";
import { accentAreaGradientColors, baselineUpDownFillColors } from "@/lib/chart/accent-area-fill";
import { PortfolioUpDownLegendSwatch } from "@/components/chart/portfolio-up-down-legend-swatch";
import { useChartThemePaintKey } from "@/lib/theme/use-logo-dev-theme";
import { baselineRelativeGradientEnabled } from "@/lib/chart/baseline-relative-gradient";
import {
  fundamentalsBarEnterProgress,
  prefersReducedFundamentalsBarMotion,
  runFundamentalsBarEnterAnimation,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import { fitSeriesLogicalRangeToPlotWidth, shouldHideMobileYAxisLabels } from "@/lib/chart/mobile-plot-horizontal-gutter";
import {
  CHART_PLOT_BACKGROUND_CLASS,
  CHART_PLOT_BACKGROUND_LABEL_CLASS,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
  computeFundamentalsChartTooltipPlacement,
} from "@/lib/chart/fundamentals-chart-surface";

import { horzTimeToUnixSeconds, nearestPointByTime } from "@/components/chart/chart-selection-utils";
import {
  CHART_PLOT_DOTS_PATTERN_CLASS,
  formatOverviewCrosshairBottomDate,
  overviewAxisLabelsEqual,
  overviewChartAxisRowPx,
  resolveOverviewBottomAxisMode,
  syncOverviewPeriodAxisLabels,
  periodAxisLabelLayoutStyle,
  periodAxisLabelMaxWidthClass,
  periodAxisLabelTransformClass,
  resolvePeriodAxisLabelAnchor,
  type OverviewAxisLabel,
} from "@/components/chart/overview-bottom-axis";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  extractAllExternalCashFlows,
  replayBenchmarkSharesAsOf,
} from "@/lib/portfolio/benchmark/benchmark-engine";
import {
  lastBenchmarkValueOnOrBeforeTime,
  mergeEodWithIntradayBenchmarkPoints,
  sortBenchmarkChartPoints,
} from "@/lib/portfolio/benchmark/benchmark-chart-points";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { netCashUsdUpTo, normalizeUsdForDisplay } from "@/lib/portfolio/overview-metrics";
import {
  topbarSquircleActiveClass,
  topbarSquircleIconClass,
} from "@/components/design-system/topbar-control-classes";
import { tooltipSurfaceClassName } from "@/components/design-system/tooltip-surface-styles";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/design-system/segmented-control";
import { STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";
import type {
  PortfolioChartRange,
  PortfolioValueHistoryPoint,
} from "@/lib/portfolio/portfolio-chart-types";
import {
  fetchPortfolioValueHistoryCached,
  peekPortfolioValueHistoryCached,
} from "@/lib/portfolio/portfolio-value-history-client-cache";
import { effectiveSamplingRange } from "@/lib/portfolio/portfolio-chart-sampling";

const BENCHMARK_SPY_LINE = "#EA580C";
const BENCHMARK_NASDAQ_LINE = "#9333EA";
const PORTFOLIO_CHART_TIME_ZONE = "America/New_York";
const PORTFOLIO_Y_AXIS_LABEL_COUNT_DESKTOP = 6;
const PORTFOLIO_Y_AXIS_LABEL_COUNT_MOBILE = 4;

const HIDE_NATIVE_Y_AXIS_TICK_LABELS = (priceValue: readonly number[]) => priceValue.map(() => "");

/** Left-to-right reveal clip — matches Metrics / Multichart / holdings line enter animation. */
function applyOverviewLineRevealClip(el: HTMLElement | null, progress: number): void {
  if (!el) return;
  if (progress >= 1) {
    el.style.clipPath = "";
    el.style.opacity = "";
    return;
  }
  const rightInset = (1 - progress) * 100;
  el.style.clipPath = `inset(0 ${rightInset}% 0 0)`;
}

function cancelOverviewLineEnter(args: {
  cancelRef: { current: (() => void) | null };
  doneRef: { current: boolean };
  clearClip: () => void;
}): void {
  args.cancelRef.current?.();
  args.cancelRef.current = null;
  args.doneRef.current = true;
  args.clearClip();
}

/**
 * Production overview enter: wait until LW has a real pane width (and has painted),
 * then clip left-to-right. Clipping at 0 before the first paint leaves axes-only blank
 * space — the canvas never composites, so the reveal has nothing to show and the line pops in.
 */
function runOverviewLineEnterReveal(args: {
  chart: IChartApi;
  wrap: HTMLElement | null;
  applyClip: (progress: number) => void;
  onRevealStart?: () => void;
  onComplete: () => void;
}): () => void {
  let cancelled = false;
  let animCancel: (() => void) | null = null;
  let raf = 0;
  const wrap = args.wrap;

  const restoreWrap = () => {
    if (wrap) wrap.style.opacity = "";
  };

  if (wrap) wrap.style.opacity = "0";
  args.applyClip(1);

  const start = (frame: number) => {
    if (cancelled) return;
    const plotW = args.chart.timeScale().width();
    if ((plotW < 12 || frame < 2) && frame < 24) {
      raf = requestAnimationFrame(() => start(frame + 1));
      return;
    }
    restoreWrap();
    args.applyClip(0);
    args.onRevealStart?.();
    animCancel = runFundamentalsBarEnterAnimation({
      periodCount: 1,
      onFrame: (elapsedMs) => {
        args.applyClip(fundamentalsBarEnterProgress(0, 1, elapsedMs));
      },
      onComplete: () => {
        if (cancelled) return;
        args.applyClip(1);
        args.onComplete();
      },
    });
  };

  raf = requestAnimationFrame(() => start(0));

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    animCancel?.();
    restoreWrap();
  };
}

/** Matches `rightPriceScale.scaleMargins` on the overview LW chart. */
const OVERVIEW_SCALE_MARGIN_TOP = 0.12;
const OVERVIEW_SCALE_MARGIN_BOTTOM = 0.08;

const COMPARE_OVERLAY_PRICE_SCALE_ID = "finsepa-compare-overlay";

/**
 * Return / profit / drawdown always share the portfolio axis (same units).
 * Value shares on 6M / YTD / 1Y / 1M / 5Y / ALL. 1D / 5D value keep an overlay
 * scale so lifetime S&P $ does not flatten the Overview window.
 */
function compareSharesPortfolioPriceScale(
  range: PortfolioChartRange,
  metric: MetricMode,
): boolean {
  if (metric !== "value") return true;
  return range !== "1d" && range !== "5d";
}

type OverviewYAxisLabel = { key: string; label: string; topPct: number };

const EMPTY_OVERLAY_SERIES: readonly {
  id: string;
  points: readonly PortfolioValueHistoryPoint[];
  color: string;
  visible: boolean;
  label?: string;
}[] = [];

function overviewMetricTitle(metric: MetricMode): string {
  return metric === "value" ? "Total value"
    : metric === "profit" ? "Total profit"
    : metric === "drawdown" ? "Drawdown"
    : "Return";
}

function overviewTooltipValue(
  metric: MetricMode,
  raw: number,
): { valueLabel: string; valueTone: "pos" | "neg" | "neutral" } {
  const valueLabel =
    isPercentMetric(metric) ? formatReturnPctAxis(raw)
    : metric === "profit" ? `${raw >= 0 ? "+" : "−"}${TOOLTIP_USD.format(Math.abs(raw))}`
    : TOOLTIP_USD.format(raw);
  const valueTone =
    isPercentMetric(metric) || metric === "profit" ?
      raw > 0 ? "pos"
      : raw < 0 ? "neg"
      : "neutral"
    : "neutral";
  return { valueLabel, valueTone };
}

function overlayLineCrosshairOptions(color: string, visible: boolean) {
  return {
    crosshairMarkerVisible: visible,
    crosshairMarkerRadius: 5,
    crosshairMarkerBorderColor: color,
    crosshairMarkerBackgroundColor: chartMarkerDiscFillColor(),
    crosshairMarkerBorderWidth: 2,
  } as const;
}

function overviewLastPointStroke(metric: MetricMode, data: readonly { value: number }[]): string {
  if (metric === "value") return resolveFsColor("--fs-accent");
  if (metric === "drawdown") return resolveFsColor("--fs-down");
  const last = data[data.length - 1]?.value;
  return typeof last === "number" && last < 0 ? resolveFsColor("--fs-down") : resolveFsColor("--fs-up");
}

function overviewYAxisLabelsEqual(a: OverviewYAxisLabel[], b: OverviewYAxisLabel[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.key !== y.key || x.label !== y.label || x.topPct !== y.topPct) return false;
  }
  return true;
}

type OverviewMainSeries = ISeriesApi<"Area"> | ISeriesApi<"Baseline">;

const BENCHMARK_COMPARE_DISABLED_HINT =
  "Switch to Value or Return to compare with an index.";

async function fetchStockPriceChartPoints(
  ticker: string,
  stockRange: StockChartRange,
  signal: AbortSignal,
): Promise<StockChartPoint[]> {
  const res = await fetch(
    `/api/stocks/${encodeURIComponent(ticker)}/chart?range=${encodeURIComponent(stockRange)}&series=price`,
    { credentials: "include", signal, cache: "no-store" },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { points?: StockChartPoint[] };
  return Array.isArray(json.points) ? json.points : [];
}

async function fetchBenchmarkChartPoints(
  ticker: string,
  range: PortfolioChartRange,
  signal: AbortSignal,
  coverFromYmd?: string | null,
): Promise<StockChartPoint[] | null> {
  const toYmd = format(new Date(), "yyyy-MM-dd");
  const windowFrom = chartWindowStartYmd(range);
  // Contribution replay needs SPY/QQQ at historical deposit dates (same as 6M / YTD / 1Y).
  let fromYmd = coverFromYmd && /^\d{4}-\d{2}-\d{2}$/.test(coverFromYmd) ? coverFromYmd : toYmd;
  try {
    fromYmd = format(subDays(parseISO(fromYmd), 14), "yyyy-MM-dd");
  } catch {
    /* keep fromYmd */
  }
  if (windowFrom != null && windowFrom < fromYmd) fromYmd = windowFrom;

  const hourlyQs = range === "1m" ? "&intraday=1h" : "";
  const res = await fetch(
    `/api/portfolio/benchmark-history?ticker=${encodeURIComponent(ticker)}&from=${encodeURIComponent(fromYmd)}&to=${encodeURIComponent(toYmd)}${hourlyQs}`,
    { credentials: "include", signal, cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { points?: StockChartPoint[] };
  const eod = Array.isArray(json.points) ? json.points : [];

  // 1D / 5D overlays need asset-style 5m. 1M uses 1h on this endpoint (not stock 1M / 1m lookback).
  if (range === "1d" || range === "5d") {
    const intra = await fetchStockPriceChartPoints(ticker, portfolioRangeToStockRange(range), signal);
    // Portfolio 1D is rolling 24h; stock 1D is only today's RTH. 5D fills yesterday's session
    // so the overlay is not a previous-close plateau with one open step.
    const priorSession = range === "1d" ? await fetchStockPriceChartPoints(ticker, "5D", signal) : [];
    const windowBars =
      range === "1d" && priorSession.length > 0
        ? mergeEodWithIntradayBenchmarkPoints(priorSession, intra)
        : intra;
    if (windowBars.length > 0) return mergeEodWithIntradayBenchmarkPoints(eod, windowBars);
  }

  return eod.length > 0 ? eod : null;
}

/** First calendar day of the selected portfolio chart range (approx). */
function chartWindowStartYmd(range: PortfolioChartRange): string | null {
  const now = new Date();
  try {
    switch (range) {
      case "1d":
        return format(subDays(now, 1), "yyyy-MM-dd");
      case "5d":
        return format(subDays(now, 5), "yyyy-MM-dd");
      case "1m":
        return format(subDays(now, 31), "yyyy-MM-dd");
      case "6m":
        return format(subDays(now, 183), "yyyy-MM-dd");
      case "ytd":
        return `${now.getFullYear()}-01-01`;
      case "1y":
        return format(subDays(now, 365), "yyyy-MM-dd");
      case "5y":
        return format(subDays(now, 365 * 5), "yyyy-MM-dd");
      case "all":
        return format(subDays(now, 365 * 12), "yyyy-MM-dd");
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Fetch S&P 500 (SPY) price history for portfolio compare overlays. */
export async function fetchSpyBenchmarkChartPoints(
  range: PortfolioChartRange,
  signal: AbortSignal,
  coverFromYmd?: string | null,
): Promise<StockChartPoint[] | null> {
  return fetchBenchmarkChartPoints("SPY", range, signal, coverFromYmd);
}

/** Fetch Nasdaq-100 proxy (QQQ) price history for portfolio compare overlays. */
export async function fetchNasdaqBenchmarkChartPoints(
  range: PortfolioChartRange,
  signal: AbortSignal,
  coverFromYmd?: string | null,
): Promise<StockChartPoint[] | null> {
  return fetchBenchmarkChartPoints("QQQ", range, signal, coverFromYmd);
}

function portfolioSamplingRange(
  requested: PortfolioChartRange,
  points: readonly StockChartPoint[],
): PortfolioChartRange {
  const from = points[0]?.sessionDate;
  const to = points[points.length - 1]?.sessionDate;
  if (!from || !to) return requested;
  return effectiveSamplingRange(requested, from, to);
}

function portfolioRangeToStockRange(r: PortfolioChartRange): StockChartRange {
  switch (r) {
    case "1d":
      return "1D";
    case "5d":
      return "5D";
    case "1m":
      return "1M";
    case "6m":
      return "6M";
    case "ytd":
      return "YTD";
    case "1y":
      return "1Y";
    case "5y":
      return "5Y";
    case "all":
      return "ALL";
    default:
      return "1Y";
  }
}

function earliestBenchmarkCoverYmd(
  transactions: readonly PortfolioTransaction[],
): string | null {
  const flows = extractAllExternalCashFlows(transactions);
  if (flows.length > 0) return flows[0]!.date;
  let min: string | null = null;
  for (const t of transactions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    if (min == null || t.date < min) min = t.date;
  }
  return min;
}

export { earliestBenchmarkCoverYmd };

function barYmdFromStockPoint(p: StockChartPoint): string | null {
  if (typeof p.sessionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.sessionDate)) {
    return p.sessionDate;
  }
  if (!Number.isFinite(p.time)) return null;
  try {
    return new Date(p.time * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function spySortedByTime(raw: readonly StockChartPoint[]): StockChartPoint[] {
  return sortBenchmarkChartPoints(raw);
}

function spyValueAtPortfolioPoint(
  sorted: readonly StockChartPoint[],
  p: PortfolioValueHistoryPoint,
): number | null {
  const ts = p.time != null && Number.isFinite(p.time) ? p.time : null;
  if (ts != null) {
    const px = lastBenchmarkValueOnOrBeforeTime(sorted, ts);
    if (px != null) return px;
  }
  return spyPriceForFlow(sorted, p.t);
}

/** Last SPY/EOD close on or before calendar `ymd` (UTC yyyy-MM-dd). */
function spyCloseOnOrBefore(sorted: readonly StockChartPoint[], ymd: string): number | null {
  let lo = 0;
  let hi = sorted.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = barYmdFromStockPoint(sorted[mid]!);
    if (d == null) {
      hi = mid - 1;
      continue;
    }
    if (d <= ymd) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? sorted[ans]!.value : null;
}

/**
 * Price for contribution replay: prefer on/before `ymd`, else first available bar
 * (deposits before the fetched window still buy shares at the first mark).
 */
function spyPriceForFlow(sorted: readonly StockChartPoint[], ymd: string): number | null {
  const direct = spyCloseOnOrBefore(sorted, ymd);
  if (direct != null && Number.isFinite(direct) && direct > 0) return direct;
  if (sorted.length === 0) return null;
  const first = sorted[0]!;
  const firstYmd = barYmdFromStockPoint(first);
  if (firstYmd != null && ymd < firstYmd && Number.isFinite(first.value) && first.value > 0) {
    return first.value;
  }
  return null;
}

function portfolioPointTime(p: PortfolioValueHistoryPoint): Time {
  if (p.time != null && Number.isFinite(p.time)) return p.time as Time;
  const ms = Date.parse(`${p.t}T12:00:00.000Z`);
  return (Number.isFinite(ms) ? Math.floor(ms / 1000) : 0) as Time;
}

/**
 * Dollar path if external cash flows had tracked the benchmark (contribution model).
 * Same overlay math on every range — 6M / YTD / 1Y are the visual reference.
 * Falls back to single-notional SPY scale when the ledger has no Cash In/Out rows.
 */
function buildBenchmarkCompareLineData(
  filtered: readonly PortfolioValueHistoryPoint[],
  rawSpy: readonly StockChartPoint[] | null | undefined,
  equityCostBasisInvestedUsd: number | null | undefined,
  mode: "value" | "profit" = "value",
  transactions?: readonly PortfolioTransaction[],
): { time: Time; value: number }[] {
  if (!rawSpy?.length || filtered.length === 0) return [];
  const spy = spySortedByTime(rawSpy);
  const priceOnOrBeforeYmd = (ymd: string) => spyPriceForFlow(spy, ymd);

  if (transactions && transactions.length > 0) {
    const flows = extractAllExternalCashFlows(transactions);
    if (flows.length > 0) {
      const out: { time: Time; value: number }[] = [];
      for (const p of filtered) {
        const px = spyValueAtPortfolioPoint(spy, p);
        if (px == null || !Number.isFinite(px) || px <= 0) continue;
        const shares = replayBenchmarkSharesAsOf(flows, p.t, priceOnOrBeforeYmd);
        const nav = shares * px;
        if (!Number.isFinite(nav)) continue;
        const netDeposits =
          mode === "profit" ?
            flows.filter((f) => f.date <= p.t).reduce((s, f) => s + f.amount, 0)
          : 0;
        out.push({
          time: portfolioPointTime(p),
          value: mode === "profit" ? nav - netDeposits : nav,
        });
      }
      return out;
    }
  }

  // Legacy fallback: scale a single notional by SPY price ratio (no cash-flow ledger).
  const firstPx = spyValueAtPortfolioPoint(spy, filtered[0]!);
  if (firstPx == null || firstPx <= 0) return [];
  const investedOk =
    equityCostBasisInvestedUsd != null &&
    Number.isFinite(equityCostBasisInvestedUsd) &&
    equityCostBasisInvestedUsd > 1e-9;
  const anchor = filtered.find((p) => Number.isFinite(p.value) && p.value > 1e-9) ?? filtered[0]!;
  const notional0 = investedOk ? equityCostBasisInvestedUsd! : anchor.value;
  if (!(notional0 > 0)) return [];
  const out: { time: Time; value: number }[] = [];
  for (const p of filtered) {
    const s = spyValueAtPortfolioPoint(spy, p);
    if (s == null || !Number.isFinite(s) || s <= 0) continue;
    const scaled = s * (notional0 / firstPx);
    out.push({
      time: portfolioPointTime(p),
      value: mode === "profit" ? scaled - notional0 : scaled,
    });
  }
  return out;
}

/**
 * S&P total return % from the first portfolio sample date (Return metric overlay).
 * Same selected window as the portfolio line — does not change portfolio data.
 */
function buildBenchmarkReturnLineData(
  filtered: readonly PortfolioValueHistoryPoint[],
  rawSpy: readonly StockChartPoint[] | null | undefined,
): { time: Time; value: number }[] {
  if (!rawSpy?.length || filtered.length === 0) return [];
  const spy = spySortedByTime(rawSpy);
  const firstPx = spyValueAtPortfolioPoint(spy, filtered[0]!);
  if (firstPx == null || firstPx <= 0) return [];
  const out: { time: Time; value: number }[] = [];
  for (const p of filtered) {
    const px = spyValueAtPortfolioPoint(spy, p);
    if (px == null || px <= 0) continue;
    out.push({
      time: portfolioPointTime(p),
      value: (px / firstPx - 1) * 100,
    });
  }
  return out;
}

/**
 * Index drawdown % from the running peak of the benchmark price (same timestamps
 * as the portfolio line). Price-based, like Return — not contribution-replayed NAV.
 */
function buildBenchmarkDrawdownLineData(
  filtered: readonly PortfolioValueHistoryPoint[],
  rawSpy: readonly StockChartPoint[] | null | undefined,
): { time: Time; value: number }[] {
  if (!rawSpy?.length || filtered.length === 0) return [];
  const spy = spySortedByTime(rawSpy);
  const line: { time: Time; value: number }[] = [];
  for (const p of filtered) {
    const px = spyValueAtPortfolioPoint(spy, p);
    if (px == null || !Number.isFinite(px) || px <= 0) continue;
    line.push({ time: portfolioPointTime(p), value: px });
  }
  return buildDrawdownFromValueLine(line);
}

function chartYmdForTrade(tradeYmd: string, sortedChartYmd: readonly string[]): string | null {
  if (sortedChartYmd.length === 0) return null;
  const first = sortedChartYmd[0]!;
  const last = sortedChartYmd[sortedChartYmd.length - 1]!;
  if (tradeYmd < first || tradeYmd > last) return null;
  if (sortedChartYmd.includes(tradeYmd)) return tradeYmd;
  const tradeMonth = tradeYmd.slice(0, 7);
  const inMonth = sortedChartYmd.filter((d) => d.slice(0, 7) === tradeMonth);
  if (inMonth.length > 0) {
    const onOrBefore = inMonth.filter((d) => d <= tradeYmd);
    if (onOrBefore.length > 0) return onOrBefore[onOrBefore.length - 1]!;
    return inMonth[0]!;
  }
  return sortedChartYmd.find((d) => d >= tradeYmd) ?? null;
}

function isPortfolioTradeDotRow(t: PortfolioTransaction): boolean {
  if (t.kind !== "trade") return false;
  const op = t.operation.toLowerCase();
  return op === "buy" || op === "sell";
}

function ymdDayBefore(ymd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  try {
    return format(subDays(parseISO(ymd), 1), "yyyy-MM-dd");
  } catch {
    return null;
  }
}

function syncPortfolioTradeDotsOverlay(
  chart: IChartApi,
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline">,
  overlay: HTMLDivElement,
  show: boolean,
  txs: readonly PortfolioTransaction[],
  lineData: readonly { time: Time; value: number }[],
  sessionYmds: readonly string[],
  hoverApiRef: MutableRefObject<TradeDotHoverApi | null>,
): void {
  overlay.replaceChildren();
  if (!show || lineData.length === 0 || sessionYmds.length !== lineData.length) return;
  const sortedYmd = [...new Set(sessionYmds)].sort((a, b) => a.localeCompare(b));
  const byChartYmd = new Map<string, PortfolioTransaction[]>();
  for (const t of txs) {
    if (!isPortfolioTradeDotRow(t)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    const timeStr = chartYmdForTrade(t.date, sortedYmd);
    if (timeStr == null) continue;
    const list = byChartYmd.get(timeStr) ?? [];
    list.push(t);
    byChartYmd.set(timeStr, list);
  }

  for (const [timeStr, bucket] of byChartYmd) {
    const idx = sessionYmds.indexOf(timeStr);
    const pt = idx >= 0 ? lineData[idx] : undefined;
    if (!pt) continue;
    const x = chart.timeScale().timeToCoordinate(pt.time);
    const y = series.priceToCoordinate(pt.value);
    if (x == null || y == null) continue;
    const netCash = bucket.reduce((s, t) => s + t.sum, 0);
    const border = netCash <= 0 ? resolveFsColor("--fs-up") : resolveFsColor("--fs-down");

    const hit = document.createElement("div");
    hit.style.cssText = [
      "position:absolute",
      "box-sizing:border-box",
      `width:${TRADE_HIT_PX}px`,
      `height:${TRADE_HIT_PX}px`,
      `left:${x - TRADE_HIT_HALF}px`,
      `top:${y - TRADE_HIT_HALF}px`,
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "pointer-events:auto",
      "cursor:default",
    ].join(";");

    const dot = document.createElement("div");
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = [
      "box-sizing:border-box",
      `width:${TRADE_DOT_PX}px`,
      `height:${TRADE_DOT_PX}px`,
      "flex-shrink:0",
      "border-radius:9999px",
      "background:#FFFFFF",
      `border:2px solid ${border}`,
      "pointer-events:none",
    ].join(";");

    hit.appendChild(dot);

    const onEnter = (e: MouseEvent) => {
      hoverApiRef.current?.onEnter({
        clientX: e.clientX,
        clientY: e.clientY,
        bucket,
        chartYmd: timeStr,
      });
    };
    const onLeave = () => {
      hoverApiRef.current?.onLeave();
    };
    hit.addEventListener("mouseenter", onEnter);
    hit.addEventListener("mouseleave", onLeave);

    overlay.appendChild(hit);
  }
}

/** Accent dot + dashed vertical line at the portfolio goal achievement year. */
function goalYearChartTime(year: number): UTCTimestamp {
  return Math.floor(Date.parse(`${year}-12-31T12:00:00.000Z`) / 1000) as UTCTimestamp;
}

function utcYearFromChartTime(time: Time): number | null {
  if (typeof time === "number" && Number.isFinite(time)) {
    return new Date(time * 1000).getUTCFullYear();
  }
  if (time && typeof time === "object" && "year" in time && typeof time.year === "number") {
    return time.year;
  }
  return null;
}

function pointForGoalYear(
  lineData: readonly { time: Time; value: number }[],
  year: number,
): { time: Time; value: number } | undefined {
  const exact = goalYearChartTime(year);
  const exactHit = lineData.find((d) => d.time === exact);
  if (exactHit) return exactHit;
  return lineData.find((d) => utcYearFromChartTime(d.time) === year);
}

/** First year-end sample where the line is at or above the goal (matches the results table). */
function firstGoalLinePointAtOrAboveTarget(
  data: readonly { time: Time; value: number }[],
  targetUsd: number,
): { logical: number; value: number } | null {
  if (!(targetUsd > 0) || data.length === 0) return null;
  for (let i = 0; i < data.length; i++) {
    const pt = data[i]!;
    if (!Number.isFinite(pt.value) || pt.value < targetUsd) continue;
    // Current-year start is already at/above target — nothing to highlight ahead.
    if (i === 0) return null;
    return { logical: i, value: pt.value };
  }
  return null;
}

function goalAchievementPlacement(
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | ISeriesApi<"Line"> | null,
  lineData: readonly { time: Time; value: number }[],
  year: number | null,
  targetUsd: number | null,
): { logical: number; value: number } | null {
  const seriesData = series ? (series.data() as { time: Time; value: number }[]) : [];
  const data = seriesData.length > 0 ? seriesData : lineData;
  if (data.length === 0) return null;
  if (targetUsd != null && targetUsd > 0) {
    const hit = firstGoalLinePointAtOrAboveTarget(data, targetUsd);
    if (hit) return hit;
  }
  if (year == null) return null;
  const idx = data.findIndex((d) => utcYearFromChartTime(d.time) === year);
  if (idx < 0) {
    const pt = pointForGoalYear(data, year);
    if (!pt) return null;
    const fallbackIdx = data.findIndex((d) => d.time === pt.time);
    return { logical: Math.max(0, fallbackIdx), value: pt.value };
  }
  return { logical: idx, value: data[idx]!.value };
}

type GoalAchievementMarkerSpec = {
  key: string;
  year: number | null;
  show: boolean;
  lineData: readonly { time: Time; value: number }[];
  strokeColor: string;
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | ISeriesApi<"Line"> | null;
};

type GoalAchievementDot = {
  key: string;
  color: string;
  xPx: number;
  yPx: number;
};

function computeGoalAchievementDots(
  chart: IChartApi,
  plotW: number,
  plotH: number,
  markers: readonly GoalAchievementMarkerSpec[],
  targetUsd: number | null,
): GoalAchievementDot[] {
  if (plotW < 12 || plotH < 12) return [];
  const out: GoalAchievementDot[] = [];
  for (const marker of markers) {
    const { year, show, lineData, strokeColor, series, key } = marker;
    if (!show || series == null) continue;
    const placement = goalAchievementPlacement(series, lineData, year, targetUsd);
    if (!placement) continue;
    const x = chart.timeScale().logicalToCoordinate(placement.logical);
    const y = series.priceToCoordinate(placement.value);
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < -8 || x > plotW + 8 || y < -8 || y > plotH + 8) continue;
    out.push({
      key,
      color: strokeColor,
      xPx: Math.round(Math.min(Math.max(x, 0), plotW) * 10) / 10,
      yPx: Math.round(Math.min(Math.max(y, 0), plotH) * 10) / 10,
    });
  }
  return out;
}

function goalAchievementDotsEqual(a: GoalAchievementDot[], b: GoalAchievementDot[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.key !== y.key || x.color !== y.color || x.xPx !== y.xPx || x.yPx !== y.yPx) return false;
  }
  return true;
}

const GOAL_LINE_END_DOT_PX = 8;
const GOAL_LINE_END_DOT_HALF = GOAL_LINE_END_DOT_PX / 2;
/** Hover-style ring on the year the line first reaches the goal (LW radius 5 + 2px stroke). */
const GOAL_ACHIEVEMENT_DOT_PX = 12;
const GOAL_ACHIEVEMENT_DOT_HALF = GOAL_ACHIEVEMENT_DOT_PX / 2;
/** Last-point disc at the left of the native price scale (Insights last-value gutter). */
const GOAL_LINE_END_GUTTER_PX = 0;

type GoalLineEndBadgeSpec = {
  key: string;
  show: boolean;
  lineData: readonly { time: Time; value: number }[];
  color: string;
};

type GoalYAxisEndBadge = {
  key: string;
  label: string;
  color: string;
  endXPx: number | null;
  endYPx: number | null;
};

function goalYAxisEndBadgesEqual(a: GoalYAxisEndBadge[], b: GoalYAxisEndBadge[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.key !== y.key ||
      x.label !== y.label ||
      x.color !== y.color ||
      x.endXPx !== y.endXPx ||
      x.endYPx !== y.endYPx
    ) {
      return false;
    }
  }
  return true;
}

type GoalLineEndSeries = ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | ISeriesApi<"Line">;

function lastGoalLinePoint(
  series: GoalLineEndSeries | null,
  lineData: readonly { time: Time; value: number }[],
): { time: Time; value: number } | null {
  const seriesData = series ? (series.data() as { time: Time; value: number }[]) : [];
  const data = seriesData.length > 0 ? seriesData : lineData;
  const last = data.at(-1);
  if (!last || !Number.isFinite(last.value)) return null;
  return last;
}

/** Last sparkline point is on the right; never clamp a bogus 0-coord onto 2026. */
function resolveGoalLineEndXPx(
  chart: IChartApi,
  series: GoalLineEndSeries,
  plotW: number,
): number {
  const fallback = Math.max(GOAL_LINE_END_DOT_HALF, plotW - GOAL_LINE_END_GUTTER_PX);
  if (plotW < 12) return fallback;
  const lastIdx = series.data().length - 1;
  if (lastIdx < 0) return fallback;
  const logicalX = chart.timeScale().logicalToCoordinate(lastIdx);
  if (logicalX == null || !Number.isFinite(logicalX) || logicalX < plotW * 0.45) {
    return fallback;
  }
  return Math.min(logicalX, plotW - GOAL_LINE_END_DOT_HALF);
}

function attachGoalEndPointCoordinates(
  chart: IChartApi,
  badges: readonly GoalYAxisEndBadge[],
  specs: readonly GoalLineEndBadgeSpec[],
  seriesForKey: (key: string) => GoalLineEndSeries | null,
  plotWidthPx: number,
): GoalYAxisEndBadge[] {
  const tsW = chart.timeScale().width();
  const plotW = tsW > 12 ? tsW : plotWidthPx;
  return badges.map((badge) => {
    const spec = specs.find((s) => s.key === badge.key);
    if (!spec) return { ...badge, endXPx: null, endYPx: null };
    const series = seriesForKey(badge.key);
    const last = lastGoalLinePoint(series, spec.lineData);
    if (!last || series == null) return { ...badge, endXPx: null, endYPx: null };
    const y = series.priceToCoordinate(last.value);
    if (y == null || !Number.isFinite(y)) {
      return { ...badge, endXPx: null, endYPx: null };
    }
    return {
      ...badge,
      endXPx: Math.round(resolveGoalLineEndXPx(chart, series, plotW) * 10) / 10,
      endYPx: Math.round(y * 10) / 10,
    };
  });
}

/** Goal end values sit on the sparkline (Overview last-price marker + last-value badge). */
function computeGoalYAxisEndBadges(badges: readonly GoalLineEndBadgeSpec[]): GoalYAxisEndBadge[] {
  const raw: GoalYAxisEndBadge[] = [];
  for (const badge of badges) {
    if (!badge.show || badge.lineData.length === 0) continue;
    const value = badge.lineData[badge.lineData.length - 1]!.value;
    if (!Number.isFinite(value)) continue;
    raw.push({
      key: badge.key,
      label: formatAxisUsd(value),
      color: badge.color,
      endXPx: null,
      endYPx: null,
    });
  }
  return raw;
}

function resolveGoalPaneEndBadges(
  plotLayout: "default" | "goal",
  goalExtents: { min: number; max: number } | null,
  badgeSpecs: readonly GoalLineEndBadgeSpec[],
): GoalYAxisEndBadge[] {
  if (plotLayout !== "goal" || !goalExtents) return [];
  return computeGoalYAxisEndBadges(badgeSpecs);
}

function PillSwitch({
  pressed,
  onPressedChange,
  disabled = false,
  "aria-label": ariaLabel,
  title,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label": string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onPressedChange(!pressed);
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
        pressed ? "bg-accent" : "bg-stroke",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-switch-thumb-off shadow-sm transition-[transform,background-color]",
          pressed ? "translate-x-4 bg-switch-thumb" : "translate-x-0",
        )}
      />
    </button>
  );
}

const PORTFOLIO_CHART_SETTINGS_ROWS = [
  { key: "showTrades", label: "Show trades", ariaLabel: "Show trades on chart" },
  { key: "compareSpy", label: "Compare to S&P 500", ariaLabel: "Compare portfolio to S&P 500" },
  { key: "compareNasdaq", label: "Compare to Nasdaq", ariaLabel: "Compare portfolio to Nasdaq" },
] as const;

type PortfolioChartSettingsRowKey = (typeof PORTFOLIO_CHART_SETTINGS_ROWS)[number]["key"];

function PortfolioChartSettingsButton({
  showTrades,
  onShowTradesChange,
  compareSpy,
  onCompareSpyChange,
  compareNasdaq,
  onCompareNasdaqChange,
  benchmarkCompareDisabled,
  nasdaqCompareDisabled,
}: {
  showTrades: boolean;
  onShowTradesChange: (next: boolean) => void;
  compareSpy: boolean;
  onCompareSpyChange: (next: boolean) => void;
  compareNasdaq: boolean;
  onCompareNasdaqChange: (next: boolean) => void;
  /** S&P compare — Value ($ contribution) or Return (%). */
  benchmarkCompareDisabled: boolean;
  /** Nasdaq compare — Value / Return / Profit (same as S&P). */
  nasdaqCompareDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const values: Record<PortfolioChartSettingsRowKey, boolean> = {
    showTrades,
    compareSpy,
    compareNasdaq,
  };

  const onChangeForKey = (key: PortfolioChartSettingsRowKey, next: boolean) => {
    if (key === "showTrades") onShowTradesChange(next);
    else if (key === "compareSpy") onCompareSpyChange(next);
    else onCompareNasdaqChange(next);
  };

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative z-20 shrink-0">
      <button
        type="button"
        aria-label="Chart settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          topbarSquircleIconClass,
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2",
          open && topbarSquircleActiveClass,
        )}
      >
        <Settings className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <TopbarDropdownPortal
          open={open}
          anchorRef={containerRef}
          ref={menuPortalRef}
          align="trailing"
          onRequestClose={() => setOpen(false)}
          className="w-[min(280px,calc(100vw-2rem))]"
        >
          <div className={dropdownMenuPanelClassName("max-md:w-full")} role="menu" aria-label="Chart settings">
            {PORTFOLIO_CHART_SETTINGS_ROWS.map(({ key, label, ariaLabel }) => {
              const rowDisabled =
                key === "compareSpy" ? benchmarkCompareDisabled
                : key === "compareNasdaq" ? nasdaqCompareDisabled
                : false;
              const hint =
                key === "compareSpy" && benchmarkCompareDisabled ? BENCHMARK_COMPARE_DISABLED_HINT
                : key === "compareNasdaq" && nasdaqCompareDisabled ?
                  BENCHMARK_COMPARE_DISABLED_HINT
                : undefined;
              return (
                <div key={key} role="menuitem" className={dropdownMenuPlainItemRowClassName()}>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-fg">{label}</span>
                  <PillSwitch
                    pressed={values[key]}
                    onPressedChange={(next) => onChangeForKey(key, next)}
                    disabled={rowDisabled}
                    title={hint}
                    aria-label={ariaLabel}
                  />
                </div>
              );
            })}
          </div>
        </TopbarDropdownPortal>
      ) : null}
    </div>
  );
}

export type PortfolioChartMetricMode = "value" | "profit" | "return" | "drawdown";

type MetricMode = PortfolioChartMetricMode;

/** Metrics plotted in % (Return, Drawdowns) share the percent axis/tooltip format. */
function isPercentMetric(m: MetricMode): boolean {
  return m === "return" || m === "drawdown";
}

/** Insights Value / Return / Profit / Drawdowns can overlay S&P 500 and Nasdaq. */
function metricSupportsBenchmarkCompare(metric: MetricMode): boolean {
  return (
    metric === "value" || metric === "return" || metric === "profit" || metric === "drawdown"
  );
}

/** Crosshair disc border — match baseline sparkline (green ≥ 0 / red < 0); Value stays accent. */
function overviewCrosshairMarkerBorderColor(metric: MetricMode, value: number): string {
  if (metric === "value") return resolveFsColor("--fs-accent");
  if (metric === "drawdown") return resolveFsColor("--fs-down");
  return value >= 0 ? resolveFsColor("--fs-up") : resolveFsColor("--fs-down");
}

/** Equity return % (same units as overview “Total profit” ATH line). */
function formatReturnPctAxis(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

export const PORTFOLIO_CHART_RANGE_LABELS: readonly SegmentedControlOption<PortfolioChartRange>[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "all", label: "ALL" },
];

/** Mobile range row omits YTD — same as asset `ChartControls`. */
const PORTFOLIO_CHART_MOBILE_RANGE_LABELS = PORTFOLIO_CHART_RANGE_LABELS.filter(
  (option) => option.value !== "ytd",
);

/** One-decimal truncation (e.g. 7616 → 7.6) so axis + last-price badge stay distinct. */
function truncOneDecimalUnit(abs: number, unit: number): string {
  const u = abs / unit;
  const t = Math.trunc(u * 10) / 10;
  if (Number.isInteger(t)) return String(t);
  return t.toFixed(1);
}

function overviewSeriesValueExtents(series: OverviewMainSeries): { min: number; max: number } | null {
  const data = series.data();
  if (data.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const pt of data) {
    const v = (pt as { value?: number }).value;
    if (typeof v === "number" && Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

function overviewYAxisPriceRange(min: number, max: number): { bottom: number; top: number } {
  if (min === max) {
    const pad = Math.max(1, Math.abs(max) * 0.1);
    return { bottom: min - pad, top: max + pad };
  }
  const dataSpan = max - min;
  const scaleSpan = dataSpan / (1 - OVERVIEW_SCALE_MARGIN_TOP - OVERVIEW_SCALE_MARGIN_BOTTOM);
  return {
    bottom: min - scaleSpan * OVERVIEW_SCALE_MARGIN_BOTTOM,
    top: max + scaleSpan * OVERVIEW_SCALE_MARGIN_TOP,
  };
}

/** Goal projections are always ≥ $0 — never show negative axis padding. */
function goalValueYAxisPriceRange(min: number, max: number): { bottom: number; top: number } {
  const clampedMin = Math.max(0, min);
  const { bottom, top } = overviewYAxisPriceRange(clampedMin, max);
  return { bottom: Math.max(0, bottom), top };
}

function overviewYAxisTopPercent(price: number, bottom: number, top: number): number {
  const span = top - bottom;
  if (span <= 0) return 50;
  return ((top - price) / span) * 100;
}

function computeOverviewYAxisLabelsFromExtents(
  min: number,
  max: number,
  metric: MetricMode,
  tickCount: number,
): OverviewYAxisLabel[] {
  if (metric !== "value") {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  const { bottom, top } = overviewYAxisPriceRange(min, max);
  return computeOverviewYAxisLabelsFromPriceRange(bottom, top, metric, tickCount);
}

function computeOverviewYAxisLabelsFromPriceRange(
  bottom: number,
  top: number,
  metric: MetricMode,
  tickCount: number,
): OverviewYAxisLabel[] {
  const span = top - bottom;
  if (span <= 0 || tickCount < 2) return [];

  const labels: OverviewYAxisLabel[] = [];
  for (let i = 0; i < tickCount; i++) {
    const price = bottom + (span * i) / (tickCount - 1);
    labels.push({
      key: String(i),
      label: isPercentMetric(metric) ? formatReturnPctAxis(price) : formatAxisUsd(price),
      topPct: overviewYAxisTopPercent(price, bottom, top),
    });
  }
  return labels;
}

function metricHistoryPointValue(p: PortfolioValueHistoryPoint, metric: MetricMode): number | null {
  if (metric === "value") return Number.isFinite(p.value) ? p.value : null;
  if (metric === "profit") return Number.isFinite(p.profit) ? p.profit : null;
  if (metric === "return") {
    return typeof p.returnPct === "number" && Number.isFinite(p.returnPct) ? p.returnPct : null;
  }
  return Number.isFinite(p.value) ? p.value : null;
}

function goalProjectionValueExtents(
  portfolioLineData: readonly { value: number }[],
  overlaySeries: readonly {
    visible: boolean;
    points: readonly PortfolioValueHistoryPoint[];
  }[],
  metric: MetricMode,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  const consider = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return;
    if (value < min) min = value;
    if (value > max) max = value;
  };

  for (const pt of portfolioLineData) consider(pt.value);
  for (const overlay of overlaySeries) {
    if (!overlay.visible) continue;
    for (const p of overlay.points) consider(metricHistoryPointValue(p, metric));
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

function goalSharedAutoscaleOptions(min: number, max: number) {
  const { bottom, top } = goalValueYAxisPriceRange(min, max);
  return {
    autoscaleInfoProvider: () => ({
      priceRange: { minValue: bottom, maxValue: top },
    }),
  } as const;
}

function applyGoalSharedAutoscale(
  mainSeries: OverviewMainSeries,
  overlaySeriesById: ReadonlyMap<string, ISeriesApi<"Line">>,
  overlaySeries: readonly {
    id: string;
    visible: boolean;
    points: readonly PortfolioValueHistoryPoint[];
  }[],
  portfolioLineData: readonly { value: number }[],
  metric: MetricMode,
): { min: number; max: number } | null {
  const extents = goalProjectionValueExtents(portfolioLineData, overlaySeries, metric);
  if (!extents) return null;
  const scaleOpts = goalSharedAutoscaleOptions(extents.min, extents.max);
  mainSeries.applyOptions(scaleOpts);
  for (const overlay of overlaySeries) {
    if (!overlay.visible) continue;
    overlaySeriesById.get(overlay.id)?.applyOptions(scaleOpts);
  }
  return extents;
}

function unionSeriesValueExtents(
  parts: readonly ({ min: number; max: number } | null | undefined)[],
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const p of parts) {
    if (!p) continue;
    if (p.min < min) min = p.min;
    if (p.max > max) max = p.max;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

function applyCompareSharedAutoscale(
  mainSeries: OverviewMainSeries,
  compareSeries: readonly (ISeriesApi<"Line"> | null)[],
  extents: { min: number; max: number },
  metric: MetricMode,
): void {
  let min = extents.min;
  let max = extents.max;
  if (metric !== "value") {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  const { bottom, top } = overviewYAxisPriceRange(min, max);
  const scaleOpts = {
    autoscaleInfoProvider: () => ({
      priceRange: { minValue: bottom, maxValue: top },
    }),
  } as const;
  mainSeries.applyOptions(scaleOpts);
  for (const s of compareSeries) s?.applyOptions(scaleOpts);
}

/** LW `merge` skips `undefined`, so `autoscaleInfoProvider: undefined` never clears a prior override. */
function restoreSeriesDefaultAutoscale(
  series: OverviewMainSeries | ISeriesApi<"Line"> | null,
): void {
  series?.applyOptions({
    autoscaleInfoProvider: (original) => original(),
  });
}

/** HTML right-axis labels — avoids LW price-line axis labels stacking at $0. */
function computeOverviewYAxisLabels(
  series: OverviewMainSeries,
  metric: MetricMode,
  tickCount: number,
): OverviewYAxisLabel[] {
  const extents = overviewSeriesValueExtents(series);
  if (!extents) return [];
  return computeOverviewYAxisLabelsFromExtents(extents.min, extents.max, metric, tickCount);
}

/** Hide axis ticks that would sit under the LW last-value badge on the right edge. */
const OVERVIEW_Y_AXIS_BADGE_CLEARANCE_PCT = 5.5;
const OVERVIEW_Y_AXIS_LABEL_MIN_GAP_PCT = 3.5;

function overviewYAxisPriceAtTopPct(topPct: number, bottom: number, top: number): number {
  return top - (topPct / 100) * (top - bottom);
}

function overviewYAxisLabelTooClose(
  candidateTopPct: number,
  labels: readonly OverviewYAxisLabel[],
): boolean {
  return labels.some((lab) => Math.abs(lab.topPct - candidateTopPct) < OVERVIEW_Y_AXIS_LABEL_MIN_GAP_PCT);
}

function resolveOverviewYAxisBadgeContext(
  series: OverviewMainSeries,
  metric: MetricMode,
): { bottom: number; top: number; lastTopPct: number } | null {
  const data = series.data();
  if (data.length === 0) return null;

  const lastValue = (data[data.length - 1] as { value?: number }).value;
  if (typeof lastValue !== "number" || !Number.isFinite(lastValue)) return null;

  const extents = overviewSeriesValueExtents(series);
  if (!extents) return null;

  let { min, max } = extents;
  if (metric !== "value") {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  const { bottom, top } = overviewYAxisPriceRange(min, max);
  return { bottom, top, lastTopPct: overviewYAxisTopPercent(lastValue, bottom, top) };
}

function filterYAxisLabelsForLastValueBadge(
  labels: OverviewYAxisLabel[],
  lastTopPct: number,
): OverviewYAxisLabel[] {
  return labels.filter(
    (lab) => Math.abs(lab.topPct - lastTopPct) >= OVERVIEW_Y_AXIS_BADGE_CLEARANCE_PCT,
  );
}

/** When the badge hides a grid tick, add one just below the badge so the axis stays evenly spaced. */
function supplementOverviewYAxisLabelForBadgeGap(
  labels: OverviewYAxisLabel[],
  removedCount: number,
  lastTopPct: number,
  bottom: number,
  top: number,
  metric: MetricMode,
): OverviewYAxisLabel[] {
  if (removedCount === 0) return labels;

  const sorted = [...labels].sort((a, b) => a.topPct - b.topPct);
  if (sorted.length < 2) return labels;

  const gaps = sorted.slice(0, -1).map((lab, i) => sorted[i + 1]!.topPct - lab.topPct);
  const maxGap = Math.max(...gaps);
  const medianGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (maxGap <= medianGap * 1.25) return labels;

  const candidateTopPct = lastTopPct + OVERVIEW_Y_AXIS_BADGE_CLEARANCE_PCT + 1.5;
  if (
    candidateTopPct <= sorted[0]!.topPct ||
    candidateTopPct >= sorted[sorted.length - 1]!.topPct ||
    overviewYAxisLabelTooClose(candidateTopPct, labels)
  ) {
    return labels;
  }

  const price = overviewYAxisPriceAtTopPct(candidateTopPct, bottom, top);
  return [
    ...labels,
    {
      key: "badge-gap",
      label: isPercentMetric(metric) ? formatReturnPctAxis(price) : formatAxisUsd(price),
      topPct: candidateTopPct,
    },
  ];
}

function syncOverviewYAxisLabels(
  series: OverviewMainSeries,
  metric: MetricMode,
  tickCount: number,
): OverviewYAxisLabel[] {
  const labels = computeOverviewYAxisLabels(series, metric, tickCount);
  const badgeContext = resolveOverviewYAxisBadgeContext(series, metric);
  if (!badgeContext) return labels;

  const filtered = filterYAxisLabelsForLastValueBadge(labels, badgeContext.lastTopPct);
  return supplementOverviewYAxisLabelForBadgeGap(
    filtered,
    labels.length - filtered.length,
    badgeContext.lastTopPct,
    badgeContext.bottom,
    badgeContext.top,
    metric,
  );
}

function syncOverviewYAxisLabelsFromMinMax(
  series: OverviewMainSeries,
  min: number,
  max: number,
  metric: MetricMode,
  tickCount: number,
): OverviewYAxisLabel[] {
  const labels = computeOverviewYAxisLabelsFromExtents(min, max, metric, tickCount);
  const data = series.data();
  if (data.length === 0) return labels;
  const lastValue = (data[data.length - 1] as { value?: number }).value;
  if (typeof lastValue !== "number" || !Number.isFinite(lastValue)) return labels;

  let lo = min;
  let hi = max;
  if (metric !== "value") {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  const { bottom, top } = overviewYAxisPriceRange(lo, hi);
  const lastTopPct = overviewYAxisTopPercent(lastValue, bottom, top);
  const filtered = filterYAxisLabelsForLastValueBadge(labels, lastTopPct);
  return supplementOverviewYAxisLabelForBadgeGap(
    filtered,
    labels.length - filtered.length,
    lastTopPct,
    bottom,
    top,
    metric,
  );
}

const OVERVIEW_CHART_PLOT_BACKDROP_INSET_CLASS = "top-[12%] bottom-[8%]";

function formatAxisUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  const v = Math.abs(n) < 0.005 ? 0 : n;
  if (Math.abs(v) < 1e-9) return "$0";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const body = truncOneDecimalUnit(abs, 1_000_000);
    return `${sign}$${body}M`;
  }
  if (abs >= 1000) {
    const body = truncOneDecimalUnit(abs, 1000);
    return `${sign}$${body}K`;
  }
  return `${sign}$${Math.trunc(abs)}`;
}

const TOOLTIP_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatTradeLedgerDateYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  try {
    return format(parseISO(ymd), "MMM d, yyyy");
  } catch {
    return ymd;
  }
}

function formatTradeHoverLines(tx: PortfolioTransaction): string[] {
  const lines: string[] = [];
  const op = tx.operation.trim();
  const sym = tx.symbol.trim().toUpperCase();
  lines.push(`${sym} · ${op}`);
  const qty = tx.shares;
  if (Number.isFinite(qty) && Math.abs(qty) > 1e-12) {
    const qtyStr =
      Math.abs(qty - Math.round(qty)) < 1e-9 ?
        String(Math.round(qty))
      : qty.toLocaleString("en-US", { maximumFractionDigits: 8 });
    lines.push(`${qtyStr} shares @ ${TOOLTIP_USD.format(tx.price)}`);
  }
  lines.push(`Cash: ${tx.sum >= 0 ? "+" : ""}${TOOLTIP_USD.format(tx.sum)}`);
  if (Number.isFinite(tx.fee) && tx.fee > 0.0005) {
    lines.push(`Fee: ${TOOLTIP_USD.format(tx.fee)}`);
  }
  return lines;
}

function formatSignedUsd(n: number): string {
  const v = normalizeUsdForDisplay(n);
  return `${v >= 0 ? "+" : ""}${TOOLTIP_USD.format(v)}`;
}

function buildTradeDotTooltip(
  bucket: readonly PortfolioTransaction[],
  chartYmd: string,
  allTransactions: readonly PortfolioTransaction[],
): { dateLabel: string; lines: string[] } {
  const sorted = [...bucket].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const lines: string[] = [];
  const firstYmd = sorted[0]?.date;
  const beforeYmd = firstYmd ? ymdDayBefore(firstYmd) : null;
  if (beforeYmd) {
    const cashBefore = netCashUsdUpTo([...allTransactions], beforeYmd);
    lines.push(`Cash before: ${TOOLTIP_USD.format(normalizeUsdForDisplay(cashBefore))}`);
  }
  if (sorted.length > 1) {
    const totalCash = sorted.reduce((s, t) => s + t.sum, 0);
    lines.push(`Total cash: ${formatSignedUsd(totalCash)}`);
  }

  for (let i = 0; i < sorted.length; i++) {
    const tx = sorted[i]!;
    if (sorted.length > 1) {
      lines.push(formatTradeLedgerDateYmd(tx.date));
    }
    lines.push(...formatTradeHoverLines(tx));
  }

  const dateLabel =
    sorted.length === 1 && sorted[0] ?
      formatTradeLedgerDateYmd(sorted[0].date)
    : /^\d{4}-\d{2}-\d{2}$/.test(chartYmd) ?
      format(parseISO(chartYmd), "MMMM yyyy")
    : chartYmd;

  return { dateLabel, lines };
}

type TradeDotHoverApi = {
  onEnter: (p: {
    clientX: number;
    clientY: number;
    bucket: readonly PortfolioTransaction[];
    chartYmd: string;
  }) => void;
  onLeave: () => void;
};

const TRADE_TOOLTIP_MAX_W_PX = 280;
const TRADE_TOOLTIP_MAX_H_PX = 280;
const TRADE_TOOLTIP_LEAVE_MS = 160;

function tradeTooltipNearPointer(
  clientX: number,
  clientY: number,
  lineCount: number,
): { left: number; top: number } {
  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const estH = Math.min(TRADE_TOOLTIP_MAX_H_PX, 56 + lineCount * 18);
  let left = clientX + pad;
  let top = clientY - estH - pad;
  if (left + TRADE_TOOLTIP_MAX_W_PX > vw - pad) {
    left = clientX - TRADE_TOOLTIP_MAX_W_PX - pad;
  }
  if (top < pad) top = clientY + pad;
  left = Math.max(pad, Math.min(left, vw - pad - TRADE_TOOLTIP_MAX_W_PX));
  top = Math.max(pad, Math.min(top, vh - pad - Math.min(estH, TRADE_TOOLTIP_MAX_H_PX)));
  return { left, top };
}

function portfolioCrosshairBottomLabel(
  hoverTime: Time,
  range: PortfolioChartRange,
  points: readonly StockChartPoint[] = [],
): string {
  const sec = horzTimeToUnixSeconds(hoverTime);
  if (sec == null) return "";
  const axisRange = portfolioSamplingRange(range, points);
  return formatOverviewCrosshairBottomDate(
    sec,
    PORTFOLIO_CHART_TIME_ZONE,
    portfolioRangeToStockRange(axisRange),
  );
}

/** Charting-style hover header for annual projection points (year only). */
function formatChartHoverPeriodYear(hoverTime: Time): string {
  const sec = horzTimeToUnixSeconds(hoverTime);
  if (sec == null) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(sec * 1000));
}

type PortfolioChartInteractionStyle = "overview" | "fundamentals";

/** Goal projection chart: plot column + Y-axis column (no native LW price-scale gutter). */
type PortfolioChartPlotLayout = "default" | "goal";

function resolveGoalChartYAxisWidthPx(containerWidthPx: number): number {
  if (shouldHideMobileYAxisLabels(containerWidthPx)) return 0;
  return FUNDAMENTALS_CHART_Y_AXIS_W_PX;
}

function collectGoalEndBadgeSpecs(badgeCfg: {
  showPortfolio: boolean;
  portfolioLineData: readonly { time: Time; value: number }[];
  safeVisible: boolean;
  safeLineData: readonly { time: Time; value: number }[];
  safeStrokeColor: string;
  aggressiveVisible: boolean;
  aggressiveLineData: readonly { time: Time; value: number }[];
  aggressiveStrokeColor: string;
}): GoalLineEndBadgeSpec[] {
  return [
    {
      key: "portfolio",
      show: badgeCfg.showPortfolio,
      lineData: badgeCfg.portfolioLineData,
      color: resolveFsColor("--fs-accent"),
    },
    {
      key: "safe",
      show: badgeCfg.safeVisible,
      lineData: badgeCfg.safeLineData,
      color: badgeCfg.safeStrokeColor,
    },
    {
      key: "aggressive",
      show: badgeCfg.aggressiveVisible,
      lineData: badgeCfg.aggressiveLineData,
      color: badgeCfg.aggressiveStrokeColor,
    },
  ];
}

/** Remove default time-scale padding so the first/last points sit on the pane edges. */
function snapOverviewTimeScale(
  chart: IChartApi,
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | ISeriesApi<"Line">,
  plotWidthPx?: number,
) {
  fitSeriesLogicalRangeToPlotWidth(chart, series.data().length, { plotWidthPx });
}

function snapChartTimeScaleForLayout(
  chart: IChartApi,
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | ISeriesApi<"Line">,
  plotWidthPx?: number,
): void {
  snapOverviewTimeScale(chart, series, plotWidthPx);
}

function syncPaneYAxisLabelsForLayout(
  series: OverviewMainSeries,
  metric: MetricMode,
  tickCount: number,
  plotLayout: PortfolioChartPlotLayout,
  goalExtents: { min: number; max: number } | null,
  compareExtents: { min: number; max: number } | null = null,
): OverviewYAxisLabel[] {
  if (plotLayout === "goal" && goalExtents) {
    const { bottom, top } = goalValueYAxisPriceRange(goalExtents.min, goalExtents.max);
    return computeOverviewYAxisLabelsFromPriceRange(bottom, top, metric, tickCount);
  }
  if (compareExtents) {
    return syncOverviewYAxisLabelsFromMinMax(
      series,
      compareExtents.min,
      compareExtents.max,
      metric,
      tickCount,
    );
  }
  return syncOverviewYAxisLabels(series, metric, tickCount);
}

type PortfolioChartTooltipState =
  | {
      variant: "overview";
      x: number;
      y: number;
      lines: readonly {
        label: string;
        valueLabel: string;
        valueTone: "pos" | "neg" | "neutral";
        swatchColor?: string;
        swatchVariant?: "solid" | "upDown";
      }[];
    }
  | {
      variant: "fundamentals";
      anchorX: number;
      y: number;
      side: "left" | "right";
      /** Center on the cursor, or sit fully above it when the plot bottom would clip. */
      vAlign: "center" | "above";
      periodLabel: string;
      rows: readonly {
        key: string;
        label: string;
        value: string;
        color: string;
        swatchVariant?: "solid" | "upDown";
      }[];
    };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function lineDataToStockChartPoints(
  data: readonly { time: Time; value: number }[],
): StockChartPoint[] {
  return data.map((pt) => ({
    time:
      typeof pt.time === "number" ? pt.time
      : horzTimeToUnixSeconds(pt.time) ?? 0,
    value: pt.value,
  }));
}

/** Prefer LW seriesData; fall back to nearest bar when magnet/compare leaves the map empty. */
function resolveOverviewSeriesValueAtCrosshair(
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | ISeriesApi<"Line"> | null,
  param: MouseEventParams,
  fallbackPoints: readonly StockChartPoint[],
): number | null {
  if (!series) return null;
  const mapped = param.seriesData.get(series);
  if (
    mapped &&
    typeof mapped === "object" &&
    "value" in mapped &&
    isFiniteNumber((mapped as { value: number }).value)
  ) {
    return (mapped as { value: number }).value;
  }
  if (param.time === undefined) return null;
  const sec = horzTimeToUnixSeconds(param.time);
  if (sec == null || fallbackPoints.length === 0) return null;
  const near = nearestPointByTime([...fallbackPoints], sec);
  return near && isFiniteNumber(near.value) ? near.value : null;
}

const PORTFOLIO_CHART_HEIGHT_DESKTOP_PX = 320;
const PORTFOLIO_CHART_HEIGHT_MOBILE_PX = 240;

type PortfolioOverviewChartLayout = {
  containerWidthPx: number;
  chartHeightPx: number;
  axisRowPx: number;
  plotHeightPx: number;
  yAxisLabelCount: number;
};

function resolvePortfolioOverviewChartLayout(containerWidthPx: number): PortfolioOverviewChartLayout {
  const widthPx = containerWidthPx > 0 ? containerWidthPx : 1024;
  const compact = widthPx < 640;
  const chartHeightPx = compact ? PORTFOLIO_CHART_HEIGHT_MOBILE_PX : PORTFOLIO_CHART_HEIGHT_DESKTOP_PX;
  /** Same axis-row heights as asset `PriceChart` (`overviewChartAxisRowPx`). */
  const axisRowPx = overviewChartAxisRowPx(widthPx);
  return {
    containerWidthPx: widthPx,
    chartHeightPx,
    axisRowPx,
    plotHeightPx: chartHeightPx - axisRowPx,
    yAxisLabelCount: compact ? PORTFOLIO_Y_AXIS_LABEL_COUNT_MOBILE : PORTFOLIO_Y_AXIS_LABEL_COUNT_DESKTOP,
  };
}

function overviewChartLayoutsEqual(
  a: PortfolioOverviewChartLayout,
  b: PortfolioOverviewChartLayout,
): boolean {
  return (
    a.containerWidthPx === b.containerWidthPx &&
    a.chartHeightPx === b.chartHeightPx &&
    a.axisRowPx === b.axisRowPx &&
    a.plotHeightPx === b.plotHeightPx &&
    a.yAxisLabelCount === b.yAxisLabelCount
  );
}

function usePortfolioOverviewChartLayout(
  containerRef: RefObject<HTMLElement | null>,
): PortfolioOverviewChartLayout {
  const [layout, setLayout] = useState<PortfolioOverviewChartLayout>(() =>
    resolvePortfolioOverviewChartLayout(1024),
  );

  useEffect(() => {
    const measure = () => {
      const widthPx =
        containerRef.current?.clientWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1024);
      // Inactive tab panels use `hidden` (display:none, width 0). Ignore that so we
      // don't flip layout to the 1024 fallback and remount charts on tab switch.
      if (widthPx < 12) return;
      const next = resolvePortfolioOverviewChartLayout(widthPx);
      setLayout((prev) => (overviewChartLayoutsEqual(prev, next) ? prev : next));
    };
    measure();
    const el = containerRef.current;
    if (!el) {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return layout;
}

function portfolioChartTime(p: PortfolioValueHistoryPoint): number {
  if (p.time != null && Number.isFinite(p.time)) return p.time;
  const ms = Date.parse(`${p.t}T12:00:00.000Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function portfolioHistoryToStockChartPoints(
  filtered: readonly PortfolioValueHistoryPoint[],
): StockChartPoint[] {
  return filtered.map((p) => ({
    time: portfolioChartTime(p),
    value: p.value,
    sessionDate: p.t,
  }));
}

/**
 * Drawdown % from the running peak within the selected period.
 * 0% at every new high; ≤ 0 elsewhere, so the line hangs from the top of the pane.
 */
function buildDrawdownFromValueLine(
  line: readonly { time: Time; value: number }[],
): { time: Time; value: number }[] {
  let peak = -Infinity;
  return line.map((pt) => {
    if (Number.isFinite(pt.value) && pt.value > peak) peak = pt.value;
    const dd = peak > 1e-9 ? (pt.value / peak - 1) * 100 : 0;
    return { time: pt.time, value: Math.min(0, dd) };
  });
}

function buildDrawdownData(
  filtered: readonly PortfolioValueHistoryPoint[],
): { time: Time; value: number }[] {
  return buildDrawdownFromValueLine(
    filtered.map((p) => ({
      time: portfolioChartTime(p) as Time,
      value: p.value,
    })),
  );
}

/** Bottom axis — same rules as stock overview / asset portfolio (`overview-bottom-axis`). */
function syncPortfolioPeriodAxisLabels(
  chart: IChartApi,
  chartPoints: readonly StockChartPoint[],
  range: PortfolioChartRange,
  plotWidthPx: number,
  minLabelGapPx = 24,
): OverviewAxisLabel[] {
  if (!chartPoints.length) return [];
  // Before the pane has a real width, coordinates are unreliable — skip rather than
  // paint a stacked right-edge pile (intermittent on first load).
  if (!(plotWidthPx > 0)) return [];
  const stockRange = portfolioRangeToStockRange(portfolioSamplingRange(range, chartPoints));
  const axisMode = resolveOverviewBottomAxisMode(stockRange, chartPoints);
  const raw = syncOverviewPeriodAxisLabels(
    chart,
    chartPoints,
    PORTFOLIO_CHART_TIME_ZONE,
    axisMode,
    plotWidthPx,
    range === "5d"
      ? { weekdayLabelMax: 5 }
      : range === "1d"
        ? { cryptoLive1D: true, cryptoLive1DMinHourStep: 3 }
        : undefined,
  );
  return thinOverlappingPeriodAxisLabels(raw, plotWidthPx, minLabelGapPx);
}

function resolveGoalPeriodAxisMinLabelGapPx(plotWidthPx: number): number {
  if (plotWidthPx < 400) return 52;
  if (plotWidthPx < 640) return 40;
  return 32;
}

/**
 * Drop labels that collapse onto the same clamped x (common while the chart is
 * still fitting on first paint — right-edge pile-ups like "JulJul").
 */
function thinOverlappingPeriodAxisLabels(
  labels: readonly OverviewAxisLabel[],
  plotWidthPx: number,
  minGapPx = 24,
): OverviewAxisLabel[] {
  if (labels.length === 0) return [];
  if (!(plotWidthPx > 0)) return [...labels];
  const clampLeft = (x: number) =>
    Math.min(Math.max(0, x), Math.max(0, plotWidthPx - 8));
  const out: OverviewAxisLabel[] = [];
  let last = -Infinity;
  for (const lab of labels) {
    const left = clampLeft(lab.leftPx);
    if (left - last < minGapPx) continue;
    out.push({ ...lab, leftPx: left });
    last = left;
  }
  return out;
}

const PERIOD_AXIS_LABEL_SYNC_MAX_ATTEMPTS = 16;

/** Retry until the time scale has real coordinates (first paint / range toggle). */
function schedulePortfolioPeriodAxisLabelsWhenReady(args: {
  chart: IChartApi;
  chartPoints: readonly StockChartPoint[];
  range: PortfolioChartRange;
  getPlotWidthPx: () => number;
  apply: (labels: OverviewAxisLabel[], plotWidthPx: number) => void;
  minLabelGapPx?: number;
  attempt?: number;
  cancelled?: () => boolean;
}): void {
  const attempt = args.attempt ?? 0;
  if (args.cancelled?.()) return;

  const plotWidthPx = Math.max(0, args.getPlotWidthPx());
  if (plotWidthPx <= 0) {
    if (attempt < PERIOD_AXIS_LABEL_SYNC_MAX_ATTEMPTS) {
      requestAnimationFrame(() =>
        schedulePortfolioPeriodAxisLabelsWhenReady({ ...args, attempt: attempt + 1 }),
      );
    }
    return;
  }

  const labels = syncPortfolioPeriodAxisLabels(
    args.chart,
    args.chartPoints,
    args.range,
    plotWidthPx,
    args.minLabelGapPx,
  );

  const spanPx =
    labels.length >= 2 ?
      Math.max(...labels.map((l) => l.leftPx)) - Math.min(...labels.map((l) => l.leftPx))
    : 0;
  const minSpanPx = Math.min(Math.max(48, plotWidthPx * 0.12), plotWidthPx * 0.45);
  const needsRetry =
    attempt < PERIOD_AXIS_LABEL_SYNC_MAX_ATTEMPTS &&
    args.chartPoints.length >= 8 &&
    (labels.length <= 1 || spanPx < minSpanPx);

  if (needsRetry) {
    requestAnimationFrame(() =>
      schedulePortfolioPeriodAxisLabelsWhenReady({ ...args, attempt: attempt + 1 }),
    );
    return;
  }

  args.apply(labels, plotWidthPx);
}

/** Figma: 10×10, white fill, 2px inside stroke (buy green / sell red). */
const TRADE_DOT_PX = 10;
const TRADE_DOT_HALF = TRADE_DOT_PX / 2;
/** Larger invisible target so tooltips are easy to trigger on the 10px dot. */
const TRADE_HIT_PX = 24;
const TRADE_HIT_HALF = TRADE_HIT_PX / 2;

/** Shared chart body for portfolio value history (Overview + Performance). */
export function PortfolioValueHistoryChartPane({
  metric,
  range,
  points,
  transactions = [],
  showTrades = false,
  showPortfolio = true,
  compareSpy = false,
  compareNasdaq = false,
  spyPricePoints = null,
  nasdaqPricePoints = null,
  benchmarkInvestedUsd = null,
  overlaySeries = EMPTY_OVERLAY_SERIES,
  portfolioMilestoneYear = null,
  safeMilestoneYear = null,
  aggressiveMilestoneYear = null,
  goalTargetUsd = null,
  mainSeriesTooltipLabel,
  chartInteractionStyle = "overview",
  plotLayout = "default",
  loading = false,
}: {
  metric: MetricMode;
  range: PortfolioChartRange;
  points: PortfolioValueHistoryPoint[];
  transactions?: readonly PortfolioTransaction[];
  showTrades?: boolean;
  /** When false, hides the main portfolio series (legend badge off). */
  showPortfolio?: boolean;
  /** When true with {@link spyPricePoints}, draws S&P 500 comparison. */
  compareSpy?: boolean;
  /** When true with {@link nasdaqPricePoints}, draws Nasdaq comparison. */
  compareNasdaq?: boolean;
  spyPricePoints?: readonly StockChartPoint[] | null;
  nasdaqPricePoints?: readonly StockChartPoint[] | null;
  /** Open equity cost basis; scales benchmark $ path like “$X invested” on the overview Value card. */
  benchmarkInvestedUsd?: number | null;
  /**
   * Extra line series (e.g. combined source portfolios).
   * Mapped like the main metric (value / profit / return / drawdown from each row).
   */
  overlaySeries?: readonly {
    id: string;
    points: readonly PortfolioValueHistoryPoint[];
    color: string;
    visible: boolean;
    /** Tooltip / legend label for this overlay line. */
    label?: string;
  }[];
  /** Year the portfolio projection line reaches the goal (accent marker). */
  portfolioMilestoneYear?: number | null;
  /** Year the safe line reaches the goal (purple marker). */
  safeMilestoneYear?: number | null;
  /** Year the aggressive line reaches the goal (orange marker). */
  aggressiveMilestoneYear?: number | null;
  /** Target $ used to place achievable dots where each sparkline crosses the goal. */
  goalTargetUsd?: number | null;
  /** Main series tooltip label (defaults to metric title, e.g. “Portfolio” on goal chart). */
  mainSeriesTooltipLabel?: string;
  /** Fundamentals / Charting hover: ISO period label in tooltip, no datetime under axis. */
  chartInteractionStyle?: PortfolioChartInteractionStyle;
  /** Goal projection: flex plot + custom Y-axis (no native LW price-scale gutter). */
  plotLayout?: PortfolioChartPlotLayout;
  /** BTC PriceChart-style overlay skeleton (shimmer area, no line-enter). */
  loading?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartLayout = usePortfolioOverviewChartLayout(containerRef);
  const chartLayoutRef = useRef(chartLayout);
  chartLayoutRef.current = chartLayout;
  const isGoalPlotLayout = plotLayout === "goal";
  const goalYAxisWidthPx =
    isGoalPlotLayout ? resolveGoalChartYAxisWidthPx(chartLayout.containerWidthPx) : FUNDAMENTALS_CHART_Y_AXIS_W_PX;
  const showGoalYAxisColumn = isGoalPlotLayout && goalYAxisWidthPx > 0;
  const chartThemePaintKey = useChartThemePaintKey();

  const wrapRef = useRef<HTMLDivElement>(null);
  const tradeOverlayRef = useRef<HTMLDivElement | null>(null);
  const [chartReadyTick, setChartReadyTick] = useState(0);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | null>(null);
  const compareSeriesRefs = useRef<{
    spy: ISeriesApi<"Line"> | null;
    nasdaq: ISeriesApi<"Line"> | null;
  }>({ spy: null, nasdaq: null });
  const overlaySeriesRefs = useRef(new Map<string, ISeriesApi<"Line">>());
  const lastPointMarkersRef = useRef<{
    main: ISeriesMarkersPluginApi<UTCTimestamp> | null;
    spy: ISeriesMarkersPluginApi<UTCTimestamp> | null;
    nasdaq: ISeriesMarkersPluginApi<UTCTimestamp> | null;
    overlays: Map<string, ISeriesMarkersPluginApi<UTCTimestamp>>;
  }>({ main: null, spy: null, nasdaq: null, overlays: new Map() });
  const syncLastPointMarkersRef = useRef<(() => void) | null>(null);
  const [yAxisLabels, setYAxisLabels] = useState<OverviewYAxisLabel[]>([]);
  const [goalEndBadges, setGoalEndBadges] = useState<GoalYAxisEndBadge[]>([]);
  const [goalAchievementDots, setGoalAchievementDots] = useState<GoalAchievementDot[]>([]);
  const goalYAxisBadgesRef = useRef<HTMLDivElement | null>(null);
  const chartRangeRef = useRef<PortfolioChartRange>(range);
  const chartPointsRef = useRef<StockChartPoint[]>([]);
  const sessionYmdsRef = useRef<string[]>([]);
  const tradeDotsConfigRef = useRef<{
    show: boolean;
    txs: readonly PortfolioTransaction[];
    lineData: readonly { time: Time; value: number }[];
    sessionYmds: readonly string[];
  }>({ show: false, txs: [], lineData: [], sessionYmds: [] });
  const goalAchievementConfigRef = useRef<{
    portfolioMilestoneYear: number | null;
    safeMilestoneYear: number | null;
    aggressiveMilestoneYear: number | null;
    goalTargetUsd: number | null;
    showPortfolio: boolean;
    portfolioLineData: readonly { time: Time; value: number }[];
    safeOverlayId: string | null;
    safeLineData: readonly { time: Time; value: number }[];
    safeVisible: boolean;
    safeStrokeColor: string;
    aggressiveOverlayId: string | null;
    aggressiveLineData: readonly { time: Time; value: number }[];
    aggressiveVisible: boolean;
    aggressiveStrokeColor: string;
  }>({
    portfolioMilestoneYear: null,
    safeMilestoneYear: null,
    aggressiveMilestoneYear: null,
    goalTargetUsd: null,
    showPortfolio: false,
    portfolioLineData: [],
    safeOverlayId: null,
    safeLineData: [],
    safeVisible: false,
    safeStrokeColor: "",
    aggressiveOverlayId: null,
    aggressiveLineData: [],
    aggressiveVisible: false,
    aggressiveStrokeColor: "",
  });
  const goalEndBadgeConfigRef = useRef<{
    showPortfolio: boolean;
    portfolioLineData: readonly { time: Time; value: number }[];
    safeOverlayId: string | null;
    safeLineData: readonly { time: Time; value: number }[];
    safeVisible: boolean;
    safeStrokeColor: string;
    aggressiveOverlayId: string | null;
    aggressiveLineData: readonly { time: Time; value: number }[];
    aggressiveVisible: boolean;
    aggressiveStrokeColor: string;
  }>({
    showPortfolio: false,
    portfolioLineData: [],
    safeOverlayId: null,
    safeLineData: [],
    safeVisible: false,
    safeStrokeColor: "",
    aggressiveOverlayId: null,
    aggressiveLineData: [],
    aggressiveVisible: false,
    aggressiveStrokeColor: "",
  });
  const goalYAxisExtentsRef = useRef<{ min: number; max: number } | null>(null);
  const compareYAxisExtentsRef = useRef<{ min: number; max: number } | null>(null);
  const goalAutoscaleActiveRef = useRef(false);
  const compareAutoscaleActiveRef = useRef(false);
  const scheduleTradeDotsSyncRef = useRef<(() => void) | null>(null);
  const tradeDotHoverApiRef = useRef<TradeDotHoverApi | null>(null);
  const lineEnterCancelRef = useRef<(() => void) | null>(null);
  const lineAnimKeyRef = useRef<string>("");
  const lineEnterDoneRef = useRef(true);
  const lineEnterRevealStartedRef = useRef(false);
  const [tooltip, setTooltip] = useState<PortfolioChartTooltipState | null>(null);
  const [periodAxisLabels, setPeriodAxisLabels] = useState<OverviewAxisLabel[]>([]);
  const periodAxisLabelsRef = useRef<OverviewAxisLabel[]>([]);
  const [axisPlotWidthPx, setAxisPlotWidthPx] = useState(0);
  const [hoverAxisLabel, setHoverAxisLabel] = useState<{ leftPx: number; label: string } | null>(
    null,
  );
  const hoverTimeRef = useRef<Time | null>(null);
  const showPortfolioRef = useRef(showPortfolio);
  showPortfolioRef.current = showPortfolio;
  const overlaySeriesRef = useRef(overlaySeries);
  overlaySeriesRef.current = overlaySeries;
  const mainSeriesTooltipLabelRef = useRef(mainSeriesTooltipLabel);
  mainSeriesTooltipLabelRef.current = mainSeriesTooltipLabel;
  const chartInteractionStyleRef = useRef(chartInteractionStyle);
  chartInteractionStyleRef.current = chartInteractionStyle;
  const plotLayoutRef = useRef(plotLayout);
  plotLayoutRef.current = plotLayout;
  const metricRef = useRef(metric);
  metricRef.current = metric;

  const setPeriodAxisLabelsGuarded = useCallback((next: OverviewAxisLabel[], plotWidthPx: number) => {
    setAxisPlotWidthPx(plotWidthPx);
    if (overviewAxisLabelsEqual(periodAxisLabelsRef.current, next)) return;
    periodAxisLabelsRef.current = next;
    setPeriodAxisLabels(next);
  }, []);
  const periodAxisSyncGenRef = useRef(0);
  const schedulePeriodAxisLabelsRef = useRef<(range: PortfolioChartRange) => void>(() => {});
  const schedulePeriodAxisLabels = useCallback(
    (rangeForSync: PortfolioChartRange) => {
      if (hoverTimeRef.current != null) return;
      const c = chartRef.current;
      if (!c || chartPointsRef.current.length === 0) return;
      const gen = ++periodAxisSyncGenRef.current;
      schedulePortfolioPeriodAxisLabelsWhenReady({
        chart: c,
        chartPoints: chartPointsRef.current,
        range: rangeForSync,
        getPlotWidthPx: () => {
          const tsW = c.timeScale().width();
          if (tsW > 12) return tsW;
          return Math.max(0, wrapRef.current?.clientWidth ?? 0);
        },
        minLabelGapPx:
          plotLayoutRef.current === "goal"
            ? resolveGoalPeriodAxisMinLabelGapPx(wrapRef.current?.clientWidth ?? chartLayoutRef.current.containerWidthPx)
            : undefined,
        apply: (labels, plotWidthPx) => setPeriodAxisLabelsGuarded(labels, plotWidthPx),
        cancelled: () => gen !== periodAxisSyncGenRef.current,
      });
    },
    [setPeriodAxisLabelsGuarded],
  );
  schedulePeriodAxisLabelsRef.current = schedulePeriodAxisLabels;
  const [tradeTooltip, setTradeTooltip] = useState<{
    left: number;
    top: number;
    dateLabel: string;
    lines: string[];
  } | null>(null);
  const [tradeTooltipMounted, setTradeTooltipMounted] = useState(false);
  const tradeTooltipLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPlotRevealClip = useCallback((progress: number) => {
    applyOverviewLineRevealClip(wrapRef.current, progress);
    if (plotLayoutRef.current === "goal") {
      applyOverviewLineRevealClip(goalYAxisBadgesRef.current, progress);
    }
  }, []);

  const syncPaneYAxisChrome = useCallback(() => {
    const s = seriesRef.current;
    if (!s || s.data().length === 0) return;
    const goalBadgeSpecs =
      plotLayoutRef.current === "goal"
        ? collectGoalEndBadgeSpecs(goalEndBadgeConfigRef.current)
        : [];
    const nextY = syncPaneYAxisLabelsForLayout(
      s,
      metricRef.current,
      chartLayoutRef.current.yAxisLabelCount,
      plotLayoutRef.current,
      goalYAxisExtentsRef.current,
      plotLayoutRef.current === "goal" ? null : compareYAxisExtentsRef.current,
    );
    setYAxisLabels((prev) => (overviewYAxisLabelsEqual(prev, nextY) ? prev : nextY));
    const chart = chartRef.current;
    const nextGoalBadges =
      chart ?
        attachGoalEndPointCoordinates(
          chart,
          resolveGoalPaneEndBadges(
            plotLayoutRef.current,
            goalYAxisExtentsRef.current,
            goalBadgeSpecs,
          ),
          goalBadgeSpecs,
          (key) => {
            if (key === "portfolio") return seriesRef.current;
            const cfg = goalEndBadgeConfigRef.current;
            const overlayId = key === "safe" ? cfg.safeOverlayId : cfg.aggressiveOverlayId;
            return overlayId ? overlaySeriesRefs.current.get(overlayId) ?? null : null;
          },
          wrapRef.current?.clientWidth ?? chartLayoutRef.current.containerWidthPx,
        )
      : [];
    setGoalEndBadges((prev) => (goalYAxisEndBadgesEqual(prev, nextGoalBadges) ? prev : nextGoalBadges));
    if (plotLayoutRef.current !== "goal" || !chart || !lineEnterDoneRef.current) {
      setGoalAchievementDots((prev) => (prev.length === 0 ? prev : []));
    } else {
      const goalCfg = goalAchievementConfigRef.current;
      const nextAchievement = computeGoalAchievementDots(
        chart,
        Math.max(chart.timeScale().width(), wrapRef.current?.clientWidth ?? 0),
        Math.max(wrapRef.current?.clientHeight ?? 0, chart.paneSize(0).height),
        [
          {
            key: "portfolio",
            year: goalCfg.portfolioMilestoneYear,
            show: goalCfg.showPortfolio,
            lineData: goalCfg.portfolioLineData,
            strokeColor: resolveFsColor("--fs-accent"),
            series: s,
          },
          {
            key: "safe",
            year: goalCfg.safeMilestoneYear,
            show: goalCfg.safeVisible,
            lineData: goalCfg.safeLineData,
            strokeColor: goalCfg.safeStrokeColor,
            series:
              goalCfg.safeOverlayId != null ?
                overlaySeriesRefs.current.get(goalCfg.safeOverlayId) ?? null
              : null,
          },
          {
            key: "aggressive",
            year: goalCfg.aggressiveMilestoneYear,
            show: goalCfg.aggressiveVisible,
            lineData: goalCfg.aggressiveLineData,
            strokeColor: goalCfg.aggressiveStrokeColor,
            series:
              goalCfg.aggressiveOverlayId != null ?
                overlaySeriesRefs.current.get(goalCfg.aggressiveOverlayId) ?? null
              : null,
          },
        ],
        goalCfg.goalTargetUsd,
      );
      setGoalAchievementDots((prev) => (goalAchievementDotsEqual(prev, nextAchievement) ? prev : nextAchievement));
    }
  }, []);

  useEffect(() => {
    setTradeTooltipMounted(true);
    return () => {
      if (tradeTooltipLeaveTimerRef.current) clearTimeout(tradeTooltipLeaveTimerRef.current);
    };
  }, []);

  const cancelTradeTooltipLeave = useCallback(() => {
    if (tradeTooltipLeaveTimerRef.current) {
      clearTimeout(tradeTooltipLeaveTimerRef.current);
      tradeTooltipLeaveTimerRef.current = null;
    }
  }, []);

  const scheduleTradeTooltipLeave = useCallback(() => {
    cancelTradeTooltipLeave();
    tradeTooltipLeaveTimerRef.current = setTimeout(() => {
      tradeTooltipLeaveTimerRef.current = null;
      setTradeTooltip(null);
    }, TRADE_TOOLTIP_LEAVE_MS);
  }, [cancelTradeTooltipLeave]);

  tradeDotHoverApiRef.current = {
    onEnter({ clientX, clientY, bucket, chartYmd }) {
      cancelTradeTooltipLeave();
      hoverTimeRef.current = null;
      setHoverAxisLabel(null);
      setTooltip(null);
      const { dateLabel, lines } = buildTradeDotTooltip(bucket, chartYmd, transactions);
      const pos = tradeTooltipNearPointer(clientX, clientY, lines.length);
      setTradeTooltip({
        left: pos.left,
        top: pos.top,
        dateLabel,
        lines,
      });
    },
    onLeave() {
      scheduleTradeTooltipLeave();
    },
  };

  const drawCompareSpy = compareSpy && metricSupportsBenchmarkCompare(metric);
  const drawCompareNasdaq = compareNasdaq && metricSupportsBenchmarkCompare(metric);
  /** Create compare series with the chart so toggling S&P does not remount the portfolio series. */
  const mountSpySeries = metricSupportsBenchmarkCompare(metric);
  const mountNasdaqSeries = metricSupportsBenchmarkCompare(metric);

  chartRangeRef.current = range;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const shouldForceEnglish = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    const showNativeLastValueBadges = true;

    const chart = createChart(el, {
      width: Math.max(2, el.clientWidth),
      height: chartLayoutRef.current.plotHeightPx,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: resolveFsColor("--fs-fg-muted"),
        fontSize: 11,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      overlayPriceScales: {
        borderVisible: false,
        ticksVisible: false,
        entireTextOnly: true,
        scaleMargins: { top: OVERVIEW_SCALE_MARGIN_TOP, bottom: OVERVIEW_SCALE_MARGIN_BOTTOM },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: OVERVIEW_SCALE_MARGIN_TOP, bottom: OVERVIEW_SCALE_MARGIN_BOTTOM },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: false,
        borderVisible: false,
        ticksVisible: false,
        tickMarkFormatter: () => "",
        minimumHeight: 0,
        fixLeftEdge: false,
        fixRightEdge: false,
        rightOffset: 0,
        barSpacing: 0,
        minBarSpacing: 0,
        shiftVisibleRangeOnNewBar: false,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "rgba(20, 20, 20, 0.28)",
          labelVisible: false,
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      localization: {
        tickmarksPriceFormatter: HIDE_NATIVE_Y_AXIS_TICK_LABELS,
        ...(shouldForceEnglish ?
          // Force English month/day labels on mobile time axis (avoid device-locale like ru-RU).
          { locale: "en-US" }
        : {}),
        priceFormatter: (p: number) =>
          isPercentMetric(metric) ? formatReturnPctAxis(p) : formatAxisUsd(p),
      },
      handleScroll: false,
      handleScale: false,
    });

    const markerBorderColorRef = { current: "" as string };
    const applyCrosshairMarkerBorder = (borderColor: string) => {
      if (borderColor === markerBorderColorRef.current) return;
      markerBorderColorRef.current = borderColor;
      seriesRef.current?.applyOptions({ crosshairMarkerBorderColor: borderColor });
    };

    const lastPriceAnimation = LastPriceAnimationMode.Disabled;

    const baselineOpts = {
      relativeGradient: false,
      ...baselineUpDownFillColors("bright"),
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastPriceAnimation,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: resolveFsColor("--fs-up"),
      crosshairMarkerBackgroundColor: chartMarkerDiscFillColor(),
      crosshairMarkerBorderWidth: 2,
    } as const;

    const series =
      metric === "value" ?
        (() => {
          const fill = accentAreaGradientColors();
          return chart.addSeries(AreaSeries, {
          lineColor: resolveFsColor("--fs-accent"),
          topColor: fill.top,
          bottomColor: fill.bottom,
          lineWidth: 2,
          lineType: LineType.Curved,
          priceLineVisible: false,
          lastPriceAnimation,
          lastValueVisible: showNativeLastValueBadges,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: resolveFsColor("--fs-accent"),
          crosshairMarkerBackgroundColor: chartMarkerDiscFillColor(),
          crosshairMarkerBorderWidth: 2,
        });
        })()
      : chart.addSeries(BaselineSeries, {
          ...baselineOpts,
          lastValueVisible: showNativeLastValueBadges,
          // Drawdowns are always ≤ 0: force red even for the flat 0% stretches at peaks.
          ...(metric === "drawdown" ?
            {
              topLineColor: resolveFsColor("--fs-down"),
              topFillColor1: "rgba(220, 38, 38, 0)",
              topFillColor2: "rgba(220, 38, 38, 0)",
            }
          : {}),
          baseValue: { type: "price" as const, price: 0 },
        });

    const compareLineOpts = {
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastPriceAnimation,
      crosshairMarkerVisible: false,
      priceScaleId: COMPARE_OVERLAY_PRICE_SCALE_ID,
      lastValueVisible: showNativeLastValueBadges,
    } as const;

    if (mountSpySeries) {
      compareSeriesRefs.current.spy = chart.addSeries(LineSeries, {
        ...compareLineOpts,
        color: BENCHMARK_SPY_LINE,
        visible: false,
      });
    } else {
      compareSeriesRefs.current.spy = null;
    }

    if (mountNasdaqSeries) {
      compareSeriesRefs.current.nasdaq = chart.addSeries(LineSeries, {
        ...compareLineOpts,
        color: BENCHMARK_NASDAQ_LINE,
        visible: false,
      });
    } else {
      compareSeriesRefs.current.nasdaq = null;
    }

    if (mountSpySeries || mountNasdaqSeries) {
      try {
        chart.priceScale(COMPARE_OVERLAY_PRICE_SCALE_ID).applyOptions({
          visible: true,
          ticksVisible: false,
          borderVisible: false,
          entireTextOnly: true,
          scaleMargins: {
            top: OVERVIEW_SCALE_MARGIN_TOP,
            bottom: OVERVIEW_SCALE_MARGIN_BOTTOM,
          },
        });
      } catch {
        /* overlay scale is created with the compare series */
      }
    }

    chartRef.current = chart;
    seriesRef.current = series;
    setChartReadyTick((n) => n + 1);
    lastPointMarkersRef.current = {
      main: createSeriesMarkers(series, [], { autoScale: true }) as ISeriesMarkersPluginApi<UTCTimestamp>,
      spy: mountSpySeries && compareSeriesRefs.current.spy
        ? createSeriesMarkers(compareSeriesRefs.current.spy, [], { autoScale: true }) as ISeriesMarkersPluginApi<UTCTimestamp>
        : null,
      nasdaq: mountNasdaqSeries && compareSeriesRefs.current.nasdaq
        ? createSeriesMarkers(compareSeriesRefs.current.nasdaq, [], { autoScale: true }) as ISeriesMarkersPluginApi<UTCTimestamp>
        : null,
      overlays: new Map(),
    };

    scheduleTradeDotsSyncRef.current = () => {
      const c = chartRef.current;
      const s = seriesRef.current;
      if (!c || !s) return;
      const tradeOverlay = tradeOverlayRef.current;
      const cfg = tradeDotsConfigRef.current;
      if (tradeOverlay) {
        syncPortfolioTradeDotsOverlay(
          c,
          s,
          tradeOverlay,
          cfg.show,
          cfg.txs,
          cfg.lineData,
          cfg.sessionYmds,
          tradeDotHoverApiRef,
        );
      }
    };

    const onGoalVisibleRangeChange = () => {
      if (plotLayoutRef.current !== "goal") return;
      scheduleTradeDotsSyncRef.current?.();
      if (lineEnterDoneRef.current || lineEnterRevealStartedRef.current) {
        syncPaneYAxisChrome();
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onGoalVisibleRangeChange);

    const onCrosshairMove = (param: MouseEventParams) => {
      const s = seriesRef.current;
      const box = containerRef.current;
      if (!s || !box) return;

      if (
        param.point === undefined ||
        param.point.x < 0 ||
        param.point.y < 0 ||
        param.time === undefined
      ) {
        hoverTimeRef.current = null;
        setHoverAxisLabel((prev) => (prev == null ? prev : null));
        setTooltip((prev) => (prev == null ? prev : null));
        schedulePeriodAxisLabelsRef.current(chartRangeRef.current);
        return;
      }

      const data = param.seriesData.get(s);
      const tooltipLines: {
        label: string;
        valueLabel: string;
        valueTone: "pos" | "neg" | "neutral";
        swatchColor?: string;
        swatchVariant?: "solid" | "upDown";
      }[] = [];

      const currentMetric = metricRef.current;
      const hasVisibleOverlays = overlaySeriesRef.current.some((o) => o.visible);
      const showTooltipSwatches =
        chartInteractionStyleRef.current === "fundamentals" || hasVisibleOverlays;

      if (showPortfolioRef.current) {
        const raw = resolveOverviewSeriesValueAtCrosshair(s, param, chartPointsRef.current);
        if (raw != null) {
          applyCrosshairMarkerBorder(overviewCrosshairMarkerBorderColor(currentMetric, raw));
          const formatted = overviewTooltipValue(currentMetric, raw);
          tooltipLines.push({
            label: mainSeriesTooltipLabelRef.current ?? overviewMetricTitle(currentMetric),
            swatchColor:
              showTooltipSwatches && !isPercentMetric(currentMetric) ?
                overviewCrosshairMarkerBorderColor(currentMetric, raw)
              : undefined,
            swatchVariant:
              showTooltipSwatches && isPercentMetric(currentMetric) ? "upDown" : undefined,
            ...formatted,
          });
        }
      }

      for (const o of overlaySeriesRef.current) {
        if (!o.visible) continue;
        const overlaySeriesApi = overlaySeriesRefs.current.get(o.id);
        if (!overlaySeriesApi) continue;
        const raw = resolveOverviewSeriesValueAtCrosshair(
          overlaySeriesApi,
          param,
          lineDataToStockChartPoints(overlaySeriesApi.data() as { time: Time; value: number }[]),
        );
        if (raw == null) continue;
        tooltipLines.push({
          label: o.label?.trim() || o.id,
          swatchColor: o.color,
          ...overviewTooltipValue(currentMetric, raw),
        });
      }

      if (tooltipLines.length === 0) {
        hoverTimeRef.current = null;
        setHoverAxisLabel((prev) => (prev == null ? prev : null));
        setTooltip((prev) => (prev == null ? prev : null));
        schedulePeriodAxisLabelsRef.current(chartRangeRef.current);
        return;
      }

      if (!showPortfolioRef.current || data == null || typeof data !== "object" || !("value" in data)) {
        applyCrosshairMarkerBorder(resolveFsColor("--fs-accent"));
      }

      setTradeTooltip((prev) => (prev == null ? prev : null));

      const hoverTime = param.time as Time;
      hoverTimeRef.current = hoverTime;
      const plotWidthPx = Math.max(0, wrapRef.current?.clientWidth ?? 0);

      if (chartInteractionStyleRef.current === "fundamentals") {
        setHoverAxisLabel(null);
        const rows: {
          key: string;
          label: string;
          value: string;
          color: string;
          swatchVariant?: "solid" | "upDown";
        }[] = [];
        for (const line of tooltipLines) {
          if (line.swatchVariant === "upDown") {
            rows.push({
              key: line.label,
              label: line.label,
              value: line.valueLabel,
              color: "",
              swatchVariant: "upDown",
            });
            continue;
          }
          if (!line.swatchColor) continue;
          rows.push({
            key: line.label,
            label: line.label,
            value: line.valueLabel,
            color: line.swatchColor,
          });
        }
        if (rows.length === 0) {
          setTooltip(null);
          return;
        }
        const { side } = computeFundamentalsChartTooltipPlacement(param.point.x, plotWidthPx);
        const plotH = chartLayoutRef.current.plotHeightPx;
        const estH = 44 + rows.length * 20;
        const vAlign: "center" | "above" =
          param.point.y + estH / 2 > plotH - 8 ? "above" : "center";
        setTooltip({
          variant: "fundamentals",
          anchorX: param.point.x,
          y: param.point.y,
          side,
          vAlign,
          periodLabel: formatChartHoverPeriodYear(hoverTime),
          rows,
        });
        return;
      }

      setHoverAxisLabel({
        leftPx: param.point.x,
        label: portfolioCrosshairBottomLabel(hoverTime, chartRangeRef.current, chartPointsRef.current),
      });

      const tw = 168;
      const lineH = 18;
      const th = 16 + tooltipLines.length * lineH;
      const pad = 8;
      let x = param.point.x + pad;
      let y = param.point.y - th - pad;
      if (x + tw > box.clientWidth - pad) x = box.clientWidth - tw - pad;
      if (x < pad) x = pad;
      if (y < pad) y = pad;
      if (y + th > chartLayoutRef.current.plotHeightPx - pad) {
        y = Math.min(chartLayoutRef.current.plotHeightPx - th - pad, param.point.y + pad);
      }

      setTooltip({
        variant: "overview",
        x,
        y,
        lines: tooltipLines,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    const lastChartWidthRef = { current: 0 };
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current || !chartRef.current) return;
      const width = wrapRef.current.clientWidth;
      // Hidden tab panels collapse to width 0. Applying Math.max(2, 0) shrinks the
      // time scale so last-value badges flash on the left when switching back.
      if (width < 12) return;
      if (width !== lastChartWidthRef.current) {
        lastChartWidthRef.current = width;
        chartRef.current.applyOptions({ width });
      }
      syncLastPointMarkersRef.current?.();
      // Tab unhide can leave a leftover clip. Never cancel a live enter (including the
      // pre-paint wait) — aborting it either snaps the line in or leaves the plot blank.
      if (lineEnterDoneRef.current) {
        applyPlotRevealClip(1);
      }
      const s = seriesRef.current;
      if (s && s.data().length > 0) {
        snapChartTimeScaleForLayout(
          chartRef.current,
          s,
          wrapRef.current?.clientWidth ?? chartRef.current.timeScale().width(),
        );
        if (lineEnterDoneRef.current || lineEnterRevealStartedRef.current) {
          syncPaneYAxisChrome();
        }
      }
      requestAnimationFrame(() => {
        scheduleTradeDotsSyncRef.current?.();
        const c = chartRef.current;
        const s = seriesRef.current;
        if (!c || !s || s.data().length === 0) return;
        const hoverTime = hoverTimeRef.current;
        if (hoverTime != null) {
          const x = c.timeScale().timeToCoordinate(hoverTime);
          if (x != null && Number.isFinite(x)) {
            setHoverAxisLabel({
              leftPx: x,
              label: portfolioCrosshairBottomLabel(hoverTime, chartRangeRef.current, chartPointsRef.current),
            });
          }
        } else if (lineEnterDoneRef.current || lineEnterRevealStartedRef.current) {
          schedulePeriodAxisLabelsRef.current(chartRangeRef.current);
        }
      });
    });
    ro.observe(el);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => scheduleTradeDotsSyncRef.current?.());
    });

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onGoalVisibleRangeChange);
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      ro.disconnect();
      cancelOverviewLineEnter({
        cancelRef: lineEnterCancelRef,
        doneRef: lineEnterDoneRef,
        clearClip: () => applyPlotRevealClip(1),
      });
      lineAnimKeyRef.current = "";
      setYAxisLabels([]);
      setGoalEndBadges([]);
      setGoalAchievementDots([]);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      compareSeriesRefs.current = { spy: null, nasdaq: null };
      overlaySeriesRefs.current.clear();
      lastPointMarkersRef.current = { main: null, spy: null, nasdaq: null, overlays: new Map() };
      syncLastPointMarkersRef.current = null;
      scheduleTradeDotsSyncRef.current = null;
      periodAxisSyncGenRef.current += 1;
      tradeOverlayRef.current?.replaceChildren();
      hoverTimeRef.current = null;
      setTooltip(null);
      setTradeTooltip(null);
      setHoverAxisLabel(null);
      periodAxisLabelsRef.current = [];
      setPeriodAxisLabels([]);
      setAxisPlotWidthPx(0);
      setYAxisLabels([]);
      setGoalEndBadges([]);
      setGoalAchievementDots([]);
      goalAutoscaleActiveRef.current = false;
      goalYAxisExtentsRef.current = null;
      compareAutoscaleActiveRef.current = false;
      compareYAxisExtentsRef.current = null;
    };
  }, [metric, setPeriodAxisLabelsGuarded, chartThemePaintKey, applyPlotRevealClip, syncPaneYAxisChrome]);

  useEffect(() => {
    chartRef.current?.applyOptions({ height: chartLayout.plotHeightPx });
  }, [chartLayout.plotHeightPx]);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const filtered = points.filter((p) =>
      metric === "profit" ?
        Number.isFinite(p.value) && Number.isFinite(p.profit)
      : metric === "return" ?
        typeof p.returnPct === "number" && Number.isFinite(p.returnPct)
      : Number.isFinite(p.value),
    );

    const sessionYmds = filtered.map((p) => p.t);
    sessionYmdsRef.current = sessionYmds;
    chartPointsRef.current = portfolioHistoryToStockChartPoints(filtered);

    const data =
      metric === "drawdown" ?
        buildDrawdownData(filtered)
      : filtered.map((p) => {
          let y: number;
          if (metric === "value") y = p.value;
          else if (metric === "profit") y = p.profit;
          else y = p.returnPct!;
          return { time: portfolioChartTime(p) as Time, value: y };
        });

    const lineAnimKey =
      data.length >= 2 ?
        `${metric}:${data.length}:${String(data[0]?.time ?? "")}:${String(data.at(-1)?.time ?? "")}`
      : "";

    if (data.length === 0) {
      cancelOverviewLineEnter({
        cancelRef: lineEnterCancelRef,
        doneRef: lineEnterDoneRef,
        clearClip: () => applyPlotRevealClip(1),
      });
      lineAnimKeyRef.current = "";
      series.setData([]);
      sessionYmdsRef.current = [];
      chartPointsRef.current = [];
      tradeDotsConfigRef.current = { show: showTrades, txs: transactions, lineData: [], sessionYmds: [] };
      scheduleTradeDotsSyncRef.current?.();
      compareSeriesRefs.current.spy?.setData([]);
      compareSeriesRefs.current.nasdaq?.setData([]);
      for (const s of overlaySeriesRefs.current.values()) s.setData([]);
      lastPointMarkersRef.current.main?.setMarkers([]);
      lastPointMarkersRef.current.spy?.setMarkers([]);
      lastPointMarkersRef.current.nasdaq?.setMarkers([]);
      for (const m of lastPointMarkersRef.current.overlays.values()) m.setMarkers([]);
      goalAchievementConfigRef.current = {
        portfolioMilestoneYear: null,
        safeMilestoneYear: null,
        aggressiveMilestoneYear: null,
        goalTargetUsd: null,
        showPortfolio: false,
        portfolioLineData: [],
        safeOverlayId: null,
        safeLineData: [],
        safeVisible: false,
        safeStrokeColor: "",
        aggressiveOverlayId: null,
        aggressiveLineData: [],
        aggressiveVisible: false,
        aggressiveStrokeColor: "",
      };
      goalEndBadgeConfigRef.current = {
        showPortfolio: false,
        portfolioLineData: [],
        safeOverlayId: null,
        safeLineData: [],
        safeVisible: false,
        safeStrokeColor: "",
        aggressiveOverlayId: null,
        aggressiveLineData: [],
        aggressiveVisible: false,
        aggressiveStrokeColor: "",
      };
      goalYAxisExtentsRef.current = null;
      setYAxisLabels([]);
      setGoalEndBadges([]);
      setGoalAchievementDots([]);
      periodAxisLabelsRef.current = [];
      setPeriodAxisLabels([]);
      setAxisPlotWidthPx(0);
      return;
    }

    if (metric !== "value") {
      series.applyOptions({
        relativeGradient: baselineRelativeGradientEnabled(data, 0),
      });
    }

    const safeOverlay = overlaySeries.find((o) => o.id === "safe");
    const aggressiveOverlay = overlaySeries.find((o) => o.id === "aggressive");
    let safeLineData: { time: Time; value: number }[] = [];
    if (safeOverlay?.visible) {
      const filteredSafe = safeOverlay.points.filter((p) => Number.isFinite(p.value));
      safeLineData = filteredSafe.map((p) => ({
        time: portfolioChartTime(p) as Time,
        value: p.value,
      }));
    }
    let aggressiveLineData: { time: Time; value: number }[] = [];
    if (aggressiveOverlay?.visible) {
      const filteredAggressive = aggressiveOverlay.points.filter((p) => Number.isFinite(p.value));
      aggressiveLineData = filteredAggressive.map((p) => ({
        time: portfolioChartTime(p) as Time,
        value: p.value,
      }));
    }

    goalAchievementConfigRef.current = {
      portfolioMilestoneYear,
      safeMilestoneYear,
      aggressiveMilestoneYear,
      goalTargetUsd,
      showPortfolio,
      portfolioLineData: data,
      safeOverlayId: safeOverlay ? "safe" : null,
      safeLineData,
      safeVisible: safeOverlay?.visible === true,
      safeStrokeColor: safeOverlay?.color ?? "",
      aggressiveOverlayId: aggressiveOverlay ? "aggressive" : null,
      aggressiveLineData,
      aggressiveVisible: aggressiveOverlay?.visible === true,
      aggressiveStrokeColor: aggressiveOverlay?.color ?? "",
    };
    goalEndBadgeConfigRef.current = {
      showPortfolio,
      portfolioLineData: data,
      safeOverlayId: safeOverlay ? "safe" : null,
      safeLineData,
      safeVisible: safeOverlay?.visible === true,
      safeStrokeColor: safeOverlay?.color ?? "",
      aggressiveOverlayId: aggressiveOverlay ? "aggressive" : null,
      aggressiveLineData,
      aggressiveVisible: aggressiveOverlay?.visible === true,
      aggressiveStrokeColor: aggressiveOverlay?.color ?? "",
    };

    const lastY = data[data.length - 1]?.value;
    if (typeof lastY === "number" && Number.isFinite(lastY)) {
      series.applyOptions({
        crosshairMarkerBorderColor: overviewCrosshairMarkerBorderColor(metric, lastY),
      });
    }

    tradeDotsConfigRef.current = { show: showTrades, txs: transactions, lineData: data, sessionYmds };

    const applyBenchmarkSeries = (
      benchSeries: ISeriesApi<"Line"> | null,
      enabled: boolean,
      rawPoints: readonly StockChartPoint[] | null | undefined,
    ) => {
      if (!benchSeries) return;
      if (enabled) {
        const benchData =
          metric === "return" ?
            buildBenchmarkReturnLineData(filtered, rawPoints ?? undefined)
          : metric === "drawdown" ?
            buildBenchmarkDrawdownLineData(filtered, rawPoints ?? undefined)
          : buildBenchmarkCompareLineData(
              filtered,
              rawPoints ?? undefined,
              benchmarkInvestedUsd,
              metric === "profit" ? "profit" : "value",
              transactions,
            );
        benchSeries.setData(benchData);
      } else {
        benchSeries.setData([]);
      }
    };

    const samePortfolioLine =
      lineAnimKey.length > 0 && lineAnimKey === lineAnimKeyRef.current;
    if (!samePortfolioLine) {
      series.setData(data);
    }
    series.applyOptions({
      visible: showPortfolio,
      ...(metric === "value" ?
        { lastValueVisible: showPortfolio }
      : {}),
    });

    applyBenchmarkSeries(compareSeriesRefs.current.spy, drawCompareSpy, spyPricePoints);
    applyBenchmarkSeries(compareSeriesRefs.current.nasdaq, drawCompareNasdaq, nasdaqPricePoints);
    const showNativeCompareBadges = plotLayoutRef.current !== "goal";
    compareSeriesRefs.current.spy?.applyOptions({
      visible: drawCompareSpy,
      lastValueVisible: drawCompareSpy && showNativeCompareBadges,
    });
    compareSeriesRefs.current.nasdaq?.applyOptions({
      visible: drawCompareNasdaq,
      lastValueVisible: drawCompareNasdaq && showNativeCompareBadges,
    });

    // Combined-source overlays (line series managed alongside compare series).
    {
      const wanted = new Set(overlaySeries.map((o) => o.id));
      for (const [id, s] of [...overlaySeriesRefs.current.entries()]) {
        if (!wanted.has(id)) {
          try {
            chart.removeSeries(s);
          } catch {
            /* chart remounting */
          }
          overlaySeriesRefs.current.delete(id);
          lastPointMarkersRef.current.overlays.delete(id);
        }
      }
      for (const o of overlaySeries) {
        let s = overlaySeriesRefs.current.get(o.id);
        if (!s) {
          s = chart.addSeries(LineSeries, {
            lineWidth: 2,
            lineType: plotLayoutRef.current === "goal" ? LineType.Simple : LineType.Curved,
            priceLineVisible: false,
            lastPriceAnimation: LastPriceAnimationMode.Disabled,
            priceScaleId: "right",
            lastValueVisible: o.visible,
            color: o.color,
            visible: o.visible,
            ...overlayLineCrosshairOptions(o.color, o.visible),
          });
          overlaySeriesRefs.current.set(o.id, s);
          lastPointMarkersRef.current.overlays.set(
            o.id,
            createSeriesMarkers(s, [], { autoScale: true }) as ISeriesMarkersPluginApi<UTCTimestamp>,
          );
        } else {
          s.applyOptions({
            color: o.color,
            visible: o.visible,
            lastValueVisible: o.visible,
            lastPriceAnimation: LastPriceAnimationMode.Disabled,
            ...overlayLineCrosshairOptions(o.color, o.visible),
          });
        }
        if (!o.visible) {
          s.setData([]);
          continue;
        }
        const filteredO = o.points.filter((p) =>
          metric === "profit" ?
            Number.isFinite(p.value) && Number.isFinite(p.profit)
          : metric === "return" ?
            typeof p.returnPct === "number" && Number.isFinite(p.returnPct)
          : Number.isFinite(p.value),
        );
        const oData =
          metric === "drawdown" ?
            buildDrawdownData(filteredO)
          : filteredO.map((p) => {
              let y: number;
              if (metric === "value") y = p.value;
              else if (metric === "profit") y = p.profit;
              else y = p.returnPct!;
              return { time: portfolioChartTime(p) as Time, value: y };
            });
        s.setData(oData);
      }
    }

    if (plotLayoutRef.current === "goal") {
      compareYAxisExtentsRef.current = null;
      compareAutoscaleActiveRef.current = false;
      goalYAxisExtentsRef.current = applyGoalSharedAutoscale(
        series,
        overlaySeriesRefs.current,
        overlaySeries,
        showPortfolio ? data : [],
        metric,
      );
      goalAutoscaleActiveRef.current = true;
    } else {
      goalYAxisExtentsRef.current = null;
      if (goalAutoscaleActiveRef.current) {
        restoreSeriesDefaultAutoscale(series);
        for (const s of overlaySeriesRefs.current.values()) {
          restoreSeriesDefaultAutoscale(s);
        }
        goalAutoscaleActiveRef.current = false;
      }

      const spyApi = compareSeriesRefs.current.spy;
      const nasdaqApi = compareSeriesRefs.current.nasdaq;
      const sharePriceScale = compareSharesPortfolioPriceScale(range, metric);
      const comparePriceScaleId = sharePriceScale ? "right" : COMPARE_OVERLAY_PRICE_SCALE_ID;
      spyApi?.applyOptions({ priceScaleId: comparePriceScaleId });
      nasdaqApi?.applyOptions({ priceScaleId: comparePriceScaleId });
      if (!sharePriceScale && (drawCompareSpy || drawCompareNasdaq)) {
        try {
          chart.priceScale(COMPARE_OVERLAY_PRICE_SCALE_ID).applyOptions({
            visible: true,
            ticksVisible: false,
            borderVisible: false,
            entireTextOnly: true,
            scaleMargins: {
              top: OVERVIEW_SCALE_MARGIN_TOP,
              bottom: OVERVIEW_SCALE_MARGIN_BOTTOM,
            },
          });
        } catch {
          /* overlay scale is created with the compare series */
        }
      }
      const compareExtents = unionSeriesValueExtents([
        showPortfolio ? overviewSeriesValueExtents(series) : null,
        drawCompareSpy && spyApi ? overviewSeriesValueExtents(spyApi as OverviewMainSeries) : null,
        drawCompareNasdaq && nasdaqApi ? overviewSeriesValueExtents(nasdaqApi as OverviewMainSeries) : null,
      ]);
      if (sharePriceScale && compareExtents && (drawCompareSpy || drawCompareNasdaq)) {
        applyCompareSharedAutoscale(series, [spyApi, nasdaqApi], compareExtents, metric);
        compareYAxisExtentsRef.current = compareExtents;
        compareAutoscaleActiveRef.current = true;
      } else {
        compareYAxisExtentsRef.current = null;
        restoreSeriesDefaultAutoscale(series);
        restoreSeriesDefaultAutoscale(spyApi);
        restoreSeriesDefaultAutoscale(nasdaqApi);
        compareAutoscaleActiveRef.current = false;
      }
    }

    snapChartTimeScaleForLayout(
      chart,
      series,
      wrapRef.current?.clientWidth ?? chart.timeScale().width(),
    );

    const syncLastPointMarkers = () => {
      const c = chartRef.current;
      if (!c) return;
      const plugins = lastPointMarkersRef.current;
      applyLastPointCircleMarkers(
        c,
        plugins.main,
        data,
        overviewLastPointStroke(metric, data),
        showPortfolio,
      );
      const spySeries = compareSeriesRefs.current.spy;
      applyLastPointCircleMarkers(
        c,
        plugins.spy,
        spySeries ? (spySeries.data() as { time: Time; value: number }[]) : [],
        BENCHMARK_SPY_LINE,
        drawCompareSpy,
      );
      const nasdaqSeries = compareSeriesRefs.current.nasdaq;
      applyLastPointCircleMarkers(
        c,
        plugins.nasdaq,
        nasdaqSeries ? (nasdaqSeries.data() as { time: Time; value: number }[]) : [],
        BENCHMARK_NASDAQ_LINE,
        drawCompareNasdaq,
      );
      for (const o of overlaySeries) {
        const overlayApi = overlaySeriesRefs.current.get(o.id);
        applyLastPointCircleMarkers(
          c,
          plugins.overlays.get(o.id),
          overlayApi ? (overlayApi.data() as { time: Time; value: number }[]) : [],
          o.color,
          o.visible,
        );
      }
    };
    syncLastPointMarkersRef.current = syncLastPointMarkers;
    syncLastPointMarkers();

    const shouldAnimateLine =
      isGoalPlotLayout &&
      data.length >= 2 &&
      !prefersReducedFundamentalsBarMotion();

    let deferTradeDots = false;
    const isFirstLineReveal = lineAnimKeyRef.current === "";
    if (shouldAnimateLine && isFirstLineReveal) {
      lineAnimKeyRef.current = lineAnimKey;
      lineEnterCancelRef.current?.();
      lineEnterCancelRef.current = null;
      lineEnterDoneRef.current = false;
      lineEnterRevealStartedRef.current = false;
      setYAxisLabels([]);
      setGoalEndBadges([]);
      setGoalAchievementDots([]);
      deferTradeDots = true;
      tradeOverlayRef.current?.replaceChildren();
      lineEnterCancelRef.current = runOverviewLineEnterReveal({
        chart,
        wrap: wrapRef.current,
        applyClip: applyPlotRevealClip,
        onRevealStart: () => {
          lineEnterRevealStartedRef.current = true;
          syncPaneYAxisChrome();
          schedulePeriodAxisLabelsRef.current(chartRangeRef.current);
          if (plotLayoutRef.current === "goal") scheduleTradeDotsSyncRef.current?.();
        },
        onComplete: () => {
          lineEnterDoneRef.current = true;
          lineEnterRevealStartedRef.current = true;
          lineEnterCancelRef.current = null;
          scheduleTradeDotsSyncRef.current?.();
          schedulePeriodAxisLabelsRef.current(chartRangeRef.current);
          syncPaneYAxisChrome();
        },
      });
    } else if (shouldAnimateLine && !lineEnterDoneRef.current && lineEnterCancelRef.current) {
      // First-paint enter still running — keep it. Range / legend toggles must not restart
      // the clip (that was the double blink: old series clipped, then new series clipped).
      lineAnimKeyRef.current = lineAnimKey;
      deferTradeDots = true;
    } else {
      // Already on screen (or reduced motion): swap data in place, never clip from zero.
      lineAnimKeyRef.current = lineAnimKey;
      cancelOverviewLineEnter({
        cancelRef: lineEnterCancelRef,
        doneRef: lineEnterDoneRef,
        clearClip: () => applyPlotRevealClip(1),
      });
      lineEnterRevealStartedRef.current = true;
      if (wrapRef.current) wrapRef.current.style.opacity = "";
    }

    let axisSyncCancelled = false;
    const syncChromeNow = () => {
      if (axisSyncCancelled) return;
      const c = chartRef.current;
      const s = seriesRef.current;
      if (!c || !s || c !== chart || s !== series || s.data().length === 0) return;
      if (lineEnterDoneRef.current || lineEnterRevealStartedRef.current) {
        syncPaneYAxisChrome();
      }
      if (!deferTradeDots) scheduleTradeDotsSyncRef.current?.();
      const hoverTime = hoverTimeRef.current;
      if (hoverTime != null) {
        const x = c.timeScale().timeToCoordinate(hoverTime);
        if (x != null && Number.isFinite(x)) {
          setHoverAxisLabel({
            leftPx: x,
            label: portfolioCrosshairBottomLabel(hoverTime, range, chartPointsRef.current),
          });
        }
      } else if (lineEnterDoneRef.current || lineEnterRevealStartedRef.current) {
        schedulePeriodAxisLabels(range);
      }
    };
    // Same turn as setData + time-scale snap so labels land with the line, not a frame later.
    syncChromeNow();
    return () => {
      axisSyncCancelled = true;
      periodAxisSyncGenRef.current += 1;
      // Overlay / range fetches re-run this effect. Do not clear the anim key or abort a
      // live first-paint enter — that restarted the clip (chart blinks twice on toggles).
      if (!lineAnimKey) {
        cancelOverviewLineEnter({
          cancelRef: lineEnterCancelRef,
          doneRef: lineEnterDoneRef,
          clearClip: () => applyPlotRevealClip(1),
        });
        lineAnimKeyRef.current = "";
      }
    };
  }, [
    points,
    metric,
    range,
    showTrades,
    transactions,
    drawCompareSpy,
    drawCompareNasdaq,
    spyPricePoints,
    nasdaqPricePoints,
    benchmarkInvestedUsd,
    showPortfolio,
    overlaySeries,
    portfolioMilestoneYear,
    safeMilestoneYear,
    aggressiveMilestoneYear,
    goalTargetUsd,
    schedulePeriodAxisLabels,
    applyPlotRevealClip,
    syncPaneYAxisChrome,
    chartReadyTick,
  ]);

  const plotSurface = (
    <>
      <div className={cn("pointer-events-none absolute inset-0 z-0", CHART_PLOT_BACKGROUND_CLASS)} aria-hidden>
            <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
          </div>
          <div
            ref={wrapRef}
            className={cn(
              "absolute inset-0 z-10 min-w-0",
              loading
                ? "pointer-events-none opacity-0"
                : "opacity-100 transition-opacity duration-300 ease-out",
            )}
          />
          {loading && !isGoalPlotLayout ? (
            <div className="absolute inset-0 z-20 flex flex-col px-1 py-1">
              <ChartSkeleton fill variant="minimal" />
            </div>
          ) : null}
          {isGoalPlotLayout ?
            <div className="pointer-events-none absolute inset-0 z-[21] overflow-visible">
              <div ref={goalYAxisBadgesRef} className="pointer-events-none absolute inset-0">
                {goalAchievementDots.map((dot) => (
                  <span
                    key={`${dot.key}-vline`}
                    aria-hidden
                    className="absolute top-0 bottom-0 w-0 border-l border-dashed border-black/25"
                    style={{ left: dot.xPx }}
                  />
                ))}
                {goalAchievementDots.map((dot) => (
                  <span
                    key={dot.key}
                    aria-hidden
                    className="absolute box-border rounded-full"
                    style={{
                      width: GOAL_ACHIEVEMENT_DOT_PX,
                      height: GOAL_ACHIEVEMENT_DOT_PX,
                      left: dot.xPx - GOAL_ACHIEVEMENT_DOT_HALF,
                      top: dot.yPx - GOAL_ACHIEVEMENT_DOT_HALF,
                      backgroundColor: chartMarkerDiscFillColor(),
                      border: `2px solid ${dot.color}`,
                    }}
                  />
                ))}
              </div>
            </div>
          : null}
          <div
            ref={tradeOverlayRef}
            className={cn(
              "pointer-events-none absolute inset-0 z-[15]",
              loading && "invisible",
            )}
          />
          {tradeTooltipMounted && tradeTooltip
            ? createPortal(
                <div
                  className={cn(
                    "pointer-events-auto fixed z-[200] max-h-[min(280px,50vh)] w-[min(calc(100vw-2rem),280px)] overflow-y-auto overscroll-contain px-3 py-2",
                    tooltipSurfaceClassName,
                  )}
                  style={{ left: tradeTooltip.left, top: tradeTooltip.top }}
                  role="tooltip"
                  onMouseEnter={cancelTradeTooltipLeave}
                  onMouseLeave={scheduleTradeTooltipLeave}
                >
                  <p className="text-[11px] leading-4 text-fg-muted">{tradeTooltip.dateLabel}</p>                <div className="mt-1.5 space-y-0.5 text-xs leading-snug text-fg">
                    {tradeTooltip.lines.map((line, i) => {
                      const isTxDate =
                        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}$/.test(line) &&
                        i > 0;
                      return (
                        <p
                          key={i}
                          className={cn(
                            "tabular-nums",
                            line.startsWith("Cash before:") || line.startsWith("Total cash:") ?
                              "font-semibold text-fg"
                            : isTxDate ?
                              "pt-1.5 text-[11px] font-medium text-fg-muted"
                            : "font-medium",
                          )}
                        >
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </div>,
                document.body,
              )
            : null}
    </>
  );

  const chartHoverTooltip = tooltip ? (
    tooltip.variant === "fundamentals" ? (
      <div
        className={FUNDAMENTALS_CHART_TOOLTIP_CLASS}
        style={{
          left: `clamp(8px, ${tooltip.anchorX}px, calc(100% - 8px))`,
          top: tooltip.y,
          transform:
            tooltip.side === "left"
              ? tooltip.vAlign === "above"
                ? "translate(calc(-100% - 10px), calc(-100% - 8px))"
                : "translate(calc(-100% - 10px), -50%)"
              : tooltip.vAlign === "above"
                ? "translate(10px, calc(-100% - 8px))"
                : "translate(10px, -50%)",
        }}
        role="tooltip"
      >
        <p className="text-[12px] font-semibold leading-4 text-fg">{tooltip.periodLabel}</p>
        <div className="mt-1.5 space-y-1">
          {tooltip.rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                {row.swatchVariant === "upDown" ? (
                  <PortfolioUpDownLegendSwatch />
                ) : (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                )}
                <span className="truncate text-[12px] font-normal leading-4 text-fg-muted">
                  {row.label}
                </span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-fg">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div
        className={cn(
          "pointer-events-none absolute z-10 min-w-[148px] px-3 py-2",
          tooltipSurfaceClassName,
        )}
        style={{ left: tooltip.x, top: tooltip.y }}
        role="status"
      >
        <div className="space-y-1">
          {tooltip.lines.map((line) => (
            <p key={line.label} className="flex items-center gap-2 text-xs font-semibold tabular-nums text-fg">
              {line.swatchVariant === "upDown" ? (
                <PortfolioUpDownLegendSwatch />
              ) : line.swatchColor ? (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: line.swatchColor }}
                  aria-hidden
                />
              ) : null}
              <span className="min-w-0">
                {line.label}:{" "}
                <span
                  className={
                    line.valueTone === "pos" ?
                      "text-up"
                    : line.valueTone === "neg" ?
                      "text-down"
                    : "text-fg"
                  }
                >
                  {line.valueLabel}
                </span>
              </span>
            </p>
          ))}
        </div>
      </div>
    )
  ) : null;

  const yAxisColumn =
    isGoalPlotLayout && !showGoalYAxisColumn
      ? null
      : (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 z-[9] text-right font-['Inter'] text-[11px] tabular-nums leading-none text-fg-muted sm:text-[12px]",
        FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
      )}
      style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
      aria-hidden
    >
      <div className={cn("pointer-events-none absolute inset-x-0", OVERVIEW_CHART_PLOT_BACKDROP_INSET_CLASS)}>
        {yAxisLabels.map((lab) => (
          <span
            key={lab.key}
            className={cn(
              "absolute right-0 block -translate-y-1/2 whitespace-nowrap rounded-sm px-0.5 py-px",
              CHART_PLOT_BACKGROUND_LABEL_CLASS,
            )}
            style={{ top: `${lab.topPct}%` }}
          >
            {lab.label}
          </span>
        ))}
      </div>
    </div>
  );

  const periodAxisLabelNodes =
    hoverAxisLabel ?
      (
        <span
          className={cn(
            "absolute bottom-1 inline-block whitespace-nowrap font-['Inter'] text-[11px] font-medium tabular-nums leading-none text-fg sm:text-[12px]",
            periodAxisLabelMaxWidthClass("center"),
            periodAxisLabelTransformClass("center"),
          )}
          style={periodAxisLabelLayoutStyle(hoverAxisLabel.leftPx, "center", axisPlotWidthPx)}
        >
          {hoverAxisLabel.label}
        </span>
      )
    : periodAxisLabels.map((lab, i) => {
        const anchor = resolvePeriodAxisLabelAnchor(lab.leftPx, { isLeftmost: i === 0 });
        return (
          <span
            key={lab.key}
            className={cn(
              "absolute top-1/2 inline-block -translate-y-1/2 whitespace-nowrap font-['Inter'] text-[11px] tabular-nums leading-none text-fg-muted sm:text-[12px]",
              isGoalPlotLayout ? "font-medium" : "font-normal",
              periodAxisLabelMaxWidthClass(anchor),
              periodAxisLabelTransformClass(anchor),
            )}
            style={periodAxisLabelLayoutStyle(lab.leftPx, anchor, axisPlotWidthPx)}
          >
            {lab.label}
          </span>
        );
      });

  return (
    <div
      ref={containerRef}
      className="relative flex w-full min-w-0 flex-col"
      style={{ height: chartLayout.chartHeightPx }}
      onMouseLeave={() => {
        hoverTimeRef.current = null;
        setTooltip(null);
        // Trade tooltip is portaled to body — leave delay / tooltip hover handles close.
        scheduleTradeTooltipLeave();
        setHoverAxisLabel(null);
        const c = chartRef.current;
        const s = seriesRef.current;
        if (c && s && s.data().length > 0) {
          schedulePeriodAxisLabels(chartRangeRef.current);
        }
      }}
    >
      <div className="relative min-h-0 min-w-0 flex-1">
        {plotSurface}
        {loading ? null : chartHoverTooltip}
        {loading ? null : yAxisColumn}
      </div>
      <div
        className="relative w-full shrink-0 overflow-visible"
        style={{ height: chartLayout.axisRowPx }}
        aria-hidden={loading || (periodAxisLabels.length === 0 && !hoverAxisLabel)}
      >
        {loading ? null : periodAxisLabelNodes}
      </div>
    </div>
  );
}

function PortfolioOverviewChartInner({
  transactions,
  benchmarkInvestedUsd = null,
}: {
  transactions: PortfolioTransaction[];
  /** Current open equity cost basis; aligns benchmark $ line with “invested” under Total value. */
  benchmarkInvestedUsd?: number | null;
}) {
  const metric: PortfolioChartMetricMode = "value";
  const [range, setRange] = useState<PortfolioChartRange>("1y");
  const [points, setPoints] = useState<PortfolioValueHistoryPoint[]>([]);
  const [loading, setLoading] = useState(() => transactions.length > 0);
  const [error, setError] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const paintedPointsRef = useRef(0);
  const [showTrades, setShowTrades] = useState(false);
  const [compareSpy, setCompareSpy] = useState(false);
  const [compareNasdaq, setCompareNasdaq] = useState(false);
  const [spyPoints, setSpyPoints] = useState<StockChartPoint[] | null>(null);
  const [nasdaqPoints, setNasdaqPoints] = useState<StockChartPoint[] | null>(null);

  const canLoad = transactions.length > 0;
  const chartSettingsProps = {
    showTrades,
    onShowTradesChange: setShowTrades,
    compareSpy,
    onCompareSpyChange: setCompareSpy,
    compareNasdaq,
    onCompareNasdaqChange: setCompareNasdaq,
    benchmarkCompareDisabled: false,
    nasdaqCompareDisabled: false,
  } as const;

  const applyRange = useCallback(
    (next: PortfolioChartRange) => {
      setRange(next);
      if (!transactions.length) {
        paintedPointsRef.current = 0;
        setPoints([]);
        setLoading(false);
        return;
      }
      const cached = peekPortfolioValueHistoryCached(next, transactions);
      if (cached) {
        paintedPointsRef.current = cached.length;
        setPoints(cached);
        setLoading(false);
      } else {
        paintedPointsRef.current = 0;
        setPoints([]);
        setSpyPoints(null);
        setNasdaqPoints(null);
        setLoading(true);
      }
      setError(null);
    },
    [transactions],
  );

  const load = useCallback(async () => {
    if (!canLoad) {
      paintedPointsRef.current = 0;
      setPoints([]);
      setLoading(false);
      return;
    }
    const gen = ++loadGenRef.current;
    const cached = peekPortfolioValueHistoryCached(range, transactions);
    if (cached) {
      paintedPointsRef.current = cached.length;
      setPoints(cached);
      setLoading(false);
    } else {
      paintedPointsRef.current = 0;
      setPoints([]);
      setSpyPoints(null);
      setNasdaqPoints(null);
      setLoading(true);
    }
    setError(null);
    try {
      const next = await fetchPortfolioValueHistoryCached(range, transactions);
      if (gen !== loadGenRef.current) return;
      paintedPointsRef.current = next.length;
      setPoints(next);
    } catch {
      if (gen !== loadGenRef.current) return;
      setError("Could not load history");
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [canLoad, range, transactions]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Mobile range row omits YTD — match asset `ChartControls`. */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const syncMobileRange = () => {
      if (mq.matches && range === "ytd") {
        applyRange("6m");
      }
    };
    syncMobileRange();
    mq.addEventListener("change", syncMobileRange);
    return () => mq.removeEventListener("change", syncMobileRange);
  }, [range, applyRange]);

  const fetchSpy = compareSpy && canLoad;
  const fetchNasdaq = compareNasdaq && canLoad;
  const coverFromYmd = earliestBenchmarkCoverYmd(transactions);

  useEffect(() => {
    if (!fetchSpy) {
      setSpyPoints(null);
      return;
    }
    const ac = new AbortController();
    void fetchBenchmarkChartPoints("SPY", range, ac.signal, coverFromYmd)
      .then(setSpyPoints)
      .catch(() => {
        if (!ac.signal.aborted) setSpyPoints(null);
      });
    return () => ac.abort();
  }, [fetchSpy, range, canLoad, coverFromYmd]);

  useEffect(() => {
    if (!fetchNasdaq) {
      setNasdaqPoints(null);
      return;
    }
    const ac = new AbortController();
    void fetchBenchmarkChartPoints("QQQ", range, ac.signal, coverFromYmd)
      .then(setNasdaqPoints)
      .catch(() => {
        if (!ac.signal.aborted) setNasdaqPoints(null);
      });
    return () => ac.abort();
  }, [fetchNasdaq, range, canLoad, coverFromYmd]);

  return (
    <section className="relative z-10 mb-6 w-full min-w-0 max-md:mb-4">
      {/* Mobile: title + settings above chart. */}
      <div className="mb-2 flex w-full min-w-0 items-center justify-between gap-2 sm:hidden">
        <h2 className={cn("min-w-0 shrink", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>Total value</h2>
        <div className="shrink-0">
          <PortfolioChartSettingsButton {...chartSettingsProps} />
        </div>
      </div>

      {/* Desktop: title + settings + range. */}
      <div className="mb-0 hidden sm:mb-4 sm:block">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <h2 className={cn("min-w-0 shrink-0", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>Total value</h2>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-2">
            <div className="hidden shrink-0 sm:block">
              <PortfolioChartSettingsButton {...chartSettingsProps} />
            </div>
            <div className="shrink-0 overflow-x-auto pb-0.5 sm:overflow-visible sm:pb-0">
              <SegmentedControl
                options={PORTFOLIO_CHART_RANGE_LABELS}
                value={range}
                onChange={applyRange}
                size="sm"
                aria-label="Chart time range"
                className="min-w-min flex-nowrap"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0">
        {!canLoad ? (
          <Empty variant="plain" className="h-[240px] justify-center py-0 sm:h-[320px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Add trades or cash movements to see portfolio value over time.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : loading || points.length > 0 ? (
          <PortfolioValueHistoryChartPane
            metric={metric}
            range={range}
            points={points}
            loading={loading}
            transactions={transactions}
            showTrades={showTrades}
            compareSpy={compareSpy}
            compareNasdaq={compareNasdaq}
            spyPricePoints={spyPoints}
            nasdaqPricePoints={nasdaqPoints}
            benchmarkInvestedUsd={benchmarkInvestedUsd}
          />
        ) : error ? (
          <div className="flex h-[240px] flex-col items-center justify-center px-6 sm:h-[320px]">
            <p className="text-sm text-fg-muted">{error}</p>
          </div>
        ) : (
          <Empty variant="plain" className="h-[240px] justify-center py-0 sm:h-[320px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Not enough data</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Try a different range or add more activity to this portfolio.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      {/* Mobile range under chart — omit YTD like asset pages. */}
      <div className="mt-3 w-full min-w-0 pt-0.5 sm:hidden">
        <SegmentedControl
          options={PORTFOLIO_CHART_MOBILE_RANGE_LABELS}
          value={range === "ytd" ? "6m" : range}
          onChange={applyRange}
          size="sm"
          fullWidth
          aria-label="Chart time range"
          className="min-w-0 flex-1"
        />
      </div>
    </section>
  );
}

export const PortfolioOverviewChart = memo(PortfolioOverviewChartInner);
