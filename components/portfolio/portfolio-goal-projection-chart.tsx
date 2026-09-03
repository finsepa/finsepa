"use client";

import { ChartBrandWatermark } from "@/components/chart/chart-brand-watermark";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import {
  CHARTING_LINE_POINT_MARKER_BORDER_PX,
  CHARTING_LINE_POINT_MARKER_DIAMETER_PX,
  CHARTING_LINE_POINT_MARKER_FILL,
  CHARTING_LINE_POINT_MARKER_RADIUS_PX,
  FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  buildFundamentalsYAxisDomain,
  computeFundamentalsChartTooltipPlacement,
  formatFundamentalsAxisTickLabel,
  valueToPlotBandTopPercent,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  fundamentalsBarEnterProgress,
  runFundamentalsBarEnterAnimation,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import { smoothLinePathD } from "@/lib/chart/smooth-line-path";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { cn } from "@/lib/utils";
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

const AXIS_ROW_PX = 32;
const AXIS_BOTTOM_PAD_PX = 10;
const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
const HOVER_DOT_HALO_RADIUS_PX = 14;
const HOVER_DOT_HALO_ALPHA = 0.14;
const LINE_STROKE_WIDTH_PX = 2;
const END_DOT_RADIUS_PX = 3.5;
const CHART_HEIGHT_PX = 320;

/** First year-end that reaches `target` (skip if the series already starts at/above). */
function firstYearIndexCrossingTarget(
  values: readonly (number | null)[],
  target: number,
): number | null {
  if (!(target > 0) || values.length === 0) return null;
  let sawBelow = false;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) continue;
    if (v < target) {
      sawBelow = true;
      continue;
    }
    return sawBelow ? i : null;
  }
  return null;
}

/** Soft hover halo in the spark line’s color (Charting uses a shared accent wash). */
function sparkLineHaloFill(color: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${HOVER_DOT_HALO_ALPHA})`;
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color.trim());
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${HOVER_DOT_HALO_ALPHA})`;
  return color;
}

type PeriodPlotEdgeMargin = { left: number; right: number };
const LINE_PERIOD_MARGINS: PeriodPlotEdgeMargin = { left: 0, right: 0 };

export type PortfolioGoalProjectionChartSeries = {
  id: string;
  label: string;
  color: string;
  points: readonly { year: number; value: number }[];
  visible: boolean;
};

function resolvePeriodCenterX(
  i: number,
  n: number,
  w: number,
  margins: PeriodPlotEdgeMargin,
): number {
  if (n <= 0) return 0;
  if (n === 1) return w / 2;
  const x0 = margins.left * w;
  const x1 = w - margins.right * w;
  return x0 + ((x1 - x0) * i) / (n - 1);
}

function resolvePeriodCenterLeftPercent(i: number, n: number, margins: PeriodPlotEdgeMargin): number {
  if (n <= 0) return 50;
  if (n === 1) return 50;
  const x0 = margins.left * 100;
  const x1 = 100 - margins.right * 100;
  return x0 + ((x1 - x0) * i) / (n - 1);
}

/** Charting 10Y-style year ticks: even years, always keep first and last. */
function goalYearAxisLabel(year: number, years: readonly number[], index: number): string {
  const n = years.length;
  if (n <= 8) return String(year);
  if (index === 0 || index === n - 1) return String(year);
  if (year % 2 !== 0) return "";
  return String(year);
}

function SparkLinePointMarker({
  x,
  y,
  color,
}: {
  x: number;
  y: number;
  color: string;
}) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={HOVER_DOT_HALO_RADIUS_PX}
        fill={sparkLineHaloFill(color)}
      />
      <circle
        cx={x}
        cy={y}
        r={CHARTING_LINE_POINT_MARKER_RADIUS_PX}
        fill={CHARTING_LINE_POINT_MARKER_FILL}
        stroke={color}
        strokeWidth={CHARTING_LINE_POINT_MARKER_BORDER_PX}
      />
    </g>
  );
}

