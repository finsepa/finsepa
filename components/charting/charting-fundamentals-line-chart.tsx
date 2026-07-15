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

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  readChartingMetricValue,
  type ChartingMetricId,
  type ChartingMetricKind,
} from "@/lib/market/stock-charting-metrics";
import type { FundamentalsChartDisplayOptions } from "@/lib/chart/fundamentals-chart-display-options";
import {
  filterPointsForChartingFundamentalsLineChart,
  formatFundamentalsLineChartAxisLabel,
  type ChartingFundamentalsLineTimeRange,
} from "@/lib/chart/fundamentals-line-chart-series";
import {
  barWidthPxForFundamentalsLineChart,
  maxBarsForFundamentalsLineChart,
} from "@/lib/chart/fundamentals-line-chart-config";
import {
  MultichartFundamentalsBar,
  type PeriodPlotEdgeMargin,
} from "@/components/stock/multichart-fundamentals-bar";
import { formatBarChartDataLabel } from "@/components/charting/charting-individual-company-table";
import {
  buildFundamentalsYAxisDomain,
  CHARTING_LINE_HOVER_HALO_BG,
  CHARTING_LINE_POINT_MARKER_DIAMETER_PX,
  computeFundamentalsChartTooltipPlacement,
  FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  valueToPlotBandTopPercent,
} from "@/lib/chart/fundamentals-chart-surface";
import { formatChartingTableCell } from "@/components/charting/charting-individual-company-table";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { ChartBrandWatermark } from "@/components/chart/chart-brand-watermark";
import { smoothLinePathD } from "@/lib/chart/smooth-line-path";
import {
  fundamentalsBarEnterProgress,
  runFundamentalsBarEnterAnimation,
} from "@/lib/chart/fundamentals-bar-enter-animation";

const MULTICHART_AXIS_ROW_PX = 32;
const MULTICHART_AXIS_BOTTOM_PAD_PX = 10;
const MULTICHART_Y_AXIS_W_LINE_PX = 46;
const PLOT_INSET_TOP_FRAC = 0.08;
const PLOT_INSET_BOTTOM_FRAC = 0.04;
const HOVER_DOT_HALO_RADIUS_PX = 14;
const LINE_HOVER_CROSSHAIR_CLASS = "border-l border-dashed border-[#2563EB]";
const MULTICHART_LINE_STROKE_WIDTH_PX = 2;

const LINE_PERIOD_MARGINS: PeriodPlotEdgeMargin = { left: 0, right: 0 };
const LINE_AXIS_LABEL_MARGINS: PeriodPlotEdgeMargin = { left: 0.022, right: 0.022 };

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

type AlignedSeries = {
  id: ChartingMetricId;
  kind: ChartingMetricKind;
  color: string;
  values: (number | null)[];
};

type Props = {
  metricIds: ChartingMetricId[];
  points: ChartingSeriesPoint[];
  lineTimeRange: ChartingFundamentalsLineTimeRange;
  displayOptions: FundamentalsChartDisplayOptions;
  height: number;
  animateBarsOnAppear?: boolean;
  metricColors: Map<ChartingMetricId, string>;
};

function formatAxisValue(kind: ChartingMetricKind, p: number): string {
  return formatChartingTableCell(kind, p);
}

