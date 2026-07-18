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
} from "react";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { ChartBrandWatermark } from "@/components/chart/chart-brand-watermark";
import type { MacroChartVariant } from "@/components/macro/macro-sparkline";
import { MacroSparklineBars } from "@/components/macro/macro-sparkline-bars";
import type { MacroRangeId } from "@/components/macro/macro-range";
import { formatMacroValue, type MacroValueKind } from "@/components/macro/macro-format";
import { MULTICHART_LINE_STROKE_WIDTH_PX } from "@/components/stock/multichart-fundamentals-bar";
import {
  fundamentalsBarEnterProgress,
  runFundamentalsBarEnterAnimation,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import {
  CHARTING_LINE_HOVER_HALO_BG,
  CHARTING_LINE_POINT_MARKER_BORDER_PX,
  CHARTING_LINE_POINT_MARKER_RADIUS_PX,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  valueToPlotBandTopPercent,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  buildMacroChartYAxisDomain,
  formatMacroChartAxisTick,
} from "@/lib/macro/macro-chart-axis-kind";
import {
  formatMacroAxisLabel,
  macroAxisLabelIndicesForTimes,
  macroChartAxisGranularity,
} from "@/lib/macro/macro-chart-points";
import { smoothAreaPathD, smoothLinePathD } from "@/lib/chart/smooth-line-path";
import {
  fundamentalsBarColorAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import { cn } from "@/lib/utils";

/** Gutter between plot edge and Y-axis tick labels (px). Absolute ticks ignore parent padding. */
const MACRO_Y_AXIS_W_PX = 72;
const MACRO_Y_AXIS_TICK_LEFT_PX = 16;
const MACRO_Y_AXIS_COMPACT_W_PX = 56;
const MACRO_Y_AXIS_COMPACT_TICK_LEFT_PX = 10;
const MACRO_Y_AXIS_COLUMN_GAP_PX = 0;

const AXIS_ROW_PX = 32;
const AXIS_BOTTOM_PAD_PX = 10;
const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
/** Flush left/right — series meets the Y-axis column. */
const PLOT_INSET_LEFT_FRAC = 0;
const PLOT_INSET_RIGHT_FRAC = 0;
/** Year labels: slight left inset to avoid clipping. */
const AXIS_LABEL_INSET_LEFT_FRAC = 0.028;
const AXIS_LABEL_INSET_RIGHT_FRAC = 0;
const LINE_AREA_GRADIENT_TOP_OPACITY = 0.22;
const LINE_AREA_GRADIENT_BOTTOM_OPACITY = 0.02;
const LINE_HOVER_CROSSHAIR_CLASS = "border-l border-dashed border-[#2563EB]";
const SERIES_COLOR = fundamentalsBarSolidAtIndex(0);
/** Fixed SVG user space — identical on server + client (avoids hydration mismatch). */
const SVG_PLOT_W = 1000;
const SVG_PLOT_H = 360;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function periodCenterLeftPercent(
  i: number,
  n: number,
  leftFrac = PLOT_INSET_LEFT_FRAC,
  rightFrac = PLOT_INSET_RIGHT_FRAC,
): number {
  if (n <= 0) return 50;
  const inner = Math.max(0, 1 - leftFrac - rightFrac);
  if (n === 1) return (leftFrac + inner / 2) * 100;
  return (leftFrac + (i / (n - 1)) * inner) * 100;
}

function formatMacroTooltipTime(ymd: string): string {
  const t = ymd.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return t;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  if (!Number.isFinite(d.getTime())) return t;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type TipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  valueLabel: string;
};

function MacroProminentLineChart({
  title,
  kind,
  points,
  rangeId,
  height,
  animateOnAppear = true,
  prominent = true,
}: {
  title: string;
  kind: MacroValueKind;
  points: Array<{ time: string; value: number }>;
  rangeId: MacroRangeId;
  height: number;
  animateOnAppear?: boolean;
  prominent?: boolean;
}) {
  const areaGradientId = useId();
  const lineEnterClipId = useId();
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const linePlotRef = useRef<HTMLDivElement>(null);
  const [plotPx, setPlotPx] = useState({ w: 0, h: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [lineRevealProgress, setLineRevealProgress] = useState(1);

  const cleaned = useMemo(() => {
    const out = points
      .filter((p) => typeof p.time === "string" && p.time.trim() && Number.isFinite(p.value))
      .map((p) => ({ time: p.time.slice(0, 10), value: p.value }));
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }, [points]);

  const values = useMemo(() => cleaned.map((p) => p.value), [cleaned]);
  const yDomain = useMemo(() => buildMacroChartYAxisDomain(values, kind), [values, kind]);

  const yMin = yDomain.min;
  const yMax = yDomain.max;
  const yTicks = yDomain.ticks;
  const yBipolar = yDomain.bipolar;

  const plotHeight = height - AXIS_ROW_PX - AXIS_BOTTOM_PAD_PX;
  const yAxisWidthPx = prominent ? MACRO_Y_AXIS_W_PX : MACRO_Y_AXIS_COMPACT_W_PX;
  const n = cleaned.length;

  /** Stable identity for enter animation — avoid restarting when parent passes a new array ref. */
  const pointsAnimKey = `${n}:${cleaned[0]?.time ?? ""}:${cleaned[n - 1]?.time ?? ""}`;

  const lineSvg = useMemo(() => {
    const w = SVG_PLOT_W;
    const h = SVG_PLOT_H;
    if (n < 2) {
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
    const padL = w * PLOT_INSET_LEFT_FRAC;
    const padR = w * PLOT_INSET_RIGHT_FRAC;
    const innerH = Math.max(1, h - padT - padB);
    const innerW = Math.max(1, w - padL - padR);
    const areaFloorY = h;

    const pts = cleaned.map((p, i) => {
      const x = n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
      const bandTop = valueToPlotBandTopPercent(p.value, yMin, yMax);
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
  }, [cleaned, n, yMax, yMin]);

  const axisGranularity = useMemo(() => {
    if (!n) return "year" as const;
    return macroChartAxisGranularity(rangeId, cleaned[0]!.time, cleaned[n - 1]!.time);
  }, [cleaned, n, rangeId]);

  const axisLabelIndexSet = useMemo(
    () => new Set(macroAxisLabelIndicesForTimes(cleaned.map((p) => p.time), 8, axisGranularity)),
    [cleaned, axisGranularity],
  );

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
  }, [n, plotHeight]);

  const shouldAnimateLine = animateOnAppear && n >= 2 && n <= 120;

  useEffect(() => {
    if (!shouldAnimateLine) {
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
  }, [shouldAnimateLine, animateOnAppear, pointsAnimKey]);

  const hoveredPt = hoveredIndex != null ? lineSvg.pts[hoveredIndex] : undefined;
  const lineHoverCrosshair =
    hoveredPt != null && plotPx.w > 0
      ? {
          left: (hoveredPt.x / SVG_PLOT_W) * plotPx.w,
          top: plotHeight * PLOT_INSET_TOP_FRAC,
          height: plotHeight * (1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC),
        }
      : null;

  const clearHover = useCallback(() => {
    setHoveredIndex(null);
    setTip(null);
  }, []);

  const onPlotMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const plot = plotAreaRef.current;
      const lineEl = linePlotRef.current;
      if (!plot || !lineEl || n < 2 || plotPx.w <= 0) return;

      const plotR = plot.getBoundingClientRect();
      const lineR = lineEl.getBoundingClientRect();
      const padL = plotPx.w * PLOT_INSET_LEFT_FRAC;
      const padR = plotPx.w * PLOT_INSET_RIGHT_FRAC;
      const innerW = Math.max(1, plotPx.w - padL - padR);
      const x = clamp(e.clientX - lineR.left, padL, padL + innerW);
      const idx = clamp(Math.round(((x - padL) / innerW) * (n - 1)), 0, n - 1);
      const svgPt = lineSvg.pts[idx];
      if (!svgPt) return;

      const focusX = (svgPt.x / SVG_PLOT_W) * plotPx.w + (lineR.left - plotR.left);
      const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
        focusX,
        Math.max(1, Math.floor(plotR.width)),
      );
      const point = cleaned[idx];
      if (!point) return;

      setHoveredIndex(idx);
      setTip({
        anchorX,
        y: e.clientY - plotR.top,
        side,
        periodLabel: formatMacroTooltipTime(point.time),
        valueLabel: formatMacroValue(kind, point.value),
      });
    },
    [cleaned, kind, lineSvg.pts, n, plotPx.w],
  );

  if (n < 2) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
        style={{ height }}
      >
        No data
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
              <div
                className="absolute inset-x-0 border-t"
                style={{
                  borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
                  top: yBipolar ? `${valueToPlotBandTopPercent(0, yMin, yMax)}%` : undefined,
                  bottom: yBipolar ? undefined : 0,
                }}
              />
            </div>

            <ChartBrandWatermark />

            {lineHoverCrosshair ? (
              <div
                aria-hidden
                className={cn("pointer-events-none absolute z-[1] w-0", LINE_HOVER_CROSSHAIR_CLASS)}
                style={{
                  left: lineHoverCrosshair.left,
                  top: lineHoverCrosshair.top,
                  height: lineHoverCrosshair.height,
                }}
              />
            ) : null}

            <div
              ref={linePlotRef}
              className="absolute inset-x-0 top-[8%] bottom-[4%] z-[2] min-h-0 w-full min-w-0"
              role="img"
              aria-label={`${title} line chart`}
            >
              {lineSvg.d ? (
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
                      <stop
                        offset="0"
                        stopColor={fundamentalsBarColorAtIndex(0, LINE_AREA_GRADIENT_TOP_OPACITY)}
                      />
                      <stop
                        offset="1"
                        stopColor={fundamentalsBarColorAtIndex(0, LINE_AREA_GRADIENT_BOTTOM_OPACITY)}
                      />
                    </linearGradient>
                    {shouldAnimateLine && lineRevealProgress < 1 ? (
                      <clipPath id={lineEnterClipId}>
                        <rect
                          x={0}
                          y={0}
                          width={Math.max(0, SVG_PLOT_W * lineRevealProgress)}
                          height={SVG_PLOT_H}
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
                      stroke={SERIES_COLOR}
                      strokeWidth={MULTICHART_LINE_STROKE_WIDTH_PX}
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                </svg>
              ) : null}
              {hoveredPt ? (
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
                      borderColor: SERIES_COLOR,
                    }}
                  />
                </>
              ) : null}
              {hoveredIndex == null && lineSvg.lastPt && lineRevealProgress >= 1 ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-1/2 rounded-full border-white bg-white"
                  style={{
                    left: `${(lineSvg.lastPt.x / SVG_PLOT_W) * 100}%`,
                    top: `${(lineSvg.lastPt.y / SVG_PLOT_H) * 100}%`,
                    width: CHARTING_LINE_POINT_MARKER_RADIUS_PX * 2,
                    height: CHARTING_LINE_POINT_MARKER_RADIUS_PX * 2,
                    borderWidth: CHARTING_LINE_POINT_MARKER_BORDER_PX,
                    borderStyle: "solid",
                    borderColor: SERIES_COLOR,
                  }}
                />
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
                <p className="text-[12px] font-semibold leading-4 text-[#0F0F0F]">{tip.periodLabel}</p>
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: SERIES_COLOR }}
                        aria-hidden
                      />
                      <span className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                        {title}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-[#0F0F0F]">
                      {tip.valueLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="relative h-full shrink-0 pr-2 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
            style={{
              width: yAxisWidthPx,
              marginLeft: MACRO_Y_AXIS_COLUMN_GAP_PX,
            }}
            aria-hidden
          >
            <div
              className="pointer-events-none absolute top-[8%] bottom-[4%] right-2"
              style={{
                left: prominent ? MACRO_Y_AXIS_TICK_LEFT_PX : MACRO_Y_AXIS_COMPACT_TICK_LEFT_PX,
              }}
            >
              {yTicks.map((t, i) => (
                <span
                  key={i}
                  className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                  style={{ top: `${valueToPlotBandTopPercent(t, yMin, yMax)}%` }}
                >
                  {formatMacroChartAxisTick(t, kind)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 overflow-visible" style={{ height: AXIS_ROW_PX }}>
          <div className="relative mb-1 min-w-0 flex-1 px-0" style={{ height: AXIS_ROW_PX }}>
            {cleaned.map((pt, i) => {
              const show = axisLabelIndexSet.has(i);
              const leftPct = periodCenterLeftPercent(
                i,
                n,
                AXIS_LABEL_INSET_LEFT_FRAC,
                AXIS_LABEL_INSET_RIGHT_FRAC,
              );
              return (
                <div
                  key={`axis-${pt.time}-${i}`}
                  className="absolute top-1.5 flex max-w-[min(100%,4.5rem)] -translate-x-1/2 justify-center overflow-visible"
                  style={{ left: `${leftPct}%` }}
                  title={formatMacroTooltipTime(pt.time)}
                >
                  {show ? (
                    <span className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]">
                      {formatMacroAxisLabel(pt.time, axisGranularity)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div
            className="shrink-0"
            style={{ width: yAxisWidthPx, marginLeft: MACRO_Y_AXIS_COLUMN_GAP_PX }}
            aria-hidden
          />
        </div>
        <div className="shrink-0" style={{ height: AXIS_BOTTOM_PAD_PX }} aria-hidden />
      </div>
    </div>
  );
}

export function MacroSparklineProminent({
  title,
  kind,
  points,
  rangeId,
  height,
  heightMode,
  variant,
  animateOnAppear = true,
  prominent = true,
}: {
  title: string;
  kind: MacroValueKind;
  points: Array<{ time: string; value: number }>;
  rangeId: MacroRangeId;
  height: number;
  heightMode: "svg" | "total";
  variant: MacroChartVariant;
  animateOnAppear?: boolean;
  prominent?: boolean;
}) {
  const totalHeight = heightMode === "total" ? height : height + AXIS_ROW_PX + AXIS_BOTTOM_PAD_PX;

  if (variant === "bar") {
    return (
      <MacroSparklineBars
        title={title}
        kind={kind}
        points={points}
        height={totalHeight}
        rangeId={rangeId}
        animateBarsOnAppear={animateOnAppear}
        prominent={prominent}
      />
    );
  }

  return (
    <MacroProminentLineChart
      title={title}
      kind={kind}
      points={points}
      rangeId={rangeId}
      height={totalHeight}
      animateOnAppear={animateOnAppear}
      prominent={prominent}
    />
  );
}
