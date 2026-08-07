"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
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

import {
  CHART_AXIS_ROW_PX,
  CHART_PLOT_DOTS_PATTERN_CLASS,
  formatOverviewCrosshairBottomDate,
  periodAxisLabelLayoutStyle,
  periodAxisLabelMaxWidthClass,
  periodAxisLabelTransformClass,
} from "@/components/chart/overview-bottom-axis";
import { SegmentedControl, type SegmentedControlOption } from "@/components/design-system/segmented-control";
import { tooltipSurfaceClassName } from "@/components/design-system/tooltip-surface-styles";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { baselineUpDownFillColors } from "@/lib/chart/accent-area-fill";
import { CHART_PLOT_BACKGROUND_CLASS } from "@/lib/chart/fundamentals-chart-surface";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import type {
  SuperinvestorPerformancePoint,
  SuperinvestorPerformanceSeries,
} from "@/lib/superinvestors/superinvestor-performance-types";
import { chartMarkerDiscFillColor, resolveFsColor } from "@/lib/theme/resolve-fs-color";
import { useChartThemePaintKey } from "@/lib/theme/use-logo-dev-theme";
import { cn } from "@/lib/utils";

/** Cap plot points so LW setData stays responsive on range changes. */
const MAX_CHART_POINTS = 160;

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-skeleton", className)} aria-hidden />;
}

/** Clickable legend badge — same pattern as portfolio Performance / returns dynamics. */
function PerformanceLegendBadge({
  label,
  swatch,
  pressed,
  onToggle,
}: {
  label: string;
  swatch: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-stroke bg-surface px-3 py-0 text-[12px] font-medium leading-none text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))] transition-opacity",
        !pressed && "opacity-40",
      )}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch }} aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

const SPY_LINE = "#EA580C";
const PLOT_HEIGHT_PX = 280;
const TOOLTIP_PAD = 8;
const TOOLTIP_W = 200;
const TOOLTIP_H = 56;
const CHART_TZ = "America/New_York";

/** User asked for 7M — treat as 7D to match portfolio range control. */
type PerfChartRange = "7d" | "1m" | "6m" | "ytd" | "1y" | "5y";

const RANGE_OPTIONS: readonly SegmentedControlOption<PerfChartRange>[] = [
  { value: "7d", label: "7D" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

const RANGE_LABEL: Record<PerfChartRange, string> = {
  "7d": "7D",
  "1m": "1M",
  "6m": "6M",
  ytd: "YTD",
  "1y": "1Y",
  "5y": "5Y",
};

function rangeToStockRange(range: PerfChartRange): StockChartRange {
  switch (range) {
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
  }
}

function rangeStartYmd(range: PerfChartRange, toYmd: string): string {
  const [y, m, d] = toYmd.split("-").map(Number);
  const end = new Date(Date.UTC(y!, m! - 1, d!));
  switch (range) {
    case "7d":
      end.setUTCDate(end.getUTCDate() - 7);
      break;
    case "1m":
      end.setUTCDate(end.getUTCDate() - 31);
      break;
    case "6m":
      end.setUTCDate(end.getUTCDate() - 183);
      break;
    case "ytd":
      return `${y}-01-01`;
    case "1y":
      end.setUTCFullYear(end.getUTCFullYear() - 1);
      break;
    case "5y":
      end.setUTCFullYear(end.getUTCFullYear() - 5);
      break;
  }
  return end.toISOString().slice(0, 10);
}

/** Slice to range and rebase so the window opens at 0%. */
function windowAndRebasePoints(
  points: SuperinvestorPerformancePoint[],
  range: PerfChartRange,
): SuperinvestorPerformancePoint[] {
  if (points.length < 2) return points;
  const toYmd = points[points.length - 1]!.t;
  const fromYmd = rangeStartYmd(range, toYmd);
  let startIdx = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.t <= fromYmd) startIdx = i;
    else break;
  }
  const sliced = points.slice(startIdx);
  if (sliced.length < 2) return sliced;
  const book0 = sliced[0]!.bookReturnPct;
  const spy0 = sliced[0]!.spyReturnPct;
  const bookBase = 1 + book0 / 100;
  const spyBase = 1 + spy0 / 100;
  if (bookBase <= 0 || spyBase <= 0) return sliced;
  return sliced.map((p) => {
    const bookReturnPct = ((1 + p.bookReturnPct / 100) / bookBase - 1) * 100;
    const spyReturnPct = ((1 + p.spyReturnPct / 100) / spyBase - 1) * 100;
    return {
      ...p,
      bookReturnPct,
      spyReturnPct,
      bookProfitUsd: 0,
      spyProfitUsd: 0,
    };
  });
}

