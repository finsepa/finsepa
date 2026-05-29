"use client";

import type { ReactNode } from "react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { MULTICHART_LINE_STROKE_WIDTH_PX } from "@/components/stock/multichart-fundamentals-bar";

import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
} from "@/lib/chart/fundamentals-chart-surface";
import { MacroSparklineBars } from "@/components/macro/macro-sparkline-bars";
import type { MacroRangeId } from "@/components/macro/macro-range";
import { formatMacroValue, type MacroValueKind } from "@/components/macro/macro-format";
import { macroChartTimeAxisLabels } from "@/lib/macro/macro-chart-points";
import { smoothAreaPathD, smoothLinePathD } from "@/lib/chart/smooth-line-path";
import { cn } from "@/lib/utils";

export type MacroChartVariant = "area" | "bar";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Same as Portfolio overview “Value” area series (`portfolio-overview-chart.tsx` AreaSeries). */
const PORTFOLIO_VALUE_LINE = "#2563EB";
const PORTFOLIO_AREA_TOP_OPACITY = 0.22;
const PORTFOLIO_AREA_BOTTOM_OPACITY = 0.02;
/** Same fill as Multicharts hover column band. */
const HOVER_COLUMN_BG = "rgba(59, 130, 246, 0.14)";
/** HTML overlay — align with Portfolio vert line (~1px); modal uses 1px width + softer tone next to thinner series stroke. */
const HOVER_RULE_WIDTH_CARD_PX = 2;
const HOVER_RULE_WIDTH_MODAL_PX = 1;
const HOVER_RULE_COLOR_CARD = "rgba(9, 9, 11, 0.14)";
const HOVER_RULE_COLOR_MODAL = "rgba(9, 9, 11, 0.12)";

const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;

type HoverOverlayPx = {
  lineX: number;
  dotTop: number;
  chartTop: number;
  chartHeight: number;
};

type TooltipState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  timeLabel: string;
  valueLabel: string;
};

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

function computeTooltipHorizontalPlacement(focusX: number, containerWidthPx: number): { anchorX: number; side: "left" | "right" } {
  const pad = 8;
  const gap = 10;
  const estW = Math.min(280, Math.max(140, containerWidthPx - 2 * pad));

  if (focusX - gap - estW >= pad) return { anchorX: focusX, side: "left" };

  let anchorX = focusX;
  if (anchorX + gap + estW > containerWidthPx - pad) {
    anchorX = containerWidthPx - pad - gap - estW;
  }
  anchorX = Math.max(pad, anchorX);
  return { anchorX, side: "right" };
}

function axisTickValues(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (count < 2) return [max];
  const span = max - min || 1;
  return Array.from({ length: count }, (_, i) => max - (i / (count - 1)) * span);
}

