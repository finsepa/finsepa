"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { ChartBrandWatermark } from "@/components/chart/chart-brand-watermark";
import { MULTICHART_LINE_STROKE_WIDTH_PX } from "@/components/stock/multichart-fundamentals-bar";
import { Spinner } from "@/components/ui/spinner";
import {
  CHARTING_LINE_HOVER_HALO_BG,
  CHARTING_LINE_POINT_MARKER_BORDER_PX,
  CHARTING_LINE_POINT_MARKER_RADIUS_PX,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  valueToPlotBandTopPercent,
} from "@/lib/chart/fundamentals-chart-surface";
import { smoothAreaPathD, smoothLinePathD } from "@/lib/chart/smooth-line-path";
import type { CryptoFearGreedHistoryPoint } from "@/lib/market/alternative-fear-greed";
import {
  fearGreedColorForValue,
  FEAR_GREED_ZONE_FILLS,
} from "@/lib/screener/fear-greed-color";
import { cn } from "@/lib/utils";

export const FEAR_GREED_CHART_RANGES = ["1M", "6M", "YTD", "1Y", "5Y", "ALL"] as const;
export type FearGreedChartRange = (typeof FEAR_GREED_CHART_RANGES)[number];

/** Axis/tick label modes used by crypto modal + macro (macro adds 10Y/20Y). */
export type FearGreedHistoryAxisRange = FearGreedChartRange | "10Y" | "20Y";

export const BTC_LINE_COLOR = "#71717A";
export const FG_BADGE_SWATCH =
  "conic-gradient(from 210deg, #E03D3E, #E8881A, #E8C42E, #8FCF2E, #2DB873, #E03D3E)";

const LINE_AREA_GRADIENT_TOP_OPACITY = 0.08;
const LINE_AREA_GRADIENT_BOTTOM_OPACITY = 0.01;

const CHART_HEIGHT_PX = 400;
const AXIS_ROW_PX = 32;
const AXIS_BOTTOM_PAD_PX = 2;
const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
const Y_MIN = 0;
const Y_MAX = 100;
const Y_TICKS = [0, 25, 50, 75, 100] as const;
/** Logical SVG space — line always draws even before ResizeObserver reports CSS pixels. */
const SVG_PLOT_W = 1000;
const SVG_PLOT_H = 360;
const LINE_HOVER_CROSSHAIR_CLASS = "border-l border-dashed border-[#A1A1AA]";
/** Inset horizontal date labels from the plot edges; labels use the date at that x, not series endpoints. */
const X_AXIS_EDGE_PAD_PX = 24;

/** Sharp-ish x-gradient stops: color changes with Fear & Greed bands along time. */
function fearGreedLineStrokeStops(
  pts: readonly { x: number; v: number }[],
  plotW: number,
): { offset: number; color: string }[] {
  if (!pts.length || plotW <= 0) return [];
  const stops: { offset: number; color: string }[] = [];
  let prevColor = "";
  for (const p of pts) {
    const color = fearGreedColorForValue(p.v);
    const offset = clamp(p.x / plotW, 0, 1);
    if (color === prevColor) continue;
    if (stops.length > 0 && offset > 0) {
      stops.push({ offset: Math.max(0, offset - 1e-4), color: prevColor });
    }
    stops.push({ offset, color });
    prevColor = color;
  }
  const last = pts[pts.length - 1]!;
  stops.push({ offset: 1, color: fearGreedColorForValue(last.v) });
  return stops;
}

const HORIZONTAL_X_LABEL_RANGES: ReadonlySet<FearGreedHistoryAxisRange> = new Set([
  "1M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
  "ALL",
  "10Y",
  "20Y",
]);

function fmtDate(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function fmtYear(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { year: "numeric" });
}

function fmtMonth(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { month: "short" });
}

function fmtMonthDay(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function scaleLinear(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return (y0 + y1) / 2;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function nearestPointByTs(points: CryptoFearGreedHistoryPoint[], ts: number): CryptoFearGreedHistoryPoint | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid]!.timestamp < ts) lo = mid + 1;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = lo > 0 ? points[lo - 1]! : null;
  if (!b) return a;
  return Math.abs(a.timestamp - ts) <= Math.abs(b.timestamp - ts) ? a : b;
}

type TipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  rows: { label: string; value: string; color: string }[];
};


function fmtBtcUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);
}

function fmtBtcBadge(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return fmtBtcUsd(n);
}

function nearestBtcByTs(
  points: readonly { time: number; value: number }[],
  ts: number,
): { time: number; value: number } | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid]!.time < ts) lo = mid + 1;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = lo > 0 ? points[lo - 1]! : null;
  if (!b) return a;
  return Math.abs(a.time - ts) <= Math.abs(b.time - ts) ? a : b;
}

export function FearGreedHistoryLineChart({
  points,
  btcPoints,
  range,
  loading,
  showIndex,
  showBtc,
  height = CHART_HEIGHT_PX,
}: {
  points: CryptoFearGreedHistoryPoint[];
  btcPoints: readonly { time: number; value: number }[];
  range: FearGreedHistoryAxisRange;
  loading: boolean;
  showIndex: boolean;
  showBtc: boolean;
  /** Total chart height in px (plot + axis). Default 400. */
  height?: number;
}) {
  const areaGradientId = useId();
  const lineStrokeGradientId = useId();
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const linePlotRef = useRef<HTMLDivElement>(null);
  const [plotPx, setPlotPx] = useState({ w: 0, h: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const plotHeight = height - AXIS_ROW_PX - AXIS_BOTTOM_PAD_PX;
  const horizontalXLabels = HORIZONTAL_X_LABEL_RANGES.has(range);
  const visibleFg = showIndex && points.length >= 2;
  const visibleBtc = showBtc && btcPoints.length >= 2;

  const xDomain = useMemo(() => {
    const xs: number[] = [];
    if (visibleFg) for (const p of points) xs.push(p.timestamp);
    if (visibleBtc) for (const p of btcPoints) xs.push(p.time);
    return {
      min: xs.length ? Math.min(...xs) : 0,
      max: xs.length ? Math.max(...xs) : 1,
    };
  }, [btcPoints, points, visibleBtc, visibleFg]);

  const lineSvg = useMemo(() => {
    const w = SVG_PLOT_W;
    const h = SVG_PLOT_H;
    const n = points.length;
    if (!visibleFg || n < 2) {
      return {
        d: "",
        areaD: "",
        gradY0: 0,
        gradY1: 0,
        pts: [] as { x: number; y: number; v: number; i: number }[],
        lastPt: null as { x: number; y: number } | null,
      };
    }

    const padT = h * PLOT_INSET_TOP_FRAC;
    const padB = h * PLOT_INSET_BOTTOM_FRAC;
    const innerH = Math.max(1, h - padT - padB);
    const areaFloorY = h;

    const pts = points.map((p, i) => {
      const x = scaleLinear(p.timestamp, xDomain.min, xDomain.max, 0, w);
      const bandTop = valueToPlotBandTopPercent(p.value, Y_MIN, Y_MAX);
      const y = padT + innerH * (bandTop / 100);
      return { x, y, v: p.value, i };
    });

    const curvePts = pts.map((p) => ({ x: p.x, y: p.y }));
    const last = pts[pts.length - 1] ?? null;

    return {
      d: smoothLinePathD(curvePts),
      areaD: smoothAreaPathD(curvePts, areaFloorY),
      gradY0: padT,
      gradY1: areaFloorY,
      pts,
      lastPt: last ? { x: last.x, y: last.y } : null,
    };
  }, [points, visibleFg, xDomain.max, xDomain.min]);

  const btcLineSvg = useMemo(() => {
    const w = SVG_PLOT_W;
    const h = SVG_PLOT_H;
    if (!visibleBtc || btcPoints.length < 2) {
      return { d: "", lastPt: null as { x: number; y: number } | null, lastValue: null as number | null };
    }
    const inRange = btcPoints.filter((p) => p.time >= xDomain.min && p.time <= xDomain.max);
    if (inRange.length < 2) return { d: "", lastPt: null, lastValue: null };

    const padT = h * PLOT_INSET_TOP_FRAC;
    const padB = h * PLOT_INSET_BOTTOM_FRAC;
    const innerH = Math.max(1, h - padT - padB);
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of inRange) {
      if (p.value < lo) lo = p.value;
      if (p.value > hi) hi = p.value;
    }
    if (!(hi > lo)) {
      lo = hi - 1;
    }

    const curvePts = inRange.map((p) => {
      const x = scaleLinear(p.time, xDomain.min, xDomain.max, 0, w);
      const t = (p.value - lo) / (hi - lo);
      const y = padT + innerH * (1 - t);
      return { x, y };
    });
    const last = curvePts[curvePts.length - 1] ?? null;
    const lastValue = inRange[inRange.length - 1]?.value;
    return {
      d: smoothLinePathD(curvePts),
      lastPt: last ? { x: last.x, y: last.y } : null,
      lastValue: lastValue != null && Number.isFinite(lastValue) ? lastValue : null,
    };
  }, [btcPoints, visibleBtc, xDomain.max, xDomain.min]);

  const xTicks = useMemo(() => {
    if (!visibleFg && !visibleBtc) return [];
    const tickCount = range === "1M" ? 6 : 7;
    const w = SVG_PLOT_W;
    const edgePad =
      plotPx.w > 0 ? (X_AXIS_EDGE_PAD_PX / plotPx.w) * w : (X_AXIS_EDGE_PAD_PX / 800) * w;
    const inner = Math.max(w - 2 * edgePad, 1);
    return Array.from({ length: tickCount }, (_, i) => {
      const xSvg = tickCount <= 1 ? w / 2 : edgePad + (inner * i) / (tickCount - 1);
      const ts = scaleLinear(xSvg, 0, w, xDomain.min, xDomain.max);
      const label =
        range === "5Y" || range === "10Y" || range === "20Y" || range === "ALL"
          ? fmtYear(ts)
          : range === "6M" || range === "1Y" || range === "YTD"
            ? fmtMonth(ts)
            : fmtMonthDay(ts);
      const leftPct = (xSvg / w) * 100;
      return { ts, leftPct, label };
    });
  }, [plotPx.w, range, visibleBtc, visibleFg, xDomain.max, xDomain.min]);

  useLayoutEffect(() => {
    if (loading) return;
    const lineEl = linePlotRef.current;
    const areaEl = plotAreaRef.current;
    if (!lineEl && !areaEl) return;

    const fallbackH = Math.max(
      1,
      Math.floor(plotHeight * (1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC)),
    );

    const measure = () => {
      const lineR = lineEl?.getBoundingClientRect();
      const areaR = areaEl?.getBoundingClientRect();
      let w = Math.max(0, Math.floor(lineR?.width ?? 0));
      let h = Math.max(0, Math.floor(lineR?.height ?? 0));
      if (w <= 0) w = Math.max(0, Math.floor(areaR?.width ?? 0));
      if (h <= 0) h = fallbackH;
      if (w <= 0) return;
      setPlotPx((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    measure();
    const raf = requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(measure);
    });
    const ro = new ResizeObserver(measure);
    if (lineEl) ro.observe(lineEl);
    if (areaEl) ro.observe(areaEl);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [loading, points.length, btcPoints.length, range, plotHeight, visibleFg, visibleBtc, height]);

  const hoveredPt = hoveredIndex != null ? lineSvg.pts[hoveredIndex] : undefined;
  const hoverStrokeColor =
    hoveredPt != null
      ? fearGreedColorForValue(hoveredPt.v)
      : points.length
        ? fearGreedColorForValue(points[points.length - 1]!.value)
        : "#71717A";

  const lineStrokeStops = useMemo(
    () => fearGreedLineStrokeStops(lineSvg.pts, SVG_PLOT_W),
    [lineSvg.pts],
  );

  const zoneFearTopPct = valueToPlotBandTopPercent(25, Y_MIN, Y_MAX);
  const zoneGreedTopPct = valueToPlotBandTopPercent(75, Y_MIN, Y_MAX);

  const clearHover = useCallback(() => {
    setHoveredIndex(null);
    setTip(null);
  }, []);

  const onPlotMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const plot = plotAreaRef.current;
      const lineEl = linePlotRef.current;
      if (!plot || !lineEl) return;
      if (!visibleFg && !visibleBtc) return;

      const plotR = plot.getBoundingClientRect();
      const lineR = lineEl.getBoundingClientRect();
      const cssW = Math.max(1, lineR.width);
      const xCss = clamp(e.clientX - lineR.left, 0, cssW);
      const xSvg = (xCss / cssW) * SVG_PLOT_W;
      const ts = scaleLinear(xSvg, 0, SVG_PLOT_W, xDomain.min, xDomain.max);

      const tipRows: TipState["rows"] = [];
      let focusX = xCss;
      let hoverIdx: number | null = null;

      if (visibleFg) {
        const pt = nearestPointByTs(points, ts);
        if (pt) {
          const idx = points.indexOf(pt);
          const svgPt = lineSvg.pts[idx];
          if (svgPt) {
            hoverIdx = idx;
            focusX = (svgPt.x / SVG_PLOT_W) * cssW + (lineR.left - plotR.left);
          }
          tipRows.push({
            label: "Fear & Greed Index",
            value: String(pt.value),
            color: fearGreedColorForValue(pt.value),
          });
        }
      }

      if (visibleBtc) {
        const bp = nearestBtcByTs(btcPoints, ts);
        if (bp) {
          tipRows.push({
            label: "Bitcoin Price",
            value: fmtBtcUsd(bp.value),
            color: BTC_LINE_COLOR,
          });
          if (!visibleFg) {
            focusX =
              (scaleLinear(bp.time, xDomain.min, xDomain.max, 0, SVG_PLOT_W) / SVG_PLOT_W) * cssW +
              (lineR.left - plotR.left);
          }
        }
      }

      if (!tipRows.length) return;

      const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
        focusX,
        Math.max(1, Math.floor(plotR.width)),
      );

      setHoveredIndex(hoverIdx);
      setTip({
        anchorX,
        y: e.clientY - plotR.top,
        side,
        periodLabel: fmtDate(ts),
        rows: tipRows,
      });
    },
    [btcPoints, lineSvg.pts, points, visibleBtc, visibleFg, xDomain.max, xDomain.min],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Spinner className="size-5 text-[#71717A]" />
      </div>
    );
  }

  if (!visibleFg && !visibleBtc) {
    return (
      <div className="flex items-center justify-center text-[14px] text-[#71717A]" style={{ height }}>
        Turn on a series above to display the chart.
      </div>
    );
  }

  if (points.length < 2 && btcPoints.length < 2) {
    return (
      <div className="flex items-center justify-center text-[14px] text-[#71717A]" style={{ height }}>
        No history available.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-visible">
      <div
        className="relative flex w-full min-w-0 max-w-full flex-col overflow-visible"
        style={{ height }}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
          <div
            ref={plotAreaRef}
            className="relative min-h-0 min-w-0 flex-1"
            onMouseMove={onPlotMouseMove}
            onMouseLeave={clearHover}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%] z-0 bg-white"
              aria-hidden
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
              {/* Extreme Greed / Extreme Fear bands — only when Fear & Greed index is visible */}
              {visibleFg ? (
                <>
                  <div
                    className="absolute inset-x-0"
                    style={{
                      top: 0,
                      height: `${zoneGreedTopPct}%`,
                      backgroundColor: FEAR_GREED_ZONE_FILLS.extremeGreed,
                    }}
                  />
                  <div
                    className="absolute inset-x-0"
                    style={{
                      top: `${zoneFearTopPct}%`,
                      bottom: 0,
                      backgroundColor: FEAR_GREED_ZONE_FILLS.extremeFear,
                    }}
                  />
                </>
              ) : null}
              <div
                className="absolute inset-x-0 bottom-0 border-t"
                style={{ borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER }}
                aria-hidden
              />
            </div>

            <ChartBrandWatermark />

            {hoveredPt ? (
              <div
                aria-hidden
                className={cn("pointer-events-none absolute z-[1] w-0", LINE_HOVER_CROSSHAIR_CLASS)}
                style={{
                  left:
                    plotPx.w > 0
                      ? (hoveredPt.x / SVG_PLOT_W) * plotPx.w
                      : `${(hoveredPt.x / SVG_PLOT_W) * 100}%`,
                  top: plotHeight * PLOT_INSET_TOP_FRAC,
                  height: plotHeight * (1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC),
                }}
              />
            ) : null}

            <div
              ref={linePlotRef}
              className="absolute inset-x-0 top-[8%] bottom-[4%] z-[2] min-h-0 w-full min-w-0"
              role="img"
              aria-label="Fear & Greed history"
            >
              {lineSvg.d || btcLineSvg.d ? (
                <svg
                  viewBox={`0 0 ${SVG_PLOT_W} ${SVG_PLOT_H}`}
                  preserveAspectRatio="none"
                  className="relative z-[2] block h-full w-full overflow-visible"
                  aria-hidden
                >
                  <defs>
                    <linearGradient
                      id={areaGradientId}
                      x1="0"
                      y1={lineSvg.gradY0}
                      x2="0"
                      y2={lineSvg.gradY1}
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0" stopColor="#71717A" stopOpacity={LINE_AREA_GRADIENT_TOP_OPACITY} />
                      <stop
                        offset="1"
                        stopColor="#71717A"
                        stopOpacity={LINE_AREA_GRADIENT_BOTTOM_OPACITY}
                      />
                    </linearGradient>
                    <linearGradient
                      id={lineStrokeGradientId}
                      x1={0}
                      y1={0}
                      x2={SVG_PLOT_W}
                      y2={0}
                      gradientUnits="userSpaceOnUse"
                    >
                      {lineStrokeStops.map((s, i) => (
                        <stop key={`${s.offset}-${i}`} offset={s.offset} stopColor={s.color} />
                      ))}
                    </linearGradient>
                  </defs>
                  {visibleFg && lineSvg.areaD ? (
                    <path d={lineSvg.areaD} fill={`url(#${areaGradientId})`} />
                  ) : null}
                  {visibleBtc && btcLineSvg.d ? (
                    <path
                      d={btcLineSvg.d}
                      fill="none"
                      stroke={BTC_LINE_COLOR}
                      strokeWidth={MULTICHART_LINE_STROKE_WIDTH_PX}
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  {visibleFg && lineSvg.d ? (
                    <path
                      d={lineSvg.d}
                      fill="none"
                      stroke={`url(#${lineStrokeGradientId})`}
                      strokeWidth={MULTICHART_LINE_STROKE_WIDTH_PX}
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </svg>
              ) : null}
              {visibleFg && hoveredPt ? (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${(hoveredPt.x / SVG_PLOT_W) * 100}%`,
                      top: `${(hoveredPt.y / SVG_PLOT_H) * 100}%`,
                      width: 28,
                      height: 28,
                      backgroundColor: CHARTING_LINE_HOVER_HALO_BG,
                    }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2 rounded-full border-white bg-white"
                    style={{
                      left: `${(hoveredPt.x / SVG_PLOT_W) * 100}%`,
                      top: `${(hoveredPt.y / SVG_PLOT_H) * 100}%`,
                      width: CHARTING_LINE_POINT_MARKER_RADIUS_PX * 2,
                      height: CHARTING_LINE_POINT_MARKER_RADIUS_PX * 2,
                      borderWidth: CHARTING_LINE_POINT_MARKER_BORDER_PX,
                      borderStyle: "solid",
                      borderColor: hoverStrokeColor,
                    }}
                  />
                </>
              ) : null}
            </div>

            {tip ? (
              <div
                className={FUNDAMENTALS_CHART_TOOLTIP_CLASS}
                style={{
                  left: `clamp(8px, ${tip.anchorX}px, calc(100% - 8px))`,
                  top: tip.y,
                  transform:
                    tip.side === "left"
                      ? "translate(calc(-100% - 10px), -50%)"
                      : "translate(10px, -50%)",
                }}
                role="tooltip"
                aria-label="Chart tooltip"
              >
                {tip.side === "left" ? (
                  <span className="absolute top-1/2 left-full -translate-y-1/2" aria-hidden>
                    <span className="block border-y-[7px] border-y-transparent border-l-[8px] border-l-[#E4E4E7]" />
                    <span className="absolute top-1/2 left-px -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[7px] border-l-white" />
                  </span>
                ) : (
                  <span className="absolute top-1/2 right-full -translate-y-1/2" aria-hidden>
                    <span className="block border-y-[7px] border-y-transparent border-r-[8px] border-r-[#E4E4E7]" />
                    <span className="absolute top-1/2 right-px -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[7px] border-r-white" />
                  </span>
                )}
                <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{tip.periodLabel}</p>
                <div className="mt-1.5 space-y-1">
                  {tip.rows.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color }}
                          aria-hidden
                        />
                        <span className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                          {row.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-[#09090B]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "relative h-full shrink-0 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]",
              FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
            )}
            style={{
              width: visibleBtc
                ? Math.max(FUNDAMENTALS_CHART_Y_AXIS_W_PX, 72)
                : FUNDAMENTALS_CHART_Y_AXIS_W_PX,
            }}
            aria-hidden
          >
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%]">
              {visibleFg
                ? Y_TICKS.map((t, i) => {
                    const topPct = valueToPlotBandTopPercent(t, Y_MIN, Y_MAX);
                    const lastV = points[points.length - 1]?.value;
                    const fgBadgeTop =
                      lastV != null && Number.isFinite(lastV)
                        ? valueToPlotBandTopPercent(lastV, Y_MIN, Y_MAX)
                        : null;
                    const btcBadgeTop =
                      btcLineSvg.lastPt != null
                        ? (btcLineSvg.lastPt.y / SVG_PLOT_H) * 100
                        : null;
                    const hideNearFg =
                      fgBadgeTop != null && Math.abs(topPct - fgBadgeTop) < 7;
                    const hideNearBtc =
                      visibleBtc && btcBadgeTop != null && Math.abs(topPct - btcBadgeTop) < 7;
                    if (hideNearFg || hideNearBtc) return null;
                    return (
                      <span
                        key={i}
                        className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                        style={{ top: `${topPct}%` }}
                      >
                        {t}
                      </span>
                    );
                  })
                : null}
              {visibleFg && points.length > 0 ? (
                <span
                  className="absolute left-0 z-[3] -translate-y-1/2 rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold leading-4 tabular-nums text-white"
                  style={{
                    top: `${valueToPlotBandTopPercent(points[points.length - 1]!.value, Y_MIN, Y_MAX)}%`,
                    backgroundColor: fearGreedColorForValue(points[points.length - 1]!.value),
                  }}
                >
                  {points[points.length - 1]!.value}
                </span>
              ) : null}
              {visibleBtc && btcLineSvg.lastPt != null && btcLineSvg.lastValue != null ? (
                <span
                  className="absolute left-0 z-[3] -translate-y-1/2 rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold leading-4 tabular-nums text-white"
                  style={{
                    top: `${(btcLineSvg.lastPt.y / SVG_PLOT_H) * 100}%`,
                    backgroundColor: BTC_LINE_COLOR,
                  }}
                >
                  {fmtBtcBadge(btcLineSvg.lastValue)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 overflow-visible" style={{ height: AXIS_ROW_PX }}>
          <div className="relative mb-1 min-w-0 flex-1 px-0" style={{ height: AXIS_ROW_PX }}>
            {xTicks.map((t, idx) => (
              <div
                key={`${t.ts}-${idx}`}
                className={cn(
                  "absolute flex max-w-[min(100%,4.5rem)] -translate-x-1/2 justify-center overflow-visible",
                  horizontalXLabels ? "top-1.5" : "bottom-0.5",
                )}
                style={{ left: `${t.leftPct}%` }}
                title={t.label}
              >
                <span
                  className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                  style={{
                    transform: horizontalXLabels
                      ? undefined
                      : `rotate(${FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG}deg)`,
                    transformOrigin: horizontalXLabels ? undefined : "center bottom",
                  }}
                >
                  {t.label}
                </span>
              </div>
            ))}
          </div>
          <div
            className={cn("shrink-0", FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS)}
            style={{
              width: visibleBtc
                ? Math.max(FUNDAMENTALS_CHART_Y_AXIS_W_PX, 72)
                : FUNDAMENTALS_CHART_Y_AXIS_W_PX,
            }}
            aria-hidden
          />
        </div>
        <div className="shrink-0" style={{ height: AXIS_BOTTOM_PAD_PX }} aria-hidden />
      </div>
    </div>
  );
}

