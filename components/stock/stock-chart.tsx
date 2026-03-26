"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AreaSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";

import { SkeletonBox } from "@/components/markets/skeleton";
import type { StockChartRange, StockChartResponse } from "@/lib/market/stock-chart-types";

type Props = {
  ticker: string;
  range: StockChartRange;
};

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function StockChart({ ticker, range }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<Array<{ time: number; value: number }>>([]);

  const performancePositive = useMemo(() => {
    if (points.length < 2) return true;
    const first = points[0]?.value;
    const last = points[points.length - 1]?.value;
    if (!isFiniteNumber(first) || !isFiniteNumber(last)) return true;
    return last >= first;
  }, [points]);

  const colors = useMemo(() => {
    const stroke = performancePositive ? "#16A34A" : "#DC2626";
    const top = performancePositive ? "rgba(22,163,74,0.18)" : "rgba(220,38,38,0.18)";
    const bottom = performancePositive ? "rgba(22,163,74,0.02)" : "rgba(220,38,38,0.02)";
    return { stroke, top, bottom };
  }, [performancePositive]);

  // Create chart once.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "#FFFFFF" },
        textColor: "#71717A",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      },
      grid: {
        vertLines: { color: "#E4E4E7" },
        horzLines: { color: "#E4E4E7" },
      },
      rightPriceScale: {
        borderColor: "#E4E4E7",
      },
      timeScale: {
        borderColor: "#E4E4E7",
      },
      crosshair: {
        vertLine: { color: "rgba(9,9,11,0.25)", labelBackgroundColor: "#09090B" },
        horzLine: { color: "rgba(9,9,11,0.12)", labelBackgroundColor: "#09090B" },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: colors.stroke,
      topColor: colors.top,
      bottomColor: colors.bottom,
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update series colors when performance flips.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.applyOptions({
      lineColor: colors.stroke,
      topColor: colors.top,
      bottomColor: colors.bottom,
    });
  }, [colors]);

  // Fetch data when ticker or range changes.
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/chart?range=${encodeURIComponent(range)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!mounted) return;
          setPoints([]);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as StockChartResponse;
        if (!mounted) return;
        setPoints(Array.isArray(json.points) ? json.points : []);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setPoints([]);
        setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [ticker, range]);

  // Push data into the chart.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (!points.length) {
      series.setData([]);
      return;
    }

    series.setData(
      points
        .filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))
        .map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
    );
    chart.timeScale().fitContent();
  }, [points]);

  return (
    <div className="relative bg-white border border-[#E4E4E7] rounded-lg overflow-hidden" style={{ height: 320 }}>
      <div ref={wrapRef} className={cls("absolute inset-0", loading ? "opacity-0" : "opacity-100")} />
      {loading ? (
        <div className="absolute inset-0 p-4">
          <SkeletonBox className="h-full w-full rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
