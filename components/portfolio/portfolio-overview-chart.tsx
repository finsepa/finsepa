"use client";

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
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { LineChart, Settings } from "@/lib/icons";

import { baselineRelativeGradientEnabled } from "@/lib/chart/baseline-relative-gradient";

import { horzTimeToUnixSeconds } from "@/components/chart/chart-selection-utils";
import {
  CHART_PLOT_DOTS_PATTERN_CLASS,
  formatOverviewCrosshairBottomDate,
  resolveOverviewBottomAxisMode,
  syncOverviewPeriodAxisLabels,
  type OverviewAxisLabel,
} from "@/components/chart/overview-bottom-axis";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
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
import { cn } from "@/lib/utils";
import type {
  PortfolioChartRange,
  PortfolioValueHistoryPoint,
} from "@/lib/portfolio/portfolio-chart-types";

const VALUE_BLUE = "#2563EB";
const GREEN = "#16A34A";
const RED = "#DC2626";
const BENCHMARK_SPY_LINE = "#EA580C";
const BENCHMARK_NASDAQ_LINE = "#9333EA";
const PORTFOLIO_CHART_TIME_ZONE = "America/New_York";
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

type OverviewMainSeries = ISeriesApi<"Area"> | ISeriesApi<"Baseline">;

const BENCHMARK_COMPARE_DISABLED_HINT = "Switch to Value to compare portfolio net worth with an index.";

