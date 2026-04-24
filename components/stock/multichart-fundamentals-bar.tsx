"use client";

import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  type ChartingMetricKind,
} from "@/lib/market/stock-charting-metrics";
import {
  formatPercentMetric,
  formatRatio,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";
import { fundamentalsBarSolidAtIndex } from "@/lib/colors/fundamentals-multi-bar-colors";

/** Fixed bar width (px); extra horizontal space becomes even gaps (`justify-between`). */
const MULTICHART_BAR_WIDTH_PX = 14;

/** Right column for Y-axis tick labels; `pl-*` gaps tick text from the plot / grid strokes. */
const MULTICHART_Y_AXIS_W_PX = 50;

/** Bottom row for period labels (px) — room for {@link AXIS_LABEL_ROTATE_DEG}-rotated text. */
const MULTICHART_AXIS_ROW_PX = 40;

/** Slanted x-axis ticks (deg) — saves horizontal space in narrow Multichart cards. */
const AXIS_LABEL_ROTATE_DEG = -42;

/** Latest fiscal periods to show — both modes span **20 years** (annual = 20 points, quarterly = 80). */
export const MULTICHART_MAX_ANNUAL_BARS = 20;
export const MULTICHART_MAX_QUARTERLY_BARS = 80;

/** Same fill as Earnings (Estimates) `EstimatesHoverBandPrimitive` hover column. */
const HOVER_COLUMN_BG = "rgba(59, 130, 246, 0.14)";

/** Reuse Earnings (Estimates) crosshair-to-tooltip layout — `anchorX` in px, relative to plot (left) edge. */
function computeTooltipHorizontalPlacement(
  focusX: number,
  containerWidthPx: number,
): { anchorX: number; side: "left" | "right" } {
  const pad = 8;
  const gap = 10;
  const estW = Math.min(280, Math.max(140, containerWidthPx - 2 * pad));

  if (focusX - gap - estW >= pad) {
    return { anchorX: focusX, side: "left" };
  }

  let anchorX = focusX;
  if (anchorX + gap + estW > containerWidthPx - pad) {
    anchorX = containerWidthPx - pad - gap - estW;
  }
  anchorX = Math.max(pad, anchorX);
  return { anchorX, side: "right" };
}

export function readChartingMetricValue(row: ChartingSeriesPoint, id: ChartingMetricId): number | null {
  const k = CHARTING_METRIC_FIELD[id];
  const v = row[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Last `n` annual rows with a value for `metricId`, oldest → newest. */
export function sliceLastAnnualWithMetric(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  n: number,
): ChartingSeriesPoint[] {
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const withVal = sorted.filter((r) => readChartingMetricValue(r, metricId) != null);
  return withVal.slice(-n);
}

/** Report year for the fiscal period (from `periodEnd`), e.g. `2024`. */
function formatAnnualYearLabel(periodEnd: string): string {
  const raw = periodEnd.trim();
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (!Number.isFinite(d.getTime())) return raw.slice(0, 4);
  return String(d.getUTCFullYear());
}

/** Full period string for tooltips — matches Charting copy. */
function formatMultichartPeriodLabel(periodEnd: string, mode: FundamentalsSeriesMode): string {
  const s = periodEnd.trim();
  if (mode === "annual") return formatAnnualYearLabel(s);
  const year = s.slice(0, 4);
  const m = s.slice(5, 7);
  const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
  const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
  return year && q ? `Q${q} ${year}` : s;
}

/** Short x-axis text (fits narrow columns); full label stays in tooltip via `title`. */
function formatMultichartPeriodAxisLabel(periodEnd: string, mode: FundamentalsSeriesMode): string {
  if (mode === "annual") return formatAnnualYearLabel(periodEnd);
  const s = periodEnd.trim();
  const year = s.slice(0, 4);
  const m = s.slice(5, 7);
  const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
  const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
  if (!year || !q) return s;
  const yy = year.length >= 2 ? year.slice(2) : year;
  return `Q${q} '${yy}`;
}

function formatAxisValue(kind: ChartingMetricKind, p: number): string {
  if (!Number.isFinite(p)) return "";
  switch (kind) {
    case "usd": {
      const abs = Math.abs(p);
      if (abs < 1e-9) return "$0";
      const neg = p < 0 ? "-" : "";
      if (abs >= 1e9) return `${neg}$${Math.round(abs / 1e9)}B`;
      if (abs >= 1e6) return `${neg}$${Math.round(abs / 1e6)}M`;
      if (abs >= 1e3) return `${neg}$${Math.round(abs / 1e3)}K`;
      return `${neg}$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    }
    case "eps":
      return formatUsdPrice(p);
    case "percent":
      return formatPercentMetric(p);
    case "multiple":
    case "ratio":
      return formatRatio(p);
    default:
      return formatUsdCompact(p);
  }
}

function niceCeilPositive(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const f = n / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

/** Smallest `c * 10^exp` with `c` from a compact ladder and `c * 10^exp >= step`. */
const NICE_STEP_FACTORS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

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

/**
 * Y-axis max for exactly 5 ticks (4 equal bands from 0).
 * USD / shares: tighter headroom than {@link niceCeilPositive} alone (e.g. ~$240B vs $500B for ~$215B).
 */
function axisMaxForFiveTicks(rawMax: number, kind: ChartingMetricKind): number {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return 1;
  if (kind === "usd" || kind === "shares") {
    const padded = rawMax * 1.04;
    const step = niceCeilStep(padded / 4);
    return step * 4;
  }
  return niceCeilPositive(rawMax);
}

export type MultichartVisual = "bar" | "line";

type Props = {
  metricId: ChartingMetricId;
  points: ChartingSeriesPoint[];
  height?: number;
  periodMode?: FundamentalsSeriesMode;
  /** Bar columns (default) or connected line over the same series. */
  visual?: MultichartVisual;
};

type BarTooltipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  valueLine: string;
};

function barTooltipStateFromEvent(
  e: MouseEvent<HTMLElement>,
  plotEl: HTMLElement,
  periodLabel: string,
  valueLine: string,
): BarTooltipState {
  const plot = plotEl.getBoundingClientRect();
  const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const focusX = col.left + col.width / 2 - plot.left;
  const { anchorX, side } = computeTooltipHorizontalPlacement(
    focusX,
    Math.max(1, Math.floor(plot.width)),
  );
  return { anchorX, y: e.clientY - plot.top, side, periodLabel, valueLine };
}

export function MultichartFundamentalsBar({
  metricId,
  points,
  height = 196,
  periodMode = "annual",
  visual = "bar",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tip, setTip] = useState<BarTooltipState | null>(null);

  const kind = CHARTING_METRIC_KIND[metricId];
  const maxBars = periodMode === "quarterly" ? MULTICHART_MAX_QUARTERLY_BARS : MULTICHART_MAX_ANNUAL_BARS;
  const rows = useMemo(
    () => sliceLastAnnualWithMetric(points, metricId, maxBars),
    [points, metricId, maxBars],
  );

  const plotHeight = height - MULTICHART_AXIS_ROW_PX;

  const { values, labels, axisLabels, maxV, yTicks } = useMemo(() => {
    const vals: number[] = [];
    const labs: string[] = [];
    const axisLabs: string[] = [];
    for (const r of rows) {
      const v = readChartingMetricValue(r, metricId);
      if (v == null) continue;
      vals.push(v);
      labs.push(formatMultichartPeriodLabel(r.periodEnd, periodMode));
      axisLabs.push(formatMultichartPeriodAxisLabel(r.periodEnd, periodMode));
    }
    const rawMax = vals.length ? Math.max(...vals.map((x) => Math.abs(x))) : 0;
    const top = axisMaxForFiveTicks(rawMax || 1, kind);
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => (top * (tickCount - 1 - i)) / (tickCount - 1));
    return { values: vals, labels: labs, axisLabels: axisLabs, maxV: top, yTicks: ticks };
  }, [rows, metricId, periodMode, kind]);

  const metricLabel = CHARTING_METRIC_LABEL[metricId];
  /** One metric × many periods — bars share the primary palette color (not per-period cycling). */
  const seriesBarColor = fundamentalsBarSolidAtIndex(0);
  const linePlotRef = useRef<HTMLDivElement>(null);
  const [linePlotPx, setLinePlotPx] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (visual !== "line") return;
    const el = linePlotRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setLinePlotPx({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visual, values.length, height, plotHeight]);

  const lineSvg = useMemo(() => {
    const w = linePlotPx.w;
    const h = linePlotPx.h;
    const n = values.length;
    if (n === 0 || w <= 0 || h <= 0) return { d: "", pts: [] as { x: number; y: number; v: number; i: number }[] };
    const padT = h * 0.08;
    const padB = h * 0.08;
    const innerH = Math.max(1, h - padT - padB);
    const pts = values.map((v, i) => {
      const x = n === 1 ? w / 2 : (i / (n - 1)) * w;
      const frac = maxV > 0 ? Math.max(0, v) / maxV : 0;
      const y = padT + innerH * (1 - frac);
      return { x, y, v, i };
    });
    const d = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    return { d, pts };
  }, [linePlotPx.h, linePlotPx.w, values, maxV]);

  if (rows.length === 0 || values.length === 0) {
    return (
      <div className="w-full">
        <div
          className="flex h-[196px] items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
          aria-hidden
        >
          No data
        </div>
      </div>
    );
  }

  const n = values.length;
  const plotGridTemplate = n > 0 ? `repeat(${n}, minmax(0, 1fr))` : undefined;

  const clearChartHover = () => {
    setHoveredIndex(null);
    setTip(null);
  };

  return (
    <div ref={wrapRef} className="w-full min-w-0 max-w-full overflow-visible">
      <div className="relative flex w-full min-w-0 max-w-full flex-col overflow-visible" style={{ height }}>
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
          <div
            ref={plotAreaRef}
            className="relative min-h-0 min-w-0 flex-1"
            onPointerLeave={clearChartHover}
          >
            {/* Insets are % of plot *height* — bar layer below uses the same `top`/`bottom` (not `pt`/`pb`, which resolve vs width) so the $0 line and bar bases line up. */}
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[8%]" aria-hidden>
              {yTicks.map((_, i) => {
                const nt = yTicks.length;
                const pct = nt <= 1 ? 0 : (i / (nt - 1)) * 100;
                return (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-[#F4F4F5]"
                    style={{ top: `${pct}%` }}
                  />
                );
              })}
            </div>
            {visual === "line" ? (
              <div
                ref={linePlotRef}
                className="absolute inset-x-0 top-[8%] bottom-[8%] z-0 min-h-0 w-full min-w-0"
                role="img"
                aria-label={`${metricLabel} line chart`}
              >
                {hoveredIndex != null && lineSvg.pts[hoveredIndex] ? (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-[1] w-10 -translate-x-1/2"
                    style={{
                      left: lineSvg.pts[hoveredIndex]!.x,
                      backgroundColor: HOVER_COLUMN_BG,
                    }}
                    aria-hidden
                  />
                ) : null}
                {lineSvg.d ? (
                  <svg
                    width={linePlotPx.w}
                    height={linePlotPx.h}
                    className="relative z-[2] block overflow-visible"
                    aria-hidden
                  >
                    <path
                      d={lineSvg.d}
                      fill="none"
                      stroke={seriesBarColor}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {lineSvg.pts.map(({ x, y, v, i }) => {
                      const ptColor = seriesBarColor;
                      return (
                        <g key={`pt-${labels[i]}-${i}`}>
                          <circle
                            cx={x}
                            cy={y}
                            r={14}
                            fill="transparent"
                            className="cursor-default"
                            onMouseEnter={(e) => {
                              const plot = plotAreaRef.current;
                              const lineEl = linePlotRef.current;
                              if (!plot || !lineEl) return;
                              const plotR = plot.getBoundingClientRect();
                              const lineR = lineEl.getBoundingClientRect();
                              const focusX = x + (lineR.left - plotR.left);
                              const { anchorX, side } = computeTooltipHorizontalPlacement(
                                focusX,
                                Math.max(1, Math.floor(plotR.width)),
                              );
                              setHoveredIndex(i);
                              setTip({
                                anchorX,
                                y: e.clientY - plotR.top,
                                side,
                                periodLabel: labels[i]!,
                                valueLine: `${metricLabel}: ${formatAxisValue(kind, v)}`,
                              });
                            }}
                            onMouseMove={(e) => {
                              const plot = plotAreaRef.current;
                              const lineEl = linePlotRef.current;
                              if (!plot || !lineEl) return;
                              const plotR = plot.getBoundingClientRect();
                              const lineR = lineEl.getBoundingClientRect();
                              const focusX = x + (lineR.left - plotR.left);
                              const { anchorX, side } = computeTooltipHorizontalPlacement(
                                focusX,
                                Math.max(1, Math.floor(plotR.width)),
                              );
                              setHoveredIndex(i);
                              setTip({
                                anchorX,
                                y: e.clientY - plotR.top,
                                side,
                                periodLabel: labels[i]!,
                                valueLine: `${metricLabel}: ${formatAxisValue(kind, v)}`,
                              });
                            }}
                          />
                          <circle
                            cx={x}
                            cy={y}
                            r={4.5}
                            fill="white"
                            stroke={ptColor}
                            strokeWidth={2}
                            className="pointer-events-none"
                          />
                        </g>
                      );
                    })}
                  </svg>
                ) : null}
              </div>
            ) : (
              <div
                className="absolute inset-x-0 top-[8%] bottom-[8%] grid min-h-0 w-full min-w-0 items-stretch px-0"
                style={{ gridTemplateColumns: plotGridTemplate }}
                role="img"
                aria-label={`${metricLabel} bar chart`}
              >
                {values.map((v, i) => {
                  const hPct = maxV > 0 ? (Math.max(0, v) / maxV) * 100 : 0;
                  const barColor = seriesBarColor;
                  const valueLine = `${metricLabel}: ${formatAxisValue(kind, v)}`;
                  return (
                    <div
                      key={`${labels[i]}-${i}`}
                      className="relative z-0 flex h-full min-h-0 min-w-0 flex-col items-center justify-end px-0.5"
                      onMouseEnter={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        setHoveredIndex(i);
                        setTip(
                          barTooltipStateFromEvent(e, plot, labels[i]!, valueLine),
                        );
                      }}
                      onMouseMove={(e) => {
                        const plot = plotAreaRef.current;
                        if (!plot) return;
                        setHoveredIndex(i);
                        setTip(barTooltipStateFromEvent(e, plot, labels[i]!, valueLine));
                      }}
                    >
                      {hoveredIndex === i ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-0"
                          style={{ backgroundColor: HOVER_COLUMN_BG }}
                          aria-hidden
                        />
                      ) : null}
                      <div
                        className="relative z-10 flex h-full min-h-0 w-full flex-col items-center justify-end"
                      >
                        <div
                          className="mt-auto shrink-0 rounded-t-[2px] rounded-b-none transition-[height] duration-75"
                          style={{
                            width: MULTICHART_BAR_WIDTH_PX,
                            maxWidth: "100%",
                            height: `${hPct}%`,
                            minHeight: hPct > 0 ? 2 : 0,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tip ? (
              <div
                className="pointer-events-none absolute z-30 max-w-[min(280px,calc(100%-16px))] rounded-lg bg-[#09090B] px-3 py-2.5 pr-3.5 text-left text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
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
                  <span
                    className="absolute top-1/2 left-full -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[7px] border-l-[#09090B]"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="absolute top-1/2 right-full -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[7px] border-r-[#09090B]"
                    aria-hidden
                  />
                )}
                <p className="text-[12px] font-semibold leading-4 text-white">{tip.periodLabel}</p>
                <p className="mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4 text-zinc-300">
                  {tip.valueLine}
                </p>
              </div>
            ) : null}
          </div>

          <div
            className="relative h-full shrink-0 pl-3 text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]"
            style={{ width: MULTICHART_Y_AXIS_W_PX }}
            aria-hidden
          >
            {/* Same `top-[8%] bottom-[8%]` + linear % as horizontal strokes so labels sit on each line. */}
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[8%]">
              {yTicks.map((t, i) => {
                const nt = yTicks.length;
                const pct = nt <= 1 ? 0 : (i / (nt - 1)) * 100;
                return (
                  <span
                    key={i}
                    className="absolute left-0 block -translate-y-1/2"
                    style={{ top: `${pct}%` }}
                  >
                    {formatAxisValue(kind, t)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 overflow-visible" style={{ height: MULTICHART_AXIS_ROW_PX }}>
          <div
            className="grid min-w-0 flex-1 items-end justify-items-stretch px-0 mb-2"
            style={{ gridTemplateColumns: plotGridTemplate }}
          >
            {axisLabels.map((axisLab, i) => {
              /** Quarterly: many columns — show every other tick (1st, 3rd, 5th…) so slanted labels don’t overlap. */
              const last = axisLabels.length - 1;
              const showAxisText =
                periodMode === "annual" || i % 2 === 0 || (periodMode === "quarterly" && i === last && last > 0);
              return (
                <div
                  key={`${labels[i]}-${i}`}
                  className="flex min-h-0 min-w-0 items-end justify-center overflow-visible px-0.5 pb-0.5"
                  title={labels[i]}
                >
                  {showAxisText ? (
                    <span
                      className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                      style={{
                        transform: `rotate(${AXIS_LABEL_ROTATE_DEG}deg)`,
                        transformOrigin: "center bottom",
                      }}
                    >
                      {axisLab}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div style={{ width: MULTICHART_Y_AXIS_W_PX }} className="shrink-0 pl-3" aria-hidden />
        </div>

      </div>
    </div>
  );
}
