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
  buildFundamentalsYAxisDomain,
  CHARTING_LINE_HOVER_HALO_BG,
  CHARTING_LINE_POINT_MARKER_BORDER_PX,
  CHARTING_LINE_POINT_MARKER_RADIUS_PX,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  formatFundamentalsAxisTickLabel,
  valueToPlotBandTopPercent,
} from "@/lib/chart/fundamentals-chart-surface";
import { macroKindToChartingKind } from "@/lib/macro/macro-chart-axis-kind";
import {
  formatMacroAxisLabel,
  macroAxisLabelIndices,
  macroChartAxisGranularity,
} from "@/lib/macro/macro-chart-points";
import { smoothAreaPathD, smoothLinePathD } from "@/lib/chart/smooth-line-path";
import {
  fundamentalsBarColorAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import { cn } from "@/lib/utils";

const AXIS_ROW_PX = 32;
const AXIS_BOTTOM_PAD_PX = 10;
const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
const LINE_AREA_GRADIENT_TOP_OPACITY = 0.22;
const LINE_AREA_GRADIENT_BOTTOM_OPACITY = 0.02;
const LINE_HOVER_CROSSHAIR_CLASS = "border-l border-dashed border-[#2563EB]";
const SERIES_COLOR = fundamentalsBarSolidAtIndex(0);

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
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
  const [lineRevealProgress, setLineRevealProgress] = useState(0);

  const cleaned = useMemo(() => {
    const out = points
      .filter((p) => typeof p.time === "string" && p.time.trim() && Number.isFinite(p.value))
      .map((p) => ({ time: p.time.slice(0, 10), value: p.value }));
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }, [points]);

  const values = useMemo(() => cleaned.map((p) => p.value), [cleaned]);
  const chartingKind = macroKindToChartingKind(kind);

  const yDomain = useMemo(() => {
    const rawMin = values.length ? Math.min(...values, 0) : 0;
    const rawMax = values.length ? Math.max(...values) : 1;
    return buildFundamentalsYAxisDomain(rawMin, rawMax, chartingKind);
  }, [values, chartingKind]);

  const yMin = yDomain.min;
  const yMax = yDomain.max;
  const yTicks = yDomain.ticks;
  const yBipolar = yDomain.bipolar;

  const plotHeight = height - AXIS_ROW_PX - AXIS_BOTTOM_PAD_PX;
  const yAxisWidthPx = prominent ? FUNDAMENTALS_CHART_Y_AXIS_W_PX : 50;
  const n = cleaned.length;

  const lineSvg = useMemo(() => {
    const w = plotPx.w;
    const h = plotPx.h;
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

    const padT = h * PLOT_INSET_TOP_FRAC;
    const padB = h * PLOT_INSET_BOTTOM_FRAC;
    const innerH = Math.max(1, h - padT - padB);
    const areaFloorY = h;

    const pts = cleaned.map((p, i) => {
      const x = n <= 1 ? w / 2 : (i / (n - 1)) * w;
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
  }, [cleaned, n, plotPx.h, plotPx.w, yMax, yMin]);

  const axisLabelIndexSet = useMemo(() => new Set(macroAxisLabelIndices(n, 8)), [n]);
  const axisGranularity = useMemo(() => {
    if (!n) return "year" as const;
    return macroChartAxisGranularity(rangeId, cleaned[0]!.time, cleaned[n - 1]!.time);
  }, [cleaned, n, rangeId]);

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

  const shouldAnimateLine = animateOnAppear && n >= 2 && plotPx.w > 0;

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
  }, [shouldAnimateLine, animateOnAppear, n, points, plotPx.w]);

  const hoveredPt = hoveredIndex != null ? lineSvg.pts[hoveredIndex] : undefined;
  const lineHoverCrosshair =
    hoveredPt != null
      ? {
          left: hoveredPt.x,
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
      const x = clamp(e.clientX - lineR.left, 0, plotPx.w);
      const idx = clamp(Math.round((x / Math.max(1, plotPx.w)) * (n - 1)), 0, n - 1);
      const svgPt = lineSvg.pts[idx];
      if (!svgPt) return;

      const focusX = svgPt.x + (lineR.left - plotR.left);
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
              className="absolute inset-x-0 top-[8%] bottom-[4%] z-0 min-h-0 w-full min-w-0"
              role="img"
              aria-label={`${title} line chart`}
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
                      stroke={SERIES_COLOR}
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
                        fill={CHARTING_LINE_HOVER_HALO_BG}
                        className="pointer-events-none"
                      />
                      <circle
                        cx={lineSvg.pts[hoveredIndex]!.x}
                        cy={lineSvg.pts[hoveredIndex]!.y}
                        r={CHARTING_LINE_POINT_MARKER_RADIUS_PX}
                        fill="white"
                        stroke={SERIES_COLOR}
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
                      stroke={SERIES_COLOR}
                      strokeWidth={CHARTING_LINE_POINT_MARKER_BORDER_PX}
                      className="pointer-events-none"
                    />
                  ) : null}
                </svg>
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
                    <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-[#09090B]">
                      {tip.valueLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "relative h-full shrink-0 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]",
              prominent ? FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS : "pl-3",
            )}
            style={{ width: yAxisWidthPx }}
            aria-hidden
          >
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%]">
              {yTicks.map((t, i) => (
                <span
                  key={i}
                  className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                  style={{ top: `${valueToPlotBandTopPercent(t, yMin, yMax)}%` }}
                >
                  {formatFundamentalsAxisTickLabel(chartingKind, t)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 overflow-visible" style={{ height: AXIS_ROW_PX }}>
          <div className="relative mb-1 min-w-0 flex-1 px-0" style={{ height: AXIS_ROW_PX }}>
            {cleaned.map((pt, i) => {
              const show = axisLabelIndexSet.has(i);
              const leftPct = n <= 1 ? 50 : (i / (n - 1)) * 100;
              return (
                <div
                  key={`axis-${pt.time}-${i}`}
                  className="absolute bottom-0 flex min-h-0 -translate-x-1/2 items-end justify-center overflow-visible px-0.5 pb-0.5"
                  style={{ left: `${leftPct}%`, maxWidth: "4.5rem" }}
                  title={formatMacroTooltipTime(pt.time)}
                >
                  {show ? (
                    <span
                      className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                      style={{
                        transform: `rotate(${FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG}deg)`,
                        transformOrigin: "center bottom",
                      }}
                    >
                      {formatMacroAxisLabel(pt.time, axisGranularity)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div
            className={cn("shrink-0", prominent && FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS)}
            style={{ width: yAxisWidthPx }}
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
