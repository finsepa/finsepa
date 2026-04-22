"use client";

import { memo, useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { format, parseISO } from "date-fns";
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
import { Check, ChevronDown, LineChart } from "lucide-react";

import { horzTimeToUnixSeconds } from "@/components/chart/chart-selection-utils";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
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
import { cn } from "@/lib/utils";
import type {
  PortfolioChartRange,
  PortfolioValueHistoryPoint,
} from "@/lib/portfolio/portfolio-chart-types";

const VALUE_BLUE = "#2563EB";
const GREEN = "#16A34A";
const RED = "#DC2626";
const BENCHMARK_LINE = "#EA580C";

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
  for (const r of rows) {
    out.push({ time: r.t as Time, value: r.spy * (notional0 / spy0) });
  }
  return out;
}

function chartYmdForTrade(tradeYmd: string, sortedChartYmd: readonly string[]): string | null {
  if (sortedChartYmd.length === 0) return null;
  if (sortedChartYmd.includes(tradeYmd)) return tradeYmd;
  const after = sortedChartYmd.find((d) => d >= tradeYmd);
  if (after) return after;
  return sortedChartYmd[sortedChartYmd.length - 1] ?? null;
}

function syncPortfolioTradeDotsOverlay(
  chart: IChartApi,
  series: ISeriesApi<"Area"> | ISeriesApi<"Baseline">,
  overlay: HTMLDivElement,
  show: boolean,
  txs: readonly PortfolioTransaction[],
  lineData: readonly { time: Time; value: number }[],
  hoverApiRef: MutableRefObject<TradeDotHoverApi | null>,
): void {
  overlay.replaceChildren();
  if (!show || lineData.length === 0) return;
  const sortedYmd = [...new Set(lineData.map((d) => String(d.time)))].sort((a, b) => a.localeCompare(b));
  for (const t of txs) {
    if (t.kind !== "trade") continue;
    const op = t.operation.toLowerCase();
    if (op !== "buy" && op !== "sell") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    const timeStr = chartYmdForTrade(t.date, sortedYmd);
    if (timeStr == null) continue;
    const pt = lineData.find((d) => String(d.time) === timeStr);
    if (!pt) continue;
    const x = chart.timeScale().timeToCoordinate(pt.time);
    const y = series.priceToCoordinate(pt.value);
    if (x == null || y == null) continue;
    const border = op === "buy" ? GREEN : RED;

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
        tx: t,
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

function formatTradeHoverLines(tx: PortfolioTransaction, chartYmd: string): string[] {
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
  if (chartYmd !== tx.date) {
    lines.push(`Chart: ${formatTradeLedgerDateYmd(chartYmd)}`);
  }
  return lines;
}

type TradeDotHoverApi = {
  onEnter: (p: {
    clientX: number;
    clientY: number;
    tx: PortfolioTransaction;
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
  points,
  transactions = [],
  showTrades = false,
  showBenchmark = false,
  benchmarkPricePoints = null,
  benchmarkInvestedUsd = null,
}: {
  metric: MetricMode;
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
  const tradeDotsConfigRef = useRef<{
    show: boolean;
    txs: readonly PortfolioTransaction[];
    lineData: readonly { time: Time; value: number }[];
  }>({ show: false, txs: [], lineData: [] });
  const scheduleTradeDotsSyncRef = useRef<(() => void) | null>(null);
  const tradeDotHoverApiRef = useRef<TradeDotHoverApi | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    dateLabel: string;
    valueLabel: string;
  } | null>(null);
  const [tradeTooltip, setTradeTooltip] = useState<{
    x: number;
    y: number;
    dateLabel: string;
    lines: string[];
  } | null>(null);

  tradeDotHoverApiRef.current = {
    onEnter({ clientX, clientY, tx, chartYmd }) {
      setTooltip(null);
      const box = containerRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const tw = 220;
      const th = 112;
      const pad = 8;
      let x = px + pad;
      let y = py - th - pad;
      if (x + tw > box.clientWidth - pad) x = Math.max(pad, box.clientWidth - tw - pad);
      if (x < pad) x = pad;
      if (y < pad) y = pad;
      if (y + th > CHART_HEIGHT - pad) y = Math.min(CHART_HEIGHT - th - pad, py + pad);
      setTradeTooltip({
        x,
        y,
        dateLabel: formatTradeLedgerDateYmd(tx.date),
        lines: formatTradeHoverLines(tx, chartYmd),
      });
    },
    onLeave() {
      setTradeTooltip(null);
    },
  };

  const drawBenchmark = showBenchmark && metric === "value";

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: CHART_HEIGHT,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: "#A1A1AA",
        fontSize: 11,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: {
          color: "rgba(228, 228, 231, 0.85)",
          style: LineStyle.Dotted,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false,
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
      localization: {
        priceFormatter: (p: number) =>
          metric === "return" ? formatReturnPctAxis(p) : formatAxisUsd(p),
      },
      handleScroll: false,
      handleScale: false,
    });

    const baselineOpts = {
      relativeGradient: true,
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
      syncPortfolioTradeDotsOverlay(c, s, overlay, cfg.show, cfg.txs, cfg.lineData, tradeDotHoverApiRef);
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
        setTooltip(null);
        return;
      }

      setTradeTooltip(null);

      const raw = (data as { value: number }).value;
      const dateLabel = formatCrosshairDate(param.time as Time);
      const valueLabel =
        metric === "return" ?
          formatReturnPctAxis(raw)
        : metric === "profit" ?
          `${raw >= 0 ? "+" : "−"}${TOOLTIP_USD.format(Math.abs(raw))}`
        : TOOLTIP_USD.format(raw);

      const tw = 168;
      const th = 56;
      const pad = 8;
      let x = param.point.x + pad;
      let y = param.point.y - th - pad;
      if (x + tw > box.clientWidth - pad) x = box.clientWidth - tw - pad;
      if (x < pad) x = pad;
      if (y < pad) y = pad;
      if (y + th > CHART_HEIGHT - pad) y = Math.min(CHART_HEIGHT - th - pad, param.point.y + pad);

      setTooltip({
        x,
        y,
        dateLabel,
        valueLabel,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: wrapRef.current.clientWidth });
      const s = seriesRef.current;
      if (s && s.data().length > 0) {
        snapOverviewTimeScale(chartRef.current, s);
      }
      requestAnimationFrame(() => scheduleTradeDotsSyncRef.current?.());
    });
    ro.observe(el);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => scheduleTradeDotsSyncRef.current?.());
    });

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      compareSeriesRef.current = null;
      scheduleTradeDotsSyncRef.current = null;
      tradeOverlayRef.current?.replaceChildren();
      setTooltip(null);
      setTradeTooltip(null);
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

    const data = filtered.map((p) => {
      let y: number;
      if (metric === "value") y = p.value;
      else if (metric === "profit") y = p.profit;
      else y = p.returnPct!;
      return { time: p.t as Time, value: y };
    });

    if (data.length === 0) {
      series.setData([]);
      tradeDotsConfigRef.current = { show: showTrades, txs: transactions, lineData: [] };
      scheduleTradeDotsSyncRef.current?.();
      compareSeriesRef.current?.setData([]);
      return;
    }

    series.setData(data);

    tradeDotsConfigRef.current = { show: showTrades, txs: transactions, lineData: data };

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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scheduleTradeDotsSyncRef.current?.());
    });
  }, [points, metric, showTrades, transactions, drawBenchmark, benchmarkPricePoints, benchmarkInvestedUsd]);

  const metricTitle =
    metric === "value" ? "Value" : metric === "profit" ? "Total profit" : "Return";

  return (
    <div
      ref={containerRef}
      className="relative h-[320px] w-full min-w-0"
      onMouseLeave={() => {
        setTooltip(null);
        setTradeTooltip(null);
      }}
    >
      <div ref={wrapRef} className="h-full w-full min-w-0" />
      <div ref={tradeOverlayRef} className="pointer-events-none absolute inset-0 z-[5]" />
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[148px] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="status"
        >
          <p className="text-[11px] leading-4 text-[#71717A]">{tooltip.dateLabel}</p>
          <p className="mt-0.5 text-xs font-semibold tabular-nums text-[#09090B]">
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
            {tradeTooltip.lines.map((line, i) => (
              <p key={i} className="font-medium tabular-nums">
                {line}
              </p>
            ))}
          </div>
        </div>
      ) : null}
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
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FormListboxSelect
            className="w-[min(100%,220px)] shrink-0"
            value={metric}
            onChange={setMetric}
            options={PORTFOLIO_CHART_METRIC_OPTIONS}
            aria-label="Chart metric"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
            <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
              <div className="flex items-center gap-2 text-sm text-[#09090B]">
                <span className="whitespace-nowrap">Show trades</span>
                <PillSwitch
                  pressed={showTrades}
                  onPressedChange={setShowTrades}
                  aria-label="Show trades on chart"
                />
              </div>
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
            <div
              className="flex min-w-0 flex-wrap justify-end gap-0.5 rounded-[10px] bg-[#F4F4F5] p-0.5"
              role="group"
              aria-label="Chart range"
            >
              {PORTFOLIO_CHART_RANGE_LABELS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  className={cn(
                    "rounded-[10px] px-3 py-1.5 font-sans text-[14px] leading-5 tracking-normal sm:px-4",
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
          <ChartSkeleton />
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
            points={points}
            transactions={transactions}
            showTrades={showTrades}
            showBenchmark={showBenchmark}
            benchmarkPricePoints={benchmarkPoints}
            benchmarkInvestedUsd={benchmarkInvestedUsd}
          />
        )}
      </div>
    </section>
  );
}

export const PortfolioOverviewChart = memo(PortfolioOverviewChartInner);
