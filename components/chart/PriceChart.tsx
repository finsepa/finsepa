"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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

import { SkeletonBox } from "@/components/markets/skeleton";
import {
  computeChartHeaderMetrics,
  type ChartRangeSelection,
} from "@/components/chart/chart-display-metrics";
import { horzTimeToUnixSeconds, pointAtChartX } from "@/components/chart/chart-selection-utils";
import { formatAssetChartTimestamp } from "@/lib/market/chart-timestamp-format";
import type { StockChartRange, StockChartPoint } from "@/lib/market/stock-chart-types";

const MIN_DRAG_PX = 8;

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

type Props = {
  kind: "stock" | "crypto";
  symbol: string;
  range: StockChartRange;
  height?: number;
  onDisplayChange?: (state: ChartDisplayState) => void;
  /** Server-provided series for the default overview range — avoids a duplicate chart fetch on first paint. */
  initialChart?: { range: StockChartRange; points: StockChartPoint[] } | null;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const GREEN = "#16A34A";
const RED = "#DC2626";
const BASELINE_LINE = "rgba(113, 113, 122, 0.55)";

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

export function PriceChart({ kind, symbol, range, height = 320, onDisplayChange, initialChart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialConsumedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const baselinePriceLineRef = useRef<IPriceLine | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  const pointsRef = useRef<StockChartPoint[]>([]);
  const dragActiveRef = useRef(false);
  const rafRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<StockChartPoint[]>([]);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTimeUnix, setHoverTimeUnix] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<ChartRangeSelection>(null);
  const [dragPreview, setDragPreview] = useState<BandGeom | null>(null);
  const [selectionBand, setSelectionBand] = useState<BandGeom | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const metrics = useMemo(
    () => computeChartHeaderMetrics(points, hoverPrice, hoverTimeUnix, selection),
    [points, hoverPrice, hoverTimeUnix, selection],
  );

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
    const priceTimestampLabel =
      metrics.displayTimeUnix != null && Number.isFinite(metrics.displayTimeUnix)
        ? formatAssetChartTimestamp(metrics.displayTimeUnix, {
            kind,
            timeZone: dataTimeZoneHint,
          })
        : null;
    onDisplayChange?.({
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

  useEffect(() => {
    queueMicrotask(() => {
      setSelection(null);
      setSelectionBand(null);
      setDragPreview(null);
      setHoverTimeUnix(null);
    });
  }, [kind, symbol, range]);

  useEffect(() => {
    initialConsumedRef.current = false;
  }, [kind, symbol]);

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

    const series = chart.addSeries(BaselineSeries, {
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
        return;
      }
      const data = param.seriesData.get(s);
      if (data && typeof data === "object" && "value" in data && isFiniteNumber((data as { value: number }).value)) {
        setHoverPrice((data as { value: number }).value);
        const row = data as { value: number; time?: UTCTimestamp };
        let tunix: number | null =
          typeof row.time === "number" && Number.isFinite(row.time) ? row.time : null;
        if (tunix == null) tunix = horzTimeToUnixSeconds(param.time as Time);
        setHoverTimeUnix(tunix);
      } else {
        setHoverPrice(null);
        setHoverTimeUnix(null);
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
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

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
          ? `/api/stocks/${encodeURIComponent(symbol)}/chart?range=${encodeURIComponent(range)}`
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
  }, [kind, symbol, range, initialChart]);

  // Series data, baseline reference, dashed baseline line, last-point marker
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    const markers = markersRef.current;
    if (!series || !chart) return;

    if (!points.length) {
      series.setData([]);
      markers?.setMarkers([]);
      if (baselinePriceLineRef.current) {
        series.removePriceLine(baselinePriceLineRef.current);
        baselinePriceLineRef.current = null;
      }
      return;
    }

    const data = points
      .filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))
      .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));

    const open = data[0]?.value;
    if (!isFiniteNumber(open)) {
      series.setData([]);
      markers?.setMarkers([]);
      if (baselinePriceLineRef.current) {
        series.removePriceLine(baselinePriceLineRef.current);
        baselinePriceLineRef.current = null;
      }
      return;
    }

    series.applyOptions({ baseValue: { type: "price", price: open } });

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
      const m: SeriesMarker<UTCTimestamp> = {
        time: last.time,
        position: "inBar",
        shape: "circle",
        color: lastPointStroke,
        size: 1,
      };
      markers.setMarkers([m]);
    }
  }, [points, lastPointStroke]);

  const empty = !loading && points.length === 0;

  return (
    <div ref={containerRef} className="relative bg-transparent select-none" style={{ height }}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {containerWidth > 0 && dragPreview && dragPreview.width > 1 ? (
          <SelectionLayers containerWidth={containerWidth} band={dragPreview} />
        ) : null}
        {containerWidth > 0 && selection && selectionBand && !dragPreview ? (
          <SelectionLayers containerWidth={containerWidth} band={selectionBand} />
        ) : null}
      </div>
      <div
        ref={wrapRef}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out ${
          loading || !ready ? "opacity-0" : "opacity-100"
        }`}
        onPointerDown={handlePointerDown}
      />
      {loading ? (
        <div className="absolute inset-0 z-20 px-1 py-1">
          <SkeletonBox className="h-full w-full rounded-md" />
        </div>
      ) : null}
      {empty ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-[14px] text-[#71717A]">
          No price data for this range.
        </div>
      ) : null}
    </div>
  );
}
