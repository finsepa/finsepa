"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  type LogicalRange,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { SegmentedControl, type SegmentedControlOption } from "@/components/design-system";
import { CandleChartSkeleton } from "@/components/ui/chart-skeleton";
import { CHART_PLOT_BACKGROUND_CLASS } from "@/lib/chart/fundamentals-chart-surface";
import {
  CRYPTO_CANDLE_INTERVALS,
  CRYPTO_DAILY_CANDLE_INTERVALS,
  isCryptoIntradayCandleInterval,
  type CryptoCandleInterval,
  type CryptoCandlesResponse,
} from "@/lib/market/crypto-candles-shared";
import type { OhlcBar } from "@/lib/market/eodhd-ohlc";
import { cryptoUsdPriceFormat, formatCryptoUsdAxis } from "@/lib/market/format-crypto-usd";
import { resolveFsColor, resolveFsColorWithAlpha } from "@/lib/theme/resolve-fs-color";
import { cn } from "@/lib/utils";

const FONT_FAMILY = "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

/** Card height beyond `height`; the plot fills all of it. */
const EXTRA_PLOT_HEIGHT_PX = 22;
const VOLUME_PANE_PX = 72;
/** Bybit-like muted volume — readable without competing with candles. */
const VOLUME_BAR_ALPHA = 0.28;
/** Candles shown on first paint — older history stays one drag away. */
const INITIAL_VISIBLE_BARS = 120;


/**
 * Empty future slots after the last candle. Lightweight-charts only draws vertical grid lines and
 * time labels at data points, so without these the grid stops at the last candle.
 */
const FUTURE_WHITESPACE_BARS = 300;

/** Visible-range high/low callout — leader line points inward so edge candles never clip the price. */
type HighLowLabel = { x: number; y: number; text: string; side: "left" | "right" };

const BUCKET_SEC: Record<CryptoCandleInterval, number> = {
  "5m": 300,
  "15m": 900,
  "30m": 1_800,
  "1h": 3_600,
  "4h": 14_400,
  "1D": 86_400,
  "1W": 604_800,
};
const WEEK_ANCHOR_SEC = 4 * 86_400;

function bucketStart(sec: number, interval: CryptoCandleInterval): number {
  const size = BUCKET_SEC[interval];
  if (interval === "1W") return Math.floor((sec - WEEK_ANCHOR_SEC) / size) * size + WEEK_ANCHOR_SEC;
  return Math.floor(sec / size) * size;
}

function futureWhitespace(lastTime: number, interval: CryptoCandleInterval): { time: UTCTimestamp }[] {
  const step = BUCKET_SEC[interval];
  return Array.from({ length: FUTURE_WHITESPACE_BARS }, (_, i) => ({
    time: (lastTime + step * (i + 1)) as UTCTimestamp,
  }));
}

/** Latest candles plus a little room on the right (not the far end of the future whitespace). */
function showLatestCandles(chart: IChartApi, candleCount: number) {
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, candleCount - INITIAL_VISIBLE_BARS),
    to: candleCount - 1 + 4,
  });
}

function refreshMs(interval: CryptoCandleInterval, live: boolean): number | null {
  if (!live) return 5 * 60_000;
  return interval === "5m" ? 15_000 : 30_000;
}

const volumeFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

function formatPrice(v: number): string {
  return formatCryptoUsdAxis(v);
}

function formatTime(sec: number, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(sec * 1000));
}