function downsampleForChart(
  points: SuperinvestorPerformancePoint[],
  maxPoints: number,
): SuperinvestorPerformancePoint[] {
  if (points.length <= maxPoints) return points;
  const out: SuperinvestorPerformancePoint[] = [];
  const lastIdx = points.length - 1;
  const step = lastIdx / (maxPoints - 1);
  let prev = -1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = i === maxPoints - 1 ? lastIdx : Math.round(i * step);
    if (idx === prev) continue;
    prev = idx;
    out.push(points[idx]!);
  }
  return out;
}

function ymdToUtcTime(ymd: string): Time {
  const [y, m, d] = ymd.split("-").map(Number);
  return (Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / 1000) as Time;
}

function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

/** Portfolio-style: tooltip to the right of the point, vertically centered; flips left near the edge. */
function layoutPortfolioStyleTooltip(
  point: { x: number; y: number },
  containerWidth: number,
  plotHeight: number,
): { left: number; top: number } {
  let x = point.x + TOOLTIP_PAD;
  let y = point.y - TOOLTIP_H / 2;
  if (x + TOOLTIP_W > containerWidth - TOOLTIP_PAD) {
    x = Math.max(TOOLTIP_PAD, point.x - TOOLTIP_W - TOOLTIP_PAD);
  }
  if (x < TOOLTIP_PAD) x = TOOLTIP_PAD;
  if (y < TOOLTIP_PAD) y = TOOLTIP_PAD;
  if (y + TOOLTIP_H > plotHeight - TOOLTIP_PAD) {
    y = Math.max(TOOLTIP_PAD, plotHeight - TOOLTIP_H - TOOLTIP_PAD);
  }
  return { left: x, top: y };
}

