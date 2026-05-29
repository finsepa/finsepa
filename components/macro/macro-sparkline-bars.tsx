"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
} from "@/lib/chart/fundamentals-chart-surface";
import type { MacroRangeId } from "@/components/macro/macro-range";
import { formatMacroValue, type MacroValueKind } from "@/components/macro/macro-format";
import {
  formatMacroAxisLabel,
  macroAxisLabelIndices,
  macroChartAxisGranularity,
} from "@/lib/macro/macro-chart-points";

const BAR_WIDTH_PX = 14;
const BAR_HIT_PAD_PX = 6;
const BAR_HIT_WIDTH_PX = BAR_WIDTH_PX + BAR_HIT_PAD_PX * 2;
const AXIS_ROW_PX = 32;
const AXIS_BOTTOM_PAD_PX = 10;
const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
const BAR_COLOR = "#2563EB";
const Y_TICK_COUNT = 5;

const NICE_STEP_FACTORS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;
const MULTIPLE_RATIO_AXIS_MAX_LADDER = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000] as const;

type BarPoint = { time: string; value: number; axisLabel: string };

type TipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  valueLine: string;
};

function niceCeilPositive(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const f = n / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

function niceCeilStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1;
  const exp = Math.floor(Math.log10(step));
  const base = 10 ** exp;
  const f = step / base;
  for (const c of NICE_STEP_FACTORS) {
    if (c >= f) return c * base;
  }
  return 10 * base;
}

function axisMaxForMultiplesAndRatios(rawMax: number): number {
  const padded = rawMax <= 0 ? 1 : rawMax * 1.08;
  const naive = niceCeilPositive(rawMax);
  if (naive > 300 && rawMax <= 250) return 300;
  for (const cap of MULTIPLE_RATIO_AXIS_MAX_LADDER) {
    if (cap >= padded) return cap;
  }
  return naive;
}

function macroBarAxisMax(rawMax: number, kind: MacroValueKind): number {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return 1;
  if (kind === "usd") {
    const padded = rawMax * 1.04;
    return niceCeilStep(padded / 4) * 4;
  }
  if (kind === "number") return axisMaxForMultiplesAndRatios(rawMax);
  return niceCeilPositive(rawMax);
}

function periodCenterLeftPercent(i: number, n: number): number {
  if (n <= 0) return 50;
  if (n === 1) return 50;
  return ((i + 0.5) / n) * 100;
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
}: {
  title: string;
  kind: MacroValueKind;
  points: Array<{ time: string; value: number }>;
  rangeId: MacroRangeId;
  height: number;
}) {
  const plotAreaRef = useRef<HTMLDivElement>(null);
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

  const axisLabelIndexSet = useMemo(() => new Set(macroAxisLabelIndices(barPoints.length, 8)), [barPoints.length]);

  const values = useMemo(() => barPoints.map((p) => p.value), [barPoints]);

  const { maxV, yTicks } = useMemo(() => {
    const rawMax = values.length ? Math.max(...values.map((v) => Math.max(0, v))) : 0;
    const top = macroBarAxisMax(rawMax || 1, kind);
    const ticks = Array.from({ length: Y_TICK_COUNT }, (_, i) => (top * (Y_TICK_COUNT - 1 - i)) / (Y_TICK_COUNT - 1));
    return { maxV: top, yTicks: ticks };
  }, [values, kind]);

  const plotHeight = height - AXIS_ROW_PX - AXIS_BOTTOM_PAD_PX;
  const n = barPoints.length;

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
              className="absolute inset-x-0 bottom-0 border-t"
              style={{ borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER }}
            />
          </div>

          <div
            className="absolute inset-x-0 top-[8%] bottom-[4%] z-[1] min-h-0 w-full min-w-0"
            role="img"
            aria-label={`${title} bar chart`}
          >
            {barPoints.map((pt, i) => {
              const plotV = Math.max(0, pt.value);
              const hPct = maxV > 0 ? (plotV / maxV) * 100 : 0;
              const valueLine = `${title}: ${formatMacroValue(kind, pt.value)}`;
              return (
                <div
                  key={`${pt.time}-${i}`}
                  className="absolute bottom-0 z-0 flex h-full min-h-0 -translate-x-1/2 flex-col items-center justify-end"
                  style={{ left: `${periodCenterLeftPercent(i, n)}%`, width: BAR_HIT_WIDTH_PX }}
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
                      className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-full -translate-x-1/2"
                      style={{
                        width: BAR_HIT_WIDTH_PX,
                        backgroundColor: FUNDAMENTALS_CHART_HOVER_BAND_BG,
                      }}
                      aria-hidden
                    />
                  ) : null}
                  <div className="relative z-10 flex h-full min-h-0 w-full flex-col items-center justify-end">
                    <div
                      className="mt-auto shrink-0 rounded-t-[2px] rounded-b-none transition-[height] duration-75"
                      style={{
                        width: BAR_WIDTH_PX,
                        maxWidth: "100%",
                        height: `${hPct}%`,
                        minHeight: hPct > 0 ? 2 : 0,
                        backgroundColor: BAR_COLOR,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {tip ? (
            <div
              className="pointer-events-none absolute z-30 max-w-[min(280px,calc(100%-16px))] rounded-lg border border-[#E4E4E7] bg-white px-3 py-2.5 pr-3.5 text-left shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08),0px_1px_2px_0px_rgba(10,10,10,0.06)]"
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
              <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{tip.periodLabel}</p>
              <p className="mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4 text-[#09090B]">
                {tip.valueLine}
              </p>
            </div>
          ) : null}
        </div>

        <div
          className="relative h-full shrink-0 pl-3 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
          style={{ width: 50 }}
          aria-hidden
        >
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{
              top: `${PLOT_INSET_TOP_FRAC * 100}%`,
              bottom: `${PLOT_INSET_BOTTOM_FRAC * 100}%`,
            }}
          >
            {yTicks.map((t, i) => {
              const nt = yTicks.length;
              const pct = nt <= 1 ? 0 : (i / (nt - 1)) * 100;
              return (
                <span
                  key={i}
                  className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                  style={{ top: `${pct}%` }}
                >
                  {formatMacroValue(kind, t)}
                </span>
              );
            })}
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
                className="absolute bottom-0 flex min-h-0 -translate-x-1/2 items-end justify-center overflow-visible px-0.5"
                style={{ left: `${periodCenterLeftPercent(i, n)}%`, width: BAR_HIT_WIDTH_PX }}
                title={formatMacroTooltipTime(pt.time)}
              >
                {show ? (
                  <span
                    className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                    style={{
                      transform: "rotate(-42deg)",
                      transformOrigin: "center bottom",
                    }}
                  >
                    {pt.axisLabel}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="shrink-0" style={{ width: 50 }} aria-hidden />
      </div>
      <div className="shrink-0" style={{ height: AXIS_BOTTOM_PAD_PX }} aria-hidden />
    </div>
  );
}
