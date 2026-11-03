"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { ChartBrandWatermark } from "@/components/chart/chart-brand-watermark";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { SegmentedControl, type SegmentedControlOption } from "@/components/design-system";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { CHART_PLOT_BACKGROUND_CLASS } from "@/lib/chart/fundamentals-chart-surface";
import {
  CRYPTO_CANDLE_INTERVALS,
  CRYPTO_DAILY_CANDLE_INTERVALS,
  isCryptoIntradayCandleInterval,
  type CryptoCandleInterval,
  type CryptoCandlesResponse,
} from "@/lib/market/crypto-candles-shared";
import type { OhlcBar } from "@/lib/market/eodhd-ohlc";
import { resolveFsColor, resolveFsColorWithAlpha } from "@/lib/theme/resolve-fs-color";
import { cn } from "@/lib/utils";

const FONT_FAMILY = "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

/** Neutral axis pill for crosshair price/time labels — readable on light and dark panels. */
const CROSSHAIR_LABEL_BG = "#52525B";

/** Room above the plot for the MA legend row. */
const LEGEND_HEIGHT_PX = 22;
const VOLUME_PANE_PX = 72;
const VOLUME_BAR_ALPHA = 0.45;
const VOLUME_MA_PERIOD = 20;
/** Candles shown on first paint — older history stays one drag away. */
const INITIAL_VISIBLE_BARS = 120;

const MOVING_AVERAGES = [
  { period: 5, color: "#F59E0B" },
  { period: 10, color: "#A855F7" },
  { period: 20, color: "#3B82F6" },
  { period: 30, color: "#EC4899" },
] as const;
const VOLUME_MA_COLOR = "#F59E0B";

/** Visible-range high/low callout — leader line points inward so edge candles never clip the price. */
type HighLowLabel = { x: number; y: number; text: string; side: "left" | "right" };

