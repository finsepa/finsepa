"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { ChartBrandWatermark } from "@/components/chart/chart-brand-watermark";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { CHART_PLOT_BACKGROUND_CLASS } from "@/lib/chart/fundamentals-chart-surface";
import type { StockCandleInterval, StockCandlesResponse } from "@/lib/market/stock-candles";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import { resolveFsColor, resolveFsColorWithAlpha } from "@/lib/theme/resolve-fs-color";
import { cn } from "@/lib/utils";

type Candle = StockCandlesResponse["candles"][number];

const LIVE_REFRESH_MS = 60_000;

/** Neutral axis pill for crosshair price/time labels — readable on light and dark panels. */
const CROSSHAIR_LABEL_BG = "#52525B";

/** Volume stays in the background — candles carry the contrast. */
const VOLUME_BAR_ALPHA = 0.2;

const FONT_FAMILY = "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

function isIntraday(interval: StockCandleInterval): boolean {
  return interval === "5m" || interval === "30m";
}

function formatTime(sec: number, interval: StockCandleInterval, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    ...opts,
    timeZone: isIntraday(interval) ? "America/New_York" : "UTC",
  }).format(new Date(sec * 1000));
}

function legendTime(sec: number, interval: StockCandleInterval): string {
  if (isIntraday(interval)) {
    return formatTime(sec, interval, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  if (interval === "1mo") return formatTime(sec, interval, { month: "short", year: "numeric" });
  return formatTime(sec, interval, { month: "short", day: "numeric", year: "numeric" });
}

function formatPrice(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 });
}

const volumeFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

function CandleLegend({ candle, interval }: { candle: Candle; interval: StockCandleInterval }) {
  const up = candle.close >= candle.open;
  const changePct = ((candle.close - candle.open) / candle.open) * 100;
  const tone = up ? "text-[var(--fs-up)]" : "text-[var(--fs-down)]";
  const cell = (label: string, value: number) => (
    <span className="whitespace-nowrap">
      <span className="text-fg-muted">{label}</span> <span className={cn("tabular-nums", tone)}>{formatPrice(value)}</span>
    </span>
  );
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-[1] flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] leading-4">
      <span className="text-fg-muted">{legendTime(candle.time, interval)}</span>
      {cell("O", candle.open)}
      {cell("H", candle.high)}
      {cell("L", candle.low)}
      {cell("C", candle.close)}
      <span className={cn("tabular-nums", tone)}>
        {changePct >= 0 ? "+" : ""}
        {changePct.toFixed(2)}%
      </span>
      {candle.volume != null ? (
        <span className="whitespace-nowrap">
          <span className="text-fg-muted">Vol</span>{" "}
          <span className="tabular-nums text-fg">{volumeFormatter.format(candle.volume)}</span>
        </span>
      ) : null}
    </div>
  );
}

