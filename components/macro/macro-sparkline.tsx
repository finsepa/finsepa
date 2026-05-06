"use client";

import type { ReactNode } from "react";
import { useId, useMemo, useRef, useState } from "react";

import { formatMacroValue, type MacroValueKind } from "@/components/macro/macro-format";
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
/** Grid cards: `nonScalingStroke` 2px matches small sparkline cards. */
const MACRO_SERIES_STROKE_WIDTH_CARD = 2;
/**
 * Full-screen modal plots stretch wide; constant 2px `nonScalingStroke` reads heavier than LWC on a large canvas.
 * Use 1px so perceived weight matches Portfolio value chart.
 */
const MACRO_SERIES_STROKE_WIDTH_MODAL = 1;
/** HTML overlay — align with Portfolio vert line (~1px); modal uses 1px width + softer tone next to thinner series stroke. */
const HOVER_RULE_WIDTH_CARD_PX = 2;
const HOVER_RULE_WIDTH_MODAL_PX = 1;
const HOVER_RULE_COLOR_CARD = "rgba(9, 9, 11, 0.14)";
const HOVER_RULE_COLOR_MODAL = "rgba(9, 9, 11, 0.12)";

const GRID = "#F4F4F5";

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

/** Polyline through samples — avoids cubic overshoot on sharp macro swings (e.g. unemployment spikes). */
function linearLinePathD(pts: readonly { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

function formatAxisTimeLabel(time: string, style: "year" | "month"): string {
  const t = time.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return t.slice(0, 4);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  if (!Number.isFinite(d.getTime())) return t.slice(0, 4);
  if (style === "month") {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return String(y);
}

/** ~6 ticks along the series — uses months when everything sits in one calendar year (fixes “only 2026” on 1Y windows). */
function compactTimeAxisLabels(points: readonly { time: string }[]): string[] {
  if (!points.length) return [];
  const n = points.length;
  const slots = 6;
  if (n === 1) return [formatAxisTimeLabel(points[0]!.time, "month")];

  const firstY = parseInt(points[0]!.time.slice(0, 4), 10);
  const lastY = parseInt(points[n - 1]!.time.slice(0, 4), 10);
  const yearSpan = Number.isFinite(firstY) && Number.isFinite(lastY) ? lastY - firstY : 0;
  const style: "year" | "month" = yearSpan <= 0 ? "month" : "year";

  const indices = Array.from({ length: slots }, (_, i) => Math.round((i / Math.max(1, slots - 1)) * (n - 1)));
  const labels = indices.map((idx) => formatAxisTimeLabel(points[idx]!.time, style));

  const out: string[] = [];
  for (const L of labels) {
    if (out[out.length - 1] !== L) out.push(L);
  }
  return out.length >= 2 ? out : labels;
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
  const seriesStrokeWidthPx = comfortable ? MACRO_SERIES_STROKE_WIDTH_MODAL : MACRO_SERIES_STROKE_WIDTH_CARD;

  const containerRef = useRef<HTMLDivElement | null>(null);
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

  const gridLines = tickVals.map((tv) => (
    <line
      key={`g-${tv}`}
      x1={padX}
      x2={w - padX}
      y1={yForValue(tv)}
      y2={yForValue(tv)}
      stroke={GRID}
      strokeWidth={1}
      vectorEffect="nonScalingStroke"
    />
  ));

  const idxToX = (i: number, n: number) => {
    if (n <= 1) return padX + chartW / 2;
    return padX + (i / (n - 1)) * chartW;
  };

  const barCenterX = (i: number, n: number) => {
    if (n <= 0) return padX + chartW / 2;
    const slot = chartW / n;
    return n === 1 ? padX + chartW / 2 : padX + (i + 0.5) * slot;
  };

  let linePathD = "";
  let fillPathD = "";
  const barEls: ReactNode[] = [];

  if (variant === "area" && seriesForLayout.length >= 2) {
    const snap = (v: number) => {
      // Avoid anti-aliased “fat/thin” segments in stretched SVGs by aligning the line to the pixel grid.
      // For 1px strokes, crisp rendering happens on half-pixels; for thicker strokes, integers look best.
      const px = seriesStrokeWidthPx <= 1 ? 0.5 : 1;
      return Math.round(v / px) * px;
    };
    const xy = seriesForLayout.map((v, i) => {
      const x = clamp(snap(idxToX(i, seriesForLayout.length)), 0, w);
      const y = clamp(snap(yForValue(v)), 0, h);
      return { x, y };
    });
    linePathD = linearLinePathD(xy);
    fillPathD = `${linePathD} L ${w - padX} ${h - padY} L ${padX} ${h - padY} Z`;
  } else if (variant === "bar" && rawValues.length > 0) {
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

  const timeAxisLabels = useMemo(() => compactTimeAxisLabels(cleaned), [cleaned]);

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

    const xPx = e.clientX - cr.left;
    const xSvg = (xPx / Math.max(1, cr.width)) * w;
    const idx = clamp(Math.round(((xSvg - padX) / Math.max(1, chartW)) * (layoutLen - 1)), 0, layoutLen - 1);
    setHoverIdx(idx);

    const x = variant === "bar" ? barCenterX(idx, layoutLen) : idxToX(idx, layoutLen);
    const val = variant === "area" ? hoverSeries[idx]! : rawValues[idx]!;
    const yUser = padY + chartH - ((val - vMin) / range) * chartH;

    const focusX = cr.left - r.left + (x / w) * cr.width;
    const { anchorX, side } = computeTooltipHorizontalPlacement(focusX, Math.max(1, Math.floor(r.width)));
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

  return (
    <div ref={containerRef} className="relative w-full" onPointerMove={onPointerMove} onPointerLeave={clearHover}>
      <div className={cn("flex w-full", comfortable ? "gap-3" : "gap-1")}>
        <div className="relative min-w-0 flex-1 overflow-visible">
          {hoverOverlayPx ? (
            <div
              className="pointer-events-none absolute z-[1] w-10 -translate-x-1/2"
              style={{
                left: hoverOverlayPx.lineX,
                top: hoverOverlayPx.chartTop,
                height: hoverOverlayPx.chartHeight,
                backgroundColor: HOVER_COLUMN_BG,
              }}
              aria-hidden
            />
          ) : null}
          <svg
            data-macro-chart-svg
            width="100%"
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            shapeRendering="geometricPrecision"
            // Important: don't use `h-full` here — it overrides the explicit pixel `height`
            // and can stretch/clamp inside modal containers.
            className="relative z-[2] block w-full min-w-0 overflow-visible"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1={padY} y2={h - padY} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={PORTFOLIO_VALUE_LINE} stopOpacity={PORTFOLIO_AREA_TOP_OPACITY} />
                <stop offset="100%" stopColor={PORTFOLIO_VALUE_LINE} stopOpacity={PORTFOLIO_AREA_BOTTOM_OPACITY} />
              </linearGradient>
            </defs>
            {gridLines}
            {variant === "area" && seriesForLayout.length >= 2 ? (
              <>
                <path d={fillPathD} fill={`url(#${gradientId})`} />
                <path
                  d={linePathD}
                  fill="none"
                  stroke={PORTFOLIO_VALUE_LINE}
                  strokeWidth={seriesStrokeWidthPx}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="nonScalingStroke"
                  shapeRendering="geometricPrecision"
                />
              </>
            ) : null}
            {variant === "bar" ? barEls : null}
          </svg>
        </div>
        <div
          className={cn(
            "flex shrink-0 flex-col justify-between text-right tabular-nums text-[#A1A1AA]",
            comfortable ? "min-w-[4.25rem] py-2 text-[12px] leading-5" : "w-10 py-1 text-[11px] leading-4",
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
            className="pointer-events-none absolute z-[5]"
            style={{
              left: hoverOverlayPx.lineX,
              top: hoverOverlayPx.chartTop,
              height: hoverOverlayPx.chartHeight,
              width: comfortable ? HOVER_RULE_WIDTH_MODAL_PX : HOVER_RULE_WIDTH_CARD_PX,
              transform: "translateX(-50%)",
              backgroundColor: comfortable ? HOVER_RULE_COLOR_MODAL : HOVER_RULE_COLOR_CARD,
              borderRadius: 1,
            }}
            aria-hidden
          />
          <div
            className={cn(
              "pointer-events-none absolute z-[6] rounded-full border-white bg-[#2563EB]",
              comfortable
                ? "h-2 w-2 border shadow-[0_0_0_3px_rgba(37,99,235,0.2)]"
                : "h-2.5 w-2.5 border-2 shadow-[0_0_0_4px_rgba(37,99,235,0.2)]",
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
          className="pointer-events-none absolute z-10 max-w-[min(280px,calc(100%-16px))] rounded-lg bg-[#09090B] px-3 py-2.5 pr-3.5 text-left text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
          style={{
            left: `clamp(8px, ${tip.anchorX}px, calc(100% - 8px))`,
            top: tip.y,
            transform: tip.side === "left" ? "translate(calc(-100% - 10px), -50%)" : "translate(10px, -50%)",
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
          <p className="text-[12px] font-semibold leading-4 text-white">{tip.timeLabel}</p>
          <p className="mt-1.5 whitespace-nowrap text-[12px] font-normal leading-4 text-[#71717A]">{tip.valueLabel}</p>
        </div>
      ) : null}

      {timeAxisLabels.length ? (
        <div
          className={cn(
            "flex w-full min-w-0 justify-between text-[#A1A1AA] tabular-nums",
            comfortable ? "gap-2 px-0.5 text-[12px] leading-5" : "gap-1 text-[11px] leading-4",
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