const BUCKET_SEC: Record<CryptoCandleInterval, number> = {
  "1m": 60,
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

function refreshMs(interval: CryptoCandleInterval, live: boolean): number | null {
  if (!live) return 5 * 60_000;
  return interval === "1m" || interval === "5m" ? 15_000 : 30_000;
}

const priceFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const smallPriceFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
const volumeFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

function formatPrice(v: number): string {
  return Math.abs(v) < 1 ? smallPriceFormatter.format(v) : priceFormatter.format(v);
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

/** Simple moving average of closes; `null` until enough candles exist. */
function movingAverage(values: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
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

/** MA values for the hovered (or latest) candle, above the plot. */
function MovingAverageLegend({ maValues }: { maValues: (number | null)[] }) {
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-[11] flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] leading-4">
      <span className="text-fg-muted">MA({MOVING_AVERAGES.map((m) => m.period).join(",")})</span>
      {MOVING_AVERAGES.map((ma, i) => (
        <span key={ma.period} className="whitespace-nowrap tabular-nums" style={{ color: ma.color }}>
          MA{ma.period}: {maValues[i] != null ? formatPrice(maValues[i]!) : "—"}
        </span>
      ))}
    </div>
  );
}

export function CryptoCandleChart({
  symbol,
  interval,
  liveSpotUsd = null,
  liveQuotedAtSec = null,
  height = 380,
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
  const maSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const volumeMaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candlesRef = useRef<OhlcBar[]>([]);
  const refreshHighLowRef = useRef<() => void>(() => {});
  const initialRangeKeyRef = useRef<string | null>(null);

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

  const maLines = useMemo(() => {
    const closes = candles.map((c) => c.close);
    return MOVING_AVERAGES.map((ma) => movingAverage(closes, ma.period));
  }, [candles]);

  const volumeMa = useMemo(() => {
    const volumes = candles.map((c) => c.volume ?? 0);
    return movingAverage(volumes, VOLUME_MA_PERIOD);
  }, [candles]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const intraday = isCryptoIntradayCandleInterval(interval);
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
        panes: {
          separatorColor: resolveFsColor("--fs-stroke"),
          separatorHoverColor: "#00000000",
          enableResize: false,
        },
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
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
        mode: CrosshairMode.Normal,
        vertLine: { color: crosshairLine, style: LineStyle.Dashed, width: 1, labelBackgroundColor: CROSSHAIR_LABEL_BG },
        horzLine: { color: crosshairLine, style: LineStyle.Dashed, width: 1, labelBackgroundColor: CROSSHAIR_LABEL_BG },
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
      priceFormat: { type: "custom", minMove: 0.01, formatter: formatPrice },
      priceLineVisible: true,
      priceLineStyle: LineStyle.Dotted,
      lastValueVisible: true,
    });

    maSeriesRef.current = MOVING_AVERAGES.map((ma) =>
      chart.addSeries(LineSeries, {
        color: ma.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }),
    );

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
    const volumeMaSeries = chart.addSeries(
      LineSeries,
      {
        color: VOLUME_MA_COLOR,
        lineWidth: 1,
        priceFormat: volumePriceFormat,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      },
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
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onScaleGesture);
    el.addEventListener("wheel", onScaleGesture, { passive: true });
    el.addEventListener("dblclick", onScaleGesture);

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
    volumeMaSeriesRef.current = volumeMaSeries;
    return () => {
      setHoveredTime(null);
      setHighLow(null);
      ro.disconnect();
      cancelAnimationFrame(highLowFrame);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onScaleGesture);
      el.removeEventListener("wheel", onScaleGesture);
      el.removeEventListener("dblclick", onScaleGesture);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateHighLow);
      refreshHighLowRef.current = () => {};
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      maSeriesRef.current = [];
      volumeSeriesRef.current = null;
      volumeMaSeriesRef.current = null;
      initialRangeKeyRef.current = null;
    };
  }, [height, interval]);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const volumeMaSeries = volumeMaSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries || !volumeMaSeries) return;

    candlesRef.current = candles;
    candleSeries.setData(
      candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })),
    );
    maSeriesRef.current.forEach((series, i) => {
      const values = maLines[i] ?? [];
      series.setData(
        candles.map((c, j) =>
          values[j] != null ? { time: c.time as UTCTimestamp, value: values[j]! } : { time: c.time as UTCTimestamp },
        ),
      );
    });

    const volumeUp = resolveFsColorWithAlpha("--fs-up", VOLUME_BAR_ALPHA);
    const volumeDown = resolveFsColorWithAlpha("--fs-down", VOLUME_BAR_ALPHA);
    volumeSeries.setData(
      candles.map((c) =>
        c.volume != null
          ? { time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? volumeUp : volumeDown }
          : { time: c.time as UTCTimestamp },
      ),
    );
    volumeMaSeries.setData(
      candles.map((c, j) =>
        volumeMa[j] != null && c.volume != null
          ? { time: c.time as UTCTimestamp, value: volumeMa[j]! }
          : { time: c.time as UTCTimestamp },
      ),
    );

    const timeScale = chart.timeScale();
    if (candles.length && initialRangeKeyRef.current !== requestKey) {
      timeScale.setVisibleLogicalRange({
        from: Math.max(0, candles.length - INITIAL_VISIBLE_BARS),
        to: candles.length - 1 + 4,
      });
      initialRangeKeyRef.current = requestKey;
    }
    refreshHighLowRef.current();
  }, [candles, maLines, volumeMa, requestKey]);

  const hoveredIndex = hoveredTime != null ? candles.findIndex((c) => c.time === hoveredTime) : -1;
  const legendIndex = hoveredIndex >= 0 ? hoveredIndex : candles.length - 1;
  const legendCandle = legendIndex >= 0 ? candles[legendIndex] : undefined;
  const legendMa = maLines.map((values) => values[legendIndex] ?? null);
  const legendVolume = legendCandle?.volume;
  const legendVolumeMa = legendIndex >= 0 ? volumeMa[legendIndex] : null;

  return (
    <div className="relative w-full" style={{ height: height + LEGEND_HEIGHT_PX }}>
      {legendCandle && !loading ? <MovingAverageLegend maValues={legendMa} /> : null}
      <div
        className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-0", CHART_PLOT_BACKGROUND_CLASS)}
        style={{ height }}
        aria-hidden
      >
        <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
        {!loading && candles.length > 0 ? <ChartBrandWatermark cover="full" /> : null}
      </div>
      <div ref={wrapRef} className="absolute inset-x-0 bottom-0 z-10" style={{ height }} />
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
                top: LEGEND_HEIGHT_PX + label.y,
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
          style={{ top: LEGEND_HEIGHT_PX + volumeLegendTop + 4 }}
        >
          <span className="text-fg-muted">
            Volume <span className="tabular-nums text-fg">{legendVolume != null ? volumeFormatter.format(legendVolume) : "—"}</span>
          </span>
          <span className="tabular-nums" style={{ color: VOLUME_MA_COLOR }}>
            MA{VOLUME_MA_PERIOD}: {legendVolumeMa != null && legendVolume != null ? volumeFormatter.format(legendVolumeMa) : "—"}
          </span>
        </div>
      ) : null}
      {loading ? (
        <div className="absolute inset-0 z-10">
          <AssetChartSkeleton heightPx={height + LEGEND_HEIGHT_PX} className="h-full" />
        </div>
      ) : candles.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-fg-muted">
          No candle data for this interval.
        </div>
      ) : null}
    </div>
  );
}