export function StockCandleChart({
  ticker,
  range,
  height = 320,
}: {
  ticker: string;
  range: StockChartRange;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  /** Fit once per ticker/range/chart instance so live refreshes keep the user's zoom and pan. */
  const fittedKeyRef = useRef<string | null>(null);
  const requestKey = `${ticker}|${range}`;
  const [loaded, setLoaded] = useState<{ key: string; data: StockCandlesResponse | null } | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      timer = setTimeout(() => void load(true), LIVE_REFRESH_MS);
    };
    const load = (isRefresh: boolean): Promise<void> =>
      fetch(`/api/stocks/${encodeURIComponent(ticker)}/candles?range=${encodeURIComponent(range)}`, {
        credentials: "include",
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<StockCandlesResponse>) : null))
        .then((json) => {
          if (json || !isRefresh) setLoaded({ key: requestKey, data: json });
          if (json?.live || (isRefresh && !json)) scheduleRefresh();
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          if (isRefresh) scheduleRefresh();
          else setLoaded({ key: requestKey, data: null });
        });
    void load(false);
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [ticker, range, requestKey]);

  const loading = loaded?.key !== requestKey;
  const data = loading ? null : loaded.data;
  const interval = data?.interval ?? "1d";

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const crosshairLine = resolveFsColorWithAlpha("--fs-fg-muted", 0.7);
    const chart = createChart(el, {
      width: Math.max(2, el.clientWidth),
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: resolveFsColor("--fs-fg-muted"),
        fontSize: 11,
        fontFamily: FONT_FAMILY,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: true, color: resolveFsColor("--fs-stroke"), style: LineStyle.Dotted },
        horzLines: { visible: true, color: resolveFsColor("--fs-stroke"), style: LineStyle.Dotted },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.26 } },
      timeScale: {
        borderVisible: false,
        rightOffset: 2,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: isIntraday(interval),
        secondsVisible: false,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          const sec = time as number;
          if (type === TickMarkType.Year) return formatTime(sec, interval, { year: "numeric" });
          if (type === TickMarkType.Month) return formatTime(sec, interval, { month: "short" });
          if (type === TickMarkType.DayOfMonth) return formatTime(sec, interval, { month: "short", day: "numeric" });
          return formatTime(sec, interval, { hour: "numeric", minute: "2-digit" });
        },
      },
      localization: {
        timeFormatter: (time: Time) => legendTime(time as number, interval),
        priceFormatter: formatPrice,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: crosshairLine,
          style: LineStyle.Dashed,
          width: 1,
          labelVisible: true,
          labelBackgroundColor: CROSSHAIR_LABEL_BG,
        },
        horzLine: {
          color: crosshairLine,
          style: LineStyle.Dashed,
          width: 1,
          labelVisible: true,
          labelBackgroundColor: CROSSHAIR_LABEL_BG,
        },
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
    });

    const up = resolveFsColor("--fs-up");
    const down = resolveFsColor("--fs-down");
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 }, visible: false });

    chart.subscribeCrosshairMove((param) => {
      setHoveredTime(param.time != null && param.seriesData.get(series) ? (param.time as number) : null);
    });

    const ro = new ResizeObserver(() => chart.applyOptions({ width: Math.max(2, el.clientWidth) }));
    ro.observe(el);

    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    return () => {
      setHoveredTime(null);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      fittedKeyRef.current = null;
    };
  }, [height, interval]);

  useEffect(() => {
    const series = seriesRef.current;
    const volume = volumeRef.current;
    if (!series || !volume) return;
    const candles = data?.candles ?? [];
    series.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    const volumeUp = resolveFsColorWithAlpha("--fs-up", VOLUME_BAR_ALPHA);
    const volumeDown = resolveFsColorWithAlpha("--fs-down", VOLUME_BAR_ALPHA);
    volume.setData(
      candles.map((c) =>
        c.volume != null
          ? { time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? volumeUp : volumeDown }
          : { time: c.time as UTCTimestamp },
      ),
    );
    const fitKey = `${requestKey}|${interval}`;
    if (candles.length && fittedKeyRef.current !== fitKey) {
      chartRef.current?.timeScale().fitContent();
      fittedKeyRef.current = fitKey;
    }
  }, [data, interval, requestKey]);

  const candles = data?.candles ?? [];
  const hovered = hoveredTime != null ? candles.find((c) => c.time === hoveredTime) : undefined;
  const legendCandle = hovered ?? candles[candles.length - 1] ?? null;

  return (
    <div className="relative w-full" style={{ height: height + 20 }}>
      {legendCandle && !loading ? <CandleLegend candle={legendCandle} interval={interval} /> : null}
      <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-0", CHART_PLOT_BACKGROUND_CLASS)} style={{ height }} aria-hidden>
        <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
        {!loading && candles.length > 0 ? <ChartBrandWatermark cover="full" /> : null}
      </div>
      <div ref={wrapRef} className="absolute inset-x-0 bottom-0 z-10" style={{ height }} />
      {loading ? (
        <div className="absolute inset-0 z-10">
          <AssetChartSkeleton heightPx={height + 20} className="h-full" />
        </div>
      ) : candles.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-fg-muted">
          No candle data for this range.
        </div>
      ) : null}
    </div>
  );
}