function ChartingMultiMetricFundamentalsLineChart({
  metricIds,
  points,
  lineTimeRange,
  displayOptions,
  height,
  animateBarsOnAppear = false,
  metricColors,
}: Props) {
  const plotAreaRef = useRef<HTMLDivElement>(null);
  const linePlotRef = useRef<HTMLDivElement>(null);
  const [linePlotPx, setLinePlotPx] = useState({ w: 0, h: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lineRevealProgress, setLineRevealProgress] = useState(1);
  const [tip, setTip] = useState<{
    anchorX: number;
    y: number;
    side: "left" | "right";
    periodLabel: string;
    rows: { id: ChartingMetricId; label: string; value: string; color: string }[];
  } | null>(null);

  const plotHeight = height - MULTICHART_AXIS_ROW_PX - MULTICHART_AXIS_BOTTOM_PAD_PX;

  const { periodEnds, axisLabels, series, kind } = useMemo(() => {
    const filteredByMetric = metricIds.map((id) =>
      filterPointsForChartingFundamentalsLineChart(points, id, lineTimeRange),
    );
    const endSet = new Set<string>();
    for (const rows of filteredByMetric) {
      for (const row of rows) endSet.add(row.periodEnd);
    }
    const ends = [...endSet].sort((a, b) => a.localeCompare(b));
    const aligned: AlignedSeries[] = metricIds.map((id, idx) => {
      const byEnd = new Map(
        filteredByMetric[idx]!.map((row) => [row.periodEnd, readChartingMetricValue(row, id)]),
      );
      return {
        id,
        kind: CHARTING_METRIC_KIND[id],
        color: metricColors.get(id) ?? "#2563EB",
        values: ends.map((pe) => {
          const v = byEnd.get(pe);
          return v != null && Number.isFinite(v) ? v : null;
        }),
      };
    });
    const axisLabs = ends.map((pe, i) =>
      formatFundamentalsLineChartAxisLabel(pe, i, ends, lineTimeRange),
    );
    return {
      periodEnds: ends,
      axisLabels: axisLabs,
      series: aligned,
      kind: aligned[0]?.kind ?? "usd",
    };
  }, [metricIds, points, lineTimeRange, metricColors]);

  const numericValues = useMemo(() => {
    const out: number[] = [];
    for (const s of series) {
      for (const v of s.values) {
        if (v != null && Number.isFinite(v)) out.push(v);
      }
    }
    return out;
  }, [series]);

  const yDomain = useMemo(() => {
    if (!numericValues.length) return buildFundamentalsYAxisDomain(0, 0, kind);
    return buildFundamentalsYAxisDomain(
      Math.min(...numericValues),
      Math.max(...numericValues),
      kind,
    );
  }, [numericValues, kind]);

  const yMin = yDomain.min;
  const yMax = yDomain.max;
  const yTicks = yDomain.ticks;

  useLayoutEffect(() => {
    const el = linePlotRef.current;
    if (!el) return;
    const measure = () => {
      setLinePlotPx({ w: Math.max(0, el.clientWidth), h: Math.max(0, el.clientHeight) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [periodEnds.length, height, plotHeight]);

  const linePaths = useMemo(() => {
    const w = linePlotPx.w;
    const h = linePlotPx.h;
    const n = periodEnds.length;
    if (n === 0 || w <= 0 || h <= 0) {
      return [] as {
        id: ChartingMetricId;
        color: string;
        d: string;
        pts: { x: number; y: number; v: number; i: number }[];
        maxPt: { x: number; y: number; v: number; i: number } | null;
      }[];
    }
    const padT = h * PLOT_INSET_TOP_FRAC;
    const padB = h * PLOT_INSET_BOTTOM_FRAC;
    const innerH = Math.max(1, h - padT - padB);

    return series.map((s) => {
      const pts: { x: number; y: number; v: number; i: number }[] = [];
      for (let i = 0; i < n; i += 1) {
        const v = s.values[i];
        if (v == null || !Number.isFinite(v)) continue;
        const x = resolvePeriodCenterX(i, n, w, LINE_PERIOD_MARGINS);
        const bandTop = valueToPlotBandTopPercent(v, yMin, yMax);
        const y = padT + innerH * (bandTop / 100);
        pts.push({ x, y, v, i });
      }
      const curvePts = pts.map((p) => ({ x: p.x, y: p.y }));
      let maxPt: { x: number; y: number; v: number; i: number } | null = null;
      for (const pt of pts) {
        if (maxPt == null || pt.v > maxPt.v || (pt.v === maxPt.v && pt.i > maxPt.i)) maxPt = pt;
      }
      if (maxPt != null && (maxPt.v === 0 || !Number.isFinite(maxPt.v))) maxPt = null;
      return {
        id: s.id,
        color: s.color,
        d: smoothLinePathD(curvePts),
        pts,
        maxPt,
      };
    });
  }, [linePlotPx.h, linePlotPx.w, periodEnds.length, series, yMin, yMax]);

  const shouldAnimateLine = animateBarsOnAppear && periodEnds.length > 0;
  const lineValueLabelsVisible = !shouldAnimateLine || lineRevealProgress >= 1;
  const lineEnterClipId = useId();

  useEffect(() => {
    if (!shouldAnimateLine || linePlotPx.w <= 0) {
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
  }, [shouldAnimateLine, periodEnds.length, linePlotPx.w, metricIds.join(",")]);

  const clearHover = useCallback(() => {
    setHoveredIndex(null);
    setTip(null);
  }, []);

  const onPlotMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const plot = plotAreaRef.current;
      const lineEl = linePlotRef.current;
      if (!plot || !lineEl || periodEnds.length === 0) return;
      const plotR = plot.getBoundingClientRect();
      const lineR = lineEl.getBoundingClientRect();
      const relX = e.clientX - lineR.left;
      const n = periodEnds.length;
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
      const rows = series
        .map((s) => {
          const v = s.values[bestIdx];
          if (v == null || !Number.isFinite(v)) return null;
          return {
            id: s.id,
            label: CHARTING_METRIC_LABEL[s.id],
            value: formatChartingTableCell(s.kind, v),
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
        periodLabel: periodEnds[bestIdx] ?? "",
        rows,
      });
    },
    [clearHover, linePlotPx.w, periodEnds, series],
  );

  const hoveredLinePts = useMemo(() => {
    if (hoveredIndex == null) return [];
    return linePaths
      .map((lp) => lp.pts.find((p) => p.i === hoveredIndex))
      .filter((p): p is NonNullable<typeof p> => p != null);
  }, [hoveredIndex, linePaths]);

  const lineHoverCrosshair =
    hoveredLinePts[0] != null
      ? {
          left: hoveredLinePts[0].x,
          top: plotHeight * PLOT_INSET_TOP_FRAC,
          height: plotHeight * (1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC),
        }
      : null;

  if (periodEnds.length === 0 || numericValues.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] text-[13px] text-[#71717A]"
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
              className="pointer-events-none absolute inset-x-0 top-[8%] bottom-[4%] z-0 bg-white"
              aria-hidden
            >
              <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
              <div
                className="absolute inset-x-0 bottom-0 border-t"
                style={{ borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER }}
              />
            </div>
            <ChartBrandWatermark />
            {lineHoverCrosshair ? (
              <div
                aria-hidden
                className={`pointer-events-none absolute z-[1] w-0 ${LINE_HOVER_CROSSHAIR_CLASS}`}
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
                          strokeWidth={MULTICHART_LINE_STROKE_WIDTH_PX}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null,
                    )}
                    {hoveredLinePts.map((pt, idx) => {
                      const color = linePaths[idx]?.color ?? "#2563EB";
                      return (
                        <g key={`hover-${idx}`}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={HOVER_DOT_HALO_RADIUS_PX}
                            fill={CHARTING_LINE_HOVER_HALO_BG}
                          />
                          <circle cx={pt.x} cy={pt.y} r={4.5} fill="white" stroke={color} strokeWidth={2} />
                        </g>
                      );
                    })}
                  </g>
                </svg>
              ) : null}
              {lineValueLabelsVisible && !displayOptions.showMaxLine
                ? linePaths.map((lp) => {
                    if (!lp.maxPt) return null;
                    const text = formatBarChartDataLabel(lp.id, lp.maxPt.v);
                    const dotClearance = CHARTING_LINE_POINT_MARKER_DIAMETER_PX / 2 + 4;
                    const minTop = FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX + 4;
                    return (
                      <div
                        key={`max-${lp.id}`}
                        className="pointer-events-none absolute z-[15] max-w-[5.5rem] -translate-x-1/2 -translate-y-full text-center"
                        style={{
                          left: lp.maxPt.x,
                          top: Math.max(minTop, lp.maxPt.y - dotClearance),
                        }}
                        title={text}
                      >
                        <span
                          className="block truncate text-[11px] font-semibold leading-none tabular-nums text-[#09090B]"
                          style={{
                            textShadow:
                              "0 0 3px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.8)",
                          }}
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
                <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{tip.periodLabel}</p>
                <div className="mt-1.5 space-y-1">
                  {tip.rows.map((r) => (
                    <div key={r.id} className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: r.color }}
                          aria-hidden
                        />
                        <span className="truncate text-[12px] font-normal leading-4 text-[#71717A]">
                          {r.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold leading-4 tabular-nums text-[#09090B]">
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
            style={{ width: MULTICHART_Y_AXIS_W_LINE_PX }}
            aria-hidden
          >
            {yTicks.map((t, i) => {
              const nt = yTicks.length;
              const pct = nt <= 1 ? 0 : i / (nt - 1);
              const top = `${(PLOT_INSET_TOP_FRAC + pct * (1 - PLOT_INSET_TOP_FRAC - PLOT_INSET_BOTTOM_FRAC)) * 100}%`;
              return (
                <span
                  key={`y-${i}`}
                  className="absolute left-0 block -translate-y-1/2 text-[12px] tabular-nums leading-none text-[#71717A]"
                  style={{ top }}
                >
                  {formatAxisValue(kind, t)}
                </span>
              );
            })}
          </div>
        </div>
        <div
          className="relative w-full min-w-0 pt-1.5"
          style={{ height: MULTICHART_AXIS_ROW_PX + MULTICHART_AXIS_BOTTOM_PAD_PX }}
        >
          {periodEnds.map((pe, i) => {
            const label = axisLabels[i] ?? "";
            if (!label) return null;
            const leftPct = resolvePeriodCenterLeftPercent(i, periodEnds.length, LINE_AXIS_LABEL_MARGINS);
            return (
              <span
                key={pe}
                className="absolute top-1.5 inline-block -translate-x-1/2 whitespace-nowrap text-[12px] tabular-nums leading-none text-[#71717A]"
                style={{ left: `${leftPct}%` }}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ChartingFundamentalsLineChart({
  metricIds,
  points,
  lineTimeRange,
  displayOptions,
  height,
  animateBarsOnAppear = false,
  metricColors,
}: Props) {
  const maxBars = maxBarsForFundamentalsLineChart("quarterly", lineTimeRange);
  const barWidthPx = barWidthPxForFundamentalsLineChart(lineTimeRange);
  const singleMetricId = metricIds.length === 1 ? metricIds[0]! : null;
  const singleChartPoints = useMemo(() => {
    if (singleMetricId == null) return [];
    return filterPointsForChartingFundamentalsLineChart(points, singleMetricId, lineTimeRange);
  }, [points, singleMetricId, lineTimeRange]);

  if (singleMetricId != null) {
    return (
      <MultichartFundamentalsBar
        key={`${singleMetricId}-${lineTimeRange}`}
        metricId={singleMetricId}
        points={singleChartPoints}
        height={height}
        periodMode="quarterly"
        visual="line"
        maxBars={maxBars}
        barWidthPx={barWidthPx}
        compactHorizontalLayout
        displayOptions={displayOptions}
        animateBarsOnAppear={animateBarsOnAppear}
        horizontalPeriodAxisLabels
        lineTimeRange={lineTimeRange}
        periodPlotMargins={{ left: 0, right: 0 }}
        showLinePointMarkers={false}
        showBrandWatermark
      />
    );
  }

  return (
    <ChartingMultiMetricFundamentalsLineChart
      metricIds={metricIds}
      points={points}
      lineTimeRange={lineTimeRange}
      displayOptions={displayOptions}
      height={height}
      animateBarsOnAppear={animateBarsOnAppear}
      metricColors={metricColors}
    />
  );
}

export function chartingMetricsShareLineChartKind(metricIds: ChartingMetricId[]): boolean {
  if (metricIds.length === 0) return false;
  const first = CHARTING_METRIC_KIND[metricIds[0]!];
  return metricIds.every((id) => CHARTING_METRIC_KIND[id] === first);
}
