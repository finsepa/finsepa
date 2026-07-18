"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { ChartBrandWatermark } from "@/components/chart/chart-brand-watermark";
import { MULTICHART_BAR_WIDTH_PX } from "@/components/stock/multichart-fundamentals-bar";
import {
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  valueToPlotBandTopPercent,
} from "@/lib/chart/fundamentals-chart-surface";
import { fundamentalsBarStaggerDelaySec } from "@/lib/chart/fundamentals-bar-enter-animation";
import {
  fundamentalsBarColorAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import type { MacroRangeId } from "@/components/macro/macro-range";
import { formatMacroValue, type MacroValueKind } from "@/components/macro/macro-format";
import {
  buildMacroChartYAxisDomain,
  formatMacroChartAxisTick,
} from "@/lib/macro/macro-chart-axis-kind";
import { cn } from "@/lib/utils";
import {
  formatMacroAxisLabel,
  macroAxisLabelIndicesForTimes,
  macroChartAxisGranularity,
} from "@/lib/macro/macro-chart-points";

const BAR_WIDTH_MAX_PX = MULTICHART_BAR_WIDTH_PX;
const BAR_WIDTH_DENSE_MAX_PX = 10;
const BAR_WIDTH_VERY_DENSE_MAX_PX = 8;
const BAR_HOVER_DIM_OPACITY = 0.6;
const NEGATIVE_BAR_COLOR = "#DC2626";
const POSITIVE_BAR_COLOR = fundamentalsBarSolidAtIndex(0);
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
/** Gutter between plot edge and Y-axis tick labels (px). Absolute ticks ignore parent padding. */
const MACRO_Y_AXIS_W_PX = 72;
const MACRO_Y_AXIS_TICK_LEFT_PX = 16;
const MACRO_Y_AXIS_COMPACT_W_PX = 56;
const MACRO_Y_AXIS_COMPACT_TICK_LEFT_PX = 10;
const MACRO_Y_AXIS_COLUMN_GAP_PX = 0;

type BarPoint = { time: string; value: number; axisLabel: string };

type TipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  valueLine: string;
};

function resolveBarFillColor(baseColor: string, dimmed: boolean): string {
  if (!dimmed) return baseColor;
  if (baseColor === NEGATIVE_BAR_COLOR) {
    return `rgba(220, 38, 38, ${BAR_HOVER_DIM_OPACITY})`;
  }
  return fundamentalsBarColorAtIndex(0, BAR_HOVER_DIM_OPACITY);
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
  return (leftFrac + ((i + 0.5) / n) * inner) * 100;
}

function macroColumnWidthPercent(
  n: number,
  leftFrac = PLOT_INSET_LEFT_FRAC,
  rightFrac = PLOT_INSET_RIGHT_FRAC,
): number {
  if (n <= 1) return Math.max(0, 1 - leftFrac - rightFrac) * 100;
  return (Math.max(0, 1 - leftFrac - rightFrac) / n) * 100;
}

/** Scale bar width to the available period slot so dense macro series do not overlap. */
function macroBarWidthPx(
  plotWidthPx: number,
  n: number,
  leftFrac = PLOT_INSET_LEFT_FRAC,
  rightFrac = PLOT_INSET_RIGHT_FRAC,
): number {
  if (n <= 0 || plotWidthPx <= 0) return BAR_WIDTH_MAX_PX;
  const usable = plotWidthPx * Math.max(0, 1 - leftFrac - rightFrac);
  if (n === 1) return Math.min(BAR_WIDTH_MAX_PX, Math.max(8, usable * 0.12));
  const slot = usable / n;
  if (n > 48) return Math.max(2, Math.min(BAR_WIDTH_VERY_DENSE_MAX_PX, slot * 0.5));
  if (n > 24) return Math.max(2, Math.min(BAR_WIDTH_DENSE_MAX_PX, slot * 0.55));
  return Math.max(2, Math.min(BAR_WIDTH_MAX_PX, slot * 0.62));
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

function barTooltipFromEvent(
  e: MouseEvent<HTMLElement>,
  plot: HTMLElement,
  periodLabel: string,
  valueLine: string,
): TipState {
  const plotR = plot.getBoundingClientRect();
  const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const focusX = col.left + col.width / 2 - plotR.left;
  const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
    focusX,
    Math.max(1, Math.floor(plotR.width)),
  );
  return {
    anchorX,
    y: e.clientY - plotR.top,
    side,
    periodLabel,
    valueLine,
  };
}

