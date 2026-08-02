"use client";

import { chartMarkerDiscFillColor, resolveFsColor } from "@/lib/theme/resolve-fs-color";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
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
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { LineChart, Settings } from "@/lib/icons";

import { accentAreaGradientColors, baselineUpDownFillColors } from "@/lib/chart/accent-area-fill";
import { useChartThemePaintKey } from "@/lib/theme/use-logo-dev-theme";
import { baselineRelativeGradientEnabled } from "@/lib/chart/baseline-relative-gradient";
import {
  fundamentalsBarEnterProgress,
  prefersReducedFundamentalsBarMotion,
  runFundamentalsBarEnterAnimation,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import { fitSeriesLogicalRangeToPlotWidth } from "@/lib/chart/mobile-plot-horizontal-gutter";
import {
  CHART_PLOT_BACKGROUND_CLASS,
  CHART_PLOT_BACKGROUND_LABEL_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
} from "@/lib/chart/fundamentals-chart-surface";

import { horzTimeToUnixSeconds } from "@/components/chart/chart-selection-utils";
import {
  CHART_PLOT_DOTS_PATTERN_CLASS,
  formatOverviewCrosshairBottomDate,
  overviewAxisLabelsEqual,
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
  buildContributionBenchmarkSeries,
  extractAllExternalCashFlows,
} from "@/lib/portfolio/benchmark/benchmark-engine";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import type { ListboxOption } from "@/components/ui/form-listbox-select";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { netCashUsdUpTo, normalizeUsdForDisplay } from "@/lib/portfolio/overview-metrics";
import { whiteSurfaceButtonBorderClass, whiteSurfaceButtonShadowClass } from "@/components/design-system";
import {
  topbarSquircleActiveClass,
  topbarSquircleIconClass,
} from "@/components/design-system/topbar-control-classes";
import { tooltipSurfaceClassName } from "@/components/design-system/tooltip-surface-styles";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/design-system/segmented-control";
import { cn } from "@/lib/utils";
import type {
  PortfolioChartRange,
  PortfolioValueHistoryPoint,
} from "@/lib/portfolio/portfolio-chart-types";

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
    return;
  }
  const rightInset = (1 - progress) * 100;
  el.style.clipPath = `inset(0 ${rightInset}% 0 0)`;
}

/** Matches `rightPriceScale.scaleMargins` on the overview LW chart. */
const OVERVIEW_SCALE_MARGIN_TOP = 0.12;
const OVERVIEW_SCALE_MARGIN_BOTTOM = 0.08;

type OverviewYAxisLabel = { key: string; label: string; topPct: number };

type OverviewMainSeries = ISeriesApi<"Area"> | ISeriesApi<"Baseline">;

const BENCHMARK_COMPARE_DISABLED_HINT =
  "Switch to Value or Return to compare with an index.";

