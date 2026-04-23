"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

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

type TipState = { clientX: number; clientY: number; text: string } | null;

export function MultichartFundamentalsBar({
  metricId,
  points,
  height = 196,
  periodMode = "annual",
  visual = "bar",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState>(null);

  const kind = CHARTING_METRIC_KIND[metricId];
  const maxBars = periodMode === "quarterly" ? 8 : 10;
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

  return (
    <div ref={wrapRef} className="w-full min-w-0 max-w-full overflow-visible">
      <div className="relative flex w-full min-w-0 max-w-full flex-col overflow-visible" style={{ height }}>
        <div className="flex min-h-0 w-full min-w-0 flex-1" style={{ height: plotHeight }}>
          <div className="relative min-h-0 min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[8%]" aria-hidden>
              {yTicks.map((_, i) => {
                const nt = yTicks.length;
                const pct = nt <= 1 ? 0 : (i / (nt - 1)) * 100;
                return (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-[#E4E4E7]"
                    style={{ top: `${pct}%` }}
                  />
                );
              })}
            </div>
            {visual === "line" ? (
              <div
                ref={linePlotRef}
                className="absolute inset-x-0 top-[8%] bottom-[8%] min-h-0 w-full min-w-0"
                role="img"
                aria-label={`${metricLabel} line chart`}
              >
                {lineSvg.d ? (
                  <svg
                    width={linePlotPx.w}
                    height={linePlotPx.h}
                    className="block overflow-visible"
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
                      const tipText = `${metricLabel}\n${labels[i]}: ${formatAxisValue(kind, v)}`;
                      return (
                        <g key={`pt-${labels[i]}-${i}`}>
                          <circle
                            cx={x}
                            cy={y}
                            r={14}
                            fill="transparent"
                            className="cursor-default"
                            onMouseEnter={(e) => {
                              setTip({ clientX: e.clientX, clientY: e.clientY, text: tipText });
                            }}
                            onMouseMove={(e) => {
                              setTip((prev) =>
                                prev ? { clientX: e.clientX, clientY: e.clientY, text: tipText } : null,
                              );
                            }}
                            onMouseLeave={() => setTip(null)}
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
                className="relative grid h-full min-h-0 w-full min-w-0 items-stretch px-0 pt-[8%] pb-[8%]"
                style={{ gridTemplateColumns: plotGridTemplate }}
                role="img"
                aria-label={`${metricLabel} bar chart`}
              >
                {values.map((v, i) => {
                  const hPct = maxV > 0 ? (Math.max(0, v) / maxV) * 100 : 0;
                  const barColor = seriesBarColor;
                  const tipText = `${metricLabel}\n${labels[i]}: ${formatAxisValue(kind, v)}`;
                  return (
                    <div
                      key={`${labels[i]}-${i}`}
                      className="flex h-full min-h-0 min-w-0 flex-col items-center justify-end px-0.5 mt-[10px] mb-3"
                      onMouseEnter={(e) => {
                        setTip({ clientX: e.clientX, clientY: e.clientY, text: tipText });
                      }}
                      onMouseMove={(e) => {
                        setTip((prev) =>
                          prev ? { clientX: e.clientX, clientY: e.clientY, text: tipText } : null,
                        );
                      }}
                      onMouseLeave={() => setTip(null)}
                    >
                      {/* `mt-auto` pins the bar to the column bottom so % height resolves to the full cell (avoids a gap above $0). */}
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
                  );
                })}
              </div>
            )}
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
            {axisLabels.map((axisLab, i) => (
              <div
                key={`${labels[i]}-${i}`}
                className="flex min-h-0 min-w-0 items-end justify-center overflow-visible px-0.5 pb-0.5"
                title={labels[i]}
              >
                <span
                  className="inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]"
                  style={{
                    transform: `rotate(${AXIS_LABEL_ROTATE_DEG}deg)`,
                    transformOrigin: "center bottom",
                  }}
                >
                  {axisLab}
                </span>
              </div>
            ))}
          </div>
          <div style={{ width: MULTICHART_Y_AXIS_W_PX }} className="shrink-0 pl-3" aria-hidden />
        </div>

        {tip ? (
          <div
            className="pointer-events-none fixed z-[100] max-w-[min(280px,calc(100vw-16px))] whitespace-pre-line rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-left text-[12px] leading-snug text-[#18181B] shadow-sm"
            style={{ left: tip.clientX + 12, top: tip.clientY + 12 }}
          >
            {tip.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