export function PortfolioGoalProjectionChart({
  series,
  targetUsd,
  height = CHART_HEIGHT_PX,
}: {
  series: readonly PortfolioGoalProjectionChartSeries[];
  /** Goal value — a marker sits on each spark line at the year it first crosses this. */
  targetUsd?: number;
  height?: number;
}) {
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const linePlotRef = useRef<HTMLDivElement>(null);
  const [linePlotPx, setLinePlotPx] = useState({ w: 0, h: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lineRevealProgress, setLineRevealProgress] = useState(1);
  const lineEnteredRef = useRef(false);
  const [tip, setTip] = useState<{
    anchorX: number;
    y: number;
    side: "left" | "right";
    periodLabel: string;
    rows: { id: string; label: string; value: string; color: string }[];
  } | null>(null);

  const plotHeight = height - AXIS_ROW_PX - AXIS_BOTTOM_PAD_PX;
  const visibleSeries = useMemo(() => series.filter((s) => s.visible), [series]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const s of visibleSeries) {
      for (const p of s.points) set.add(p.year);
    }
    return [...set].sort((a, b) => a - b);
  }, [visibleSeries]);

  const aligned = useMemo(
    () =>
      visibleSeries.map((s) => {
        const byYear = new Map(s.points.map((p) => [p.year, p.value]));
        return {
          id: s.id,
          label: s.label,
          color: s.color,
          values: years.map((y) => {
            const v = byYear.get(y);
            return v != null && Number.isFinite(v) ? v : null;
          }),
        };
      }),
    [visibleSeries, years],
  );

  const numericValues = useMemo(() => {
    const out: number[] = [];
    for (const s of aligned) {
      for (const v of s.values) {
        if (v != null && Number.isFinite(v)) out.push(v);
      }
    }
    return out;
  }, [aligned]);

  const yDomain = useMemo(() => {
    if (!numericValues.length) return buildFundamentalsYAxisDomain(0, 0, "usd");
    return buildFundamentalsYAxisDomain(Math.min(...numericValues), Math.max(...numericValues), "usd");
  }, [numericValues]);

  const yMin = yDomain.min;
  const yMax = yDomain.max;
  const yTicks = yDomain.ticks;

  useLayoutEffect(() => {
    const el = linePlotRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Hidden tab panels are display:none (width 0). Keep the last layout.
      if (w < 12) return;
      setLinePlotPx((prev) => (prev.w === w && prev.h === Math.max(0, h) ? prev : { w, h: Math.max(0, h) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [years.length, height, plotHeight]);

  const linePaths = useMemo(() => {
    const w = linePlotPx.w;
    const h = linePlotPx.h;
    const n = years.length;
    if (n === 0 || w <= 0 || h <= 0) {
      return [] as {
        id: string;
        color: string;
        d: string;
        pts: { x: number; y: number; v: number; i: number }[];
        endPt: { x: number; y: number; v: number; i: number } | null;
      }[];
    }
    const padT = h * PLOT_INSET_TOP_FRAC;
    const padB = h * PLOT_INSET_BOTTOM_FRAC;
    const innerH = Math.max(1, h - padT - padB);

    return aligned.map((s) => {
      const pts: { x: number; y: number; v: number; i: number }[] = [];
      for (let i = 0; i < n; i += 1) {
        const v = s.values[i];
        if (v == null || !Number.isFinite(v)) continue;
        const x = resolvePeriodCenterX(i, n, w, LINE_PERIOD_MARGINS);
        const bandTop = valueToPlotBandTopPercent(v, yMin, yMax);
        const y = padT + innerH * (bandTop / 100);
        pts.push({ x, y, v, i });
      }
      return {
        id: s.id,
        color: s.color,
        d: smoothLinePathD(pts.map((p) => ({ x: p.x, y: p.y }))),
        pts,
        endPt: pts.at(-1) ?? null,
      };
    });
  }, [aligned, linePlotPx.h, linePlotPx.w, years.length, yMin, yMax]);

  const crossingLinePts = useMemo(() => {
    if (!(typeof targetUsd === "number" && targetUsd > 0)) return [];
    return linePaths.flatMap((lp) => {
      const values = aligned.find((s) => s.id === lp.id)?.values;
      if (!values) return [];
      const yearIndex = firstYearIndexCrossingTarget(values, targetUsd);
      if (yearIndex == null) return [];
      const pt = lp.pts.find((p) => p.i === yearIndex);
      if (!pt) return [];
      return [{ id: lp.id, color: lp.color, pt, yearIndex }];
    });
  }, [aligned, linePaths, targetUsd, years]);

  const crossingYearIndexes = useMemo(
    () => new Set(crossingLinePts.map((row) => row.yearIndex)),
    [crossingLinePts],
  );

  const shouldAnimateLine = years.length > 0;
  const lineValueLabelsVisible = !shouldAnimateLine || lineRevealProgress >= 1;
  const lineEnterClipId = useId();

  useEffect(() => {
    if (!shouldAnimateLine || linePlotPx.w <= 0) {
      if (linePlotPx.w > 0) setLineRevealProgress(1);
      return;
    }
    // Chip / scenario toggles and late ResizeObserver ticks must not replay the clip.
    if (lineEnteredRef.current) {
      setLineRevealProgress(1);
      return;
    }
    lineEnteredRef.current = true;
    setLineRevealProgress(0);
    return runFundamentalsBarEnterAnimation({
      periodCount: 1,
      onFrame: (elapsedMs) => {
        setLineRevealProgress(fundamentalsBarEnterProgress(0, 1, elapsedMs));
      },
      onComplete: () => setLineRevealProgress(1),
    });
  }, [shouldAnimateLine, linePlotPx.w]);

  const clearHover = useCallback(() => {
    setHoveredIndex(null);
    setTip(null);
  }, []);

  const onPlotMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const plot = plotAreaRef.current;
      const lineEl = linePlotRef.current;
      if (!plot || !lineEl || years.length === 0) return;
      const plotR = plot.getBoundingClientRect();
      const lineR = lineEl.getBoundingClientRect();
      const relX = e.clientX - lineR.left;
      const n = years.length;
      const w = linePlotPx.w;
      if (w <= 0) return;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < n; i += 1) {
        const cx = resolvePeriodCenterX(i, n, w, LINE_PERIOD_MARGINS);
        const d = Math.abs(cx - relX);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      setHoveredIndex(bestIdx);
      const focusX = resolvePeriodCenterX(bestIdx, n, w, LINE_PERIOD_MARGINS) + (lineR.left - plotR.left);
      const { anchorX, side } = computeFundamentalsChartTooltipPlacement(
        focusX,
        Math.max(1, Math.floor(plotR.width)),
      );
      const rows = aligned
        .map((s) => {
          const v = s.values[bestIdx];
          if (v == null || !Number.isFinite(v)) return null;
          return {
            id: s.id,
            label: s.label,
            value: formatUsdCompact(v),
            color: s.color,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r != null);
      if (!rows.length) {
        clearHover();
        return;
      }
      setTip({
        anchorX,
        y: e.clientY - plotR.top,
        side,
        periodLabel: String(years[bestIdx] ?? ""),
        rows,
      });
    },
    [aligned, clearHover, linePlotPx.w, years],
  );

  const hoveredLinePts = useMemo(() => {
    if (hoveredIndex == null) return [];
    const crossingIdsAtHover = new Set(
      crossingLinePts.filter((row) => row.yearIndex === hoveredIndex).map((row) => row.id),
    );
    return linePaths
      .map((lp) => ({ pt: lp.pts.find((p) => p.i === hoveredIndex), color: lp.color, id: lp.id }))
      .filter(
        (row): row is { pt: NonNullable<(typeof linePaths)[0]["pts"][number]>; color: string; id: string } =>
          row.pt != null && !crossingIdsAtHover.has(row.id),
      );
  }, [crossingLinePts, hoveredIndex, linePaths]);

  const plotCrosshairBand = {
    top: plotHeight * PLOT_INSET_TOP_FRAC,
    height: plotHeight * (1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC),
  };

  const achievedYearCrosshairs = useMemo(() => {
    if (years.length === 0 || linePlotPx.w <= 0) return [];
    return [...crossingYearIndexes]
      .sort((a, b) => a - b)
      .map((yearIndex) => ({
        yearIndex,
        left: resolvePeriodCenterX(yearIndex, years.length, linePlotPx.w, LINE_PERIOD_MARGINS),
      }));
  }, [crossingYearIndexes, linePlotPx.w, years.length]);

  const lineHoverCrosshair =
    hoveredIndex != null &&
    years.length > 0 &&
    linePlotPx.w > 0 &&
    !crossingYearIndexes.has(hoveredIndex)
      ? {
          left: resolvePeriodCenterX(hoveredIndex, years.length, linePlotPx.w, LINE_PERIOD_MARGINS),
        }
      : null;

  if (years.length === 0 || numericValues.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-stroke bg-canvas text-[13px] text-fg-muted"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-visible" style={{ height }}>
      <div className="relative flex w-full min-w-0 flex-col overflow-visible" style={{ height }}>
        <div className="flex min-h-0 w-full min-w-0 flex-1 gap-3" style={{ height: plotHeight }}>
          <div
            ref={plotAreaRef}
            className="relative min-h-0 min-w-0 flex-1"
            onMouseMove={onPlotMouseMove}
            onMouseLeave={clearHover}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%] z-0 bg-panel"
              aria-hidden
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
              <div
                className="absolute inset-x-0 bottom-0 border-t"
                style={{ borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER }}
              />
            </div>
            <ChartBrandWatermark />
            {achievedYearCrosshairs.map((hair) => (
              <div
                key={`achieved-${hair.yearIndex}`}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute z-[1] w-0 border-l border-dashed transition-colors duration-100",
                  hoveredIndex === hair.yearIndex ? "border-fg-muted" : "border-fg-muted/40",
                )}
                style={{
                  left: hair.left,
                  top: plotCrosshairBand.top,
                  height: plotCrosshairBand.height,
                }}
              />
            ))}
            {lineHoverCrosshair ? (
              <div
                aria-hidden
                className="pointer-events-none absolute z-[1] w-0 border-l border-dashed border-accent"
                style={{
                  left: lineHoverCrosshair.left,
                  top: plotCrosshairBand.top,
                  height: plotCrosshairBand.height,
                }}
              />
            ) : null}
            <div
              ref={linePlotRef}
              className="absolute inset-x-0 top-[8%] bottom-[4%] z-[2] min-h-0 w-full min-w-0"
            >
              {linePaths.some((lp) => lp.d) ? (
                <svg
                  width={linePlotPx.w}
                  height={linePlotPx.h}
                  className="relative block overflow-visible"
                  aria-hidden
                >
                  <defs>
                    {shouldAnimateLine && lineRevealProgress < 1 ? (
                      <clipPath id={lineEnterClipId}>
                        <rect
                          x={0}
                          y={0}
                          width={Math.max(0, linePlotPx.w * lineRevealProgress)}
                          height={linePlotPx.h}
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
                    {linePaths.map((lp) =>
                      lp.d ? (
                        <path
                          key={lp.id}
                          d={lp.d}
                          fill="none"
                          stroke={lp.color}
                          strokeWidth={LINE_STROKE_WIDTH_PX}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null,
                    )}
                    {linePaths.map((lp) =>
                      lp.endPt ? (
                        <circle
                          key={`end-dot-${lp.id}`}
                          cx={lp.endPt.x}
                          cy={lp.endPt.y}
                          r={END_DOT_RADIUS_PX}
                          fill={lp.color}
                        />
                      ) : null,
                    )}
                    {crossingLinePts.map((row) => (
                      <SparkLinePointMarker
                        key={`cross-${row.id}`}
                        x={row.pt.x}
                        y={row.pt.y}
                        color={row.color}
                      />
                    ))}
                    {hoveredLinePts.map((row) => (
                      <SparkLinePointMarker
                        key={`hover-${row.id}`}
                        x={row.pt.x}
                        y={row.pt.y}
                        color={row.color}
                      />
                    ))}
                  </g>
                </svg>
              ) : null}
              {lineValueLabelsVisible
                ? linePaths.map((lp) => {
                    if (!lp.endPt) return null;
                    const text = formatUsdCompact(lp.endPt.v);
                    const badgeClearance = CHARTING_LINE_POINT_MARKER_DIAMETER_PX / 2 + 6;
                    const minTop = FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX + 8;
                    return (
                      <div
                        key={`end-${lp.id}`}
                        className="pointer-events-none absolute z-[15] -translate-x-1/2 -translate-y-full"
                        style={{
                          left: lp.endPt.x,
                          top: Math.max(minTop, lp.endPt.y - badgeClearance),
                        }}
                      >
                        <span
                          className="inline-block rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold leading-4 tabular-nums whitespace-nowrap text-white"
                          style={{ backgroundColor: lp.color }}
                        >
                          {text}
                        </span>
                      </div>
                    );
                  })
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
              >
                <p className="text-[12px] font-semibold leading-4 text-fg">{tip.periodLabel}</p>
                <div className="mt-1.5 space-y-1">
                  {tip.rows.map((r) => (
                    <div key={r.id} className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: r.color }}
                          aria-hidden
                        />
                        <span className="truncate text-[12px] font-normal leading-4 text-fg-muted">
                          {r.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-fg">
                        {r.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div
            className="relative shrink-0 pl-0 pr-0"
            style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
            aria-hidden
          >
            {yTicks.map((t, i) => {
              const nt = yTicks.length;
              const pct = nt <= 1 ? 0 : i / (nt - 1);
              const top = `${(PLOT_INSET_TOP_FRAC + pct * (1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC)) * 100}%`;
              return (
                <span
                  key={`y-${i}`}
                  className="absolute left-0 block -translate-y-1/2 text-[12px] tabular-nums leading-none text-fg-muted"
                  style={{ top }}
                >
                  {formatFundamentalsAxisTickLabel("usd", t)}
                </span>
              );
            })}
          </div>
        </div>
        <div
          className="flex w-full min-w-0 gap-3 pt-1.5"
          style={{ height: AXIS_ROW_PX + AXIS_BOTTOM_PAD_PX }}
        >
          <div className="relative min-w-0 flex-1 overflow-visible">
            {years.map((year, i) => {
              const isCrossingYear = crossingYearIndexes.has(i);
              const label = isCrossingYear ? String(year) : goalYearAxisLabel(year, years, i);
              if (!label) return null;
              const leftPct = resolvePeriodCenterLeftPercent(i, years.length, LINE_PERIOD_MARGINS);
              return (
                <span
                  key={year}
                  className={cn(
                    "absolute top-1.5 inline-block -translate-x-1/2 whitespace-nowrap text-[12px] tabular-nums leading-none",
                    isCrossingYear
                      ? "font-semibold text-fg"
                      : "font-medium text-fg-muted",
                  )}
                  style={{ left: `${leftPct}%` }}
                >
                  {label}
                </span>
              );
            })}
          </div>
          <div
            className="shrink-0"
            style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

export function GoalScenarioLegendBadge({
  label,
  swatch,
  pressed,
  onToggle,
}: {
  label: string;
  swatch: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-stroke bg-surface px-3 py-0 text-[12px] font-medium leading-none text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))] transition-opacity",
        !pressed && "opacity-40",
      )}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch }} aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
