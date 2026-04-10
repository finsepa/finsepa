"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  AreaSeries,
  BaselineSeries,
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineStyle,
  LineType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { LineChart } from "lucide-react";

import { horzTimeToUnixSeconds } from "@/components/chart/chart-selection-utils";
import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
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

export type PortfolioChartMetricMode = "value" | "profit";

type MetricMode = PortfolioChartMetricMode;

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
}: {
  metric: MetricMode;
  points: PortfolioValueHistoryPoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Baseline"> | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    dateLabel: string;
    valueLabel: string;
  } | null>(null);

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
        priceFormatter: (p: number) => formatAxisUsd(p),
      },
      handleScroll: false,
      handleScale: false,
    });

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
          baseValue: { type: "price", price: 0 },
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
        });

    chartRef.current = chart;
    seriesRef.current = series;

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

      const raw = (data as { value: number }).value;
      const dateLabel = formatCrosshairDate(param.time as Time);
      const valueLabel =
        metric === "profit" ?
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
    });
    ro.observe(el);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setTooltip(null);
    };
  }, [metric]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const data = points
      .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.profit))
      .map((p) => ({
        time: p.t as Time,
        value: metric === "value" ? p.value : p.profit,
      }));

    if (data.length === 0) {
      series.setData([]);
      return;
    }

    series.setData(data);
    snapOverviewTimeScale(chart, series);
  }, [points, metric]);

  const metricTitle = metric === "value" ? "Value" : "Total profit";

  return (
    <div
      ref={containerRef}
      className="relative h-[320px] w-full min-w-0"
      onMouseLeave={() => setTooltip(null)}
    >
      <div ref={wrapRef} className="h-full w-full min-w-0" />
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
    </div>
  );
}

function PortfolioOverviewChartInner({ transactions }: { transactions: PortfolioTransaction[] }) {
  const [metric, setMetric] = useState<MetricMode>("value");
  const [range, setRange] = useState<PortfolioChartRange>("all");
  const [points, setPoints] = useState<PortfolioValueHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section className="mb-6 w-full min-w-0">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B]">Overview</h2>
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div
            className="inline-flex shrink-0 rounded-[10px] bg-[#F4F4F5] p-0.5"
            role="group"
            aria-label="Chart metric"
          >
            {(
              [
                { id: "value" as const, label: "Value" },
                { id: "profit" as const, label: "Total profit" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMetric(opt.id)}
                className={cn(
                  "rounded-[10px] px-4 py-1.5 text-sm font-medium transition-shadow",
                  metric === opt.id ?
                    "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#71717A]",
                )}
              >
                {opt.label}
              </button>
            ))}
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
                  "rounded-[10px] px-3 py-1.5 text-sm font-medium sm:px-4",
                  range === r.id ?
                    "bg-white text-[#09090B] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.12),0px_1px_2px_0px_rgba(10,10,10,0.07)]"
                  : "text-[#71717A]",
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
          <PortfolioValueHistoryChartPane metric={metric} points={points} />
        )}
      </div>
    </section>
  );
}

export const PortfolioOverviewChart = memo(PortfolioOverviewChartInner);