function formatPctAxis(p: number): string {
  const sign = p > 0 ? "+" : p < 0 ? "−" : "";
  return `${sign}${Math.abs(p).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

export function SuperinvestorPerformanceChart({ profileSlug }: { profileSlug: string }) {
  const [data, setData] = useState<SuperinvestorPerformanceSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<PerfChartRange>("5y");
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showSpy, setShowSpy] = useState(true);
  const paintKey = useChartThemePaintKey();
  const portfolioSwatch = resolveFsColor("--fs-accent") || "#364aff";

  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const bookSeriesRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const spySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const windowedByYmdRef = useRef<Map<string, SuperinvestorPerformancePoint>>(new Map());
  const rangeRef = useRef(range);
  const showPortfolioRef = useRef(showPortfolio);
  const showSpyRef = useRef(showSpy);
  showPortfolioRef.current = showPortfolio;
  showSpyRef.current = showSpy;
  const [hover, setHover] = useState<{
    bookReturnPct: number;
    spyReturnPct: number;
    x: number;
    y: number;
    dateLabel: string;
  } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    const load = async (attempt: number): Promise<void> => {
      const res = await fetch(`/api/superinvestors/${encodeURIComponent(profileSlug)}/performance`, {
        credentials: "include",
        signal: ac.signal,
      });
      if (res.status === 503 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 2500));
        if (ac.signal.aborted) return;
        return load(attempt + 1);
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to load performance");
      }
      const payload = (await res.json()) as SuperinvestorPerformanceSeries;
      if (ac.signal.aborted) return;
      startTransition(() => {
        setData(payload);
        setLoading(false);
      });
    };

    void load(0).catch((e: unknown) => {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load performance");
      setLoading(false);
    });
    return () => {
      ac.abort();
    };
  }, [profileSlug]);

  const windowedPoints = useMemo(() => {
    if (!data?.points.length) return [];
    return windowAndRebasePoints(data.points, range);
  }, [data, range]);

  const chartPoints = useMemo(
    () => downsampleForChart(windowedPoints, MAX_CHART_POINTS),
    [windowedPoints],
  );

  useEffect(() => {
    const m = new Map<string, SuperinvestorPerformancePoint>();
    for (const p of windowedPoints) m.set(p.t, p);
    windowedByYmdRef.current = m;
  }, [windowedPoints]);
  rangeRef.current = range;

  const headline = useMemo(() => {
    const last = windowedPoints[windowedPoints.length - 1];
    if (!last) return null;
    const returnPct = last.bookReturnPct;
    return {
      returnLabel: formatPct(returnPct),
      spanLabel: RANGE_LABEL[range],
      tone: returnPct > 0 ? "text-up" : returnPct < 0 ? "text-down" : "text-fg-muted",
    };
  }, [windowedPoints, range]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !data?.points.length) return;

    const muted = resolveFsColor("--fs-fg-muted") || "#999999";
    const up = resolveFsColor("--fs-up") || "#16a34a";
    const markerFill = chartMarkerDiscFillColor();
    const fills = baselineUpDownFillColors("bright");

    const chart = createChart(host, {
      width: Math.max(2, host.clientWidth),
      height: Math.max(2, host.clientHeight),
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: muted,
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
        timeVisible: false,
        ticksVisible: false,
      },
      localization: {
        priceFormatter: formatPctAxis,
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
      handleScroll: false,
      handleScale: false,
    });

    const bookSeries = chart.addSeries(BaselineSeries, {
      ...fills,
      relativeGradient: false,
      baseValue: { type: "price", price: 0 },
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: true,
      lastPriceAnimation: LastPriceAnimationMode.Disabled,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: up,
      crosshairMarkerBackgroundColor: markerFill,
      crosshairMarkerBorderWidth: 2,
      visible: showPortfolioRef.current,
    });

    const spySeries = chart.addSeries(LineSeries, {
      color: SPY_LINE,
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: true,
      lastPriceAnimation: LastPriceAnimationMode.Disabled,
      crosshairMarkerVisible: false,
      priceScaleId: "right",
      visible: showSpyRef.current,
    });

    chartRef.current = chart;
    bookSeriesRef.current = bookSeries;
    spySeriesRef.current = spySeries;

    const onMove = (param: MouseEventParams<Time>) => {
      const box = plotRef.current;
      if (
        !box ||
        param.point === undefined ||
        param.point.x < 0 ||
        param.point.y < 0 ||
        param.time === undefined
      ) {
        setHover(null);
        return;
      }
      const book = param.seriesData.get(bookSeries) as { value?: number } | undefined;
      const spy = param.seriesData.get(spySeries) as { value?: number } | undefined;
      const hasBook = showPortfolioRef.current && book?.value != null;
      const hasSpy = showSpyRef.current && spy?.value != null;
      if (!hasBook && !hasSpy) {
        setHover(null);
        return;
      }
      const tSec = typeof param.time === "number" ? param.time : 0;
      const d = new Date(tSec * 1000);
      const t = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const point = windowedByYmdRef.current.get(t);
      if (!point) {
        setHover(null);
        return;
      }
      setHover({
        bookReturnPct: point.bookReturnPct,
        spyReturnPct: point.spyReturnPct,
        x: param.point.x,
        y: param.point.y,
        dateLabel: formatOverviewCrosshairBottomDate(
          tSec,
          CHART_TZ,
          rangeToStockRange(rangeRef.current),
        ),
      });
    };
    chart.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: host.clientWidth, height: host.clientHeight });
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      bookSeriesRef.current = null;
      spySeriesRef.current = null;
      setHover(null);
    };
  }, [data, paintKey]);

  useEffect(() => {
    if (
      !chartPoints.length ||
      !bookSeriesRef.current ||
      !spySeriesRef.current ||
      !chartRef.current
    ) {
      return;
    }
    const bookData = chartPoints.map((p) => ({
      time: ymdToUtcTime(p.t),
      value: p.bookReturnPct,
    }));
    const spyData = chartPoints.map((p) => ({
      time: ymdToUtcTime(p.t),
      value: p.spyReturnPct,
    }));
    // Defer setData so tab switch paint isn’t blocked on the main thread.
    const id = window.requestAnimationFrame(() => {
      bookSeriesRef.current?.setData(bookData);
      spySeriesRef.current?.setData(spyData);
      chartRef.current?.timeScale().fitContent();
      setHover(null);
    });
    return () => window.cancelAnimationFrame(id);
  }, [chartPoints, paintKey]);

  useEffect(() => {
    bookSeriesRef.current?.applyOptions({ visible: showPortfolio });
    spySeriesRef.current?.applyOptions({ visible: showSpy });
  }, [showPortfolio, showSpy]);

  const togglePortfolio = () => {
    setShowPortfolio((cur) => {
      if (cur && !showSpy) return cur;
      return !cur;
    });
  };
  const toggleSpy = () => {
    setShowSpy((cur) => {
      if (cur && !showPortfolio) return cur;
      return !cur;
    });
  };

  const tooltipPos = useMemo(() => {
    if (!hover) return null;
    const w = plotRef.current?.clientWidth ?? 280;
    return layoutPortfolioStyleTooltip(hover, w, PLOT_HEIGHT_PX);
  }, [hover]);

  if (loading) {
    return (
      <div className="rounded-xl border border-stroke-subtle bg-panel p-4 sm:p-5" aria-busy>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Pulse className="h-3 w-28" />
            <Pulse className="h-8 w-[min(100%,9rem)] max-w-full rounded-md" />
          </div>
          <Pulse className="h-9 w-full max-w-[22rem] shrink-0 rounded-[10px] sm:w-[22rem]" />
        </div>
        <div className="relative mt-4 h-[280px] w-full min-w-0 overflow-hidden">
          <AssetChartSkeleton fill />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-stroke-subtle bg-panel px-4 py-8 text-center text-sm text-fg-muted sm:px-5">
        {error ?? "Performance data unavailable."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stroke-subtle bg-panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-fg-muted">Portfolio return</p>
          {headline ? (
            <p className="mt-1 font-['Inter'] text-2xl font-semibold tabular-nums tracking-tight">
              <span className={headline.tone}>{headline.returnLabel}</span>
              {headline.spanLabel ? (
                <span className="font-['Inter'] text-[14px] font-semibold tabular-nums tracking-tight text-fg-muted">
                  {" "}
                  {headline.spanLabel}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <SegmentedControl
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          aria-label="Chart range"
          className="w-full shrink-0 sm:w-auto"
        />
      </div>

      <div className="relative mt-4 w-full">
        <div
          ref={plotRef}
          className={cn(
            "relative w-full isolate overflow-hidden rounded-lg",
            CHART_PLOT_BACKGROUND_CLASS,
          )}
          style={{ height: PLOT_HEIGHT_PX }}
        >
          <div className={CHART_PLOT_DOTS_PATTERN_CLASS} aria-hidden />
          <div ref={hostRef} className="absolute inset-0 z-[1]" />
          {hover && tooltipPos ? (
            <div
              className={cn(
                tooltipSurfaceClassName,
                "pointer-events-none absolute z-20 min-w-[148px] px-3 py-2",
              )}
              style={{ left: tooltipPos.left, top: tooltipPos.top }}
              role="tooltip"
            >
              {showPortfolio ? (
                <p className="text-xs font-semibold tabular-nums text-fg">
                  {data?.label ?? "Portfolio"}:{" "}
                  <span className={hover.bookReturnPct >= 0 ? "text-up" : "text-down"}>
                    {formatPct(hover.bookReturnPct)}
                  </span>
                </p>
              ) : null}
              {showSpy ? (
                <p
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    showPortfolio ? "mt-0.5" : undefined,
                  )}
                  style={{ color: SPY_LINE }}
                >
                  {data?.benchmarkLabel ?? "S&P 500"}: {formatPct(hover.spyReturnPct)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          className="relative w-full shrink-0 overflow-visible"
          style={{ height: CHART_AXIS_ROW_PX }}
          aria-hidden={!hover}
        >
          {hover ? (
            <span
              className={cn(
                "absolute bottom-1 inline-block whitespace-nowrap font-['Inter'] text-[11px] font-medium tabular-nums leading-none text-fg sm:text-[12px]",
                periodAxisLabelMaxWidthClass("center"),
                periodAxisLabelTransformClass("center"),
              )}
              style={periodAxisLabelLayoutStyle(
                hover.x,
                "center",
                plotRef.current?.clientWidth ?? 0,
              )}
            >
              {hover.dateLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <PerformanceLegendBadge
            label={data?.label ?? "Portfolio"}
            swatch={portfolioSwatch}
            pressed={showPortfolio}
            onToggle={togglePortfolio}
          />
          <PerformanceLegendBadge
            label={data?.benchmarkLabel ?? "S&P 500"}
            swatch={SPY_LINE}
            pressed={showSpy}
            onToggle={toggleSpy}
          />
        </div>
      </div>
    </div>
  );
}
