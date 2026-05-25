"use client";

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
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { Check, ChevronDown, LineChart, Settings } from "lucide-react";

import { baselineRelativeGradientEnabled } from "@/lib/chart/baseline-relative-gradient";

import { horzTimeToUnixSeconds } from "@/components/chart/chart-selection-utils";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import type { ListboxOption } from "@/components/ui/form-listbox-select";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";
import { SegmentedControl } from "@/components/design-system";
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
const BENCHMARK_LINE = "#EA580C";
/** Top/bottom pane borders (replaces dense auto grid). */
const SCALE_EDGE_LINE = "rgba(228, 228, 231, 0.85)";
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

const BENCHMARK_OPTIONS: { ticker: string; label: string }[] = [
  { ticker: "SPY", label: "S&P 500" },
  { ticker: "QQQ", label: "Nasdaq-100" },
];

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

function BenchmarkSelectMini({ value, onChange }: { value: string; onChange: (ticker: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = BENCHMARK_OPTIONS.find((o) => o.ticker === value) ?? BENCHMARK_OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative z-20 shrink-0">
      <button
        type="button"
        aria-label="Benchmark index"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 min-w-[9.5rem] cursor-pointer items-center rounded-[10px] bg-[#F4F4F5] py-2 pl-3 pr-9 text-left text-sm font-normal text-[#09090B] outline-none transition-colors hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
      >
        <span className="min-w-0 flex-1 truncate">{active.label}</span>
      </button>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#09090B] transition-transform",
          open && "rotate-180",
        )}
        strokeWidth={2}
        aria-hidden
      />
      {open ? (
        <div
          className={cn(dropdownMenuPanelClassName(), "absolute right-0 top-[calc(100%+4px)] z-[120] min-w-[10rem]")}
          role="listbox"
          aria-label="Benchmark index"
        >
          {BENCHMARK_OPTIONS.map((opt) => {
            const selected = value === opt.ticker;
            return (
              <button
                key={opt.ticker}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt.ticker);
                  setOpen(false);
                }}
                className={dropdownMenuPlainItemRowClassName({ selected })}
              >
                <span className="min-w-0 flex-1 truncate text-left">{opt.label}</span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                  {selected ? <Check className="h-4 w-4 text-[#09090B]" strokeWidth={2} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
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

function removeScaleBoundsPriceLines(
  series: OverviewMainSeries | null,
  topRef: RefObject<IPriceLine | null>,
  bottomRef: RefObject<IPriceLine | null>,
) {
  if (!series) {
    topRef.current = null;
    bottomRef.current = null;
    return;
  }
  for (const ref of [topRef, bottomRef]) {
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

function syncScaleBoundsPriceLines(
  chart: IChartApi,
  series: OverviewMainSeries,
  topRef: RefObject<IPriceLine | null>,
  bottomRef: RefObject<IPriceLine | null>,
) {
  const h = overviewChartPaneHeight(chart);
  if (h == null) return;

  const top = seriesPriceAtCoordinate(series, 0);
  const bottom = seriesPriceAtCoordinate(series, h);
  if (top == null || bottom == null) return;

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

function syncOverviewChartYAxis(
  chart: IChartApi,
  series: OverviewMainSeries,
  yAxisTickLinesRef: RefObject<IPriceLine[]>,
  scaleTopPriceLineRef: RefObject<IPriceLine | null>,
  scaleBottomPriceLineRef: RefObject<IPriceLine | null>,
) {
  if (series.data().length === 0) return;
  try {
    syncScaleBoundsPriceLines(chart, series, scaleTopPriceLineRef, scaleBottomPriceLineRef);
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

function formatCrosshairDate(t: Time): string {
  if (typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return format(parseISO(t), "MMM d, yyyy");
  }
  const sec = horzTimeToUnixSeconds(t);
  if (sec != null) return format(new Date(sec * 1000), "MMM d, yyyy");
  return "";
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const CHART_HEIGHT = 320;
/** Plot height; dates render in a custom row below (hidden while crosshair hover). */
const PORTFOLIO_CHART_AXIS_ROW_PX = 44;
const PORTFOLIO_CHART_PLOT_HEIGHT_PX = CHART_HEIGHT - PORTFOLIO_CHART_AXIS_ROW_PX;

type PortfolioAxisLabel = { key: string; leftPx: number; label: string };

function parsePortfolioChartTime(t: Time): Date | null {
  if (typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const parsed = parseISO(t);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  const sec = horzTimeToUnixSeconds(t);
  return sec != null ? new Date(sec * 1000) : null;
}

/** Compact x-axis copy when not hovering (year / month / day — like native LW thinning). */
function formatPortfolioAxisIdleLabel(t: Time, prevT: Time | null): string {
  const d = parsePortfolioChartTime(t);
  if (!d) return "";
  const prev = prevT ? parsePortfolioChartTime(prevT) : null;
  if (!prev || d.getFullYear() !== prev.getFullYear()) {
    return String(d.getFullYear());
  }
  if (d.getMonth() !== prev.getMonth() || d.getDate() === 1) {
    return format(d, "MMM");
  }
  return String(d.getDate());
}

function portfolioAxisShowsLabel(index: number, total: number): boolean {
  if (total <= 12) return true;
  const last = total - 1;
  if (index === 0 || index === last) return true;
  if (total > 80) return index % 6 === 0;
  if (total > 40) return index % 4 === 0;
  if (total > 20) return index % 2 === 0;
  return true;
}

function portfolioPointChartTime(p: PortfolioValueHistoryPoint): Time {
  if (p.time != null && Number.isFinite(p.time)) return p.time as Time;
  return p.t as Time;
}

function isFirstPointOfMonth(sessionYmds: readonly string[], index: number): boolean {
  if (index === 0) return true;
  const cur = sessionYmds[index]?.slice(0, 7);
  const prev = sessionYmds[index - 1]?.slice(0, 7);
  return cur != null && cur !== prev;
}

/** YTD x-axis: abbreviated month at the first point of each month. */
function formatYtdMonthAxisLabel(sessionYmd: string): string {
  return format(parseISO(sessionYmd), "MMM");
}

/** 1Y x-axis: Jun, Sep, Nov, Feb, Apr at the first point of each such month. */
const ONE_YEAR_AXIS_MONTHS = new Set([6, 9, 11, 2, 4]);

function shouldShowOneYearAxisLabel(sessionYmds: readonly string[], index: number): boolean {
  if (!isFirstPointOfMonth(sessionYmds, index)) return false;
  const ymd = sessionYmds[index];
  if (!ymd) return false;
  const month = parseISO(ymd).getMonth() + 1;
  return ONE_YEAR_AXIS_MONTHS.has(month);
}

function formatOneYearMonthAxisLabel(sessionYmd: string): string {
  return format(parseISO(sessionYmd), "MMM");
}

function isFirstPointOfYear(sessionYmds: readonly string[], index: number): boolean {
  if (index === 0) return true;
  const cur = sessionYmds[index]?.slice(0, 4);
  const prev = sessionYmds[index - 1]?.slice(0, 4);
  return cur != null && cur !== prev;
}

/** 5Y x-axis: calendar year at the first point of each year. */
function formatFiveYearAxisLabel(sessionYmd: string): string {
  return format(parseISO(sessionYmd), "yyyy");
}

const ALL_AXIS_YEAR_STEP = 4;

function allAxisAnchorYear(sessionYmds: readonly string[]): number {
  for (let i = 0; i < sessionYmds.length; i++) {
    if (isFirstPointOfYear(sessionYmds, i)) {
      const y = Number.parseInt(sessionYmds[i]!.slice(0, 4), 10);
      if (Number.isFinite(y)) return y;
    }
  }
  const y = Number.parseInt(sessionYmds[0]!.slice(0, 4), 10);
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

/** ALL x-axis: year labels every four years from the first year in range (e.g. 2011, 2015, 2019, 2023). */
function shouldShowAllAxisLabel(sessionYmds: readonly string[], index: number): boolean {
  if (!isFirstPointOfYear(sessionYmds, index)) return false;
  const year = Number.parseInt(sessionYmds[index]!.slice(0, 4), 10);
  if (!Number.isFinite(year)) return false;
  const anchor = allAxisAnchorYear(sessionYmds);
  if ((year - anchor) % ALL_AXIS_YEAR_STEP === 0) return true;
  const lastYear = Number.parseInt(sessionYmds[sessionYmds.length - 1]!.slice(0, 4), 10);
  return Number.isFinite(lastYear) && year === lastYear;
}

function formatAllAxisLabel(sessionYmd: string): string {
  return format(parseISO(sessionYmd), "yyyy");
}

function computePortfolioPeriodAxisLabels(
  chart: IChartApi,
  data: readonly { time: Time }[],
  sessionYmds: readonly string[],
  range: PortfolioChartRange,
): PortfolioAxisLabel[] {
  if (!data.length || sessionYmds.length !== data.length) return [];
  const ts = chart.timeScale();
  const labels: PortfolioAxisLabel[] = [];
  for (let i = 0; i < data.length; i++) {
    if (range === "ytd") {
      if (!isFirstPointOfMonth(sessionYmds, i)) continue;
    } else if (range === "1y") {
      if (!shouldShowOneYearAxisLabel(sessionYmds, i)) continue;
    } else if (range === "5y") {
      if (!isFirstPointOfYear(sessionYmds, i)) continue;
    } else if (range === "all") {
      if (!shouldShowAllAxisLabel(sessionYmds, i)) continue;
    } else if (!portfolioAxisShowsLabel(i, data.length)) {
      continue;
    }
    const pt = data[i]!;
    const x = ts.timeToCoordinate(pt.time);
    if (x == null || !Number.isFinite(x)) continue;
    const label =
      range === "ytd" ?
        formatYtdMonthAxisLabel(sessionYmds[i]!)
      : range === "1y" ?
        formatOneYearMonthAxisLabel(sessionYmds[i]!)
      : range === "5y" ?
        formatFiveYearAxisLabel(sessionYmds[i]!)
      : range === "all" ?
        formatAllAxisLabel(sessionYmds[i]!)
      : formatPortfolioAxisIdleLabel(pt.time, i > 0 ? data[i - 1]!.time : null);
    labels.push({
      key: `${String(pt.time)}-${i}`,
      leftPx: x,
      label,
    });
  }
  return labels;
}

function syncPortfolioPeriodAxisLabels(
  chart: IChartApi,
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline">,
  sessionYmds: readonly string[],
  range: PortfolioChartRange,
): PortfolioAxisLabel[] {
  const data = series.data();
  if (!data.length) return [];
  return computePortfolioPeriodAxisLabels(chart, data, sessionYmds, range);
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
  showBenchmark = false,
  benchmarkPricePoints = null,
  benchmarkInvestedUsd = null,
}: {
  metric: MetricMode;
  range: PortfolioChartRange;
  points: PortfolioValueHistoryPoint[];
  transactions?: readonly PortfolioTransaction[];
  showTrades?: boolean;
  /** When true with {@link benchmarkPricePoints}, draws benchmark only for the Value metric (same $ scale). */
  showBenchmark?: boolean;
  benchmarkPricePoints?: readonly StockChartPoint[] | null;
  /** Open equity cost basis; scales benchmark $ path like “$X invested” on the overview Value card. */
  benchmarkInvestedUsd?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tradeOverlayRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | null>(null);
  const compareSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const yAxisTickLinesRef = useRef<IPriceLine[]>([]);
  const scaleTopPriceLineRef = useRef<IPriceLine | null>(null);
  const scaleBottomPriceLineRef = useRef<IPriceLine | null>(null);
  const chartRangeRef = useRef<PortfolioChartRange>(range);
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
  const [periodAxisLabels, setPeriodAxisLabels] = useState<PortfolioAxisLabel[]>([]);
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

  const drawBenchmark = showBenchmark && metric === "value";

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

    if (drawBenchmark) {
      compareSeriesRef.current = chart.addSeries(LineSeries, {
        color: BENCHMARK_LINE,
        lineWidth: 2,
        lineType: LineType.Curved,
        priceLineVisible: false,
        lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
        crosshairMarkerVisible: false,
        priceScaleId: "right",
      });
    } else {
      compareSeriesRef.current = null;
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
        label: formatCrosshairDate(hoverTime),
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
        syncOverviewChartYAxis(
          chartRef.current,
          s,
          yAxisTickLinesRef,
          scaleTopPriceLineRef,
          scaleBottomPriceLineRef,
        );
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
            setHoverAxisLabel({ leftPx: x, label: formatCrosshairDate(hoverTime) });
          }
        } else {
          setPeriodAxisLabels(
            syncPortfolioPeriodAxisLabels(c, s, sessionYmdsRef.current, chartRangeRef.current),
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
      removeScaleBoundsPriceLines(seriesRef.current, scaleTopPriceLineRef, scaleBottomPriceLineRef);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      compareSeriesRef.current = null;
      scheduleTradeDotsSyncRef.current = null;
      tradeOverlayRef.current?.replaceChildren();
      hoverTimeRef.current = null;
      setTooltip(null);
      setTradeTooltip(null);
      setHoverAxisLabel(null);
      setPeriodAxisLabels([]);
    };
  }, [metric, drawBenchmark]);

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

    const data = filtered.map((p) => {
      let y: number;
      if (metric === "value") y = p.value;
      else if (metric === "profit") y = p.profit;
      else y = p.returnPct!;
      return { time: portfolioPointChartTime(p), value: y };
    });

    if (data.length === 0) {
      series.setData([]);
      sessionYmdsRef.current = [];
      tradeDotsConfigRef.current = { show: showTrades, txs: transactions, lineData: [], sessionYmds: [] };
      scheduleTradeDotsSyncRef.current?.();
      compareSeriesRef.current?.setData([]);
      removeYAxisTickLabels(series, yAxisTickLinesRef);
      removeScaleBoundsPriceLines(series, scaleTopPriceLineRef, scaleBottomPriceLineRef);
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

    const cmp = compareSeriesRef.current;
    if (cmp && drawBenchmark) {
      const bench = buildBenchmarkValueLineData(
        filtered,
        benchmarkPricePoints ?? undefined,
        benchmarkInvestedUsd,
      );
      cmp.setData(bench);
    } else if (cmp) {
      cmp.setData([]);
    }

    snapOverviewTimeScale(chart, series);
    let axisSyncCancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (axisSyncCancelled) return;
        const c = chartRef.current;
        const s = seriesRef.current;
        if (!c || !s || c !== chart || s !== series || s.data().length === 0) return;
        syncOverviewChartYAxis(c, s, yAxisTickLinesRef, scaleTopPriceLineRef, scaleBottomPriceLineRef);
        scheduleTradeDotsSyncRef.current?.();
        const hoverTime = hoverTimeRef.current;
        if (hoverTime != null) {
          const x = c.timeScale().timeToCoordinate(hoverTime);
          if (x != null && Number.isFinite(x)) {
            setHoverAxisLabel({ leftPx: x, label: formatCrosshairDate(hoverTime) });
          }
        } else {
          setPeriodAxisLabels(syncPortfolioPeriodAxisLabels(c, s, sessionYmds, range));
        }
      });
    });
    return () => {
      axisSyncCancelled = true;
    };
  }, [points, metric, range, showTrades, transactions, drawBenchmark, benchmarkPricePoints, benchmarkInvestedUsd]);

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
            syncPortfolioPeriodAxisLabels(c, s, sessionYmdsRef.current, chartRangeRef.current),
          );
        }
      }}
    >
      <div className="relative min-h-0 min-w-0 flex-1">
        <div ref={wrapRef} className="h-full w-full min-w-0" />
        <div ref={tradeOverlayRef} className="pointer-events-none absolute inset-0 z-[5]" />
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
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [benchmarkTicker, setBenchmarkTicker] = useState("SPY");
  const [benchmarkPoints, setBenchmarkPoints] = useState<StockChartPoint[] | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!controlsOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (controlsRef.current && !controlsRef.current.contains(e.target as Node)) {
        setControlsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [controlsOpen]);

  useEffect(() => {
    if (!controlsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setControlsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [controlsOpen]);

  const canLoad = transactions.length > 0;

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

  const fetchBenchmark = showBenchmark && metric === "value" && canLoad;

  useEffect(() => {
    if (!fetchBenchmark) {
      setBenchmarkPoints(null);
      return;
    }
    const ac = new AbortController();
    const stockRange = portfolioRangeToStockRange(range);
    void (async () => {
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(benchmarkTicker)}/chart?range=${stockRange}&series=price`,
          { credentials: "include", signal: ac.signal },
        );
        if (!res.ok) {
          setBenchmarkPoints(null);
          return;
        }
        const json = (await res.json()) as { points?: StockChartPoint[] };
        setBenchmarkPoints(Array.isArray(json.points) ? json.points : []);
      } catch {
        if (!ac.signal.aborted) setBenchmarkPoints(null);
      }
    })();
    return () => ac.abort();
  }, [fetchBenchmark, benchmarkTicker, range, canLoad]);

  return (
    <section className="mb-6 w-full min-w-0">
      {/* Web/desktop controls row (keep mobile in gear menu). */}
      <div className="mb-4 hidden w-full min-w-0 flex-wrap items-center justify-between gap-3 sm:flex">
        <div className="flex min-w-0 items-center gap-3">
          <FormListboxSelect
            aria-label="Chart metric"
            className="w-[140px]"
            options={PORTFOLIO_CHART_METRIC_OPTIONS}
            value={metric}
            onChange={(v) => setMetric(v as PortfolioChartMetricMode)}
          />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#09090B]">Show Trades</span>
            <PillSwitch pressed={showTrades} onPressedChange={setShowTrades} aria-label="Show trades on chart" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#09090B]">Benchmark</span>
            <BenchmarkSelectMini value={benchmarkTicker} onChange={setBenchmarkTicker} />
            <PillSwitch
              pressed={showBenchmark}
              onPressedChange={setShowBenchmark}
              disabled={metric !== "value"}
              title={
                metric !== "value" ? "Switch to Value to compare portfolio net worth with the index." : undefined
              }
              aria-label="Show benchmark comparison on chart"
            />
          </div>

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
            showBenchmark={showBenchmark}
            benchmarkPricePoints={benchmarkPoints}
            benchmarkInvestedUsd={benchmarkInvestedUsd}
          />
        )}
      </div>

      {/* Mobile range + gear below the chart (web uses the header row above). */}
      <div className="mt-3 flex w-full min-w-0 items-start justify-between gap-2 sm:hidden">
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

        <div ref={controlsRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Chart settings"
            aria-haspopup="menu"
            aria-expanded={controlsOpen}
            onClick={() => setControlsOpen((v) => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B]",
              "shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100",
              "hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
            )}
          >
            <Settings className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>

          {controlsOpen ? (
            <div
              className={cn(
                dropdownMenuPanelClassName(),
                "absolute right-0 top-[calc(100%+6px)] z-[130] w-[min(100vw-2rem,360px)] p-3",
              )}
              role="menu"
              aria-label="Chart settings"
            >
              <div className="space-y-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#71717A]">Metric</span>
                    <SegmentedControl
                      options={PORTFOLIO_CHART_METRIC_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      value={metric}
                      onChange={setMetric}
                      size="sm"
                      fullWidth
                      aria-label="Chart metric"
                      className="w-full min-w-0"
                    />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-[#09090B]">Show trades</span>
                  <PillSwitch
                    pressed={showTrades}
                    onPressedChange={setShowTrades}
                    aria-label="Show trades on chart"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-[#09090B]">Benchmark</span>
                  <div className="flex items-center gap-2">
                    <BenchmarkSelectMini value={benchmarkTicker} onChange={setBenchmarkTicker} />
                    <PillSwitch
                      pressed={showBenchmark}
                      onPressedChange={setShowBenchmark}
                      disabled={metric !== "value"}
                      title={
                        metric !== "value" ?
                          "Switch to Value to compare portfolio net worth with the index."
                        : undefined
                      }
                      aria-label="Show benchmark comparison on chart"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export const PortfolioOverviewChart = memo(PortfolioOverviewChartInner);
