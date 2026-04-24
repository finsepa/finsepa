"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
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
  type UTCTimestamp,
} from "lightweight-charts";

import { horzTimeToUnixSeconds, nearestPointByTime } from "@/components/chart/chart-selection-utils";
import type { CompanyPick } from "@/components/charting/company-picker";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { formatAssetChartTimestamp } from "@/lib/market/chart-timestamp-format";
import type { StockChartPoint, StockChartRange } from "@/lib/market/stock-chart-types";

const PRIMARY_BLUE = "#2563EB";

/** Line colors for additional compare tickers (primary is blue area). */
export const STOCK_OVERVIEW_COMPARE_LINE_COLORS = [
  "#EA580C",
  "#CA8A04",
  "#9333EA",
  "#DB2777",
  "#0891B2",
  "#4F46E5",
  "#059669",
  "#BE123C",
  "#B45309",
  "#0F766E",
  "#7C3AED",
  "#C026D3",
] as const;

const TOOLTIP_MAX_W = 280;
const TOOLTIP_GAP_PX = 6;
const TOOLTIP_EDGE_PAD = 8;

function layoutPointTooltip(
  hover: { x: number; y: number },
  containerWidth: number,
  chartHeight: number,
  estimatedHeight: number,
): { left: number; top: number; transform: string } {
  const left = Math.min(
    Math.max(TOOLTIP_EDGE_PAD, hover.x + TOOLTIP_GAP_PX),
    Math.max(TOOLTIP_EDGE_PAD, containerWidth - TOOLTIP_MAX_W - TOOLTIP_EDGE_PAD),
  );
  const minTop = TOOLTIP_EDGE_PAD;
  const bottomLimit = chartHeight - TOOLTIP_EDGE_PAD;
  const placeAbove = hover.y >= estimatedHeight + TOOLTIP_GAP_PX + minTop;
  if (placeAbove) {
    return { left, top: hover.y - TOOLTIP_GAP_PX, transform: "translateY(-100%)" };
  }
  const top = Math.max(minTop, Math.min(hover.y + TOOLTIP_GAP_PX, bottomLimit - estimatedHeight));
  return { left, top, transform: "none" };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function formatReturnPctFromIndex(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const r = v - 100;
  const sign = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${sign}${Math.abs(r).toFixed(2)}%`;
}

function formatAxisReturn(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const rel = n - 100;
  const sign = rel > 0 ? "+" : rel < 0 ? "−" : "";
  return `${sign}${Math.abs(rel).toFixed(2)}%`;
}

type Props = {
  primaryTicker: string;
  comparePicks: readonly CompanyPick[];
  range: StockChartRange;
  height?: number;
};

export function StockCompareReturnChart({ primaryTicker, comparePicks, range, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const primarySeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const compareSeriesRefs = useRef<ISeriesApi<"Line">[]>([]);
  const primaryPointsRef = useRef<StockChartPoint[]>([]);
  const comparePointsListRef = useRef<StockChartPoint[][]>([]);
  const comparePicksRef = useRef<readonly CompanyPick[]>(comparePicks);

  const [loading, setLoading] = useState(true);
  const [primaryPts, setPrimaryPts] = useState<StockChartPoint[]>([]);
  const [comparePtsList, setComparePtsList] = useState<StockChartPoint[][]>(() =>
    comparePicks.map(() => []),
  );
  const [ready, setReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    dateLabel: string;
    lines: { label: string; color: string }[];
  } | null>(null);

  const pSym = primaryTicker.trim().toUpperCase();
  /** Preserve picker order (stable fetch + series index). */
  const compareSlotsKey = useMemo(
    () => comparePicks.map((p) => p.symbol.trim().toUpperCase()).join("|"),
    [comparePicks],
  );

  useEffect(() => {
    primaryPointsRef.current = primaryPts;
  }, [primaryPts]);
  useEffect(() => {
    comparePointsListRef.current = comparePtsList;
  }, [comparePtsList]);
  useEffect(() => {
    comparePicksRef.current = comparePicks;
  }, [comparePicks]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setReady(false);
      const syms = compareSlotsKey.split("|").filter((s) => s.length > 0);
      const path = (t: string) =>
        `/api/stocks/${encodeURIComponent(t)}/chart?range=${encodeURIComponent(range)}&series=return`;
      try {
        const [ra, ...rOthers] = await Promise.all([
          fetch(path(pSym), { credentials: "include" }),
          ...syms.map((s) => fetch(path(s), { credentials: "include" })),
        ]);
        const ja = ra.ok ? ((await ra.json()) as { points?: StockChartPoint[] }) : { points: [] };
        const rest: StockChartPoint[][] = [];
        for (const rb of rOthers) {
          const jb = rb.ok ? ((await rb.json()) as { points?: StockChartPoint[] }) : { points: [] };
          rest.push(Array.isArray(jb.points) ? jb.points : []);
        }
        if (cancelled) return;
        setPrimaryPts(Array.isArray(ja.points) ? ja.points : []);
        setComparePtsList(rest);
      } catch {
        if (!cancelled) {
          setPrimaryPts([]);
          setComparePtsList(syms.map(() => []));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          requestAnimationFrame(() => setReady(true));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pSym, compareSlotsKey, range]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const nCompare = compareSlotsKey.split("|").filter((s) => s.length > 0).length;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
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
        horzLines: {
          visible: true,
          color: "rgba(228, 228, 231, 0.85)",
          style: LineStyle.Solid,
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
        horzLine: { visible: false, labelVisible: false },
      },
      localization: {
        priceFormatter: formatAxisReturn,
      },
      handleScroll: false,
      handleScale: false,
    });

    const primarySeries = chart.addSeries(AreaSeries, {
      lineColor: PRIMARY_BLUE,
      topColor: "rgba(37, 99, 235, 0.20)",
      bottomColor: "rgba(37, 99, 235, 0.02)",
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: true,
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
      crosshairMarkerBackgroundColor: PRIMARY_BLUE,
      crosshairMarkerBorderWidth: 2,
    });

    const lines: ISeriesApi<"Line">[] = [];
    for (let i = 0; i < nCompare; i++) {
      const color = STOCK_OVERVIEW_COMPARE_LINE_COLORS[i % STOCK_OVERVIEW_COMPARE_LINE_COLORS.length]!;
      lines.push(
        chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineType: LineType.Curved,
          priceLineVisible: true,
          lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: "rgba(255,255,255,0.95)",
          crosshairMarkerBackgroundColor: color,
          crosshairMarkerBorderWidth: 2,
        }),
      );
    }

    chartRef.current = chart;
    primarySeriesRef.current = primarySeries;
    compareSeriesRefs.current = lines;

    const onCrosshairMove = (param: MouseEventParams) => {
      if (param.point === undefined || param.point.x < 0 || param.point.y < 0 || param.time === undefined) {
        setHover(null);
        return;
      }
      const sec = horzTimeToUnixSeconds(param.time);
      if (sec == null) {
        setHover(null);
        return;
      }
      const pa = primaryPointsRef.current;
      const picks = comparePicksRef.current;
      const lists = comparePointsListRef.current;
      const na = sec != null && pa.length ? nearestPointByTime(pa, sec) : null;
      if (!na || !isFiniteNumber(na.time) || !isFiniteNumber(na.value)) {
        setHover(null);
        return;
      }
      const tz = pa.find((p) => typeof p.timeZone === "string" && p.timeZone.length > 0)?.timeZone;
      const dateLabel = formatAssetChartTimestamp(na.time, { kind: "stock", timeZone: tz });
      const linesOut: { label: string; color: string }[] = [
        { label: `${pSym} ${formatReturnPctFromIndex(na.value)}`, color: PRIMARY_BLUE },
      ];
      for (let i = 0; i < picks.length; i++) {
        const pb = lists[i] ?? [];
        const nb = sec != null && pb.length ? nearestPointByTime(pb, sec) : null;
        const sym = picks[i]?.symbol.trim().toUpperCase() ?? "";
        const color = STOCK_OVERVIEW_COMPARE_LINE_COLORS[i % STOCK_OVERVIEW_COMPARE_LINE_COLORS.length]!;
        if (nb && isFiniteNumber(nb.value)) {
          linesOut.push({ label: `${sym} ${formatReturnPctFromIndex(nb.value)}`, color });
        }
      }
      setHover({
        x: param.point.x,
        y: param.point.y,
        dateLabel,
        lines: linesOut,
      });
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
      chart.remove();
      chartRef.current = null;
      primarySeriesRef.current = null;
      compareSeriesRefs.current = [];
    };
  }, [height, pSym, compareSlotsKey]);

  useEffect(() => {
    const chart = chartRef.current;
    const a = primarySeriesRef.current;
    const lines = compareSeriesRefs.current;
    const nCompare = compareSlotsKey.split("|").filter((s) => s.length > 0).length;
    if (!chart || !a || lines.length !== nCompare) return;

    const mapData = (pts: StockChartPoint[]) =>
      pts
        .filter((p) => isFiniteNumber(p.time) && isFiniteNumber(p.value))
        .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));

    const da = mapData(primaryPts);
    a.setData(da);
    for (let i = 0; i < lines.length; i++) {
      lines[i]!.setData(mapData(comparePtsList[i] ?? []));
    }
    chart.timeScale().fitContent();
  }, [primaryPts, comparePtsList, compareSlotsKey]);

  const tooltipEstHeight = useMemo(() => 34 + Math.max(1, hover?.lines.length ?? 2) * 22, [hover?.lines.length]);

  const tooltipPos = useMemo(() => {
    if (!hover || containerWidth <= 0) return null;
    return layoutPointTooltip({ x: hover.x, y: hover.y }, containerWidth, height, tooltipEstHeight);
  }, [hover, containerWidth, height, tooltipEstHeight]);

  const empty = !loading && primaryPts.length === 0;

  const emptyMessage = useCallback(() => {
    if (primaryPts.length === 0) return `No return data for ${pSym} in this range.`;
    return "No return data for this range.";
  }, [primaryPts.length, pSym]);

  return (
    <div ref={containerRef} className="relative z-0 bg-transparent select-none" style={{ height }}>
      <div
        ref={wrapRef}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out ${
          loading || !ready ? "opacity-0" : "opacity-100"
        }`}
      />
      {hover && tooltipPos ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[200px] max-w-[min(100%,280px)] rounded-[10px] border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] leading-4 text-[#09090B] shadow-[0px_8px_20px_0px_rgba(10,10,10,0.10)]"
          style={{
            left: tooltipPos.left,
            top: tooltipPos.top,
            transform: tooltipPos.transform,
          }}
          role="tooltip"
        >
          <div className="font-normal text-[#71717A]">{hover.dateLabel}</div>
          {hover.lines.map((line, i) => (
            <div
              key={`${line.label}-${i}`}
              className={i === 0 ? "mt-1 font-semibold tabular-nums" : "mt-0.5 font-semibold tabular-nums"}
              style={{ color: line.color }}
            >
              {line.label}
            </div>
          ))}
        </div>
      ) : null}
      {loading ? (
        <div className="absolute inset-0 z-20 flex flex-col px-1 py-1">
          <ChartSkeleton fill variant="minimal" />
        </div>
      ) : null}
      {empty ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-[14px] text-[#71717A]">
          {emptyMessage()}
        </div>
      ) : null}
    </div>
  );
}
