"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { CompanyLogo } from "@/components/screener/company-logo";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { MULTICHART_LINE_STROKE_WIDTH_PX } from "@/components/stock/multichart-fundamentals-bar";
import {
  fundamentalsBarEnterProgress,
  runFundamentalsBarEnterAnimation,
  FUNDAMENTALS_BAR_VALUE_LABEL_STAGGER_MS,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import {
  CHARTING_LINE_HOVER_HALO_BG,
  CHARTING_LINE_POINT_MARKER_BORDER_PX,
  CHARTING_LINE_POINT_MARKER_DIAMETER_PX,
  CHARTING_LINE_POINT_MARKER_RADIUS_PX,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_AXIS_ROW_PX,
  FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX,
  FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC,
  FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  valueToPlotBandTopPercent,
} from "@/lib/chart/fundamentals-chart-surface";
import { smoothAreaPathD, smoothLinePathD } from "@/lib/chart/smooth-line-path";
import type { DrawdownSeriesPoint } from "@/lib/market/drawdown-series-types";
import {
  FUNDAMENTALS_CHART_TIME_RANGE_LABELS,
  FUNDAMENTALS_CHART_TIME_RANGE_ORDER,
  type FundamentalsChartTimeRange,
} from "@/lib/market/fundamentals-chart-time-range";
import { formatPercentMetric } from "@/lib/market/key-stats-basic-format";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalShell } from "@/components/ui/app-modal-shell";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import { MOBILE_MODAL_SHEET_OVERLAY_CLASS } from "@/components/ui/mobile-bottom-sheet";
import { Download } from "@/lib/icons";
import { cn } from "@/lib/utils";

const KEY_STATS_DESKTOP_MODAL_WIDTH_CLASS = "w-full max-w-[960px]";
const MOBILE_KEY_STATS_CHART_HEIGHT_PX = 268;
const MOBILE_SHEET_DISMISS_DRAG_PX = 72;
const LINE_AREA_GRADIENT_TOP_OPACITY = 0.18;
const LINE_AREA_GRADIENT_BOTTOM_OPACITY = 0.02;
const LINE_HOVER_CROSSHAIR_CLASS = "border-l border-dashed border-[#DC2626]";
const DRAWDOWN_LINE_COLOR = "#DC2626";
const DRAWDOWN_Y_MIN = -1;
const DRAWDOWN_Y_MAX = 0;
const DRAWDOWN_Y_TICKS = [0, -0.25, -0.5, -0.75, -1] as const;

/** Matches revenue / fundamentals line value labels ({@link multichart-fundamentals-bar.tsx}). */
const DRAWDOWN_VALUE_LABEL_ANCHOR_CLASS =
  "pointer-events-none absolute z-[15] max-w-[5.5rem] -translate-x-1/2 text-center";

const DRAWDOWN_VALUE_LABEL_TEXT_CLASS =
  "block truncate text-[11px] font-semibold leading-none tabular-nums text-[#09090B]";

const DRAWDOWN_VALUE_LABEL_TEXT_SHADOW =
  "0 0 3px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.8)";

const TIME_RANGE_TAB_OPTIONS: TabSwitcherOption<FundamentalsChartTimeRange>[] =
  FUNDAMENTALS_CHART_TIME_RANGE_ORDER.map((value) => ({
    value,
    label: FUNDAMENTALS_CHART_TIME_RANGE_LABELS[value],
  }));

