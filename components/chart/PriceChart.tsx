"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  BaselineSeries,
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineStyle,
  LineType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import {
  computeChartHeaderMetrics,
  type ChartRangeSelection,
} from "@/components/chart/chart-display-metrics";
import { horzTimeToUnixSeconds, nearestPointByTime, pointAtChartX } from "@/components/chart/chart-selection-utils";
import { formatAssetChartTimestamp } from "@/lib/market/chart-timestamp-format";
import type { StockChartRange, StockChartPoint, StockChartSeries } from "@/lib/market/stock-chart-types";

const MIN_DRAG_PX = 8;

function formatStockPriceAxis(p: number): string {
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMarketCapAxis(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Total-return index (100 = range start); show as % from start. */
function formatReturnAxis(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const rel = n - 100;
  const sign = rel > 0 ? "+" : rel < 0 ? "−" : "";
  return `${sign}${Math.abs(rel).toFixed(2)}%`;
}

export type ChartDisplayState = {
  loading: boolean;
  empty: boolean;
  displayPrice: number | null;
  displayChangePct: number | null;
  displayChangeAbs: number | null;
  isHovering: boolean;
  selectionActive: boolean;
  periodLabelOverride: string | null;
  /** Formatted "Month D, YYYY at h:mm AM/PM TZ, USD"; null when no display time. */
  priceTimestampLabel: string | null;
};

export type HoldingsTradeMarker = { date: string; side: "buy" | "sell" };
export type HoldingsTradeTooltipItem = { date: string; lines: string[] };

type Props = {
  kind: "stock" | "crypto";
  symbol: string;
  range: StockChartRange;
  /** Stock overview: price vs market cap (market cap uses price × latest shares outstanding per point). */
  series?: StockChartSeries;
  height?: number;
  onDisplayChange?: (state: ChartDisplayState) => void;
  /** Server-provided series for the default overview range — avoids a duplicate chart fetch on first paint. */
  initialChart?: { range: StockChartRange; points: StockChartPoint[] } | null;
  /**
   * Asset Holdings tab: blue area chart, no range-drag P/L selection, optional avg-cost line + trade dots.
   * Does not call `onDisplayChange` (keeps stock/crypto header on overview metrics).
   */
  holdingsStyle?: boolean;
  /** Trade dates (yyyy-MM-dd) shown as green (buy) / red (sell) dots, snapped to bars in range. */
  tradeMarkers?: readonly HoldingsTradeMarker[];
  /** Optional: lines shown when hovering on a day with trade markers. Keyed by `date` (yyyy-MM-dd). */
  tradeTooltipItems?: readonly HoldingsTradeTooltipItem[];
  /** Avg cost — dashed horizontal price line when holdingsStyle. */
  costBasisPrice?: number | null;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const GREEN = "#16A34A";
const RED = "#DC2626";
const VALUE_BLUE = "#2563EB";
const BASELINE_LINE = "rgba(113, 113, 122, 0.55)";

function ymdToBarTime(ymd: string, data: readonly { time: UTCTimestamp }[]): UTCTimestamp | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, mo, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const midnight = Math.floor(Date.UTC(y, mo - 1, d) / 1000) as UTCTimestamp;
  if (data.some((p) => p.time === midnight)) return midnight;
  const dayEnd = midnight + 86400;
  const onDay = data.filter((p) => p.time >= midnight && p.time < dayEnd);
  if (onDay.length > 0) return onDay[onDay.length - 1]!.time;
  return null;
}

function tradeMarkersForChart(
  tradeMarkers: readonly HoldingsTradeMarker[],
  data: readonly { time: UTCTimestamp }[],
): SeriesMarker<UTCTimestamp>[] {
  const out: SeriesMarker<UTCTimestamp>[] = [];
  for (const tm of tradeMarkers) {
    const time = ymdToBarTime(tm.date, data);
    if (time == null) continue;
    out.push({
      time,
      position: "inBar",
      shape: "circle",
      color: tm.side === "buy" ? GREEN : RED,
      size: 2,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

function costBasisPriceLineTitle(price: number): string {
  const s = price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `My cost / sh: $${s}`;
}

function ymdFromUnixSeconds(sec: number): string | null {
  if (!Number.isFinite(sec)) return null;
  try {
    return new Date(sec * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/** `ymd` is yyyy-MM-dd (UTC calendar day of the bar). */
function formatTradeTooltipDateHeader(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, mo, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type BandGeom = { left: number; width: number; positive: boolean };

function SelectionLayers({ containerWidth, band }: { containerWidth: number; band: BandGeom }) {
  if (containerWidth <= 0 || band.width <= 0) return null;
  const l = (band.left / containerWidth) * 100;
  const w = (band.width / containerWidth) * 100;
  const dim = "rgba(9, 9, 11, 0.06)";
  const hi = band.positive ? "rgba(22, 163, 74, 0.10)" : "rgba(220, 38, 38, 0.10)";
  return (
    <>
      {band.left > 0 ? (
        <div className="absolute inset-y-0 left-0" style={{ width: `${l}%`, background: dim }} />
      ) : null}
      <div
        className="absolute inset-y-0 border-x border-[rgba(9,9,11,0.04)]"
        style={{ left: `${l}%`, width: `${w}%`, background: hi }}
      />
      {band.left + band.width < containerWidth ? (
        <div
          className="absolute inset-y-0 right-0"
          style={{
            width: `${100 - l - w}%`,
            background: dim,
          }}
        />
      ) : null}
    </>
  );
}

export function PriceChart({
  kind,
  symbol,
  range,
  series = "price",
  height = 320,
  onDisplayChange,
  initialChart,
  holdingsStyle = false,
  tradeMarkers = [],
  tradeTooltipItems = [],
  costBasisPrice = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialConsumedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Baseline"> | ISeriesApi<"Area"> | null>(null);
  const baselinePriceLineRef = useRef<IPriceLine | null>(null);
  const costBasisLineRef = useRef<IPriceLine | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  const pointsRef = useRef<StockChartPoint[]>([]);
  const dragActiveRef = useRef(false);
  const rafRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<StockChartPoint[]>([]);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTimeUnix, setHoverTimeUnix] = useState<number | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverPointRafRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<ChartRangeSelection>(null);
  const [dragPreview, setDragPreview] = useState<BandGeom | null>(null);
  const [selectionBand, setSelectionBand] = useState<BandGeom | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const crosshairForHeader = useMemo((): { price: number; timeUnix: number } | null => {
    if (!holdingsStyle) return null;
    if (hoverPrice == null || !Number.isFinite(hoverPrice)) return null;
    if (hoverTimeUnix == null || !Number.isFinite(hoverTimeUnix)) return null;
    return { price: hoverPrice, timeUnix: hoverTimeUnix };
  }, [holdingsStyle, hoverPrice, hoverTimeUnix]);

  const metrics = useMemo(
    () => computeChartHeaderMetrics(points, selection, crosshairForHeader),
    [points, selection, crosshairForHeader],
  );

  const tooltipByDate = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const it of tradeTooltipItems) {
      const k = it.date.trim();
      if (!k) continue;
      const lines = Array.isArray(it.lines) ? it.lines.filter((s) => typeof s === "string" && s.trim()) : [];
      if (lines.length) m.set(k, lines);
    }
    return m;
  }, [tradeTooltipItems]);

  const dataTimeZoneHint = useMemo(
    () => points.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone,
    [points],
  );

  const lastPointStroke = useMemo(() => {
    const first = points.find((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value));
    if (first == null || points.length < 1) return GREEN;
    const last = points[points.length - 1]?.value;
    return isFiniteNumber(last) && last < first.value ? RED : GREEN;
  }, [points]);

  const pushDisplay = useCallback(() => {
    if (!onDisplayChange) return;
    const priceTimestampLabel =
      metrics.displayTimeUnix != null && Number.isFinite(metrics.displayTimeUnix)
        ? formatAssetChartTimestamp(metrics.displayTimeUnix, {
            kind,
            timeZone: dataTimeZoneHint,
          })
        : null;
    onDisplayChange({
      loading,
      empty: !loading && points.length === 0,
      displayPrice: metrics.displayPrice,
      displayChangePct: metrics.displayChangePct,
      displayChangeAbs: metrics.displayChangeAbs,
      isHovering: metrics.isHovering,
      selectionActive: metrics.selectionActive,
      periodLabelOverride: metrics.periodLabelOverride,
      priceTimestampLabel,
    });
  }, [loading, points.length, metrics, onDisplayChange, kind, dataTimeZoneHint]);

  useEffect(() => {
    pushDisplay();
  }, [pushDisplay]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /** Clear range-drag selection immediately when series/range/etc. change so header metrics don’t keep stale selection prices (e.g. $258) while the series switches to market cap / return). */
  useLayoutEffect(() => {
    setSelection(null);
    setSelectionBand(null);
    setDragPreview(null);
    setHoverTimeUnix(null);
    initialConsumedRef.current = false;
  }, [kind, symbol, range, series, holdingsStyle]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!selection) return;
      if (containerRef.current?.contains(e.target as Node)) return;
      setSelection(null);
      setSelectionBand(null);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !selection) return;
      setSelection(null);
      setSelectionBand(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  // Create chart once.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
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
      timeScale: {
        borderVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
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
      handleScroll: false,
      handleScale: false,
    });

    const series = holdingsStyle
      ? chart.addSeries(AreaSeries, {
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
          topFillColor1: "rgba(22, 163, 74, 0.20)",
          topFillColor2: "rgba(22, 163, 74, 0.03)",
          topLineColor: GREEN,
          bottomFillColor1: "rgba(220, 38, 38, 0.03)",
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

    const markers = createSeriesMarkers(series, [], { autoScale: true });
    markersRef.current = markers as ISeriesMarkersPluginApi<UTCTimestamp>;

    chartRef.current = chart;
    seriesRef.current = series;

    const onCrosshairMove = (param: MouseEventParams) => {
      if (dragActiveRef.current) return;
      const s = seriesRef.current;
      if (!s) return;
      if (param.point === undefined || param.point.x < 0 || param.point.y < 0 || param.time === undefined) {
        setHoverPrice(null);
        setHoverTimeUnix(null);
        hoverPointRef.current = null;
        if (hoverPointRafRef.current) {
          cancelAnimationFrame(hoverPointRafRef.current);
          hoverPointRafRef.current = 0;
        }
        setHoverPoint(null);
        return;
      }
      const nextPt = { x: param.point.x, y: param.point.y };
      const prev = hoverPointRef.current;
      if (!prev || prev.x !== nextPt.x || prev.y !== nextPt.y) {
        hoverPointRef.current = nextPt;
        if (!hoverPointRafRef.current) {
          hoverPointRafRef.current = requestAnimationFrame(() => {
            hoverPointRafRef.current = 0;
            setHoverPoint(hoverPointRef.current);
          });
        }
      }
      const data = param.seriesData.get(s);
      let hoverValue: number | null = null;
      let tunix: number | null = null;
      if (data && typeof data === "object" && "value" in data && isFiniteNumber((data as { value: number }).value)) {
        hoverValue = (data as { value: number }).value;
        const row = data as { value: number; time?: UTCTimestamp };
        tunix =
          typeof row.time === "number" && Number.isFinite(row.time) ? row.time : horzTimeToUnixSeconds(param.time as Time);
      } else if (holdingsStyle) {
        const sec = horzTimeToUnixSeconds(param.time as Time);
        const near = sec != null ? nearestPointByTime(pointsRef.current, sec) : null;
        if (near && isFiniteNumber(near.time) && isFiniteNumber(near.value)) {
          hoverValue = near.value;
          tunix = near.time;
        }
      }
      if (hoverValue != null && tunix != null) {
        setHoverPrice(hoverValue);
        setHoverTimeUnix(tunix);
      } else {
        setHoverPrice(null);
        setHoverTimeUnix(null);
        hoverPointRef.current = null;
        if (hoverPointRafRef.current) {
          cancelAnimationFrame(hoverPointRafRef.current);
          hoverPointRafRef.current = 0;
        }
        setHoverPoint(null);
      }
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) chart.resize(w, height);
    });
    ro.observe(el);
    chart.resize(el.clientWidth, height);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      markersRef.current = null;
      baselinePriceLineRef.current = null;
      costBasisLineRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, holdingsStyle]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const fmt =
      kind === "stock" && series === "marketCap"
        ? formatMarketCapAxis
        : kind === "stock" && series === "return"
          ? formatReturnAxis
          : formatStockPriceAxis;
    chart.applyOptions({
      localization: { priceFormatter: fmt },
    });
  }, [kind, series]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || loading || !pointsRef.current.length || !chartRef.current || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < 0 || x > rect.width) return;
      e.preventDefault();
      setSelection(null);
      setSelectionBand(null);
      dragActiveRef.current = true;
      setHoverPrice(null);
      setHoverTimeUnix(null);
      const startX = x;
      try {
        wrapRef.current.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const onMove = (ev: PointerEvent) => {
        const r = wrapRef.current?.getBoundingClientRect();
        const chart = chartRef.current;
        const pts = pointsRef.current;
        if (!r || !chart || pts.length < 1) return;
        const cx = Math.max(0, Math.min(r.width, ev.clientX - r.left));
        const left = Math.min(startX, cx);
        const width = Math.abs(cx - startX);
        const pA = pointAtChartX(chart, pts, startX);
        const pB = pointAtChartX(chart, pts, cx);
        const positive = pA && pB ? pB.value >= pA.value : true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          if (width < 1) setDragPreview(null);
          else setDragPreview({ left, width, positive });
        });
      };

      const finish = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        dragActiveRef.current = false;
        setDragPreview(null);
        try {
          wrapRef.current?.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }

        const r = wrapRef.current?.getBoundingClientRect();
        const chart = chartRef.current;
        const pts = pointsRef.current;
        if (!r || !chart || pts.length < 1) return;
        const endX = Math.max(0, Math.min(r.width, ev.clientX - r.left));
        const w = Math.abs(endX - startX);
        if (w < MIN_DRAG_PX) return;
        const p0 = pointAtChartX(chart, pts, startX);
        const p1 = pointAtChartX(chart, pts, endX);
        if (!p0 || !p1) return;
        const left = Math.min(startX, endX);
        const positive = p1.value >= p0.value;
        setSelection({
          startPrice: p0.value,
          endPrice: p1.value,
          endTimeUnix: p1.time,
        });
        setSelectionBand({ left, width: w, positive });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [loading],
  );

  // Fetch
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (
        series === "price" &&
        initialChart &&
        initialChart.range === range &&
        initialChart.points.length > 0 &&
        !initialConsumedRef.current
      ) {
        initialConsumedRef.current = true;
        setLoading(true);
        setHoverPrice(null);
        setHoverTimeUnix(null);
        setSelection(null);
        setSelectionBand(null);
        setReady(false);
        setPoints(initialChart.points);
        setLoading(false);
        requestAnimationFrame(() => setReady(true));
        return;
      }

      setLoading(true);
      setHoverPrice(null);
      setHoverTimeUnix(null);
      setSelection(null);
      setSelectionBand(null);
      setReady(false);
      const path =
        kind === "stock"
          ? `/api/stocks/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}&series=${encodeURIComponent(series)}`
          : `/api/crypto/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}`;
      try {
        const res = await fetch(path, { credentials: "include" });
        if (!res.ok) {
          if (!mounted) return;
          setPoints([]);
          setLoading(false);
          requestAnimationFrame(() => setReady(true));
          return;
        }
        const json = (await res.json()) as { points?: StockChartPoint[] };
        if (!mounted) return;
        setPoints(Array.isArray(json.points) ? json.points : []);
        setLoading(false);
        requestAnimationFrame(() => setReady(true));
      } catch {
        if (!mounted) return;
        setPoints([]);
        setLoading(false);
        requestAnimationFrame(() => setReady(true));
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [kind, symbol, range, series, initialChart]);

  // Series data, price lines, markers
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    const markers = markersRef.current;
    if (!series || !chart) return;

    const removeBaselineLine = () => {
      if (baselinePriceLineRef.current) {
        try {
          series.removePriceLine(baselinePriceLineRef.current);
        } catch {
          /* ignore */
        }
        baselinePriceLineRef.current = null;
      }
    };

    const removeCostLine = () => {
      if (costBasisLineRef.current) {
        try {
          series.removePriceLine(costBasisLineRef.current);
        } catch {
          /* ignore */
        }
        costBasisLineRef.current = null;
      }
    };

    if (!points.length) {
      series.setData([]);
      markers?.setMarkers([]);
      removeBaselineLine();
      removeCostLine();
      return;
    }

    const data = points
      .filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))
      .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));

    const open = data[0]?.value;
    if (!isFiniteNumber(open)) {
      series.setData([]);
      markers?.setMarkers([]);
      removeBaselineLine();
      removeCostLine();
      return;
    }

    if (holdingsStyle) {
      removeBaselineLine();
      series.setData(data);
      chart.timeScale().fitContent();

      if (costBasisPrice != null && Number.isFinite(costBasisPrice) && costBasisPrice > 0) {
        const title = costBasisPriceLineTitle(costBasisPrice);
        let cbl = costBasisLineRef.current;
        if (!cbl) {
          cbl = series.createPriceLine({
            price: costBasisPrice,
            color: BASELINE_LINE,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title,
          });
          costBasisLineRef.current = cbl;
        } else {
          cbl.applyOptions({ price: costBasisPrice, title });
        }
      } else {
        removeCostLine();
      }

      markers?.setMarkers(tradeMarkersForChart(tradeMarkers, data));
      return;
    }

    removeCostLine();
    (series as ISeriesApi<"Baseline">).applyOptions({ baseValue: { type: "price", price: open } });

    let bl = baselinePriceLineRef.current;
    if (!bl) {
      bl = series.createPriceLine({
        price: open,
        color: BASELINE_LINE,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        lineVisible: true,
      });
      baselinePriceLineRef.current = bl;
    } else {
      bl.applyOptions({ price: open });
    }

    series.setData(data);
    chart.timeScale().fitContent();

    const last = data[data.length - 1];
    if (markers && last) {
      markers.setMarkers([
        {
          time: last.time,
          position: "inBar",
          shape: "circle",
          color: lastPointStroke,
          size: 1,
        },
      ]);
    }
  }, [points, lastPointStroke, holdingsStyle, tradeMarkers, costBasisPrice]);

  const empty = !loading && points.length === 0;
  const hoverYmd = useMemo(
    () => (holdingsStyle && hoverTimeUnix != null ? ymdFromUnixSeconds(hoverTimeUnix) : null),
    [holdingsStyle, hoverTimeUnix],
  );
  const hoverTradeLines = hoverYmd ? tooltipByDate.get(hoverYmd) ?? null : null;

  const overviewHoverTooltip = useMemo(() => {
    if (holdingsStyle) return null;
    if (hoverPoint == null || hoverPrice == null || hoverTimeUnix == null) return null;
    if (!Number.isFinite(hoverPrice) || !Number.isFinite(hoverTimeUnix)) return null;
    const dateLabel = formatAssetChartTimestamp(hoverTimeUnix, {
      kind,
      timeZone: dataTimeZoneHint,
    });
    const valueLabel =
      kind === "stock" && series === "marketCap"
        ? formatMarketCapAxis(hoverPrice)
        : kind === "stock" && series === "return"
          ? formatReturnAxis(hoverPrice)
          : `$${formatStockPriceAxis(hoverPrice)}`;
    return { dateLabel, valueLabel };
  }, [holdingsStyle, hoverPoint, hoverPrice, hoverTimeUnix, kind, series, dataTimeZoneHint]);

  return (
    <div ref={containerRef} className="relative z-0 bg-transparent select-none" style={{ height }}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {containerWidth > 0 && !holdingsStyle && dragPreview && dragPreview.width > 1 ? (
          <SelectionLayers containerWidth={containerWidth} band={dragPreview} />
        ) : null}
        {containerWidth > 0 && !holdingsStyle && selection && selectionBand && !dragPreview ? (
          <SelectionLayers containerWidth={containerWidth} band={selectionBand} />
        ) : null}
      </div>
      <div
        ref={wrapRef}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out ${
          loading || !ready ? "opacity-0" : "opacity-100"
        }`}
        onPointerDown={holdingsStyle ? undefined : handlePointerDown}
      />
      {holdingsStyle && hoverPoint && hoverYmd && hoverTradeLines && hoverTradeLines.length > 0 ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[220px] max-w-[280px] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] leading-4 text-[#09090B] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)]"
          style={{
            left: Math.min(Math.max(8, hoverPoint.x + 12), Math.max(8, containerWidth - 292)),
            top: Math.max(8, hoverPoint.y - 12),
            transform: "translateY(-100%)",
          }}
          role="status"
        >
          <div className="font-semibold text-[#09090B]">{formatTradeTooltipDateHeader(hoverYmd)}</div>
          <div className="mt-1 space-y-1 text-[#71717A]">
            {hoverTradeLines.slice(0, 6).map((line, i) => (
              <div key={`${hoverYmd}-${i}`} className="whitespace-normal break-words">
                {line}
              </div>
            ))}
            {hoverTradeLines.length > 6 ? <div className="text-[#A1A1AA]">+{hoverTradeLines.length - 6} more</div> : null}
          </div>
        </div>
      ) : null}
      {!holdingsStyle && overviewHoverTooltip && hoverPoint ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[200px] max-w-[min(100%,280px)] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] leading-4 text-[#09090B] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)]"
          style={{
            left: Math.min(Math.max(8, hoverPoint.x + 12), Math.max(8, containerWidth - 292)),
            top: Math.max(8, hoverPoint.y - 12),
            transform: "translateY(-100%)",
          }}
          role="tooltip"
        >
          <div className="font-normal text-[#71717A]">{overviewHoverTooltip.dateLabel}</div>
          <div className="mt-1 tabular-nums font-semibold text-[#09090B]">{overviewHoverTooltip.valueLabel}</div>
        </div>
      ) : null}
      {loading ? (
        <div className="absolute inset-0 z-20 flex flex-col px-1 py-1">
          <ChartSkeleton fill variant="minimal" />
        </div>
      ) : null}
      {empty ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-[14px] text-[#71717A]">
          {kind === "stock" && series === "marketCap"
            ? "No market cap data for this range (shares outstanding unavailable)."
            : kind === "stock" && series === "return"
              ? "No return data for this range."
              : "No price data for this range."}
        </div>
      ) : null}
    </div>
  );
}