/** DOM bar chart — matches {@link MultichartFundamentalsBar} card layout (0 baseline, column hover). */
export function MacroSparklineBars({
  title,
  kind,
  points,
  rangeId,
  height,
  animateBarsOnAppear = false,
  prominent = false,
}: {
  title: string;
  kind: MacroValueKind;
  points: Array<{ time: string; value: number }>;
  rangeId: MacroRangeId;
  height: number;
  animateBarsOnAppear?: boolean;
  prominent?: boolean;
}) {
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [plotWidthPx, setPlotWidthPx] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const cleaned = useMemo(() => {
    const out = points
      .filter((p) => typeof p.time === "string" && p.time.trim() && Number.isFinite(p.value))
      .map((p) => ({ time: p.time.slice(0, 10), value: p.value }));
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }, [points]);

  const barPoints = useMemo((): BarPoint[] => {
    const n = cleaned.length;
    if (!n) return [];
    const granularity = macroChartAxisGranularity(rangeId, cleaned[0]!.time, cleaned[n - 1]!.time);
    return cleaned.map((p) => ({
      time: p.time,
      value: p.value,
      axisLabel: formatMacroAxisLabel(p.time, granularity),
    }));
  }, [cleaned, rangeId]);

  const axisLabelIndexSet = useMemo(() => {
    const granularity =
      barPoints.length > 0
        ? macroChartAxisGranularity(rangeId, barPoints[0]!.time, barPoints[barPoints.length - 1]!.time)
        : "year";
    return new Set(
      macroAxisLabelIndicesForTimes(
        barPoints.map((p) => p.time),
        8,
        granularity,
      ),
    );
  }, [barPoints, rangeId]);

  const values = useMemo(() => barPoints.map((p) => p.value), [barPoints]);

  const yDomain = useMemo(() => buildMacroChartYAxisDomain(values, kind), [values, kind]);

  const yMin = yDomain.min;
  const yMax = yDomain.max;
  const yTicks = yDomain.ticks;
  const yBipolar = yDomain.bipolar;

  const plotHeight = height - AXIS_ROW_PX - AXIS_BOTTOM_PAD_PX;
  const n = barPoints.length;
  const shouldAnimateBars = animateBarsOnAppear && n > 0;
  const barStaggerDelaySec = fundamentalsBarStaggerDelaySec(n);
  const columnWidthPct = useMemo(() => macroColumnWidthPercent(n), [n]);
  const barWidthPx = useMemo(() => macroBarWidthPx(plotWidthPx, n), [plotWidthPx, n]);

  useLayoutEffect(() => {
    const el = plotAreaRef.current;
    if (!el) return;
    const measure = () => {
      setPlotWidthPx(Math.max(0, el.getBoundingClientRect().width));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n, plotHeight]);

  const clearHover = () => {
    setHoveredIndex(null);
    setTip(null);
  };

  if (!n) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-md bg-[#FAFAFA] text-[13px] text-[#71717A]"
        style={{ height }}
        aria-hidden
      >
        No data
      </div>
    );
  }

  return (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden" style={{ height }}>
      <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
        <div
          ref={plotAreaRef}
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
          onPointerLeave={clearHover}
        >
          <div
            className="pointer-events-none absolute inset-x-0 z-0 bg-white"
            style={{
              top: `${PLOT_INSET_TOP_FRAC * 100}%`,
              bottom: `${PLOT_INSET_BOTTOM_FRAC * 100}%`,
            }}
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

          <div
            className="absolute inset-x-0 top-[8%] bottom-[4%] z-[2] min-h-0 w-full min-w-0"
            role="img"
            aria-label={`${title} bar chart`}
          >
            {barPoints.map((pt, i) => {
              const v = pt.value;
              const zeroTop = valueToPlotBandTopPercent(0, yMin, yMax);
              const vTop = valueToPlotBandTopPercent(v, yMin, yMax);
              const barHeightPct = v >= 0 ? Math.max(0, zeroTop - vTop) : Math.max(0, vTop - zeroTop);
              const barTopPct = v >= 0 ? vTop : zeroTop;
              const baseBarColor = v < 0 ? NEGATIVE_BAR_COLOR : POSITIVE_BAR_COLOR;
              const barColor = resolveBarFillColor(
                baseBarColor,
                hoveredIndex != null && hoveredIndex !== i,
              );
              const valueLine = formatMacroValue(kind, pt.value);
              return (
                <div
                  key={`${pt.time}-${i}`}
                  className="absolute top-0 z-0 h-full min-h-0 -translate-x-1/2"
                  style={{ left: `${periodCenterLeftPercent(i, n)}%`, width: `${columnWidthPct}%` }}
                  onMouseEnter={(e) => {
                    const plot = plotAreaRef.current;
                    if (!plot) return;
                    setHoveredIndex(i);
                    setTip(barTooltipFromEvent(e, plot, formatMacroTooltipTime(pt.time), valueLine));
                  }}
                  onMouseMove={(e) => {
                    const plot = plotAreaRef.current;
                    if (!plot) return;
                    setHoveredIndex(i);
                    setTip(barTooltipFromEvent(e, plot, formatMacroTooltipTime(pt.time), valueLine));
                  }}
                >
                  {hoveredIndex === i ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-full"
                      style={{ backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG }}
                      aria-hidden
                    />
                  ) : null}
                  {barHeightPct > 0 ? (
                    <div
                      className={cn(
                        "absolute left-1/2 z-10 -translate-x-1/2",
                        v >= 0 ? "rounded-t-[4px] rounded-b-none" : "rounded-b-[4px] rounded-t-none",
                        shouldAnimateBars
                          ? "fundamentals-bar-grow-in"
                          : "transition-[height,top] duration-75",
                      )}
                      style={{
                        ...(shouldAnimateBars
                          ? ({
                              ["--bar-grow-origin-top"]: `${zeroTop}%`,
                              ["--bar-target-height"]: `${barHeightPct}%`,
                              ["--bar-target-top"]: `${barTopPct}%`,
                              animationDelay: `${i * barStaggerDelaySec}s`,
                            } as CSSProperties)
                          : {
                              top: `${barTopPct}%`,
                              height: `${barHeightPct}%`,
                              minHeight: 2,
                            }),
                        width: barWidthPx,
                        maxWidth: "100%",
                        backgroundColor: barColor,
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
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
              {prominent ? (
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: POSITIVE_BAR_COLOR }}
                        aria-hidden
                      />
                      <span className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                        {title}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-[#0F0F0F]">
                      {tip.valueLine}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4 text-[#0F0F0F]">
                  {`${title}: ${tip.valueLine}`}
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div
          className="relative h-full shrink-0 pr-2 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
          style={{
            width: prominent ? MACRO_Y_AXIS_W_PX : MACRO_Y_AXIS_COMPACT_W_PX,
            marginLeft: MACRO_Y_AXIS_COLUMN_GAP_PX,
          }}
          aria-hidden
        >
          <div
            className="pointer-events-none absolute right-2"
            style={{
              top: `${PLOT_INSET_TOP_FRAC * 100}%`,
              bottom: `${PLOT_INSET_BOTTOM_FRAC * 100}%`,
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
          {barPoints.map((pt, i) => {
            const show = axisLabelIndexSet.has(i);
            return (
              <div
                key={`axis-${pt.time}-${i}`}
                className="absolute top-1.5 flex -translate-x-1/2 justify-center overflow-visible"
                style={{
                  left: `${periodCenterLeftPercent(i, n, AXIS_LABEL_INSET_LEFT_FRAC, AXIS_LABEL_INSET_RIGHT_FRAC)}%`,
                  width: `${macroColumnWidthPercent(n, AXIS_LABEL_INSET_LEFT_FRAC, AXIS_LABEL_INSET_RIGHT_FRAC)}%`,
                }}
                title={formatMacroTooltipTime(pt.time)}
              >
                {show ? (
                  <span className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]">
                    {pt.axisLabel}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div
          className="shrink-0"
          style={{
            width: prominent ? MACRO_Y_AXIS_W_PX : MACRO_Y_AXIS_COMPACT_W_PX,
            marginLeft: MACRO_Y_AXIS_COLUMN_GAP_PX,
          }}
          aria-hidden
        />
      </div>
      <div className="shrink-0" style={{ height: AXIS_BOTTOM_PAD_PX }} aria-hidden />
    </div>
  );
}