function fmtDate(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function fmtYear(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return d.toLocaleDateString("en-US", { year: "numeric" });
}

function scaleLinear(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return (y0 + y1) / 2;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function formatDrawdownDepth(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return formatPercentMetric(Math.abs(v));
}

function formatDrawdownAxisTick(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (v === 0) return "0.00%";
  return formatPercentMetric(v);
}

function drawdownYDomain() {
  return { min: DRAWDOWN_Y_MIN, max: DRAWDOWN_Y_MAX, ticks: [...DRAWDOWN_Y_TICKS] };
}

function drawdownPlotValueTopPercent(v: number, yMin: number, yMax: number): number {
  const top = FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC * 100;
  const bottom = FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC * 100;
  const span = 100 - top - bottom;
  const range = yMax - yMin;
  const frac = range > 0 ? (yMax - v) / range : 0;
  return top + span * Math.min(1, Math.max(0, frac));
}

function filterDrawdownPoints(
  points: DrawdownSeriesPoint[],
  range: FundamentalsChartTimeRange,
): DrawdownSeriesPoint[] {
  if (!points.length || range === "all") return points;
  const years = range === "5Y" ? 5 : 10;
  const lastTs = points[points.length - 1]!.timestamp;
  const cutoff = lastTs - Math.floor(years * 365.25 * 86400);
  const start = points.findIndex((p) => p.timestamp >= cutoff);
  return start >= 0 ? points.slice(start) : points;
}

function yearLabelStep(range: FundamentalsChartTimeRange): number {
  if (range === "5Y") return 1;
  if (range === "10Y") return 2;
  return 5;
}

function nearestPointByTs(points: DrawdownSeriesPoint[], ts: number): DrawdownSeriesPoint | null {
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

function isKeyStatsModalMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function useKeyStatsModalMobile(): boolean {
  const [mobile, setMobile] = useState(isKeyStatsModalMobileViewport);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

function useMobileSheetDragDismiss(onClose: () => void, enabled: boolean) {
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startClientYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const resetDrag = useCallback(() => {
    setDragging(false);
    setDragOffsetY(0);
    pointerIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) resetDrag();
  }, [enabled, resetDrag]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (!(e.target as HTMLElement).closest("[data-sheet-drag-handle]")) return;
      pointerIdRef.current = e.pointerId;
      startClientYRef.current = e.clientY;
      setDragging(true);
      setDragOffsetY(0);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || pointerIdRef.current !== e.pointerId) return;
      setDragOffsetY(Math.max(0, e.clientY - startClientYRef.current));
    },
    [enabled],
  );

  const finishDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || pointerIdRef.current !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const dy = Math.max(0, e.clientY - startClientYRef.current);
      if (dy >= MOBILE_SHEET_DISMISS_DRAG_PX) {
        onClose();
        return;
      }
      resetDrag();
    },
    [enabled, onClose, resetDrag],
  );

  const sheetStyle =
    dragOffsetY > 0
      ? {
          transform: `translate3d(0, ${dragOffsetY}px, 0)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        }
      : undefined;

  const sheetPointerHandlers = enabled
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: finishDrag,
        onPointerCancel: finishDrag,
      }
    : {};

  return { sheetStyle, sheetPointerHandlers };
}

type TipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  value: string;
};

function DrawdownHistoryChart({
  points,
  loading,
  timeRange,
  height,
}: {
  points: DrawdownSeriesPoint[];
  loading: boolean;
  timeRange: FundamentalsChartTimeRange;
  height: number;
}) {
  const areaGradientId = useId();
  const lineEnterClipId = useId();
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const linePlotRef = useRef<HTMLDivElement>(null);
  const [plotPx, setPlotPx] = useState({ w: 0, h: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [lineRevealProgress, setLineRevealProgress] = useState(0);

  const plotHeight = height - FUNDAMENTALS_CHART_AXIS_ROW_PX;

  const xDomain = useMemo(() => {
    const xs = points.map((p) => p.timestamp);
    return {
      min: xs.length ? Math.min(...xs) : 0,
      max: xs.length ? Math.max(...xs) : 1,
    };
  }, [points]);

  const yDomain = useMemo(() => drawdownYDomain(), []);

  const lineSvg = useMemo(() => {
    const w = plotPx.w;
    const h = plotPx.h;
    const n = points.length;
    if (n < 2 || w <= 0 || h <= 0) {
      return {
        d: "",
        areaD: "",
        gradY0: 0,
        gradY1: 0,
        pts: [] as { x: number; y: number; v: number; i: number }[],
        lastPt: null as { x: number; y: number } | null,
      };
    }

    const padT = h * FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC;
    const padB = h * FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC;
    const innerH = Math.max(1, h - padT - padB);
    const areaFloorY =
      padT +
      innerH *
        (valueToPlotBandTopPercent(yDomain.min, yDomain.min, yDomain.max) / 100);

    const pts = points.map((p, i) => {
      const x = scaleLinear(p.timestamp, xDomain.min, xDomain.max, 0, w);
      const bandTop = valueToPlotBandTopPercent(p.drawdown, yDomain.min, yDomain.max);
      const y = padT + innerH * (bandTop / 100);
      return { x, y, v: p.drawdown, i };
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
  }, [plotPx.h, plotPx.w, points, xDomain.max, xDomain.min, yDomain.max, yDomain.min]);

  const lineMinValuePoint = useMemo(() => {
    if (!lineSvg.pts.length) return null;
    let best = lineSvg.pts[0]!;
    for (const pt of lineSvg.pts) {
      if (pt.v == null || !Number.isFinite(pt.v)) continue;
      if (pt.v < best.v) best = pt;
    }
    return best.v != null && Number.isFinite(best.v) && best.v < 0 ? best : null;
  }, [lineSvg.pts]);

  const xTicks = useMemo(() => {
    if (points.length < 2) return [];
    const stepYears = yearLabelStep(timeRange);
    const startYear = new Date(xDomain.min * 1000).getUTCFullYear();
    const endYear = new Date(xDomain.max * 1000).getUTCFullYear();
    const ticks: { ts: number; leftPct: number; label: string }[] = [];
    const firstYear = Math.ceil(startYear / stepYears) * stepYears;
    for (let y = firstYear; y <= endYear; y += stepYears) {
      const ts = Math.floor(Date.UTC(y, 0, 1) / 1000);
      if (ts < xDomain.min || ts > xDomain.max) continue;
      const leftPct = scaleLinear(ts, xDomain.min, xDomain.max, 0, 100);
      ticks.push({ ts, leftPct, label: String(y) });
    }
    if (!ticks.length) {
      const tickCount = 7;
      return Array.from({ length: tickCount }, (_, i) => {
        const t = i / (tickCount - 1);
        const ts = xDomain.min + t * (xDomain.max - xDomain.min);
        return { ts, leftPct: t * 100, label: fmtYear(ts) };
      });
    }
    return ticks;
  }, [points.length, timeRange, xDomain.max, xDomain.min]);

  useLayoutEffect(() => {
    const el = linePlotRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setPlotPx({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [points.length, timeRange]);

  useEffect(() => {
    if (loading || points.length < 2 || plotPx.w <= 0) {
      setLineRevealProgress(1);
      return;
    }
    setLineRevealProgress(0);
    return runFundamentalsBarEnterAnimation({
      periodCount: 1,
      onFrame: (elapsedMs) => {
        setLineRevealProgress(fundamentalsBarEnterProgress(0, 1, elapsedMs));
      },
      onComplete: () => setLineRevealProgress(1),
    });
  }, [loading, points, timeRange, plotPx.w]);

  const shouldAnimateLine = !loading && points.length >= 2 && plotPx.w > 0;
  const lineValueLabelsVisible = !shouldAnimateLine || lineRevealProgress >= 1;
  const hoveredPt = hoveredIndex != null ? lineSvg.pts[hoveredIndex] : undefined;

  const clearHover = useCallback(() => {
    setHoveredIndex(null);
    setTip(null);
  }, []);

  const onPlotMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const plot = plotAreaRef.current;
      const lineEl = linePlotRef.current;
      if (!plot || !lineEl || points.length < 2 || plotPx.w <= 0) return;

      const plotR = plot.getBoundingClientRect();
      const lineR = lineEl.getBoundingClientRect();
      const x = clamp(e.clientX - lineR.left, 0, plotPx.w);
      const ts = scaleLinear(x, 0, plotPx.w, xDomain.min, xDomain.max);
      const pt = nearestPointByTs(points, ts);
      if (!pt) return;

      const idx = points.indexOf(pt);
      const svgPt = lineSvg.pts[idx];
      if (!svgPt) return;

      const focusX = svgPt.x + (lineR.left - plotR.left);
      const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
        focusX,
        Math.max(1, Math.floor(plotR.width)),
      );

      setHoveredIndex(idx);
      setTip({
        anchorX,
        y: e.clientY - plotR.top,
        side,
        periodLabel: fmtDate(pt.timestamp),
        value: formatDrawdownDepth(pt.drawdown),
      });
    },
    [lineSvg.pts, plotPx.w, points, xDomain.max, xDomain.min],
  );

  const plotValueTopPercent = (value: number) =>
    drawdownPlotValueTopPercent(value, yDomain.min, yDomain.max);

  const zeroBaselineTopPct = plotValueTopPercent(0);

  if (loading) {
    return <AssetChartSkeleton heightPx={height} className="w-full min-w-0" />;
  }

  if (points.length < 2) {
    return <p className="text-[14px] leading-6 text-[#71717A]">No drawdown history available.</p>;
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-visible">
      <div
        className="relative flex w-full min-w-0 max-w-full flex-col overflow-visible"
        style={{ height }}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 gap-3" style={{ height: plotHeight }}>
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
            </div>

            <div
              className="pointer-events-none absolute inset-x-0 z-[3] border-t border-dashed border-[#A1A1AA]"
              style={{ top: `${zeroBaselineTopPct}%` }}
              aria-hidden
            />

            {hoveredPt ? (
              <div
                aria-hidden
                className={cn("pointer-events-none absolute z-[1] w-0", LINE_HOVER_CROSSHAIR_CLASS)}
                style={{
                  left: hoveredPt.x,
                  top: plotHeight * FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC,
                  height:
                    plotHeight *
                    (1 - FUNDAMENTALS_CHART_PLOT_INSET_TOP_FRAC - FUNDAMENTALS_CHART_PLOT_INSET_BOTTOM_FRAC),
                }}
              />
            ) : null}

            <div
              ref={linePlotRef}
              className="absolute inset-x-0 top-[8%] bottom-[4%] z-0 min-h-0 w-full min-w-0"
              role="img"
              aria-label="Drawdown history"
            >
              {lineSvg.d ? (
                <svg
                  width={plotPx.w}
                  height={plotPx.h}
                  className="relative z-[2] block overflow-visible"
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
                      <stop
                        offset="0"
                        stopColor={`rgba(220, 38, 38, ${LINE_AREA_GRADIENT_TOP_OPACITY})`}
                      />
                      <stop
                        offset="1"
                        stopColor={`rgba(220, 38, 38, ${LINE_AREA_GRADIENT_BOTTOM_OPACITY})`}
                      />
                    </linearGradient>
                    {shouldAnimateLine && lineRevealProgress < 1 ? (
                      <clipPath id={lineEnterClipId}>
                        <rect
                          x={0}
                          y={0}
                          width={Math.max(0, plotPx.w * lineRevealProgress)}
                          height={plotPx.h}
                        />
                      </clipPath>
                    ) : null}
                  </defs>
                  <g
                    clipPath={
                      shouldAnimateLine && lineRevealProgress < 1
                        ? `url(#${lineEnterClipId})`
                        : undefined
                    }
                  >
                    {lineSvg.areaD ? <path d={lineSvg.areaD} fill={`url(#${areaGradientId})`} /> : null}
                    <path
                      d={lineSvg.d}
                      fill="none"
                      stroke={DRAWDOWN_LINE_COLOR}
                      strokeWidth={MULTICHART_LINE_STROKE_WIDTH_PX}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                  {hoveredIndex != null && lineSvg.pts[hoveredIndex] ? (
                    <>
                      <circle
                        cx={lineSvg.pts[hoveredIndex]!.x}
                        cy={lineSvg.pts[hoveredIndex]!.y}
                        r={14}
                        fill={
                          lineSvg.pts[hoveredIndex]!.v < 0
                            ? "rgba(220, 38, 38, 0.14)"
                            : CHARTING_LINE_HOVER_HALO_BG
                        }
                        className="pointer-events-none"
                      />
                      <circle
                        cx={lineSvg.pts[hoveredIndex]!.x}
                        cy={lineSvg.pts[hoveredIndex]!.y}
                        r={CHARTING_LINE_POINT_MARKER_RADIUS_PX}
                        fill="white"
                        stroke={
                          lineSvg.pts[hoveredIndex]!.v < 0 ? DRAWDOWN_LINE_COLOR : "#2563EB"
                        }
                        strokeWidth={CHARTING_LINE_POINT_MARKER_BORDER_PX}
                        className="pointer-events-none"
                      />
                    </>
                  ) : null}
                  {hoveredIndex == null && lineSvg.lastPt ? (
                    <circle
                      cx={lineSvg.lastPt.x}
                      cy={lineSvg.lastPt.y}
                      r={CHARTING_LINE_POINT_MARKER_RADIUS_PX}
                      fill="white"
                      stroke={
                        (lineSvg.pts[lineSvg.pts.length - 1]?.v ?? 0) < 0
                          ? DRAWDOWN_LINE_COLOR
                          : "#2563EB"
                      }
                      strokeWidth={CHARTING_LINE_POINT_MARKER_BORDER_PX}
                      className="pointer-events-none"
                    />
                  ) : null}
                </svg>
              ) : null}
              {lineValueLabelsVisible && lineMinValuePoint
                ? (() => {
                    const { x, y, v, i } = lineMinValuePoint;
                    const text = formatDrawdownDepth(v);
                    const dotClearance = CHARTING_LINE_POINT_MARKER_DIAMETER_PX / 2 + 4;
                    const minTop = FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX + 4;
                    return (
                      <div
                        key={`drawdown-min-${i}`}
                        className={cn(DRAWDOWN_VALUE_LABEL_ANCHOR_CLASS, "-translate-y-full")}
                        style={{
                          left: x,
                          top: Math.max(minTop, y - dotClearance),
                        }}
                        title={text}
                      >
                        <span
                          className={cn(
                            DRAWDOWN_VALUE_LABEL_TEXT_CLASS,
                            shouldAnimateLine && "fundamentals-bar-value-label-in",
                          )}
                          style={{
                            animationDelay: shouldAnimateLine
                              ? `${i * FUNDAMENTALS_BAR_VALUE_LABEL_STAGGER_MS}ms`
                              : undefined,
                            textShadow: DRAWDOWN_VALUE_LABEL_TEXT_SHADOW,
                          }}
                        >
                          {text}
                        </span>
                      </div>
                    );
                  })()
                : null}
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
                <p className="text-[11px] leading-4 text-[#71717A]">{tip.periodLabel}</p>
                <p className="text-[13px] font-semibold leading-5 text-[#09090B] tabular-nums">
                  {tip.value}
                </p>
              </div>
            ) : null}
          </div>

          <div
            className="relative h-full shrink-0 pl-0 pr-2 text-left text-[11px] leading-4 text-[#71717A] tabular-nums"
            style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
            aria-hidden
          >
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%]">
              {yDomain.ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                  style={{ top: `${valueToPlotBandTopPercent(tick, yDomain.min, yDomain.max)}%` }}
                >
                  {formatDrawdownAxisTick(tick)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 gap-3" style={{ height: FUNDAMENTALS_CHART_AXIS_ROW_PX }}>
          <div className="relative min-w-0 flex-1">
          {xTicks.map(({ ts, leftPct, label }) => (
            <span
              key={ts}
              className="absolute bottom-[10px] -translate-x-1/2 text-[11px] leading-4 text-[#71717A]"
              style={{ left: `${leftPct}%` }}
            >
              {label}
            </span>
          ))}
          </div>
          <div
            style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
            className="shrink-0 pr-2"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

export function StockDrawdownChartPanel({
  ticker,
  height = 400,
  className,
}: {
  ticker: string;
  height?: number;
  className?: string;
}) {
  const [timeRange, setTimeRange] = useState<FundamentalsChartTimeRange>("all");
  const [points, setPoints] = useState<DrawdownSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPoints([]);
    fetch(`/api/stocks/${encodeURIComponent(ticker)}/drawdown-series`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Request failed"))))
      .then((data: { points?: DrawdownSeriesPoint[] | null }) => {
        if (cancelled) return;
        setPoints(Array.isArray(data.points) ? data.points : []);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const windowedPoints = useMemo(
    () => filterDrawdownPoints(points, timeRange),
    [points, timeRange],
  );

  const hasSeries = windowedPoints.length >= 2;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <TabSwitcher
          size="sm"
          options={TIME_RANGE_TAB_OPTIONS}
          value={timeRange}
          onChange={setTimeRange}
          aria-label="Date range"
        />
        <button
          type="button"
          disabled={loading || !hasSeries}
          className={cn(
            topbarSquircleIconClass,
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
          )}
          aria-label="Download chart"
        >
          <Download className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <DrawdownHistoryChart
        key={`drawdown-${timeRange}`}
        points={windowedPoints}
        loading={loading}
        timeRange={timeRange}
        height={height}
      />
    </div>
  );
}

export function StockDrawdownChartModal({
  open,
  onClose,
  ticker,
  headerMeta,
}: {
  open: boolean;
  onClose: () => void;
  ticker: string;
  headerMeta: StockDetailHeaderMeta | null;
}) {
  const isMobile = useKeyStatsModalMobile();
  const { sheetStyle, sheetPointerHandlers } = useMobileSheetDragDismiss(onClose, isMobile);
  const [timeRange, setTimeRange] = useState<FundamentalsChartTimeRange>("all");
  const [points, setPoints] = useState<DrawdownSeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onKeyDown]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPoints([]);
    fetch(`/api/stocks/${encodeURIComponent(ticker)}/drawdown-series`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Request failed"))))
      .then((data: { points?: DrawdownSeriesPoint[] | null }) => {
        if (cancelled) return;
        setPoints(Array.isArray(data.points) ? data.points : []);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, ticker]);

  const windowedPoints = useMemo(
    () => filterDrawdownPoints(points, timeRange),
    [points, timeRange],
  );

  const chartHeight = isMobile ? MOBILE_KEY_STATS_CHART_HEIGHT_PX : 400;
  const hasSeries = windowedPoints.length >= 2;

  const companyLine = headerMeta?.fullName?.trim() || null;
  const logoName = companyLine ?? ticker;
  const mobileSubtitle = companyLine ? `${ticker} · ${companyLine}` : ticker;

  const chartBody = (
    <DrawdownHistoryChart
      key={`drawdown-${timeRange}`}
      points={windowedPoints}
      loading={loading}
      timeRange={timeRange}
      height={chartHeight}
    />
  );

  const toolbarControls = (
    <>
      <TabSwitcher
        size="sm"
        options={TIME_RANGE_TAB_OPTIONS}
        value={timeRange}
        onChange={setTimeRange}
        aria-label="Date range"
        className={isMobile ? "min-w-0 flex-1" : undefined}
        fullWidth={isMobile}
      />
      <button
        type="button"
        disabled={loading || !hasSeries}
        className={cn(
          topbarSquircleIconClass,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
        )}
        aria-label="Download chart"
      >
        <Download className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>
    </>
  );

  const shell = isMobile ? (
    <AppModalShell
      titleId="drawdown-chart-title"
      showClose={false}
      maxWidthClass="w-full"
      maxHeightClass="max-h-[min(92vh,720px)]"
      className="key-stats-metric-sheet-enter !rounded-t-xl !rounded-b-none !bg-white !p-0 !shadow-[0px_10px_8px_rgba(10,10,10,0.1),0px_4px_3px_rgba(10,10,10,0.04)]"
      bareBody
      bodyScroll={false}
    >
      <div
        data-sheet-drag-handle
        className="flex shrink-0 cursor-grab flex-col items-center gap-3 px-4 pb-1 pt-2 active:cursor-grabbing"
      >
        <div className="h-1 w-10 shrink-0 rounded-full bg-[#D9D9D9]" aria-hidden />
        <div className="flex w-full flex-col items-center gap-1 text-center">
          <h2 id="drawdown-chart-title" className="text-[16px] font-semibold leading-6 text-[#09090B]">
            Drawdown
          </h2>
          <p className="text-[11px] leading-4 text-[#71717A]">{mobileSubtitle}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto px-4 py-2">
        {chartBody}
      </div>
      <div className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-1">{toolbarControls}</div>
    </AppModalShell>
  ) : (
    <AppModalShell
      titleId="drawdown-chart-title"
      title="Drawdown"
      onClose={onClose}
      maxWidthClass="w-full"
      maxHeightClass="max-h-[min(92vh,900px)]"
      bodyScroll={false}
      bodyClassName="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-0"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <CompanyLogo
            name={logoName}
            logoUrl={headerMeta?.logoUrl ?? ""}
            symbol={ticker}
            size="lg"
            className="!rounded-xl"
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="shrink-0 text-[18px] font-semibold leading-7 text-[#09090B]">Drawdown</span>
            {companyLine ? (
              <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{companyLine}</span>
            ) : (
              <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{ticker}</span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{toolbarControls}</div>
      </div>
      <div className="min-h-0 flex-1 px-5 py-4">{chartBody}</div>
    </AppModalShell>
  );

  if (!open) return null;

  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      zIndex={300}
      align={isMobile ? "bottom" : "center"}
      className={isMobile ? MOBILE_MODAL_SHEET_OVERLAY_CLASS : undefined}
    >
      <div
        className={cn(isMobile ? "w-full min-w-0" : KEY_STATS_DESKTOP_MODAL_WIDTH_CLASS)}
        style={isMobile ? sheetStyle : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        {...(isMobile ? sheetPointerHandlers : {})}
      >
        {shell}
      </div>
    </AppModalOverlay>
  );
}