async function fetchBenchmarkChartPoints(
  ticker: string,
  range: PortfolioChartRange,
  signal: AbortSignal,
): Promise<StockChartPoint[] | null> {
  const stockRange = portfolioRangeToStockRange(range);
  const res = await fetch(
    `/api/stocks/${encodeURIComponent(ticker)}/chart?range=${stockRange}&series=price`,
    { credentials: "include", signal },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { points?: StockChartPoint[] };
  return Array.isArray(json.points) ? json.points : null;
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
 * Dollar path if starting capital had tracked the benchmark (Value metric only).
 * Uses {@link equityCostBasisInvestedUsd} when set (same basis as “$X invested” under Total value);
 * otherwise falls back to portfolio value at the first in-range point with positive net worth.
 */
function buildBenchmarkValueLineData(
  filtered: readonly PortfolioValueHistoryPoint[],
  rawSpy: readonly StockChartPoint[] | null | undefined,
  equityCostBasisInvestedUsd: number | null | undefined,
): { time: Time; value: number }[] {
  if (!rawSpy?.length || filtered.length === 0) return [];
  const spy = spySortedByTime(rawSpy);
  const rows: { t: string; spy: number; v: number }[] = [];
  for (const p of filtered) {
    const s = spyCloseOnOrBefore(spy, p.t);
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
    const s = spyCloseOnOrBefore(spy, p.t);
    if (s == null || !Number.isFinite(s) || s <= 0) continue;
    out.push({
      time: p.time != null && Number.isFinite(p.time) ? (p.time as Time) : (p.t as Time),
      value: s * (notional0 / spy0),
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
    const border = netCash <= 0 ? GREEN : RED;

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
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
        pressed ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
          pressed ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

const PORTFOLIO_CHART_SETTINGS_MENU_Z = 120;

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
}: {
  showTrades: boolean;
  onShowTradesChange: (next: boolean) => void;
  compareSpy: boolean;
  onCompareSpyChange: (next: boolean) => void;
  compareNasdaq: boolean;
  onCompareNasdaqChange: (next: boolean) => void;
  benchmarkCompareDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    setPortalMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuAnchor(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuAnchor({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.min(window.innerWidth - 32, 280),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const menuPanel =
    open && menuAnchor && portalMounted ?
      createPortal(
        <div
          ref={menuRef}
          className={dropdownMenuPanelClassName("fixed")}
          style={{
            top: menuAnchor.top,
            left: menuAnchor.left,
            width: menuAnchor.width,
            zIndex: PORTFOLIO_CHART_SETTINGS_MENU_Z,
          }}
          role="menu"
          aria-label="Chart settings"
        >
          {PORTFOLIO_CHART_SETTINGS_ROWS.map(({ key, label, ariaLabel }) => {
            const benchmarkRow = key === "compareSpy" || key === "compareNasdaq";
            return (
              <div key={key} role="menuitem" className={dropdownMenuPlainItemRowClassName()}>
                <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-[#09090B]">{label}</span>
                <PillSwitch
                  pressed={values[key]}
                  onPressedChange={(next) => onChangeForKey(key, next)}
                  disabled={benchmarkRow && benchmarkCompareDisabled}
                  title={benchmarkRow && benchmarkCompareDisabled ? BENCHMARK_COMPARE_DISABLED_HINT : undefined}
                  aria-label={ariaLabel}
                />
              </div>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {menuPanel}
      <div className="relative z-20 shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-label="Chart settings"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B]",
            "shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100",
            "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
            open && "bg-[#F4F4F5]",
          )}
        >
          <Settings className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </>
  );
}

export type PortfolioChartMetricMode = "value" | "profit" | "return";

type MetricMode = PortfolioChartMetricMode;

const PORTFOLIO_CHART_METRIC_OPTIONS: readonly ListboxOption<PortfolioChartMetricMode>[] = [
  { value: "value", label: "Value" },
  { value: "profit", label: "Total profit" },
  { value: "return", label: "Return" },
];

/** Equity return % (same units as overview “Total profit” ATH line). */
function formatReturnPctAxis(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

export const PORTFOLIO_CHART_RANGE_LABELS: { id: PortfolioChartRange; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "7d", label: "7D" },
  { id: "1m", label: "1M" },
  { id: "6m", label: "6M" },
  { id: "ytd", label: "YTD" },
  { id: "1y", label: "1Y" },
  { id: "5y", label: "5Y" },
  { id: "all", label: "ALL" },
];

/** One-decimal truncation (e.g. 7616 → 7.6) so axis + last-price badge stay distinct. */
function truncOneDecimalUnit(abs: number, unit: number): string {
  const u = abs / unit;
  const t = Math.trunc(u * 10) / 10;
  if (Number.isInteger(t)) return String(t);
  return t.toFixed(1);
}

function removeYAxisTickLabels(series: OverviewMainSeries | null, ticksRef: RefObject<IPriceLine[]>) {
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

/** Plot pane height when LW pane metrics are not ready (276px plot × scaleMargins 12%/8%). */
const OVERVIEW_PANE_HEIGHT_FALLBACK_PX = Math.round((320 - 44) * 0.8);

function overviewChartPaneHeight(chart: IChartApi): number | null {
  try {
    const size = chart.paneSize(0);
    if (size && Number.isFinite(size.height) && size.height > 0) return size.height;
  } catch {
    /* chart removed or pane not laid out yet */
  }
  return OVERVIEW_PANE_HEIGHT_FALLBACK_PX > 0 ? OVERVIEW_PANE_HEIGHT_FALLBACK_PX : null;
}

function seriesPriceAtCoordinate(series: OverviewMainSeries, y: number): number | null {
  try {
    const p = series.coordinateToPrice(y);
    if (p == null || !Number.isFinite(p as number)) return null;
    return p as number;
  } catch {
    return null;
  }
}

/** Six evenly spaced right-axis labels (no inner grid lines). */
function syncYAxisTickLabels(
  chart: IChartApi,
  series: OverviewMainSeries,
  ticksRef: RefObject<IPriceLine[]>,
  tickCount: number = Y_AXIS_LABEL_COUNT,
) {
  const h = overviewChartPaneHeight(chart);
  if (h == null || tickCount < 2) {
    removeYAxisTickLabels(series, ticksRef);
    return;
  }

  const topPrice = seriesPriceAtCoordinate(series, 0);
  const bottomPrice = seriesPriceAtCoordinate(series, h);
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

function syncOverviewChartYAxis(
  chart: IChartApi,
  series: OverviewMainSeries,
  yAxisTickLinesRef: RefObject<IPriceLine[]>,
) {
  if (series.data().length === 0) return;
  try {
    syncYAxisTickLabels(chart, series, yAxisTickLinesRef);
  } catch {
    /* pane/scale not ready or chart torn down */
  }
}

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

const CHART_HEIGHT = 320;
/** Plot height; dates render in a custom row below (hidden while crosshair hover). */
const PORTFOLIO_CHART_AXIS_ROW_PX = 44;
const PORTFOLIO_CHART_PLOT_HEIGHT_PX = CHART_HEIGHT - PORTFOLIO_CHART_AXIS_ROW_PX;

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

/** Bottom axis — same rules as stock overview / asset portfolio (`overview-bottom-axis`). */
function syncPortfolioPeriodAxisLabels(
  chart: IChartApi,
  chartPoints: readonly StockChartPoint[],
  range: PortfolioChartRange,
  plotWidthPx: number,
): OverviewAxisLabel[] {
  if (!chartPoints.length) return [];
  const stockRange = portfolioRangeToStockRange(range);
  const axisMode = resolveOverviewBottomAxisMode(stockRange, chartPoints);
  return syncOverviewPeriodAxisLabels(
    chart,
    chartPoints,
    PORTFOLIO_CHART_TIME_ZONE,
    axisMode,
    plotWidthPx,
  );
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
  const d = series.data();
  const n = d.length;
  if (n === 0) return;
  chart.timeScale().fitContent();
  requestAnimationFrame(() => {
    chart.timeScale().setVisibleLogicalRange({
      from: 0,
      to: Math.max(0, n - 1),
    });
  });
}

/** Shared chart body for portfolio value history (Overview + Performance). */
export function PortfolioValueHistoryChartPane({
  metric,
  range,
  points,
  transactions = [],
  showTrades = false,
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
  /** When true with {@link spyPricePoints}, draws S&P 500 comparison for the Value metric (same $ scale). */
  compareSpy?: boolean;
  /** When true with {@link nasdaqPricePoints}, draws Nasdaq comparison for the Value metric (same $ scale). */
  compareNasdaq?: boolean;
  spyPricePoints?: readonly StockChartPoint[] | null;
  nasdaqPricePoints?: readonly StockChartPoint[] | null;
  /** Open equity cost basis; scales benchmark $ path like “$X invested” on the overview Value card. */
  benchmarkInvestedUsd?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tradeOverlayRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | null>(null);
  const compareSeriesRefs = useRef<{
    spy: ISeriesApi<"Line"> | null;
    nasdaq: ISeriesApi<"Line"> | null;
  }>({ spy: null, nasdaq: null });
  const yAxisTickLinesRef = useRef<IPriceLine[]>([]);
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
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    valueLabel: string;
  } | null>(null);
  const [periodAxisLabels, setPeriodAxisLabels] = useState<OverviewAxisLabel[]>([]);
  const [hoverAxisLabel, setHoverAxisLabel] = useState<{ leftPx: number; label: string } | null>(
    null,
  );
  const hoverTimeRef = useRef<Time | null>(null);
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
      if (y + th > PORTFOLIO_CHART_PLOT_HEIGHT_PX - pad) {
        y = Math.min(PORTFOLIO_CHART_PLOT_HEIGHT_PX - th - pad, py + pad);
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

  const drawCompareSpy = compareSpy && metric === "value";
  const drawCompareNasdaq = compareNasdaq && metric === "value";

  chartRangeRef.current = range;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const shouldForceEnglish = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

    const chart = createChart(el, {
      width: Math.max(2, el.clientWidth),
      height: PORTFOLIO_CHART_PLOT_HEIGHT_PX,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: "#71717A",
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
      localization: {
        tickmarksPriceFormatter: HIDE_NATIVE_Y_AXIS_TICK_LABELS,
        ...(shouldForceEnglish ?
          // Force English month/day labels on mobile time axis (avoid device-locale like ru-RU).
          { locale: "en-US" }
        : {}),
        priceFormatter: (p: number) =>
          metric === "return" ? formatReturnPctAxis(p) : formatAxisUsd(p),
      },
      handleScroll: false,
      handleScale: false,
    });

    const baselineOpts = {
      relativeGradient: false,
      topFillColor1: "rgba(22, 163, 74, 0.22)",
      topFillColor2: "rgba(22, 163, 74, 0.04)",
      topLineColor: GREEN,
      bottomFillColor1: "rgba(220, 38, 38, 0.04)",
      bottomFillColor2: "rgba(220, 38, 38, 0.18)",
      bottomLineColor: RED,
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
      crosshairMarkerBackgroundColor: "",
      crosshairMarkerBorderWidth: 2,
    } as const;

    const series =
      metric === "value" ?
        chart.addSeries(AreaSeries, {
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
          ...baselineOpts,
          baseValue: { type: "price" as const, price: 0 },
        });

    const compareLineOpts = {
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
      crosshairMarkerVisible: false,
      priceScaleId: "right",
    } as const;

    if (drawCompareSpy) {
      compareSeriesRefs.current.spy = chart.addSeries(LineSeries, {
        ...compareLineOpts,
        color: BENCHMARK_SPY_LINE,
      });
    } else {
      compareSeriesRefs.current.spy = null;
    }

    if (drawCompareNasdaq) {
      compareSeriesRefs.current.nasdaq = chart.addSeries(LineSeries, {
        ...compareLineOpts,
        color: BENCHMARK_NASDAQ_LINE,
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
        metric === "return" ?
          formatReturnPctAxis(raw)
        : metric === "profit" ?
          `${raw >= 0 ? "+" : "−"}${TOOLTIP_USD.format(Math.abs(raw))}`
        : TOOLTIP_USD.format(raw);

      const tw = 168;
      const th = 40;
      const pad = 8;
      let x = param.point.x + pad;
      let y = param.point.y - th - pad;
      if (x + tw > box.clientWidth - pad) x = box.clientWidth - tw - pad;
      if (x < pad) x = pad;
      if (y < pad) y = pad;
      if (y + th > PORTFOLIO_CHART_PLOT_HEIGHT_PX - pad) {
        y = Math.min(PORTFOLIO_CHART_PLOT_HEIGHT_PX - th - pad, param.point.y + pad);
      }

      setTooltip({
        x,
        y,
        valueLabel,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: Math.max(2, wrapRef.current.clientWidth) });
      const s = seriesRef.current;
      if (s && s.data().length > 0) {
        snapOverviewTimeScale(chartRef.current, s);
        syncOverviewChartYAxis(chartRef.current, s, yAxisTickLinesRef);
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
          setPeriodAxisLabels(
            syncPortfolioPeriodAxisLabels(
              c,
              chartPointsRef.current,
              chartRangeRef.current,
              plotWidthPx,
            ),
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
      removeYAxisTickLabels(seriesRef.current, yAxisTickLinesRef);
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
      setPeriodAxisLabels([]);
    };
  }, [metric, compareSpy, compareNasdaq]);

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

    const data = filtered.map((p) => {
      let y: number;
      if (metric === "value") y = p.value;
      else if (metric === "profit") y = p.profit;
      else y = p.returnPct!;
      return { time: portfolioChartTime(p) as Time, value: y };
    });

    if (data.length === 0) {
      series.setData([]);
      sessionYmdsRef.current = [];
      chartPointsRef.current = [];
      tradeDotsConfigRef.current = { show: showTrades, txs: transactions, lineData: [], sessionYmds: [] };
      scheduleTradeDotsSyncRef.current?.();
      compareSeriesRefs.current.spy?.setData([]);
      compareSeriesRefs.current.nasdaq?.setData([]);
      removeYAxisTickLabels(series, yAxisTickLinesRef);
      setPeriodAxisLabels([]);
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
        series.setData(
          buildBenchmarkValueLineData(filtered, rawPoints ?? undefined, benchmarkInvestedUsd),
        );
      } else if (series) {
        series.setData([]);
      }
    };

    applyBenchmarkSeries(compareSeriesRefs.current.spy, drawCompareSpy, spyPricePoints);
    applyBenchmarkSeries(compareSeriesRefs.current.nasdaq, drawCompareNasdaq, nasdaqPricePoints);

    snapOverviewTimeScale(chart, series);
    let axisSyncCancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (axisSyncCancelled) return;
        const c = chartRef.current;
        const s = seriesRef.current;
        if (!c || !s || c !== chart || s !== series || s.data().length === 0) return;
        syncOverviewChartYAxis(c, s, yAxisTickLinesRef);
        scheduleTradeDotsSyncRef.current?.();
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
          setPeriodAxisLabels(syncPortfolioPeriodAxisLabels(c, chartPointsRef.current, range, plotWidthPx));
        }
      });
    });
    return () => {
      axisSyncCancelled = true;
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
  ]);

  const metricTitle =
    metric === "value" ? "Value" : metric === "profit" ? "Total profit" : "Return";

  return (
    <div
      ref={containerRef}
      className="relative flex h-[320px] w-full min-w-0 flex-col"
      onMouseLeave={() => {
        hoverTimeRef.current = null;
        setTooltip(null);
        setTradeTooltip(null);
        setHoverAxisLabel(null);
        const c = chartRef.current;
        const s = seriesRef.current;
        if (c && s && s.data().length > 0) {
          setPeriodAxisLabels(
            syncPortfolioPeriodAxisLabels(
              c,
              chartPointsRef.current,
              chartRangeRef.current,
              Math.max(0, wrapRef.current?.clientWidth ?? 0),
            ),
          );
        }
      }}
    >
      <div className="relative min-h-0 min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-0 z-0 bg-white" aria-hidden>
          <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
        </div>
        <div ref={wrapRef} className="relative z-10 h-full w-full min-w-0" />
        <div ref={tradeOverlayRef} className="pointer-events-none absolute inset-0 z-[15]" />
        {tooltip ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[148px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
            style={{ left: tooltip.x, top: tooltip.y }}
            role="status"
          >
            <p className="text-xs font-semibold tabular-nums text-[#09090B]">
              {metricTitle}: {tooltip.valueLabel}
            </p>
          </div>
        ) : null}
        {tradeTooltip ? (
          <div
            className="pointer-events-none absolute z-[15] max-w-[min(calc(100vw-2rem),260px)] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
            style={{ left: tradeTooltip.x, top: tradeTooltip.y }}
            role="tooltip"
          >
            <p className="text-[11px] leading-4 text-[#71717A]">{tradeTooltip.dateLabel}</p>
            <div className="mt-1.5 space-y-0.5 text-xs leading-snug text-[#09090B]">
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
                        "font-semibold text-[#09090B]"
                      : isTxDate ?
                        "pt-1.5 text-[11px] font-medium text-[#71717A]"
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
        style={{ height: PORTFOLIO_CHART_AXIS_ROW_PX }}
        aria-hidden={periodAxisLabels.length === 0 && !hoverAxisLabel}
      >
        {hoverAxisLabel ?
          <span
            className="absolute bottom-1 inline-block max-w-[calc(100%-16px)] -translate-x-1/2 truncate whitespace-nowrap font-['Inter'] text-[11px] font-medium tabular-nums leading-none text-[#09090B] sm:text-[12px]"
            style={{ left: `clamp(8px, ${hoverAxisLabel.leftPx}px, calc(100% - 8px))` }}
          >
            {hoverAxisLabel.label}
          </span>
        : periodAxisLabels.map((lab) => (
            <span
              key={lab.key}
              className="absolute bottom-1 inline-block max-w-[72px] -translate-x-1/2 truncate whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
              style={{ left: `clamp(8px, ${lab.leftPx}px, calc(100% - 8px))` }}
            >
              {lab.label}
            </span>
          ))
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
  const [range, setRange] = useState<PortfolioChartRange>("all");
  const [points, setPoints] = useState<PortfolioValueHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState(false);
  const [compareSpy, setCompareSpy] = useState(false);
  const [compareNasdaq, setCompareNasdaq] = useState(false);
  const [spyPoints, setSpyPoints] = useState<StockChartPoint[] | null>(null);
  const [nasdaqPoints, setNasdaqPoints] = useState<StockChartPoint[] | null>(null);

  const canLoad = transactions.length > 0;
  const benchmarkCompareDisabled = metric !== "value";
  const chartSettingsProps = {
    showTrades,
    onShowTradesChange: setShowTrades,
    compareSpy,
    onCompareSpyChange: setCompareSpy,
    compareNasdaq,
    onCompareNasdaqChange: setCompareNasdaq,
    benchmarkCompareDisabled,
  } as const;

  const load = useCallback(async () => {
    if (!canLoad) {
      setPoints([]);
      return;
    }
    setLoading(true);
    setError(null);
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
      setPoints(Array.isArray(json.points) ? json.points : []);
    } catch {
      setError("Could not load history");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [canLoad, range, transactions]);

  useEffect(() => {
    void load();
  }, [load]);

  const fetchSpy = compareSpy && metric === "value" && canLoad;
  const fetchNasdaq = compareNasdaq && metric === "value" && canLoad;

  useEffect(() => {
    if (!fetchSpy) {
      setSpyPoints(null);
      return;
    }
    const ac = new AbortController();
    void fetchBenchmarkChartPoints("SPY", range, ac.signal)
      .then(setSpyPoints)
      .catch(() => {
        if (!ac.signal.aborted) setSpyPoints(null);
      });
    return () => ac.abort();
  }, [fetchSpy, range, canLoad]);

  useEffect(() => {
    if (!fetchNasdaq) {
      setNasdaqPoints(null);
      return;
    }
    const ac = new AbortController();
    void fetchBenchmarkChartPoints("QQQ", range, ac.signal)
      .then(setNasdaqPoints)
      .catch(() => {
        if (!ac.signal.aborted) setNasdaqPoints(null);
      });
    return () => ac.abort();
  }, [fetchNasdaq, range, canLoad]);

  return (
    <section className="mb-6 w-full min-w-0">
      {/* Web/desktop controls row. */}
      <div className="relative z-20 mb-4 hidden w-full min-w-0 flex-wrap items-center justify-between gap-3 sm:flex">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex w-auto min-w-0 flex-nowrap gap-0.5 rounded-[10px] bg-[#F4F4F5] p-0.5"
            role="group"
            aria-label="Chart metric"
          >
            {PORTFOLIO_CHART_METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMetric(opt.value)}
                className={cn(
                  "flex-none rounded-[10px] px-3 py-1.5 text-center font-sans text-[13px] leading-5 tracking-normal",
                  metric === opt.value ?
                    "bg-white font-medium text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                  : "font-normal text-[#71717A]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-3">
          <PortfolioChartSettingsButton {...chartSettingsProps} />

          <div
            className="flex w-auto min-w-0 flex-nowrap justify-end gap-0.5 rounded-[10px] bg-[#F4F4F5] p-0.5"
            role="group"
            aria-label="Chart range"
          >
            {PORTFOLIO_CHART_RANGE_LABELS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={cn(
                  "flex-none rounded-[10px] px-3 py-1.5 text-center font-sans text-[13px] leading-5 tracking-normal",
                  range === r.id ?
                    "bg-white font-medium text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                  : "font-normal text-[#71717A]",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-20 mb-3 w-full sm:hidden">
        <FormListboxSelect
          aria-label="Chart metric"
          className="w-full"
          options={PORTFOLIO_CHART_METRIC_OPTIONS}
          value={metric}
          onChange={(v) => setMetric(v as PortfolioChartMetricMode)}
        />
      </div>

      <div className="w-full min-w-0">
        {!canLoad ? (
          <Empty variant="plain" className="h-[320px] justify-center py-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium leading-5">No activity yet</EmptyTitle>
              <EmptyDescription className="max-w-sm">
                Add trades or cash movements to see portfolio value over time.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : loading ? (
          <AssetChartSkeleton />
        ) : error ? (
          <div className="flex h-[320px] flex-col items-center justify-center px-6">
            <p className="text-sm text-[#71717A]">{error}</p>
          </div>
        ) : points.length === 0 ? (
          <Empty variant="plain" className="h-[320px] justify-center py-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <LineChart className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium leading-5">Not enough data</EmptyTitle>
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

      {/* Mobile range + gear below the chart (web uses the header row above). */}
      <div className="mt-3 flex w-full min-w-0 items-start justify-between gap-2 sm:hidden">
        <PortfolioChartSettingsButton {...chartSettingsProps} />

        <div
          className="flex w-full min-w-0 flex-nowrap justify-stretch gap-0.5 rounded-[10px] bg-[#F4F4F5] p-0.5"
          role="group"
          aria-label="Chart range"
        >
          {PORTFOLIO_CHART_RANGE_LABELS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                "flex-1 rounded-[10px] px-2 py-1.5 text-center font-sans text-[14px] leading-5 tracking-normal",
                range === r.id ?
                  "bg-white font-medium text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                : "font-normal text-[#71717A]",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export const PortfolioOverviewChart = memo(PortfolioOverviewChartInner);