export function MacroSparkline({
  title,
  kind,
  points,
  rangeId,
  height = 168,
  variant = "area",
  /** Match macro card chart density; `prominent` = slightly richer fill for expanded / modal views. */
  visualWeight = "default",
  /** Default: `height` applies to the SVG only. In modals we want a fixed total height incl. x-axis labels. */
  heightMode = "svg",
}: {
  title: string;
  kind: MacroValueKind;
  points: Array<{ time: string; value: number }>;
  rangeId: MacroRangeId;
  height?: number;
  variant?: MacroChartVariant;
  visualWeight?: "default" | "prominent";
  heightMode?: "svg" | "total";
}) {
  const w = 280;
  const comfortable = visualWeight === "prominent";
  const axisRowPx = comfortable ? 28 : 18;
  const axisGapPx = comfortable ? 12 : 6;
  const h = heightMode === "total" ? Math.max(120, height - axisRowPx - axisGapPx) : height;
  const padX = comfortable ? 12 : 4;
  const padY = comfortable ? 16 : 8;
  const gradientId = `macro-area-${useId().replace(/:/g, "")}`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotAreaRef = useRef<HTMLDivElement | null>(null);
  const [plotPx, setPlotPx] = useState({ w: 0, h: 0 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  /** Pixel overlay — avoids stretched SVG turning the rule/marker into odd thickness or ellipses (`preserveAspectRatio="none"`). */
  const [hoverOverlayPx, setHoverOverlayPx] = useState<HoverOverlayPx | null>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const cleaned = useMemo(() => {
    const out = points
      .filter((p) => typeof p.time === "string" && p.time.trim() && Number.isFinite(p.value))
      .map((p) => ({ time: p.time.slice(0, 10), value: p.value }));
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }, [points]);

  const rawValues = cleaned.map((p) => p.value);

  const seriesForLayout: number[] =
    variant === "area"
      ? rawValues.length >= 2
        ? rawValues
        : rawValues.length === 1
          ? [rawValues[0]!, rawValues[0]!]
          : []
      : [];

  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const layoutLen =
    variant === "area" ? seriesForLayout.length : rawValues.length > 0 ? rawValues.length : 0;

  const vMin = rawValues.length ? Math.min(...rawValues) : 0;
  const vMax = rawValues.length ? Math.max(...rawValues) : 1;
  const range = vMax - vMin || 1;

  const yForValue = (v: number) => padY + chartH - ((v - vMin) / range) * chartH;

  const tickVals = useMemo(() => axisTickValues(vMin, vMax, 6), [vMin, vMax]);

  useLayoutEffect(() => {
    if (variant !== "area") return;
    const el = plotAreaRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setPlotPx({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant, h, seriesForLayout.length]);

  const areaLine = useMemo(() => {
    if (variant !== "area" || seriesForLayout.length < 2) return null;
    const pw = plotPx.w;
    const ph = plotPx.h;
    if (pw <= 0 || ph <= 0) return null;
    const n = seriesForLayout.length;
    const padT = ph * PLOT_INSET_TOP_FRAC;
    const padB = ph * PLOT_INSET_BOTTOM_FRAC;
    const innerH = Math.max(1, ph - padT - padB);
    const floorY = ph;
    const pts = seriesForLayout.map((v, i) => {
      const x = n <= 1 ? pw / 2 : (i / (n - 1)) * pw;
      const frac = (v - vMin) / range;
      const y = padT + innerH * (1 - frac);
      return { x, y, i };
    });
    const curvePts = pts.map((p) => ({ x: p.x, y: p.y }));
    const d = smoothLinePathD(curvePts);
    const areaD = smoothAreaPathD(curvePts, floorY);
    return { d, areaD, gradY0: padT, gradY1: floorY, pts, innerH, padT };
  }, [variant, plotPx.h, plotPx.w, range, seriesForLayout, vMin]);

  const idxToX = (i: number, n: number) => {
    if (n <= 1) return padX + chartW / 2;
    return padX + (i / (n - 1)) * chartW;
  };

  const barCenterX = (i: number, n: number) => {
    if (n <= 0) return padX + chartW / 2;
    const slot = chartW / n;
    return n === 1 ? padX + chartW / 2 : padX + (i + 0.5) * slot;
  };

  const barEls: ReactNode[] = [];

  if (variant === "bar" && rawValues.length > 0) {
    const n = rawValues.length;
    const slot = chartW / n;
    const bw = clamp(slot * 0.62, 2, 22);
    rawValues.forEach((v, i) => {
      const cx = n === 1 ? padX + chartW / 2 : padX + (i + 0.5) * slot;
      const x0 = cx - bw / 2;
      const y0 = yForValue(v);
      const y1 = h - padY;
      barEls.push(
        <rect
          key={`b-${i}`}
          x={clamp(x0, padX, w - padX - bw)}
          y={y0}
          width={bw}
          height={Math.max(0, y1 - y0)}
          rx={2}
          fill={PORTFOLIO_VALUE_LINE}
          fillOpacity={0.85}
        />,
      );
    });
  }

  const timeAxisLabels = useMemo(() => macroChartTimeAxisLabels(cleaned, rangeId), [cleaned, rangeId]);

  const hoverSeries: number[] =
    variant === "area"
      ? seriesForLayout.length >= 2
        ? seriesForLayout
        : rawValues.length === 1
          ? [rawValues[0]!, rawValues[0]!]
          : []
      : rawValues;
  const hoverLen = variant === "area" ? hoverSeries.length : rawValues.length;

  const hover = useMemo(() => {
    if (hoverIdx == null || hoverLen === 0) return null;
    const idx = clamp(hoverIdx, 0, hoverLen - 1);
    const point = cleaned.length ? cleaned[Math.min(idx, cleaned.length - 1)] : null;
    const val = variant === "area" ? hoverSeries[idx]! : rawValues[idx]!;
    const x = idxToX(idx, hoverLen);
    const y = padY + chartH - ((val - vMin) / range) * chartH;
    if (!point || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { idx, point, x, y };
  }, [chartH, cleaned, hoverIdx, hoverLen, hoverSeries, padY, rawValues, range, variant, vMin]);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el || layoutLen === 0) return;
    const r = el.getBoundingClientRect();
    const chartEl = el.querySelector("[data-macro-chart-svg]");
    const cr = chartEl?.getBoundingClientRect();
    if (!chartEl || !cr) return;

    if (variant === "area") {
      const xPx = e.clientX - cr.left;
      const idx = clamp(Math.round((xPx / Math.max(1, cr.width)) * (layoutLen - 1)), 0, layoutLen - 1);
      const pt = areaLine?.pts[idx];
      if (!pt) return;
      setHoverIdx(idx);
      const focusX = cr.left - r.left + pt.x;
      const { anchorX, side } = comfortable
        ? computeTooltipHorizontalPlacement(focusX, Math.max(1, Math.floor(r.width)))
        : computeFundamentalsChartTooltipPlacement(focusX, Math.max(1, Math.floor(r.width)));
      const point = cleaned.length ? cleaned[Math.min(idx, cleaned.length - 1)] : null;
      if (point) {
        setTip({
          anchorX,
          side,
          y: e.clientY - r.top,
          timeLabel: formatMacroTooltipTime(point.time),
          valueLabel: `${title}: ${formatMacroValue(kind, point.value)}`,
        });
      } else {
        setTip(null);
      }
      setHoverOverlayPx({
        lineX: focusX,
        dotTop: cr.top - r.top + pt.y,
        chartTop: cr.top - r.top,
        chartHeight: cr.height,
      });
      return;
    }

    const xPx = e.clientX - cr.left;
    const xSvg = (xPx / Math.max(1, cr.width)) * w;
    const idx = clamp(Math.round(((xSvg - padX) / Math.max(1, chartW)) * (layoutLen - 1)), 0, layoutLen - 1);
    setHoverIdx(idx);

    const x = barCenterX(idx, layoutLen);
    const val = rawValues[idx]!;
    const yUser = padY + chartH - ((val - vMin) / range) * chartH;

    const focusX = cr.left - r.left + (x / w) * cr.width;
    const { anchorX, side } = comfortable
      ? computeTooltipHorizontalPlacement(focusX, Math.max(1, Math.floor(r.width)))
      : computeFundamentalsChartTooltipPlacement(focusX, Math.max(1, Math.floor(r.width)));
    const point = cleaned.length ? cleaned[Math.min(idx, cleaned.length - 1)] : null;
    if (point) {
      setTip({
        anchorX,
        side,
        y: e.clientY - r.top,
        timeLabel: formatMacroTooltipTime(point.time),
        valueLabel: `${title}: ${formatMacroValue(kind, point.value)}`,
      });
    } else {
      setTip(null);
    }

    setHoverOverlayPx({
      lineX: focusX,
      dotTop: cr.top - r.top + (yUser / h) * cr.height,
      chartTop: cr.top - r.top,
      chartHeight: cr.height,
    });
  };

  const clearHover = () => {
    setHoverIdx(null);
    setHoverOverlayPx(null);
    setTip(null);
  };

  if (!cleaned.length) {
    return <div className="w-full rounded-md bg-[#FAFAFA]" style={{ height: h }} aria-hidden />;
  }

  if (variant === "bar" && !comfortable) {
    const totalHeight =
      heightMode === "total" ? height : height + axisRowPx + axisGapPx + (comfortable ? 0 : 10);
    return (
      <MacroSparklineBars title={title} kind={kind} points={points} height={totalHeight} rangeId={rangeId} />
    );
  }

  return (
    <div ref={containerRef} className="relative w-full" onPointerMove={onPointerMove} onPointerLeave={clearHover}>
      <div className={cn("flex w-full", comfortable ? "gap-3" : "gap-1")}>
        <div
          ref={plotAreaRef}
          className="relative min-h-0 min-w-0 flex-1 overflow-visible"
          style={{ height: h }}
        >
          {!comfortable ? (
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
          ) : null}
          {variant === "area" ? (
            areaLine && plotPx.w > 0 && plotPx.h > 0 ? (
              <svg
                data-macro-chart-svg
                width={plotPx.w}
                height={plotPx.h}
                className="absolute inset-0 z-[2] block overflow-visible"
              >
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0"
                    x2="0"
                    y1={areaLine.gradY0}
                    y2={areaLine.gradY1}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={PORTFOLIO_VALUE_LINE} stopOpacity={PORTFOLIO_AREA_TOP_OPACITY} />
                    <stop offset="100%" stopColor={PORTFOLIO_VALUE_LINE} stopOpacity={PORTFOLIO_AREA_BOTTOM_OPACITY} />
                  </linearGradient>
                </defs>
                {comfortable
                  ? tickVals.map((tv) => {
                      const y = areaLine.padT + areaLine.innerH * (1 - (tv - vMin) / range);
                      return (
                        <line
                          key={`g-${tv}`}
                          x1={0}
                          x2={plotPx.w}
                          y1={y}
                          y2={y}
                          stroke="#F4F4F5"
                          strokeWidth={1}
                        />
                      );
                    })
                  : null}
                {areaLine.areaD ? <path d={areaLine.areaD} fill={`url(#${gradientId})`} /> : null}
                <path
                  d={areaLine.d}
                  fill="none"
                  stroke={PORTFOLIO_VALUE_LINE}
                  strokeWidth={MULTICHART_LINE_STROKE_WIDTH_PX}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <div data-macro-chart-svg className="absolute inset-0 z-[2]" aria-hidden />
            )
          ) : (
            <svg
              data-macro-chart-svg
              width="100%"
              height={h}
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
              shapeRendering="geometricPrecision"
              className="relative z-[2] block w-full min-w-0 overflow-visible"
            >
              {barEls}
            </svg>
          )}
        </div>
        <div
          className={cn(
            "flex shrink-0 flex-col justify-between text-right tabular-nums",
            comfortable
              ? "min-w-[4.25rem] py-2 text-[12px] leading-5 text-[#A1A1AA]"
              : "min-w-[3.25rem] py-2 pl-3 text-[12px] leading-5 text-[#71717A]",
          )}
          aria-hidden
        >
          {tickVals.map((tv) => (
            <span key={tv}>{formatMacroValue(kind, tv)}</span>
          ))}
        </div>
      </div>

      {hover && hoverOverlayPx ? (
        <>
          <div
            className={cn(
              "pointer-events-none absolute z-[5]",
              !comfortable && variant === "area"
                ? "w-0 border-l border-dashed border-[#2563EB]"
                : "",
            )}
            style={
              !comfortable && variant === "area"
                ? {
                    left: hoverOverlayPx.lineX,
                    top: hoverOverlayPx.chartTop,
                    height: hoverOverlayPx.chartHeight,
                    transform: "translateX(-50%)",
                  }
                : {
                    left: hoverOverlayPx.lineX,
                    top: hoverOverlayPx.chartTop,
                    height: hoverOverlayPx.chartHeight,
                    width: comfortable ? HOVER_RULE_WIDTH_MODAL_PX : HOVER_RULE_WIDTH_CARD_PX,
                    transform: "translateX(-50%)",
                    backgroundColor: comfortable ? HOVER_RULE_COLOR_MODAL : HOVER_RULE_COLOR_CARD,
                    borderRadius: 1,
                  }
            }
            aria-hidden
          />
          <div
            className={cn(
              "pointer-events-none absolute z-[6] rounded-full border-white bg-[#2563EB]",
              comfortable
                ? "h-2 w-2 border shadow-[0_0_0_3px_rgba(37,99,235,0.2)]"
                : "h-[9px] w-[9px] border-2",
            )}
            style={{
              left: hoverOverlayPx.lineX,
              top: hoverOverlayPx.dotTop,
              transform: "translate(-50%, -50%)",
            }}
            aria-hidden
          />
        </>
      ) : null}

      {tip && hoverOverlayPx ? (
        <div
          className={
            comfortable
              ? "pointer-events-none absolute z-10 max-w-[min(280px,calc(100%-16px))] rounded-lg bg-[#09090B] px-3 py-2.5 pr-3.5 text-left text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
              : FUNDAMENTALS_CHART_TOOLTIP_CLASS
          }
          style={{
            left: `clamp(8px, ${tip.anchorX}px, calc(100% - 8px))`,
            top: tip.y,
            transform: tip.side === "left" ? "translate(calc(-100% - 10px), -50%)" : "translate(10px, -50%)",
          }}
        >
          {comfortable ? (
            tip.side === "left" ? (
              <span
                className="absolute top-1/2 left-full -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[7px] border-l-[#09090B]"
                aria-hidden
              />
            ) : (
              <span
                className="absolute top-1/2 right-full -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[7px] border-r-[#09090B]"
                aria-hidden
              />
            )
          ) : tip.side === "left" ? (
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
          <p
            className={
              comfortable
                ? "text-[12px] font-semibold leading-4 text-white"
                : "text-[12px] font-semibold leading-4 text-[#09090B]"
            }
          >
            {tip.timeLabel}
          </p>
          <p
            className={cn(
              "mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4",
              comfortable ? "text-[#71717A]" : "text-[#09090B]",
            )}
          >
            {tip.valueLabel}
          </p>
        </div>
      ) : null}

      {timeAxisLabels.length ? (
        <div
          className={cn(
            "flex w-full min-w-0 justify-between tabular-nums",
            comfortable
              ? "gap-2 px-0.5 text-[12px] leading-5 text-[#A1A1AA]"
              : "gap-1 text-[11px] leading-4 text-[#71717A] sm:text-[12px]",
          )}
          style={
            heightMode === "total"
              ? { marginTop: axisGapPx, height: axisRowPx, alignItems: "flex-end" }
              : { marginTop: comfortable ? 12 : 4 }
          }
        >
          {timeAxisLabels.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className={cn("min-w-0 truncate text-center", comfortable ? "max-w-[5.5rem]" : "max-w-[4.5rem]")}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