function legendTime(sec: number, interval: CryptoCandleInterval): string {
  if (isCryptoIntradayCandleInterval(interval)) {
    return formatTime(sec, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return formatTime(sec, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const INTERVAL_OPTIONS: readonly SegmentedControlOption<CryptoCandleInterval>[] = CRYPTO_CANDLE_INTERVALS.map(
  (value) => ({ value, label: value }),
);

/** Interval tabs for the candle view — replaces the range tabs while candles are on. */
export function CryptoCandleIntervalControl({
  value,
  onChange,
  liveIntraday,
  fullWidth = false,
}: {
  value: CryptoCandleInterval;
  onChange: (interval: CryptoCandleInterval) => void;
  /** Coins with a live minute feed get intraday intervals. */
  liveIntraday: boolean;
  fullWidth?: boolean;
}) {
  const options = liveIntraday
    ? INTERVAL_OPTIONS
    : INTERVAL_OPTIONS.filter((o) => CRYPTO_DAILY_CANDLE_INTERVALS.includes(o.value));
  return (
    <SegmentedControl
      options={options}
      value={value}
      onChange={onChange}
      size="sm"
      fullWidth={fullWidth}
      aria-label="Candle interval"
      className={cn("min-w-min flex-nowrap", fullWidth && "min-w-0 flex-1")}
    />
  );
}

export function CryptoCandleChart({
  symbol,
  interval,
  liveSpotUsd = null,
  liveQuotedAtSec = null,
  height = 422,
}: {
  symbol: string;
  interval: CryptoCandleInterval;
  /** Header live price — patches the forming candle between candle refreshes. */
  liveSpotUsd?: number | null;
  /** Quote time of {@link liveSpotUsd} (UNIX sec) — opens a new candle when it crosses a bucket. */
  liveQuotedAtSec?: number | null;
  /** Total chart height including the volume pane. */
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<OhlcBar[]>([]);
  const refreshHighLowRef = useRef<() => void>(() => {});
  const initialRangeKeyRef = useRef<string | null>(null);

  const plotHeight = height + EXTRA_PLOT_HEIGHT_PX;
  const requestKey = `${symbol}|${interval}`;
  const [loaded, setLoaded] = useState<{ key: string; data: CryptoCandlesResponse | null } | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [volumeLegendTop, setVolumeLegendTop] = useState<number | null>(null);
  const [highLow, setHighLow] = useState<{ high: HighLowLabel | null; low: HighLowLabel | null } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (isRefresh: boolean): Promise<void> =>
      fetch(`/api/crypto/${encodeURIComponent(symbol)}/candles?interval=${encodeURIComponent(interval)}`, {
        credentials: "include",
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<CryptoCandlesResponse>) : null))
        .then((json) => {
          if (json || !isRefresh) setLoaded({ key: requestKey, data: json });
          const ms = refreshMs(interval, json?.live ?? false);
          if (ms != null) timer = setTimeout(() => void load(true), ms);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          if (!isRefresh) setLoaded({ key: requestKey, data: null });
          timer = setTimeout(() => void load(true), 30_000);
        });
    void load(false);
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [symbol, interval, requestKey]);

  const loading = loaded?.key !== requestKey;
  const data = loading ? null : loaded.data;
  const live = data?.live ?? false;

  /** Server candles with the forming candle patched from the header live price. */
  const candles = useMemo(() => {
    const base = data?.candles ?? [];
    if (!live || liveSpotUsd == null || !Number.isFinite(liveSpotUsd) || liveSpotUsd <= 0 || base.length === 0) {
      return base;
    }
    const last = base[base.length - 1]!;
    const nowBucket = liveQuotedAtSec != null ? bucketStart(liveQuotedAtSec, interval) : last.time;
    if (nowBucket < last.time) return base;
    // Stale history: bridging the gap with one candle would paint a giant fake move.
    if (nowBucket - last.time > 2 * BUCKET_SEC[interval]) return base;
    if (nowBucket === last.time) {
      return [
        ...base.slice(0, -1),
        { ...last, close: liveSpotUsd, high: Math.max(last.high, liveSpotUsd), low: Math.min(last.low, liveSpotUsd) },
      ];
    }
    return [
      ...base,
      {
        time: nowBucket,
        open: last.close,
        high: Math.max(last.close, liveSpotUsd),
        low: Math.min(last.close, liveSpotUsd),
        close: liveSpotUsd,
      },
    ];
  }, [data, live, liveSpotUsd, liveQuotedAtSec, interval]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const intraday = isCryptoIntradayCandleInterval(interval);
    // Finsepa stroke grid (same as stock candles) — never alpha-wrap `--fs-fg` (parse miss → solid white).
    const gridLine = resolveFsColor("--fs-stroke");
    const crosshairLine = resolveFsColorWithAlpha("--fs-fg-muted", 0.4);
    const axisLabelBg = resolveFsColor("--fs-surface-muted");
    const chart = createChart(el, {
      width: Math.max(2, el.clientWidth),
      height: plotHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: resolveFsColor("--fs-fg-muted"),
        fontSize: 11,
        fontFamily: FONT_FAMILY,
        attributionLogo: false,
        panes: {
          separatorColor: resolveFsColor("--fs-stroke"),
          separatorHoverColor: "#00000000",
          enableResize: false,
        },
      },
      grid: {
        vertLines: { visible: true, color: gridLine, style: LineStyle.Solid },
        horzLines: { visible: true, color: gridLine, style: LineStyle.Solid },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.14, bottom: 0.06 } },
      timeScale: {
        borderVisible: false,
        rightOffset: 4,
        timeVisible: intraday,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          const sec = time as number;
          const tz = intraday ? undefined : "UTC";
          if (type === TickMarkType.Year) return formatTime(sec, { year: "numeric", timeZone: tz });
          if (type === TickMarkType.Month) return formatTime(sec, { month: "short", timeZone: tz });
          if (type === TickMarkType.DayOfMonth) return formatTime(sec, { month: "short", day: "numeric", timeZone: tz });
          return formatTime(sec, { hour: "numeric", minute: "2-digit" });
        },
      },
      localization: {
        timeFormatter: (time: Time) => legendTime(time as number, interval),
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: crosshairLine,
          style: LineStyle.Dashed,
          width: 1,
          labelVisible: true,
          labelBackgroundColor: axisLabelBg,
        },
        horzLine: {
          color: crosshairLine,
          style: LineStyle.Dashed,
          width: 1,
          labelVisible: true,
          labelBackgroundColor: axisLabelBg,
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
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: cryptoUsdPriceFormat(1, formatPrice),
      priceLineVisible: true,
      priceLineStyle: LineStyle.Dotted,
      // Binance/CMC-style last-price axis badge (color follows last candle up/down).
      lastValueVisible: true,
    });

    const volumePriceFormat = {
      type: "custom" as const,
      minMove: 1,
      formatter: (v: number) => volumeFormatter.format(v),
    };
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: volumePriceFormat, priceLineVisible: false, lastValueVisible: false },
      1,
    );
    const volumePane = chart.panes()[1];
    volumePane?.setHeight(VOLUME_PANE_PX);

    let highLowFrame = 0;
    const updateHighLow = (range: LogicalRange | null) => {
      cancelAnimationFrame(highLowFrame);
      // Coordinates settle after the price scale autoscales for the new range.
      highLowFrame = requestAnimationFrame(() => {
        const bars = candlesRef.current;
        const from = range ? Math.max(0, Math.floor(range.from)) : 0;
        const to = range ? Math.min(bars.length - 1, Math.ceil(range.to)) : -1;
        if (!range || to < from) {
          setHighLow(null);
          return;
        }
        let hi = bars[from]!;
        let lo = bars[from]!;
        for (let i = from + 1; i <= to; i++) {
          const bar = bars[i]!;
          if (bar.high > hi.high) hi = bar;
          if (bar.low < lo.low) lo = bar;
        }
        const timeScale = chart.timeScale();
        const plotWidth = timeScale.width();
        const plotHeight = chart.panes()[0]?.getHeight() ?? 0;
        const label = (bar: OhlcBar, price: number): HighLowLabel | null => {
          const x = timeScale.timeToCoordinate(bar.time as UTCTimestamp);
          const y = candleSeries.priceToCoordinate(price);
          // Price-axis zoom can push the extreme outside the candle pane, where the label would float alone.
          if (x == null || y == null || x < 0 || x > plotWidth || y < 0 || y > plotHeight) return null;
          return { x, y, text: formatPrice(price), side: x > plotWidth / 2 ? "left" : "right" };
        };
        const high = label(hi, hi.high);
        const low = label(lo, lo.low);
        setHighLow(high || low ? { high, low } : null);
      });
    };
    refreshHighLowRef.current = () => updateHighLow(chart.timeScale().getVisibleLogicalRange());
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateHighLow);
    // Price-axis drag / wheel zoom / double-click reset don't emit a time-range change.
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons) refreshHighLowRef.current();
    };
    const onScaleGesture = () => refreshHighLowRef.current();
    // Axis double-click resets to the series end, which is now the far edge of the future whitespace.
    const onDoubleClick = () => {
      requestAnimationFrame(() => {
        const count = candlesRef.current.length;
        const range = chart.timeScale().getVisibleLogicalRange();
        if (count && range && range.from > count - 1) showLatestCandles(chart, count);
        refreshHighLowRef.current();
      });
    };
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onScaleGesture);
    el.addEventListener("wheel", onScaleGesture, { passive: true });
    el.addEventListener("dblclick", onDoubleClick);

    chart.subscribeCrosshairMove((param) => {
      setHoveredTime(param.time != null && param.seriesData.get(candleSeries) ? (param.time as number) : null);
    });

    const measureVolumeLegend = () => {
      const paneEl = chart.panes()[1]?.getHTMLElement();
      if (!paneEl) return;
      setVolumeLegendTop(paneEl.getBoundingClientRect().top - el.getBoundingClientRect().top);
    };
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: Math.max(2, el.clientWidth) });
      measureVolumeLegend();
      refreshHighLowRef.current();
    });
    ro.observe(el);
    requestAnimationFrame(measureVolumeLegend);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    return () => {
      setHoveredTime(null);
      setHighLow(null);
      ro.disconnect();
      cancelAnimationFrame(highLowFrame);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onScaleGesture);
      el.removeEventListener("wheel", onScaleGesture);
      el.removeEventListener("dblclick", onDoubleClick);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateHighLow);
      refreshHighLowRef.current = () => {};
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      initialRangeKeyRef.current = null;
    };
  }, [plotHeight, interval]);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    candlesRef.current = candles;
    const refClose = candles.at(-1)?.close ?? candles[0]?.close ?? 1;
    candleSeries.applyOptions({ priceFormat: cryptoUsdPriceFormat(refClose, formatPrice) });
    const last = candles.at(-1);
    candleSeries.setData([
      ...candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })),
      ...(last ? futureWhitespace(last.time, interval) : []),
    ]);

    const volumeUp = resolveFsColorWithAlpha("--fs-up", VOLUME_BAR_ALPHA);
    const volumeDown = resolveFsColorWithAlpha("--fs-down", VOLUME_BAR_ALPHA);
    volumeSeries.setData(
      candles.map((c) =>
        c.volume != null
          ? { time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? volumeUp : volumeDown }
          : { time: c.time as UTCTimestamp },
      ),
    );

    if (candles.length && initialRangeKeyRef.current !== requestKey) {
      showLatestCandles(chart, candles.length);
      initialRangeKeyRef.current = requestKey;
    }
    refreshHighLowRef.current();
  }, [candles, requestKey, interval]);

  const hoveredIndex = hoveredTime != null ? candles.findIndex((c) => c.time === hoveredTime) : -1;
  const legendIndex = hoveredIndex >= 0 ? hoveredIndex : candles.length - 1;
  const legendCandle = legendIndex >= 0 ? candles[legendIndex] : undefined;
  const legendVolume = legendCandle?.volume;

  return (
    <div className="relative w-full" style={{ height: plotHeight }}>
      <div
        className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-0", CHART_PLOT_BACKGROUND_CLASS)}
        style={{ height: plotHeight }}
        aria-hidden
      />
      <div ref={wrapRef} className="absolute inset-x-0 bottom-0 z-10" style={{ height: plotHeight }} />
      {!loading && highLow
        ? (["high", "low"] as const).map((key) => {
            const label = highLow[key];
            if (!label) return null;
            return (
            <div
              key={key}
              className={cn(
                "pointer-events-none absolute z-[11] flex items-center gap-1 text-[11px] leading-none tabular-nums text-fg",
                label.side === "left" && "flex-row-reverse",
              )}
              style={{
                top: label.y,
                left: label.x,
                transform: `translate(${label.side === "left" ? "-100%" : "0"}, -50%)`,
              }}
            >
              <span className="h-px w-3 bg-fg-muted" aria-hidden />
              {label.text}
            </div>
            );
          })
        : null}
      {!loading && volumeLegendTop != null && candles.length > 0 ? (
        <div
          className="pointer-events-none absolute left-0 z-[11] flex items-center gap-3 text-[12px] leading-4"
          style={{ top: volumeLegendTop + 4 }}
        >
          <span className="text-fg-muted">
            Volume <span className="tabular-nums text-fg">{legendVolume != null ? volumeFormatter.format(legendVolume) : "—"}</span>
          </span>
        </div>
      ) : null}
      {loading ? (
        <div className="absolute inset-0 z-10">
          <CandleChartSkeleton heightPx={plotHeight} className="h-full" />
        </div>
      ) : candles.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-fg-muted">
          No candle data for this interval.
        </div>
      ) : null}
    </div>
  );
}