async function fetchBenchmarkChartPoints(
  ticker: string,
  range: PortfolioChartRange,
  signal: AbortSignal,
  coverFromYmd?: string | null,
): Promise<StockChartPoint[] | null> {
  const toYmd = format(new Date(), "yyyy-MM-dd");
  // Daily EOD via Portfolio loader — same session cadence as value-history (not weekly/monthly stock charts).
  let fromYmd = coverFromYmd && /^\d{4}-\d{2}-\d{2}$/.test(coverFromYmd) ? coverFromYmd : toYmd;
  // Pad so the first chart sample can resolve a prior session mark.
  try {
    fromYmd = format(subDays(parseISO(fromYmd), 14), "yyyy-MM-dd");
  } catch {
    /* keep fromYmd */
  }
  // Also cover the visible chart window start when it is earlier than coverFrom.
  const windowFrom = chartWindowStartYmd(range);
  if (windowFrom != null && windowFrom < fromYmd) fromYmd = windowFrom;

  const res = await fetch(
    `/api/portfolio/benchmark-history?ticker=${encodeURIComponent(ticker)}&from=${encodeURIComponent(fromYmd)}&to=${encodeURIComponent(toYmd)}`,
    { credentials: "include", signal, cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { points?: StockChartPoint[] };
  return Array.isArray(json.points) ? json.points : null;
}

/** First calendar day of the selected portfolio chart range (approx). */
function chartWindowStartYmd(range: PortfolioChartRange): string | null {
  const now = new Date();
  try {
    switch (range) {
      case "1d":
        return format(subDays(now, 1), "yyyy-MM-dd");
      case "7d":
        return format(subDays(now, 7), "yyyy-MM-dd");
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

function portfolioRangeToStockRange(r: PortfolioChartRange): StockChartRange {
  switch (r) {
    case "1d":
      return "1D";
    case "7d":
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
  return [...raw]
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);
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
  return p.time != null && Number.isFinite(p.time) ? (p.time as Time) : (p.t as Time);
}

/**
 * Dollar path if external cash flows had tracked the benchmark (contribution model).
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
  const priceOnOrBefore = (ymd: string) => spyPriceForFlow(spy, ymd);

  if (transactions && transactions.length > 0) {
    const flows = extractAllExternalCashFlows(transactions);
    if (flows.length > 0) {
      const series = buildContributionBenchmarkSeries({
        sampleYmds: filtered.map((p) => p.t),
        flows,
        priceOnOrBefore,
        mode,
      });
      const byT = new Map(series.map((r) => [r.t, r.value]));
      const out: { time: Time; value: number }[] = [];
      for (const p of filtered) {
        const v = byT.get(p.t);
        if (v == null || !Number.isFinite(v)) continue;
        out.push({ time: portfolioPointTime(p), value: v });
      }
      return out;
    }
  }

  // Legacy fallback: scale a single notional by SPY price ratio (no cash-flow ledger).
  const rows: { t: string; spy: number; v: number }[] = [];
  for (const p of filtered) {
    const s = priceOnOrBefore(p.t);
    if (s == null || !Number.isFinite(s) || s <= 0) continue;
    if (!Number.isFinite(p.value)) continue;
    rows.push({ t: p.t, spy: s, v: p.value });
  }
  if (rows.length === 0) return [];
  const first = rows[0]!;
  const spy0 = first.spy;
  const investedOk =
    equityCostBasisInvestedUsd != null &&
    Number.isFinite(equityCostBasisInvestedUsd) &&
    equityCostBasisInvestedUsd > 1e-9;
  const anchor = rows.find((r) => r.v > 1e-9) ?? first;
  const notional0 = investedOk ? equityCostBasisInvestedUsd! : anchor.v;
  if (spy0 <= 0 || notional0 <= 0) return [];
  const out: { time: Time; value: number }[] = [];
  for (const p of filtered) {
    const s = priceOnOrBefore(p.t);
    if (s == null || !Number.isFinite(s) || s <= 0) continue;
    const scaled = s * (notional0 / spy0);
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
  const firstPx = spyPriceForFlow(spy, filtered[0]!.t);
  if (firstPx == null || firstPx <= 0) return [];
  const out: { time: Time; value: number }[] = [];
  for (const p of filtered) {
    const px = spyPriceForFlow(spy, p.t);
    if (px == null || px <= 0) continue;
    out.push({
      time: portfolioPointTime(p),
      value: (px / firstPx - 1) * 100,
    });
  }
  return out;
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
  /** Nasdaq compare — Value only. */
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
                  "Switch to Value to compare portfolio net worth with Nasdaq."
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

const PORTFOLIO_CHART_METRIC_OPTIONS: readonly ListboxOption<PortfolioChartMetricMode>[] = [
  { value: "value", label: "Value" },
  { value: "profit", label: "Total profit" },
  { value: "return", label: "Return" },
  { value: "drawdown", label: "Drawdowns" },
];

/** Metrics plotted in % (Return, Drawdowns) share the percent axis/tooltip format. */
function isPercentMetric(m: MetricMode): boolean {
  return m === "return" || m === "drawdown";
}

/** Equity return % (same units as overview “Total profit” ATH line). */
function formatReturnPctAxis(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

export const PORTFOLIO_CHART_RANGE_LABELS: readonly SegmentedControlOption<PortfolioChartRange>[] = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "all", label: "ALL" },
];

const PORTFOLIO_CHART_METRIC_SEGMENTS: readonly SegmentedControlOption<PortfolioChartMetricMode>[] =
  PORTFOLIO_CHART_METRIC_OPTIONS;

const PORTFOLIO_CHART_MOBILE_METRIC_TRIGGER_CLASS = `w-auto ${whiteSurfaceButtonBorderClass} bg-button font-medium ${whiteSurfaceButtonShadowClass} hover:bg-canvas`;

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

function overviewYAxisTopPercent(price: number, bottom: number, top: number): number {
  const span = top - bottom;
  if (span <= 0) return 50;
  return ((top - price) / span) * 100;
}

/** HTML right-axis labels — avoids LW price-line axis labels stacking at $0. */
function computeOverviewYAxisLabels(
  series: OverviewMainSeries,
  metric: MetricMode,
  tickCount: number,
): OverviewYAxisLabel[] {
  const extents = overviewSeriesValueExtents(series);
  if (!extents) return [];

  let { min, max } = extents;
  if (metric !== "value") {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  const { bottom, top } = overviewYAxisPriceRange(min, max);
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

function portfolioCrosshairBottomLabel(hoverTime: Time, range: PortfolioChartRange): string {
  const sec = horzTimeToUnixSeconds(hoverTime);
  if (sec == null) return "";
  return formatOverviewCrosshairBottomDate(sec, PORTFOLIO_CHART_TIME_ZONE, portfolioRangeToStockRange(range));
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const PORTFOLIO_CHART_HEIGHT_DESKTOP_PX = 320;
const PORTFOLIO_CHART_HEIGHT_MOBILE_PX = 240;
const PORTFOLIO_CHART_AXIS_ROW_DESKTOP_PX = 44;
const PORTFOLIO_CHART_AXIS_ROW_MOBILE_PX = 26;

type PortfolioOverviewChartLayout = {
  chartHeightPx: number;
  axisRowPx: number;
  plotHeightPx: number;
  yAxisLabelCount: number;
};

function resolvePortfolioOverviewChartLayout(viewportWidthPx: number): PortfolioOverviewChartLayout {
  const compact = viewportWidthPx < 640;
  const chartHeightPx = compact ? PORTFOLIO_CHART_HEIGHT_MOBILE_PX : PORTFOLIO_CHART_HEIGHT_DESKTOP_PX;
  const axisRowPx = compact ? PORTFOLIO_CHART_AXIS_ROW_MOBILE_PX : PORTFOLIO_CHART_AXIS_ROW_DESKTOP_PX;
  return {
    chartHeightPx,
    axisRowPx,
    plotHeightPx: chartHeightPx - axisRowPx,
    yAxisLabelCount: compact ? PORTFOLIO_Y_AXIS_LABEL_COUNT_MOBILE : PORTFOLIO_Y_AXIS_LABEL_COUNT_DESKTOP,
  };
}

function usePortfolioOverviewChartLayout(): PortfolioOverviewChartLayout {
  const [layout, setLayout] = useState<PortfolioOverviewChartLayout>(() =>
    typeof window !== "undefined"
      ? resolvePortfolioOverviewChartLayout(window.innerWidth)
      : resolvePortfolioOverviewChartLayout(1024),
  );

  useEffect(() => {
    const update = () => setLayout(resolvePortfolioOverviewChartLayout(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
function buildDrawdownData(
  filtered: readonly PortfolioValueHistoryPoint[],
): { time: Time; value: number }[] {
  let peak = -Infinity;
  return filtered.map((p) => {
    if (Number.isFinite(p.value) && p.value > peak) peak = p.value;
    const dd = peak > 1e-9 ? (p.value / peak - 1) * 100 : 0;
    return { time: portfolioChartTime(p) as Time, value: Math.min(0, dd) };
  });
}

/** Bottom axis — same rules as stock overview / asset portfolio (`overview-bottom-axis`). */
function syncPortfolioPeriodAxisLabels(
  chart: IChartApi,
  chartPoints: readonly StockChartPoint[],
  range: PortfolioChartRange,
  plotWidthPx: number,
): OverviewAxisLabel[] {
  if (!chartPoints.length) return [];
  // Before the pane has a real width, coordinates are unreliable — skip rather than
  // paint a stacked right-edge pile (intermittent on first load).
  if (!(plotWidthPx > 0)) return [];
  const stockRange = portfolioRangeToStockRange(range);
  const axisMode = resolveOverviewBottomAxisMode(stockRange, chartPoints);
  const raw = syncOverviewPeriodAxisLabels(
    chart,
    chartPoints,
    PORTFOLIO_CHART_TIME_ZONE,
    axisMode,
    plotWidthPx,
  );
  return thinOverlappingPeriodAxisLabels(raw, plotWidthPx);
}

/**
 * Drop labels that collapse onto the same clamped x (common while the chart is
 * still fitting on first paint — right-edge pile-ups like "JulJul").
 */
function thinOverlappingPeriodAxisLabels(
  labels: readonly OverviewAxisLabel[],
  plotWidthPx: number,
): OverviewAxisLabel[] {
  if (labels.length === 0) return [];
  if (!(plotWidthPx > 0)) return [...labels];
  const clampLeft = (x: number) =>
    Math.min(Math.max(0, x), Math.max(0, plotWidthPx - 8));
  const out: OverviewAxisLabel[] = [];
  let last = -Infinity;
  for (const lab of labels) {
    const left = clampLeft(lab.leftPx);
    if (left - last < 24) continue;
    out.push({ ...lab, leftPx: left });
    last = left;
  }
  return out;
}

/** Figma: 10×10, white fill, 2px inside stroke (buy green / sell red). */
const TRADE_DOT_PX = 10;
const TRADE_DOT_HALF = TRADE_DOT_PX / 2;
/** Larger invisible target so tooltips are easy to trigger on the 10px dot. */
const TRADE_HIT_PX = 24;
const TRADE_HIT_HALF = TRADE_HIT_PX / 2;

/** Remove default time-scale padding so the first/last points sit on the pane edges. */
function snapOverviewTimeScale(
  chart: IChartApi,
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline">,
) {
  fitSeriesLogicalRangeToPlotWidth(chart, series.data().length);
}

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
}: {
  metric: MetricMode;
  range: PortfolioChartRange;
  points: PortfolioValueHistoryPoint[];
  transactions?: readonly PortfolioTransaction[];
  showTrades?: boolean;
  /** When false, hides the main portfolio series (legend badge off). */
  showPortfolio?: boolean;
  /** When true with {@link spyPricePoints}, draws S&P 500 comparison (value or profit). */
  compareSpy?: boolean;
  /** When true with {@link nasdaqPricePoints}, draws Nasdaq comparison for the Value metric (same $ scale). */
  compareNasdaq?: boolean;
  spyPricePoints?: readonly StockChartPoint[] | null;
  nasdaqPricePoints?: readonly StockChartPoint[] | null;
  /** Open equity cost basis; scales benchmark $ path like “$X invested” on the overview Value card. */
  benchmarkInvestedUsd?: number | null;
}) {
  const chartLayout = usePortfolioOverviewChartLayout();
  const chartLayoutRef = useRef(chartLayout);
  chartLayoutRef.current = chartLayout;
  const chartThemePaintKey = useChartThemePaintKey();

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tradeOverlayRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | null>(null);
  const compareSeriesRefs = useRef<{
    spy: ISeriesApi<"Line"> | null;
    nasdaq: ISeriesApi<"Line"> | null;
  }>({ spy: null, nasdaq: null });
  const [yAxisLabels, setYAxisLabels] = useState<OverviewYAxisLabel[]>([]);
  const chartRangeRef = useRef<PortfolioChartRange>(range);
  const chartPointsRef = useRef<StockChartPoint[]>([]);
  const sessionYmdsRef = useRef<string[]>([]);
  const tradeDotsConfigRef = useRef<{
    show: boolean;
    txs: readonly PortfolioTransaction[];
    lineData: readonly { time: Time; value: number }[];
    sessionYmds: readonly string[];
  }>({ show: false, txs: [], lineData: [], sessionYmds: [] });
  const scheduleTradeDotsSyncRef = useRef<(() => void) | null>(null);
  const tradeDotHoverApiRef = useRef<TradeDotHoverApi | null>(null);
  const lineEnterCancelRef = useRef<(() => void) | null>(null);
  const lineAnimKeyRef = useRef<string>("");
  const lineEnterDoneRef = useRef(true);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    valueLabel: string;
    /** Color the metric value green/red when signed (Return, Profit, Drawdowns). */
    valueTone: "pos" | "neg" | "neutral";
  } | null>(null);
  const [periodAxisLabels, setPeriodAxisLabels] = useState<OverviewAxisLabel[]>([]);
  const periodAxisLabelsRef = useRef<OverviewAxisLabel[]>([]);
  const [axisPlotWidthPx, setAxisPlotWidthPx] = useState(0);
  const [hoverAxisLabel, setHoverAxisLabel] = useState<{ leftPx: number; label: string } | null>(
    null,
  );
  const hoverTimeRef = useRef<Time | null>(null);

  const setPeriodAxisLabelsGuarded = useCallback((next: OverviewAxisLabel[], plotWidthPx: number) => {
    setAxisPlotWidthPx(plotWidthPx);
    if (overviewAxisLabelsEqual(periodAxisLabelsRef.current, next)) return;
    periodAxisLabelsRef.current = next;
    setPeriodAxisLabels(next);
  }, []);
  const [tradeTooltip, setTradeTooltip] = useState<{
    x: number;
    y: number;
    dateLabel: string;
    lines: string[];
  } | null>(null);

  tradeDotHoverApiRef.current = {
    onEnter({ clientX, clientY, bucket, chartYmd }) {
      hoverTimeRef.current = null;
      setHoverAxisLabel(null);
      setTooltip(null);
      const box = containerRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const tw = 260;
      const { dateLabel, lines } = buildTradeDotTooltip(bucket, chartYmd, transactions);
      const th = Math.min(280, 56 + lines.length * 18);
      const pad = 8;
      let x = px + pad;
      let y = py - th - pad;
      if (x + tw > box.clientWidth - pad) x = Math.max(pad, box.clientWidth - tw - pad);
      if (x < pad) x = pad;
      if (y < pad) y = pad;
      if (y + th > chartLayoutRef.current.plotHeightPx - pad) {
        y = Math.min(chartLayoutRef.current.plotHeightPx - th - pad, py + pad);
      }
      setTradeTooltip({
        x,
        y,
        dateLabel,
        lines,
      });
    },
    onLeave() {
      setTradeTooltip(null);
    },
  };

  const drawCompareSpy =
    compareSpy && (metric === "value" || metric === "return" || metric === "profit");
  const drawCompareNasdaq = compareNasdaq && metric === "value";
  /** Create compare series with the chart so toggling S&P does not remount the portfolio series. */
  const mountSpySeries = metric === "value" || metric === "return" || metric === "profit";
  const mountNasdaqSeries = metric === "value";

  chartRangeRef.current = range;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const shouldForceEnglish = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

    const chart = createChart(el, {
      width: Math.max(2, el.clientWidth),
      height: chartLayout.plotHeightPx,
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
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
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

    const baselineOpts = {
      relativeGradient: false,
      ...baselineUpDownFillColors("bright"),
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
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
          lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: resolveFsColor("--fs-accent"),
          crosshairMarkerBackgroundColor: chartMarkerDiscFillColor(),
          crosshairMarkerBorderWidth: 2,
        });
        })()
      : chart.addSeries(BaselineSeries, {
          ...baselineOpts,
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
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
      crosshairMarkerVisible: false,
      priceScaleId: "right",
      lastValueVisible: true,
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

    chartRef.current = chart;
    seriesRef.current = series;

    scheduleTradeDotsSyncRef.current = () => {
      const c = chartRef.current;
      const s = seriesRef.current;
      const overlay = tradeOverlayRef.current;
      if (!c || !s || !overlay) return;
      const cfg = tradeDotsConfigRef.current;
      syncPortfolioTradeDotsOverlay(
        c,
        s,
        overlay,
        cfg.show,
        cfg.txs,
        cfg.lineData,
        cfg.sessionYmds,
        tradeDotHoverApiRef,
      );
    };

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
        setHoverAxisLabel(null);
        setTooltip(null);
        return;
      }

      const data = param.seriesData.get(s);
      if (
        !data ||
        typeof data !== "object" ||
        !("value" in data) ||
        !isFiniteNumber((data as { value: number }).value)
      ) {
        hoverTimeRef.current = null;
        setHoverAxisLabel(null);
        setTooltip(null);
        return;
      }

      setTradeTooltip(null);

      const hoverTime = param.time as Time;
      hoverTimeRef.current = hoverTime;
      setHoverAxisLabel({
        leftPx: param.point.x,
        label: portfolioCrosshairBottomLabel(hoverTime, chartRangeRef.current),
      });

      const raw = (data as { value: number }).value;
      const valueLabel =
        isPercentMetric(metric) ?
          formatReturnPctAxis(raw)
        : metric === "profit" ?
          `${raw >= 0 ? "+" : "−"}${TOOLTIP_USD.format(Math.abs(raw))}`
        : TOOLTIP_USD.format(raw);
      const valueTone =
        isPercentMetric(metric) || metric === "profit" ?
          raw > 0 ?
            "pos"
          : raw < 0 ?
            "neg"
          : "neutral"
        : "neutral";

      const tw = 168;
      const th = 40;
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
        x,
        y,
        valueLabel,
        valueTone,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: Math.max(2, wrapRef.current.clientWidth) });
      const s = seriesRef.current;
      if (s && s.data().length > 0) {
        snapOverviewTimeScale(chartRef.current, s);
        setYAxisLabels(syncOverviewYAxisLabels(s, metric, chartLayoutRef.current.yAxisLabelCount));
      }
      requestAnimationFrame(() => {
        scheduleTradeDotsSyncRef.current?.();
        const c = chartRef.current;
        const s = seriesRef.current;
        if (!c || !s || s.data().length === 0) return;
        const plotWidthPx = Math.max(0, wrapRef.current?.clientWidth ?? 0);
        const hoverTime = hoverTimeRef.current;
        if (hoverTime != null) {
          const x = c.timeScale().timeToCoordinate(hoverTime);
          if (x != null && Number.isFinite(x)) {
            setHoverAxisLabel({
              leftPx: x,
              label: portfolioCrosshairBottomLabel(hoverTime, chartRangeRef.current),
            });
          }
        } else {
          setPeriodAxisLabelsGuarded(
            syncPortfolioPeriodAxisLabels(
              c,
              chartPointsRef.current,
              chartRangeRef.current,
              plotWidthPx,
            ),
            plotWidthPx,
          );
        }
      });
    });
    ro.observe(el);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => scheduleTradeDotsSyncRef.current?.());
    });

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      ro.disconnect();
      lineEnterCancelRef.current?.();
      lineEnterCancelRef.current = null;
      lineEnterDoneRef.current = true;
      lineAnimKeyRef.current = "";
      applyOverviewLineRevealClip(wrapRef.current, 1);
      setYAxisLabels([]);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      compareSeriesRefs.current = { spy: null, nasdaq: null };
      scheduleTradeDotsSyncRef.current = null;
      tradeOverlayRef.current?.replaceChildren();
      hoverTimeRef.current = null;
      setTooltip(null);
      setTradeTooltip(null);
      setHoverAxisLabel(null);
      periodAxisLabelsRef.current = [];
      setPeriodAxisLabels([]);
      setAxisPlotWidthPx(0);
      setYAxisLabels([]);
    };
  }, [metric, chartLayout.plotHeightPx, setPeriodAxisLabelsGuarded, chartThemePaintKey]);

  useEffect(() => {
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

    if (data.length === 0) {
      lineEnterCancelRef.current?.();
      lineEnterCancelRef.current = null;
      lineEnterDoneRef.current = true;
      lineAnimKeyRef.current = "";
      applyOverviewLineRevealClip(wrapRef.current, 1);
      series.setData([]);
      sessionYmdsRef.current = [];
      chartPointsRef.current = [];
      tradeDotsConfigRef.current = { show: showTrades, txs: transactions, lineData: [], sessionYmds: [] };
      scheduleTradeDotsSyncRef.current?.();
      compareSeriesRefs.current.spy?.setData([]);
      compareSeriesRefs.current.nasdaq?.setData([]);
      setYAxisLabels([]);
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

    series.setData(data);

    tradeDotsConfigRef.current = { show: showTrades, txs: transactions, lineData: data, sessionYmds };

    const applyBenchmarkSeries = (
      series: ISeriesApi<"Line"> | null,
      enabled: boolean,
      rawPoints: readonly StockChartPoint[] | null | undefined,
    ) => {
      if (series && enabled) {
        const data =
          metric === "return" ?
            buildBenchmarkReturnLineData(filtered, rawPoints ?? undefined)
          : buildBenchmarkCompareLineData(
              filtered,
              rawPoints ?? undefined,
              benchmarkInvestedUsd,
              metric === "profit" ? "profit" : "value",
              transactions,
            );
        series.setData(data);
      } else if (series) {
        series.setData([]);
      }
    };

    applyBenchmarkSeries(compareSeriesRefs.current.spy, drawCompareSpy, spyPricePoints);
    applyBenchmarkSeries(compareSeriesRefs.current.nasdaq, drawCompareNasdaq, nasdaqPricePoints);

    series.applyOptions({ visible: showPortfolio });
    compareSeriesRefs.current.spy?.applyOptions({ visible: drawCompareSpy });
    compareSeriesRefs.current.nasdaq?.applyOptions({ visible: drawCompareNasdaq });

    snapOverviewTimeScale(chart, series);

    const lineAnimKey = `${metric}:${range}:${data.length}:${String(data[0]?.time ?? "")}:${String(data.at(-1)?.time ?? "")}`;
    const shouldAnimateLine =
      data.length >= 2 && !prefersReducedFundamentalsBarMotion();

    let deferTradeDots = false;
    if (shouldAnimateLine && lineAnimKey !== lineAnimKeyRef.current) {
      lineAnimKeyRef.current = lineAnimKey;
      lineEnterCancelRef.current?.();
      lineEnterDoneRef.current = false;
      deferTradeDots = true;
      tradeOverlayRef.current?.replaceChildren();
      applyOverviewLineRevealClip(wrapRef.current, 0);
      lineEnterCancelRef.current = runFundamentalsBarEnterAnimation({
        periodCount: 1,
        onFrame: (elapsedMs) => {
          applyOverviewLineRevealClip(
            wrapRef.current,
            fundamentalsBarEnterProgress(0, 1, elapsedMs),
          );
        },
        onComplete: () => {
          lineEnterDoneRef.current = true;
          applyOverviewLineRevealClip(wrapRef.current, 1);
          lineEnterCancelRef.current = null;
          scheduleTradeDotsSyncRef.current?.();
        },
      });
    } else if (shouldAnimateLine && !lineEnterDoneRef.current && lineEnterCancelRef.current) {
      // Enter animation still running from this effect’s prior frame.
      deferTradeDots = true;
    } else {
      // No live enter animation (or it was aborted) — never leave the plot clipped.
      lineEnterCancelRef.current?.();
      lineEnterCancelRef.current = null;
      lineEnterDoneRef.current = true;
      applyOverviewLineRevealClip(wrapRef.current, 1);
    }

    let axisSyncCancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (axisSyncCancelled) return;
        const c = chartRef.current;
        const s = seriesRef.current;
        if (!c || !s || c !== chart || s !== series || s.data().length === 0) return;
        setYAxisLabels(syncOverviewYAxisLabels(s, metric, chartLayoutRef.current.yAxisLabelCount));
        if (!deferTradeDots) scheduleTradeDotsSyncRef.current?.();
        const plotWidthPx = Math.max(0, wrapRef.current?.clientWidth ?? 0);
        const hoverTime = hoverTimeRef.current;
        if (hoverTime != null) {
          const x = c.timeScale().timeToCoordinate(hoverTime);
          if (x != null && Number.isFinite(x)) {
            setHoverAxisLabel({
              leftPx: x,
              label: portfolioCrosshairBottomLabel(hoverTime, range),
            });
          }
        } else {
          setPeriodAxisLabelsGuarded(
            syncPortfolioPeriodAxisLabels(c, chartPointsRef.current, range, plotWidthPx),
            plotWidthPx,
          );
        }
      });
    });
    return () => {
      axisSyncCancelled = true;
      lineEnterCancelRef.current?.();
      lineEnterCancelRef.current = null;
      // Aborting mid-reveal must not leave `clip-path` hiding the series.
      lineEnterDoneRef.current = true;
      lineAnimKeyRef.current = "";
      applyOverviewLineRevealClip(wrapRef.current, 1);
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
    setPeriodAxisLabelsGuarded,
  ]);

  const metricTitle =
    metric === "value" ? "Value"
    : metric === "profit" ? "Total profit"
    : metric === "drawdown" ? "Drawdown"
    : "Return";

  return (
    <div
      ref={containerRef}
      className="relative flex w-full min-w-0 flex-col"
      style={{ height: chartLayout.chartHeightPx }}
      onMouseLeave={() => {
        hoverTimeRef.current = null;
        setTooltip(null);
        setTradeTooltip(null);
        setHoverAxisLabel(null);
        const c = chartRef.current;
        const s = seriesRef.current;
        if (c && s && s.data().length > 0) {
          const plotWidthPx = Math.max(0, wrapRef.current?.clientWidth ?? 0);
          setPeriodAxisLabelsGuarded(
            syncPortfolioPeriodAxisLabels(
              c,
              chartPointsRef.current,
              chartRangeRef.current,
              plotWidthPx,
            ),
            plotWidthPx,
          );
        }
      }}
    >
      <div className="relative min-h-0 min-w-0 flex-1">
        <div className={cn("pointer-events-none absolute inset-0 z-0", CHART_PLOT_BACKGROUND_CLASS)} aria-hidden>
          <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
        </div>
        <div ref={wrapRef} className="relative z-10 h-full w-full min-w-0" />
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
                  "absolute right-0 block -translate-y-1/2 rounded-sm px-0.5 py-px",
                  CHART_PLOT_BACKGROUND_LABEL_CLASS,
                )}
                style={{ top: `${lab.topPct}%` }}
              >
                {lab.label}
              </span>
            ))}
          </div>
        </div>
        <div ref={tradeOverlayRef} className="pointer-events-none absolute inset-0 z-[15]" />
        {tooltip ? (
          <div
            className={cn(
              "pointer-events-none absolute z-10 min-w-[148px] px-3 py-2",
              tooltipSurfaceClassName,
            )}
            style={{ left: tooltip.x, top: tooltip.y }}
            role="status"
          >
            <p className="text-xs font-semibold tabular-nums text-fg">
              {metricTitle}:{" "}
              <span
                className={
                  tooltip.valueTone === "pos" ?
                    "text-up"
                  : tooltip.valueTone === "neg" ?
                    "text-down"
                  : "text-fg"
                }
              >
                {tooltip.valueLabel}
              </span>
            </p>
          </div>
        ) : null}
        {tradeTooltip ? (
          <div
            className={cn(
              "pointer-events-none absolute z-[15] max-w-[min(calc(100vw-2rem),260px)] px-3 py-2",
              tooltipSurfaceClassName,
            )}
            style={{ left: tradeTooltip.x, top: tradeTooltip.y }}
            role="tooltip"
          >
            <p className="text-[11px] leading-4 text-fg-muted">{tradeTooltip.dateLabel}</p>
            <div className="mt-1.5 space-y-0.5 text-xs leading-snug text-fg">
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
          </div>
        ) : null}
      </div>
      <div
        className="relative w-full shrink-0 overflow-visible"
        style={{ height: chartLayout.axisRowPx }}
        aria-hidden={periodAxisLabels.length === 0 && !hoverAxisLabel}
      >
        {hoverAxisLabel ?
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
                "absolute bottom-1 inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-fg-muted sm:text-[12px]",
                periodAxisLabelMaxWidthClass(anchor),
                periodAxisLabelTransformClass(anchor),
              )}
              style={periodAxisLabelLayoutStyle(lab.leftPx, anchor, axisPlotWidthPx)}
            >
              {lab.label}
            </span>
            );
          })
        }
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
  const [metric, setMetric] = useState<PortfolioChartMetricMode>("value");
  const [range, setRange] = useState<PortfolioChartRange>("ytd");
  const [points, setPoints] = useState<PortfolioValueHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const [showTrades, setShowTrades] = useState(false);
  const [compareSpy, setCompareSpy] = useState(false);
  const [compareNasdaq, setCompareNasdaq] = useState(false);
  const [spyPoints, setSpyPoints] = useState<StockChartPoint[] | null>(null);
  const [nasdaqPoints, setNasdaqPoints] = useState<StockChartPoint[] | null>(null);

  const canLoad = transactions.length > 0;
  const benchmarkCompareDisabled = metric !== "value" && metric !== "return";
  const nasdaqCompareDisabled = metric !== "value";
  const chartSettingsProps = {
    showTrades,
    onShowTradesChange: setShowTrades,
    compareSpy,
    onCompareSpyChange: setCompareSpy,
    compareNasdaq,
    onCompareNasdaqChange: setCompareNasdaq,
    benchmarkCompareDisabled,
    nasdaqCompareDisabled,
  } as const;

  const load = useCallback(async () => {
    if (!canLoad) {
      setPoints([]);
      return;
    }
    setLoading(true);
    setError(null);
    const gen = ++loadGenRef.current;
    try {
      const res = await fetch("/api/portfolio/value-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ range, transactions }),
      });
      if (!res.ok) {
        throw new Error("Failed to load chart");
      }
      const json = (await res.json()) as { points?: PortfolioValueHistoryPoint[] };
      if (gen !== loadGenRef.current) return;
      setPoints(Array.isArray(json.points) ? json.points : []);
    } catch {
      if (gen !== loadGenRef.current) return;
      setError("Could not load history");
      // Keep prior points on failure — avoid wiping a good chart on transient errors.
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [canLoad, range, transactions]);

  useEffect(() => {
    void load();
  }, [load]);

  const fetchSpy = compareSpy && (metric === "value" || metric === "return") && canLoad;
  const fetchNasdaq = compareNasdaq && metric === "value" && canLoad;
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
    <section className="mb-6 w-full min-w-0 max-md:mb-4">
      {/* Web/desktop controls row. */}
      <div className="relative z-20 mb-5 hidden w-full min-w-0 flex-wrap items-center justify-between gap-3 sm:flex">
        <div className="flex min-w-0 items-center gap-3">
          <SegmentedControl
            options={PORTFOLIO_CHART_METRIC_SEGMENTS}
            value={metric}
            onChange={setMetric}
            aria-label="Chart metric"
          />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-3">
          <PortfolioChartSettingsButton {...chartSettingsProps} />

          <SegmentedControl
            options={PORTFOLIO_CHART_RANGE_LABELS}
            value={range}
            onChange={setRange}
            aria-label="Chart range"
          />
        </div>
      </div>

      <div className="relative z-20 mb-3 mt-2 flex w-full min-w-0 max-w-full items-center justify-between gap-2 sm:hidden">
        <FormListboxSelect
          compact
          fitTrigger
          truncateLabel={false}
          aria-label="Chart metric"
          triggerClassName={PORTFOLIO_CHART_MOBILE_METRIC_TRIGGER_CLASS}
          options={PORTFOLIO_CHART_METRIC_OPTIONS}
          value={metric}
          onChange={(v) => setMetric(v as PortfolioChartMetricMode)}
        />
        <PortfolioChartSettingsButton {...chartSettingsProps} />
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
        ) : loading ? (
          <div className="relative h-[240px] sm:h-[320px]">
            <AssetChartSkeleton fill />
          </div>
        ) : error ? (
          <div className="flex h-[240px] flex-col items-center justify-center px-6 sm:h-[320px]">
            <p className="text-sm text-fg-muted">{error}</p>
          </div>
        ) : points.length === 0 ? (
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
        ) : (
          <PortfolioValueHistoryChartPane
            metric={metric}
            range={range}
            points={points}
            transactions={transactions}
            showTrades={showTrades}
            compareSpy={compareSpy}
            compareNasdaq={compareNasdaq}
            spyPricePoints={spyPoints}
            nasdaqPricePoints={nasdaqPoints}
            benchmarkInvestedUsd={benchmarkInvestedUsd}
          />
        )}
      </div>

      <div className="relative z-20 mt-3 w-full sm:hidden">
        <SegmentedControl
          options={PORTFOLIO_CHART_RANGE_LABELS}
          value={range}
          onChange={setRange}
          fullWidth
          aria-label="Chart range"
        />
      </div>
    </section>
  );
}

export const PortfolioOverviewChart = memo(PortfolioOverviewChartInner);
