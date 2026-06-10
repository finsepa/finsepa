"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, X } from "@/lib/icons";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type IPanePrimitive,
  type IPanePrimitivePaneView,
  type IPrimitivePaneRenderer,
  type ISeriesApi,
  type MouseEventParams,
  type PaneAttachedParameter,
  type UTCTimestamp,
} from "lightweight-charts";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  formatChartingPeriodAxisLabel,
  formatChartingPeriodLabel,
  fundamentalsPeriodAxisShowsLabel,
} from "@/lib/market/charting-period-display";
import {
  CHARTING_DEFAULT_METRICS,
  CHARTING_DROPDOWN_GROUPS,
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_IDS,
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  type ChartingMetricKind,
  buildStandaloneChartPath,
  parseChartingMetricsParam,
  type StandaloneChartRoute,
} from "@/lib/market/stock-charting-metrics";
import {
  ChartingIndividualCompanyTable,
  formatBarChartDataLabel,
  formatChartingTableCell,
} from "@/components/charting/charting-individual-company-table";
import { DataFetchTopLoader } from "@/components/layout/data-fetch-top-loader";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { ChartLoadingIndicator } from "@/components/ui/chart-loading-indicator";
import { ChartingVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import { secondaryFillButtonClassName, TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import {
  dropdownMenuRichItemClassName,
  dropdownMenuSearchHeaderClassName,
  dropdownMenuSearchInputClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";
import {
  fundamentalsBarColorAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import {
  buildFixedFundamentalsYAxisTicks,
  buildFundamentalsYAxisTicks,
  chartingFundamentalsSeriesNoReferenceLines,
  chartingFundamentalsLineSeriesOptions,
  CHARTING_LINE_HOVER_HALO_BG,
  CHARTING_LINE_HOVER_HALO_RADIUS_PX,
  CHARTING_LINE_POINT_MARKER_BORDER_PX,
  CHARTING_LINE_POINT_MARKER_DIAMETER_PX,
  computeFundamentalsChartTooltipPlacement,
  formatFundamentalsAxisTickLabel,
  FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG,
  FUNDAMENTALS_CHART_HOVER_BAND_BG,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  FUNDAMENTALS_CHART_SCALE_MARGIN_BOTTOM_BARS,
  FUNDAMENTALS_CHART_SCALE_MARGIN_BOTTOM_LINE,
  FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX,
  fundamentalsChartScaleMarginTop,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  HIDE_NATIVE_Y_AXIS_TICK_LABELS,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  FUNDAMENTALS_BAR_VALUE_LABEL_STAGGER_MS,
  prefersReducedFundamentalsBarMotion,
  runFundamentalsBarEnterAnimation,
  scaleBarPointsForEnter,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import {
  FundamentalsRoundedBarsPrimitive,
  type FundamentalsRoundedBarItem,
} from "@/lib/chart/fundamentals-rounded-bar-primitive";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { fetchChartingFundamentalsSeriesCached } from "@/lib/charting/charting-fundamentals-client-cache";

/** Y-axis tick labels — match reference (e.g. "30 B", "15 B", "0"). */
function formatChartAxisPrice(p: number): string {
  if (!Number.isFinite(p)) return "";
  const abs = Math.abs(p);
  if (abs >= 1e9) return `${Math.round(p / 1e9)} B`;
  if (abs >= 1e6) return `${Math.round(p / 1e6)} M`;
  if (abs >= 1e3) return `${Math.round(p / 1e3)} K`;
  if (abs < 1e-9) return "0";
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Figma 8479:70857 — fixed unit dropdown (axis labels). */
export type ChartingUnitScale = "auto" | "billions" | "millions" | "thousands";

function formatAxisForUnit(p: number, unit: ChartingUnitScale): string {
  if (!Number.isFinite(p)) return "";
  if (unit === "auto") return formatChartAxisPrice(p);
  const sign = p < 0 ? "-" : "";
  const abs = Math.abs(p);
  switch (unit) {
    case "billions": {
      const v = abs / 1e9;
      const t = v >= 100 ? Math.round(v).toString() : v.toFixed(2);
      return `${sign}${t} B`;
    }
    case "millions": {
      const v = abs / 1e6;
      const t = v >= 100 ? Math.round(v).toString() : v.toFixed(2);
      return `${sign}${t} M`;
    }
    case "thousands": {
      return `${sign}${Math.round(abs / 1e3)} K`;
    }
    default:
      return formatChartAxisPrice(p);
  }
}

/** Draw shorter metric first, taller last so stacked-from-zero columns remain legible with alpha. */
function barMetricOrder(ids: ChartingMetricId[]): ChartingMetricId[] {
  const rank = (id: ChartingMetricId) => {
    if (id === "net_income") return 0;
    if (id === "revenue") return 1;
    return 2 + CHARTING_METRIC_IDS.indexOf(id);
  };
  return [...ids].sort((a, b) => rank(a) - rank(b));
}

function scaleIdForKind(k: ChartingMetricKind): string {
  switch (k) {
    case "usd":
      return "usd";
    case "shares":
      return "shares";
    case "eps":
      return "eps";
    case "percent":
      return "pct";
    case "multiple":
    case "ratio":
      return "mult";
    default:
      return "usd";
  }
}

/** Right axis for percent metrics when mixed with USD bars (0–50%, five ticks). */
const CHARTING_PERCENT_Y_AXIS_MAX = 50;

/** Plot scale for percent metrics on the dedicated 0–50% axis. */
function chartingPercentPlotValue(raw: number): number {
  if (!Number.isFinite(raw)) return raw;
  return Math.abs(raw) <= 1 && raw !== 0 ? raw * 100 : raw;
}

function chartingPlotValueForKind(kind: ChartingMetricKind, raw: number): number {
  if (kind !== "percent") return raw;
  return chartingPercentPlotValue(raw);
}

function chartingPlotBarPointsForKind(
  points: ChartingBarSeriesPoint[],
  kind: ChartingMetricKind,
): ChartingBarSeriesPoint[] {
  if (kind !== "percent") return points;
  return points.map((p) => ({
    ...p,
    value: isTransparentChartingBarPoint(p) ? p.value : chartingPercentPlotValue(p.value),
  }));
}

function chartingPlotLinePointsForKind(
  points: ChartingBarSeriesPoint[],
  kind: ChartingMetricKind,
): { time: UTCTimestamp; value: number }[] {
  return points.map((p) => ({
    time: p.time,
    value: chartingPlotValueForKind(kind, p.value),
  }));
}

type ChartingYAxisConfig = {
  kind: ChartingMetricKind;
  ticks: number[];
};

function priceFormatForKind(kind: ChartingMetricKind) {
  switch (kind) {
    case "eps":
      return { type: "price" as const, precision: 2, minMove: 0.01 };
    case "percent":
      return { type: "percent" as const, precision: 2, minMove: 0.01 };
    case "multiple":
    case "ratio":
      return { type: "price" as const, precision: 2, minMove: 0.01 };
    default:
      return { type: "price" as const, precision: 2, minMove: 0.01 };
  }
}

export type ChartTimeRange = "1Y" | "2Y" | "3Y" | "5Y" | "10Y" | "all";
export type ChartType = "line" | "bars";

/** Default period when opening Charting (stock tab, compare, empty toolbar). */
export const DEFAULT_CHART_TIME_RANGE: ChartTimeRange = "10Y";

/** Right-edge value pills (Figma / TradingView-style) for multi-metric line charts. */
type LineEndBadge = {
  id: ChartingMetricId;
  topPx: number;
  text: string;
  color: string;
};

/** Value label centered above a histogram bar. */
type BarValueLabel = {
  key: string;
  metricId: ChartingMetricId;
  leftPx: number;
  topPx: number;
  text: string;
  color: string;
  periodIndex: number;
};

/** Hollow dot on a line series (white fill, series-color stroke). */
type LinePointMarker = {
  key: string;
  leftPx: number;
  topPx: number;
  color: string;
};

type PeriodAxisLabel = {
  key: string;
  leftPx: number;
  axisText: string;
  title: string;
};

const LINE_BADGE_MIN_GAP_PX = 22;

function staggerLineEndBadges(badges: LineEndBadge[], chartHeightPx: number): LineEndBadge[] {
  if (badges.length === 0) return [];
  const maxY = Math.max(LINE_BADGE_MIN_GAP_PX, chartHeightPx - 12);
  const tops = badges.map((b) => Math.min(Math.max(b.topPx, 12), maxY));
  for (let j = 1; j < tops.length; j++) {
    if (tops[j]! - tops[j - 1]! < LINE_BADGE_MIN_GAP_PX) {
      tops[j] = tops[j - 1]! + LINE_BADGE_MIN_GAP_PX;
    }
  }
  for (let j = tops.length - 2; j >= 0; j--) {
    if (tops[j + 1]! - tops[j]! < LINE_BADGE_MIN_GAP_PX) {
      tops[j] = tops[j + 1]! - LINE_BADGE_MIN_GAP_PX;
    }
  }
  for (let j = 0; j < tops.length; j++) {
    tops[j] = Math.min(Math.max(tops[j]!, 12), maxY);
  }
  return badges.map((b, i) => ({ ...b, topPx: tops[i]! }));
}

function computeLineEndBadgeLayout(
  chartType: ChartType,
  seriesByMetric: Map<ChartingMetricId, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>,
  ordered: ChartingSeriesPoint[],
  selected: ChartingMetricId[],
  chartHeightPx: number,
): LineEndBadge[] {
  if (chartType !== "line" || !ordered.length || !selected.length) return [];
  const raw: LineEndBadge[] = [];
  let colorIdx = 0;
  for (const id of selected) {
    const series = seriesByMetric.get(id);
    if (!series) {
      colorIdx += 1;
      continue;
    }
    const data = seriesData(ordered, id, 0);
    if (!data.length) {
      colorIdx += 1;
      continue;
    }
    const last = data[data.length - 1]!;
    const y = series.priceToCoordinate(last.value);
    if (y == null || !Number.isFinite(y)) {
      colorIdx += 1;
      continue;
    }
    raw.push({
      id,
      topPx: y,
      text: formatChartingTableCell(CHARTING_METRIC_KIND[id], last.value),
      color: fundamentalsBarSolidAtIndex(colorIdx),
    });
    colorIdx += 1;
  }
  return staggerLineEndBadges(raw, chartHeightPx);
}

function computeLinePointMarkersLayout(
  chart: IChartApi,
  seriesByMetric: Map<ChartingMetricId, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>,
  ordered: ChartingSeriesPoint[],
  selected: ChartingMetricId[],
): LinePointMarker[] {
  if (!ordered.length || !selected.length) return [];
  const ts = chart.timeScale();
  const markers: LinePointMarker[] = [];
  let colorIdx = 0;
  for (const id of selected) {
    const series = seriesByMetric.get(id);
    if (!series) {
      colorIdx += 1;
      continue;
    }
    const color = fundamentalsBarSolidAtIndex(colorIdx);
    const data = seriesData(ordered, id, 0);
    for (const pt of data) {
      const x = ts.timeToCoordinate(pt.time);
      const y = series.priceToCoordinate(pt.value);
      if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      markers.push({
        key: `${id}-${pt.time}`,
        leftPx: x,
        topPx: y,
        color,
      });
    }
    colorIdx += 1;
  }
  return markers;
}

function computePeriodAxisLabelsLayout(
  chart: IChartApi,
  ordered: ChartingSeriesPoint[],
  periodMode: "annual" | "quarterly",
  chartType: ChartType,
  selected: ChartingMetricId[],
  barBaseTimeByPeriodEnd: Map<string, number> | null,
  stockFullWidthFixedBars: boolean,
): PeriodAxisLabel[] {
  if (!ordered.length) return [];
  const ts = chart.timeScale();
  const seriesOrder = chartType === "bars" ? barMetricOrder(selected) : selected;
  const labels: PeriodAxisLabel[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i]!;
    let x: number | null = null;
    if (chartType === "bars" && barBaseTimeByPeriodEnd) {
      x = chartingPeriodCenterXPx(
        chart,
        i,
        ordered,
        seriesOrder,
        barBaseTimeByPeriodEnd,
        stockFullWidthFixedBars,
      );
    } else {
      const ms = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
      if (Number.isFinite(ms)) {
        const coord = ts.timeToCoordinate(Math.floor(ms / 1000) as UTCTimestamp);
        if (coord != null && Number.isFinite(coord)) x = coord;
      }
    }
    if (x == null) continue;
    labels.push({
      key: row.periodEnd,
      leftPx: x,
      axisText: formatChartingPeriodAxisLabel(row.periodEnd, periodMode),
      title: formatChartingPeriodLabel(row.periodEnd, periodMode),
    });
  }
  return labels;
}

function computeBarValueLabelsLayout(
  chart: IChartApi,
  seriesByMetric: Map<ChartingMetricId, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>,
  ordered: ChartingSeriesPoint[],
  selected: ChartingMetricId[],
  barBaseTimeByPeriodEnd: Map<string, number> | null,
  stockFullWidthFixedBars: boolean,
): BarValueLabel[] {
  if (!ordered.length || !selected.length) return [];
  const seriesOrder = barMetricOrder(selected);
  const ts = chart.timeScale();
  const labels: BarValueLabel[] = [];

  for (let ci = 0; ci < seriesOrder.length; ci++) {
    const id = seriesOrder[ci]!;
    const series = seriesByMetric.get(id);
    if (!series) continue;
    const kind = CHARTING_METRIC_KIND[id];
    const shiftSec =
      selected.length > 1 ? groupedBarShiftSeconds(id, seriesOrder, stockFullWidthFixedBars) : 0;

    for (let periodIndex = 0; periodIndex < ordered.length; periodIndex++) {
      const row = ordered[periodIndex]!;
      const v = rowValue(row, id);
      if (v == null || !Number.isFinite(v) || v === 0) continue;

      let timeSec: number | null = null;
      if (barBaseTimeByPeriodEnd) {
        const base = barBaseTimeByPeriodEnd.get(row.periodEnd);
        if (base != null) timeSec = base + shiftSec;
      } else {
        const ms = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
        if (Number.isFinite(ms)) timeSec = Math.floor(ms / 1000) + shiftSec;
      }
      if (timeSec == null) continue;

      const x = ts.timeToCoordinate(timeSec as UTCTimestamp);
      const plotV = chartingPlotValueForKind(kind, v);
      const yVal = series.priceToCoordinate(plotV);
      const yZero = series.priceToCoordinate(0);
      if (x == null || yVal == null || yZero == null || !Number.isFinite(x) || !Number.isFinite(yVal)) continue;

      const barTop = v >= 0 ? yVal : yZero;
      const labelAnchorMin =
        FUNDAMENTALS_CHART_BAR_VALUE_LABEL_HEIGHT_PX + 4;
      labels.push({
        key: `${id}-${row.periodEnd}`,
        metricId: id,
        leftPx: x,
        topPx: Math.max(labelAnchorMin, barTop - 4),
        text: formatBarChartDataLabel(id, v),
        color: fundamentalsBarSolidAtIndex(ci),
        periodIndex,
      });
    }
  }

  return labels;
}

/** Map Y-axis tick values to pane Y coordinates so the $0 grid line matches bar bases. */
function computeYGridTickTopsPx(
  series: ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | undefined,
  ticks: readonly number[],
): number[] | null {
  if (!series || ticks.length === 0) return null;
  const tops: number[] = [];
  for (const tick of ticks) {
    const y = series.priceToCoordinate(tick);
    if (y == null || !Number.isFinite(y)) return null;
    tops.push(y);
  }
  return tops;
}

/** Hover column top/bottom — align with top Y tick ($500B) and $0 baseline grid lines. */
function chartingHoverBandVerticalRangePx(
  series: ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | undefined,
  ticks: readonly number[] | undefined,
): { y0: number; y1: number } | null {
  if (!series || !ticks?.length) return null;
  const yTop = series.priceToCoordinate(ticks[0]!);
  const yBottom = series.priceToCoordinate(0);
  if (yTop == null || yBottom == null || !Number.isFinite(yTop) || !Number.isFinite(yBottom)) {
    return null;
  }
  return { y0: yTop, y1: yBottom };
}

/** Stock page Charting tab — full range including 2Y. */
export const DEFAULT_CHART_TIME_RANGE_ORDER: ChartTimeRange[] = ["1Y", "2Y", "3Y", "5Y", "10Y", "all"];

/** Standalone `/charting` page only (not symbol tab). */
export const STANDALONE_CHARTING_TIME_RANGE_ORDER: ChartTimeRange[] = ["1Y", "3Y", "5Y", "10Y", "all"];

const TIME_RANGE_LABELS: Record<ChartTimeRange, string> = {
  "1Y": "1Y",
  "2Y": "2Y",
  "3Y": "3Y",
  "5Y": "5Y",
  "10Y": "10Y",
  all: "All",
};

const RANGE_PERIODS: Record<ChartTimeRange, { annual: number; quarterly: number }> = {
  "1Y": { annual: 1, quarterly: 4 },
  "2Y": { annual: 2, quarterly: 8 },
  "3Y": { annual: 3, quarterly: 12 },
  "5Y": { annual: 5, quarterly: 20 },
  "10Y": { annual: 10, quarterly: 40 },
  all: { annual: Number.POSITIVE_INFINITY, quarterly: Number.POSITIVE_INFINITY },
};

function applyTimeRange(
  points: ChartingSeriesPoint[],
  periodMode: "annual" | "quarterly",
  range: ChartTimeRange,
): ChartingSeriesPoint[] {
  if (range === "all" || points.length === 0) return points;
  const max = RANGE_PERIODS[range][periodMode];
  if (!Number.isFinite(max)) return points;
  return points.slice(-max);
}

function rowValue(row: ChartingSeriesPoint, id: ChartingMetricId): number | null {
  const k = CHARTING_METRIC_FIELD[id];
  const v = row[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const CHARTING_BAR_TRANSPARENT = "rgba(0,0,0,0)";
/** Non-hovered period bars while a column is hovered (Multicharts-style focus). */
const CHARTING_BAR_HOVER_DIM_OPACITY = 0.6;

type ChartingBarSeriesPoint = {
  time: UTCTimestamp;
  value: number;
  color?: string;
  periodIndex: number;
};

function isTransparentChartingBarPoint(p: ChartingBarSeriesPoint): boolean {
  return p.value === 0 && p.color === CHARTING_BAR_TRANSPARENT;
}

function chartingBarPointFillColor(
  colorIdx: number,
  periodIndex: number,
  hoveredPeriodIndex: number | null,
): string {
  if (hoveredPeriodIndex == null || periodIndex === hoveredPeriodIndex) {
    return fundamentalsBarSolidAtIndex(colorIdx);
  }
  return fundamentalsBarColorAtIndex(colorIdx, CHARTING_BAR_HOVER_DIM_OPACITY);
}

function chartingBarPointsToHistogramData(
  points: ChartingBarSeriesPoint[],
  _colorIdx: number,
  _hoveredPeriodIndex: number | null,
) {
  return points.map((p) => ({
    time: p.time,
    value: p.value,
    color: CHARTING_BAR_TRANSPARENT,
  }));
}

function chartingHistogramBarWidthPx(chart: IChartApi, denseQuarterly = false): number {
  const barSpacing = chart.timeScale().options().barSpacing;
  if (denseQuarterly) {
    return Math.max(5, Math.floor(barSpacing * 0.84));
  }
  return Math.max(1, Math.round(barSpacing) - (barSpacing > 4 ? 1 : 0));
}

const CHARTING_GROUPED_BAR_GAP_PX = 3;

/** Grouped bars: width from center spacing so a visible gutter remains between columns. */
function chartingGroupedHistogramBarWidthPx(
  chart: IChartApi,
  ordered: ChartingSeriesPoint[],
  seriesOrder: ChartingMetricId[],
  barBaseTimeByPeriodEnd: Map<string, number> | null,
  stockFullWidthFixedBars: boolean,
  denseQuarterly = false,
): number {
  const soloWidth = chartingHistogramBarWidthPx(chart, denseQuarterly);
  if (!barBaseTimeByPeriodEnd || seriesOrder.length <= 1) return soloWidth;

  const ts = chart.timeScale();
  let minNeighborDist = Infinity;

  for (const row of ordered) {
    const base = barBaseTimeByPeriodEnd.get(row.periodEnd);
    if (base == null) continue;
    const xs: number[] = [];
    for (const id of seriesOrder) {
      const v = rowValue(row, id);
      if (v == null || !Number.isFinite(v)) continue;
      const coord = ts.timeToCoordinate(
        (base + groupedBarShiftSeconds(id, seriesOrder, stockFullWidthFixedBars)) as UTCTimestamp,
      );
      if (coord != null && Number.isFinite(coord)) xs.push(coord);
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const d = xs[i]! - xs[i - 1]!;
      if (d > 0) minNeighborDist = Math.min(minNeighborDist, d);
    }
  }

  if (!Number.isFinite(minNeighborDist)) return soloWidth;
  return Math.max(4, Math.floor(minNeighborDist - CHARTING_GROUPED_BAR_GAP_PX));
}

function computeRoundedBarDrawLayout(
  chart: IChartApi,
  seriesByMetric: Map<ChartingMetricId, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>,
  displayedByMetric: Map<ChartingMetricId, ChartingBarSeriesPoint[]>,
  colorIdxByMetric: Map<ChartingMetricId, number>,
  hoveredPeriodIndex: number | null,
): FundamentalsRoundedBarItem[] {
  const ts = chart.timeScale();
  const items: FundamentalsRoundedBarItem[] = [];

  for (const [metricId, points] of displayedByMetric) {
    const series = seriesByMetric.get(metricId);
    if (!series) continue;
    const colorIdx = colorIdxByMetric.get(metricId) ?? 0;

    for (const p of points) {
      if (isTransparentChartingBarPoint(p)) continue;
      const x = ts.timeToCoordinate(p.time);
      const yVal = series.priceToCoordinate(p.value);
      const yZero = series.priceToCoordinate(0);
      if (
        x == null ||
        yVal == null ||
        yZero == null ||
        !Number.isFinite(x) ||
        !Number.isFinite(yVal) ||
        !Number.isFinite(yZero)
      ) {
        continue;
      }

      const top = Math.min(yVal, yZero);
      const bottom = Math.max(yVal, yZero);
      if (bottom - top <= 0) continue;

      items.push({
        centerX: x,
        top,
        bottom,
        color: chartingBarPointFillColor(colorIdx, p.periodIndex, hoveredPeriodIndex),
      });
    }
  }

  return items;
}

function seriesData(
  points: ChartingSeriesPoint[],
  id: ChartingMetricId,
  shiftSeconds = 0,
): ChartingBarSeriesPoint[] {
  const out: ChartingBarSeriesPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const row = points[i]!;
    const v = rowValue(row, id);
    if (v == null || !Number.isFinite(v)) continue;
    const t = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
    if (!Number.isFinite(t)) continue;
    out.push({
      time: (Math.floor(t / 1000) + shiftSeconds) as UTCTimestamp,
      value: v,
      periodIndex: i,
    });
  }
  return out;
}

function seriesDataBarsWithGapSlots(
  points: ChartingSeriesPoint[],
  id: ChartingMetricId,
  baseTimeByPeriodEnd: Map<string, number>,
  shiftSeconds = 0,
): ChartingBarSeriesPoint[] {
  const out: ChartingBarSeriesPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const row = points[i]!;
    const v = rowValue(row, id);
    if (v == null || !Number.isFinite(v)) continue;
    const base = baseTimeByPeriodEnd.get(row.periodEnd);
    if (base == null) continue;
    const barTime = (base + shiftSeconds) as UTCTimestamp;
    out.push({
      time: barTime,
      value: v,
      periodIndex: i,
    });
    out.push({
      time: (barTime + BAR_GAP_SLOT_SEC) as UTCTimestamp,
      value: 0,
      color: CHARTING_BAR_TRANSPARENT,
      periodIndex: -1,
    });
  }
  return out;
}

const CHARTING_STOCK_INTER_GROUP_GAP_SLOTS = 3;

function chartingIsDenseQuarterlyStockBars(
  stockFullWidthFixedBars: boolean,
  periodMode: "annual" | "quarterly",
  timeRange: ChartTimeRange,
  periodCount: number,
): boolean {
  return (
    stockFullWidthFixedBars &&
    periodMode === "quarterly" &&
    (timeRange === "10Y" || periodCount >= 36)
  );
}

function chartingStockInterGroupGapSlots(
  stockFullWidthFixedBars: boolean,
  periodMode: "annual" | "quarterly",
  timeRange: ChartTimeRange,
  periodCount: number,
): number {
  if (!stockFullWidthFixedBars) return CHARTING_STOCK_INTER_GROUP_GAP_SLOTS;
  if (periodMode !== "quarterly") return CHARTING_STOCK_INTER_GROUP_GAP_SLOTS;
  if (timeRange === "10Y" || periodCount >= 36) return 1;
  if (timeRange === "5Y" || periodCount >= 18) return 2;
  return CHARTING_STOCK_INTER_GROUP_GAP_SLOTS;
}

function chartingPeriodBarTimesSec(
  base: number,
  row: ChartingSeriesPoint,
  ids: ChartingMetricId[],
  stockFullWidthFixedBars: boolean,
): number[] {
  const times: number[] = [];
  for (const metricId of ids) {
    const v = rowValue(row, metricId);
    if (v == null || !Number.isFinite(v)) continue;
    times.push(base + groupedBarShiftSeconds(metricId, ids, stockFullWidthFixedBars));
  }
  return times;
}

/** Stock tab: transparent gap slots between period groups only (side inset comes from layout). */
function seriesDataBarsStockFullWidth(
  points: ChartingSeriesPoint[],
  id: ChartingMetricId,
  baseTimeByPeriodEnd: Map<string, number>,
  shiftSeconds: number,
  seriesOrder: ChartingMetricId[],
  interGroupGapSlots = CHARTING_STOCK_INTER_GROUP_GAP_SLOTS,
): ChartingBarSeriesPoint[] {
  const out: ChartingBarSeriesPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const row = points[i]!;
    const v = rowValue(row, id);
    const base = baseTimeByPeriodEnd.get(row.periodEnd);
    if (base == null) continue;
    if (v != null && Number.isFinite(v)) {
      out.push({
        time: (base + shiftSeconds) as UTCTimestamp,
        value: v,
        periodIndex: i,
      });
    }
    if (i >= points.length - 1) continue;
    const next = points[i + 1]!;
    const baseNext = baseTimeByPeriodEnd.get(next.periodEnd);
    if (baseNext == null) continue;

    const curTimes = chartingPeriodBarTimesSec(base, row, seriesOrder, true);
    const nextTimes = chartingPeriodBarTimesSec(baseNext, next, seriesOrder, true);
    if (!curTimes.length || !nextTimes.length) continue;

    const groupEnd = Math.max(...curTimes);
    const nextGroupStart = Math.min(...nextTimes);
    if (!Number.isFinite(groupEnd) || !Number.isFinite(nextGroupStart) || nextGroupStart <= groupEnd) {
      continue;
    }
    const span = nextGroupStart - groupEnd;
    for (let g = 0; g < interGroupGapSlots; g++) {
      out.push({
        time: (groupEnd + ((g + 1) / (interGroupGapSlots + 1)) * span) as UTCTimestamp,
        value: 0,
        color: CHARTING_BAR_TRANSPARENT,
        periodIndex: -1,
      });
    }
  }

  return out;
}

/** Period column anchor in time — grouped bar shifts are symmetric around `base`. */
function chartingPeriodCenterTimeSec(
  periodIndex: number,
  ordered: ChartingSeriesPoint[],
  seriesOrder: ChartingMetricId[],
  baseTimeByPeriodEnd: Map<string, number>,
): number | null {
  const row = ordered[periodIndex];
  if (!row) return null;
  const base = baseTimeByPeriodEnd.get(row.periodEnd);
  if (base == null) return null;
  return base;
}

/** Pixel center of a period column — average of visible grouped bar x coords. */
function chartingPeriodCenterXPx(
  chart: IChartApi,
  periodIndex: number,
  ordered: ChartingSeriesPoint[],
  seriesOrder: ChartingMetricId[],
  baseTimeByPeriodEnd: Map<string, number>,
  stockFullWidthFixedBars: boolean,
): number | null {
  const row = ordered[periodIndex];
  if (!row) return null;
  const base = baseTimeByPeriodEnd.get(row.periodEnd);
  if (base == null) return null;
  const ts = chart.timeScale();
  const xs: number[] = [];
  for (const id of seriesOrder) {
    const v = rowValue(row, id);
    if (v == null || !Number.isFinite(v)) continue;
    const coord = ts.timeToCoordinate(
      (base + groupedBarShiftSeconds(id, seriesOrder, stockFullWidthFixedBars)) as UTCTimestamp,
    );
    if (coord != null && Number.isFinite(coord)) xs.push(coord);
  }
  if (xs.length === 0) {
    const centerTime = chartingPeriodCenterTimeSec(periodIndex, ordered, seriesOrder, baseTimeByPeriodEnd);
    if (centerTime == null) return null;
    const fallback = ts.timeToCoordinate(centerTime as UTCTimestamp);
    return fallback != null && Number.isFinite(fallback) ? fallback : null;
  }
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

/** Extra px beyond bar half-width on non–full-width bar layouts. */
const CHARTING_HOVER_BAND_EXTRA_PX = 10;

/** Equal-width period columns that tile between adjacent year centers (Multicharts parity). */
function chartingPeriodColumnBoundsPx(
  chart: IChartApi,
  periodIndex: number,
  ordered: ChartingSeriesPoint[],
  seriesOrder: ChartingMetricId[],
  baseTimeByPeriodEnd: Map<string, number>,
  stockFullWidthFixedBars: boolean,
): { x0: number; x1: number } | null {
  const ts = chart.timeScale();
  const centerXs: number[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const centerX = chartingPeriodCenterXPx(
      chart,
      i,
      ordered,
      seriesOrder,
      baseTimeByPeriodEnd,
      stockFullWidthFixedBars,
    );
    if (centerX == null) continue;
    centerXs.push(centerX);
  }

  if (centerXs.length === 0 || periodIndex < 0 || periodIndex >= centerXs.length) return null;

  const n = centerXs.length;
  const centerX = centerXs[periodIndex]!;
  const plotW = ts.width();
  const spacing =
    n > 1
      ? (centerXs[n - 1]! - centerXs[0]!) / (n - 1)
      : chartingEqualPeriodColumnHalfPx(plotW > 0 ? plotW : 1, 1) * 2;

  if (periodIndex === 0) {
    return {
      x0: centerX - spacing / 2,
      x1: n > 1 ? (centerX + centerXs[1]!) / 2 : centerX + spacing / 2,
    };
  }
  if (periodIndex === n - 1) {
    return {
      x0: (centerXs[periodIndex - 1]! + centerX) / 2,
      x1: centerX + spacing / 2,
    };
  }
  return {
    x0: (centerXs[periodIndex - 1]! + centerX) / 2,
    x1: (centerX + centerXs[periodIndex + 1]!) / 2,
  };
}

/** Hover band: bar span, or full period column (stock tab — matches year label width). */
function chartingPeriodBarHighlightRange(
  chart: IChartApi,
  periodIndex: number,
  ordered: ChartingSeriesPoint[],
  seriesOrder: ChartingMetricId[],
  baseTimeByPeriodEnd: Map<string, number>,
  stockFullWidthFixedBars: boolean,
  spanMode: "bars" | "periodColumn" = "bars",
): { x0: number; x1: number } | null {
  const ts = chart.timeScale();
  const half = ts.options().barSpacing / 2;
  const row = ordered[periodIndex];
  if (!row) return null;
  const base = baseTimeByPeriodEnd.get(row.periodEnd);
  if (base == null) return null;

  const xs: number[] = [];
  for (const id of seriesOrder) {
    const v = rowValue(row, id);
    if (v == null || !Number.isFinite(v)) continue;
    const coord = ts.timeToCoordinate(
      (base + groupedBarShiftSeconds(id, seriesOrder, stockFullWidthFixedBars)) as UTCTimestamp,
    );
    if (coord != null && Number.isFinite(coord)) xs.push(coord);
  }

  let x0: number;
  let x1: number;
  if (xs.length === 0) {
    const centerTime = chartingPeriodCenterTimeSec(periodIndex, ordered, seriesOrder, baseTimeByPeriodEnd);
    if (centerTime == null) return null;
    const center = ts.timeToCoordinate(centerTime as UTCTimestamp);
    if (center == null || !Number.isFinite(center)) return null;
    x0 = center - half;
    x1 = center + half;
  } else {
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    x0 = min - half;
    x1 = max + half;
  }

  if (spanMode === "periodColumn") {
    return (
      chartingPeriodColumnBoundsPx(
        chart,
        periodIndex,
        ordered,
        seriesOrder,
        baseTimeByPeriodEnd,
        stockFullWidthFixedBars,
      ) ?? { x0, x1 }
    );
  }

  return { x0: x0 - CHARTING_HOVER_BAND_EXTRA_PX, x1: x1 + CHARTING_HOVER_BAND_EXTRA_PX };
}

function pickChartingPeriodAtX(
  chart: IChartApi,
  cx: number,
  ordered: ChartingSeriesPoint[],
  seriesOrder: ChartingMetricId[],
  baseTimeByPeriodEnd: Map<string, number>,
  stockFullWidthFixedBars: boolean,
): { row: ChartingSeriesPoint; index: number } | null {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < ordered.length; i++) {
    const coord = chartingPeriodCenterXPx(
      chart,
      i,
      ordered,
      seriesOrder,
      baseTimeByPeriodEnd,
      stockFullWidthFixedBars,
    );
    if (coord == null) continue;
    const d = Math.abs(coord - cx);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return null;
  const band = chartingPeriodBarHighlightRange(
    chart,
    bestIdx,
    ordered,
    seriesOrder,
    baseTimeByPeriodEnd,
    stockFullWidthFixedBars,
    "periodColumn",
  );
  const threshold = band ? Math.max(20, (band.x1 - band.x0) / 2) : 120;
  if (bestDist > threshold) return null;
  return { row: ordered[bestIdx]!, index: bestIdx };
}

function chartingLinePeriodTimeSec(row: ChartingSeriesPoint): number | null {
  const ms = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function chartingLinePeriodXCoords(
  chart: IChartApi,
  ordered: ChartingSeriesPoint[],
): Array<{ index: number; x: number }> {
  const ts = chart.timeScale();
  const coords: Array<{ index: number; x: number }> = [];
  for (let i = 0; i < ordered.length; i++) {
    const timeSec = chartingLinePeriodTimeSec(ordered[i]!);
    if (timeSec == null) continue;
    const x = ts.timeToCoordinate(timeSec as UTCTimestamp);
    if (x == null || !Number.isFinite(x)) continue;
    coords.push({ index: i, x });
  }
  return coords;
}

/** Snap line hover to the nearest period dot (x), not free movement along segments. */
function pickChartingLinePeriodAtX(
  chart: IChartApi,
  cx: number,
  ordered: ChartingSeriesPoint[],
): { row: ChartingSeriesPoint; index: number; snapX: number } | null {
  const coords = chartingLinePeriodXCoords(chart, ordered);
  if (!coords.length) return null;

  let best = coords[0]!;
  let bestDist = Math.abs(best.x - cx);
  for (let k = 1; k < coords.length; k++) {
    const c = coords[k]!;
    const d = Math.abs(c.x - cx);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }

  const idxInCoords = coords.findIndex((c) => c.index === best.index);
  let halfSpan = 48;
  if (idxInCoords > 0) {
    const prevX = coords[idxInCoords - 1]!.x;
    halfSpan = Math.min(halfSpan, Math.abs(best.x - prevX) / 2);
  }
  if (idxInCoords < coords.length - 1) {
    const nextX = coords[idxInCoords + 1]!.x;
    halfSpan = Math.min(halfSpan, Math.abs(nextX - best.x) / 2);
  }
  const threshold = Math.max(12, halfSpan * 0.55);
  if (bestDist > threshold) return null;

  return { row: ordered[best.index]!, index: best.index, snapX: best.x };
}

function chartingLineHoverDotAtPeriod(
  row: ChartingSeriesPoint,
  seriesOrder: ChartingMetricId[],
  seriesByMetric: Map<ChartingMetricId, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>,
  snapX: number,
  pointerY: number,
): { leftPx: number; topPx: number } | null {
  let bestTop: number | null = null;
  let bestDist = Infinity;
  for (const id of seriesOrder) {
    const series = seriesByMetric.get(id);
    if (!series) continue;
    const v = rowValue(row, id);
    if (v == null || !Number.isFinite(v)) continue;
    const plotV = chartingPlotValueForKind(CHARTING_METRIC_KIND[id], v);
    const y = series.priceToCoordinate(plotV);
    if (y == null || !Number.isFinite(y)) continue;
    const d = Math.abs(y - pointerY);
    if (d < bestDist) {
      bestDist = d;
      bestTop = y;
    }
  }
  if (bestTop == null) return null;
  return { leftPx: snapX, topPx: bestTop };
}

type Props = {
  ticker: string;
  metricParam: string | null;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialQuarterlyPoints?: ChartingSeriesPoint[];
  /** Optional allowlist (e.g. derived from Key Stats availability). */
  allowedMetricIds?: readonly ChartingMetricId[];
  /** Figma 8479:70857 — unit dropdown, export/refresh; chart is always single `ticker`. */
  toolbarLayout?: "default" | "figma70857";
  /** Full-page Charting only: company chip row (after metric chips and + Add Metric). */
  fullPageCompanyChipSlot?: ReactNode;
  /** Full-page Charting only: + Add Company (shown when ≥1 metric selected). */
  fullPageCompanyAddSlot?: ReactNode;
  /** Asset-page tab: remove/add metrics in the chart legend instead of the toolbar. */
  metricControlsPlacement?: "toolbar" | "legend";
  pathRoute?: StandaloneChartRoute;
  workspaceTitle?: string;
  /** Defaults to {@link DEFAULT_CHART_TIME_RANGE_ORDER}; standalone `/charting` passes {@link STANDALONE_CHARTING_TIME_RANGE_ORDER}. */
  timeRangeOrder?: ChartTimeRange[];
  /**
   * Stock tab only: uniform period spacing + layout that stretches barSpacing to the plot width
   * (32px side gutters) on resize.
   */
  histogramLayout?: "default" | "stockFullWidthFixedBars";
  /** Grow histogram bars from $0 on appear (stock Charting tab / Key Stats metrics). */
  animateBarsOnAppear?: boolean;
};

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

function timeRangeTabOptionsFor(order: ChartTimeRange[]): TabSwitcherOption<ChartTimeRange>[] {
  return order.map((r) => ({ value: r, label: TIME_RANGE_LABELS[r] }));
}

export const CHARTING_HEIGHT_PX = 332;
/** Annual x-axis row — tight under the $0 baseline. */
export const CHARTING_AXIS_ROW_PX_ANNUAL = 34;
/** Quarterly slanted labels need more vertical room. */
export const CHARTING_AXIS_ROW_PX_QUARTERLY = 44;

export function chartingAxisRowPx(periodMode: "annual" | "quarterly"): number {
  return periodMode === "annual" ? CHARTING_AXIS_ROW_PX_ANNUAL : CHARTING_AXIS_ROW_PX_QUARTERLY;
}

export function chartingPlotHeightPx(periodMode: "annual" | "quarterly"): number {
  return CHARTING_HEIGHT_PX - chartingAxisRowPx(periodMode);
}

/** Largest plot band (annual axis row). */
export const CHARTING_PLOT_HEIGHT_PX = chartingPlotHeightPx("annual");

/** Dot-grid band — matches Key Stats / Multicharts (`MultichartFundamentalsBar`). */
export const CHARTING_PLOT_BACKDROP_INSET_CLASS = "top-[8%] bottom-[4%]";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function chartingPeriodBoundsSec(ordered: ChartingSeriesPoint[]): { lo: number; hi: number } | null {
  const secs: number[] = [];
  for (const row of ordered) {
    const ms = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
    if (Number.isFinite(ms)) secs.push(Math.floor(ms / 1000));
  }
  if (!secs.length) return null;
  return { lo: Math.min(...secs), hi: Math.max(...secs) };
}

/**
 * Fixed windows (1Y, 2Y, …) with few periods make `fitContent` stretch histogram bars across the full width.
 * Pad the visible time range so bars stay visually narrower and centered.
 */
export function applySparseHistogramVisiblePadding(
  chart: IChartApi,
  orderedForBounds: ChartingSeriesPoint[],
  chartType: ChartType,
  timeRange: ChartTimeRange,
  periodCount: number,
): void {
  if (chartType !== "bars" || timeRange === "all" || periodCount === 0 || periodCount > 10) return;
  const b = chartingPeriodBoundsSec(orderedForBounds);
  if (!b) return;
  const span = Math.max(b.hi - b.lo, 28 * 86400);
  const pad = Math.max(Math.floor(span * 0.52), 110 * 86400);
  chart.timeScale().applyOptions({ fixLeftEdge: false, fixRightEdge: false });
  chart.timeScale().setVisibleRange({
    from: (b.lo - pad) as UTCTimestamp,
    to: (b.hi + pad) as UTCTimestamp,
  });
}

/** Minimum horizontal inset before first / after last bar group (each side). */
const CHARTING_TIME_SCALE_SIDE_GUTTER_PX = 8;

/** Equal period-column half-width — same slot model as Multicharts (`plotW / (2n)`). */
function chartingEqualPeriodColumnHalfPx(plotW: number, periodCount: number): number {
  if (plotW <= 0 || periodCount <= 0) return CHARTING_TIME_SCALE_SIDE_GUTTER_PX;
  if (periodCount === 1) return plotW / 2;
  return plotW / (2 * periodCount);
}

function chartingTimeScaleSideGutterPx(plotW: number, periodCount?: number): number {
  if (periodCount != null && periodCount > 0) {
    return Math.max(CHARTING_TIME_SCALE_SIDE_GUTTER_PX, chartingEqualPeriodColumnHalfPx(plotW, periodCount));
  }
  return CHARTING_TIME_SCALE_SIDE_GUTTER_PX;
}

/**
 * Fit bar histogram to container width: stretch or shrink `barSpacing` so bars fill the plot
 * with only a minimal fixed side inset.
 */
type ChartingTimeScaleLayoutOptions = {
  /** Stock tab: stretch `barSpacing` so content fills plot width (minus side gutters). */
  fixedBarSpacingPx?: number;
  /** Stock tab: period count — reserves half-column inset so edge hover bands are not clipped. */
  periodCount?: number;
};

export function layoutChartingTimeScale(
  chart: IChartApi,
  containerWidthPx: number,
  layoutAttempt = 0,
  layoutOptions?: ChartingTimeScaleLayoutOptions,
): void {
  const fixedBarSpacingPx = layoutOptions?.fixedBarSpacingPx;
  const periodCount = layoutOptions?.periodCount;
  const ts = chart.timeScale();
  ts.applyOptions({ fixLeftEdge: false, fixRightEdge: false });

  /** Stock tab bars — fill plot width; side inset = half column width when `periodCount` is set. */
  if (fixedBarSpacingPx != null) {
    const plotFallback = Math.max(120, containerWidthPx);
    ts.fitContent();
    requestAnimationFrame(() => {
      const lr = ts.getVisibleLogicalRange();
      if (lr === null) {
        if (layoutAttempt < 4) {
          layoutChartingTimeScale(chart, containerWidthPx, layoutAttempt + 1, layoutOptions);
        }
        return;
      }
      const contentFrom = lr.from;
      const contentTo = lr.to;
      const contentSpan = Math.max(1, contentTo - contentFrom);
      const measuredPlot = ts.width();
      const plotW = measuredPlot > 8 ? measuredPlot : plotFallback;
      if (plotW < 16 && layoutAttempt < 4) {
        layoutChartingTimeScale(chart, containerWidthPx, layoutAttempt + 1, layoutOptions);
        return;
      }
      if (plotW < 16) return;

      const sideGutterPx = chartingTimeScaleSideGutterPx(plotW, periodCount);
      const plotInner = plotW - 2 * sideGutterPx;
      const spacing = Math.max(2, plotInner / contentSpan);
      ts.applyOptions({
        barSpacing: spacing,
        minBarSpacing: 2,
        maxBarSpacing: Math.max(spacing, fixedBarSpacingPx),
      });

      const sidePadLogical = sideGutterPx / spacing;
      ts.setVisibleLogicalRange({
        from: contentFrom - sidePadLogical,
        to: contentTo + sidePadLogical,
      });

      requestAnimationFrame(() => {
        const plotW2 = ts.width() > 8 ? ts.width() : plotW;
        const sideGutterPx2 = chartingTimeScaleSideGutterPx(plotW2, periodCount);
        const plotInner2 = plotW2 - 2 * sideGutterPx2;
        const refined = Math.max(2, plotInner2 / contentSpan);
        if (Math.abs(refined - spacing) > 0.5) {
          ts.applyOptions({
            barSpacing: refined,
            minBarSpacing: 2,
            maxBarSpacing: Math.max(refined, fixedBarSpacingPx),
          });
        }
        const sidePadLogical2 = sideGutterPx2 / refined;
        ts.setVisibleLogicalRange({
          from: contentFrom - sidePadLogical2,
          to: contentTo + sidePadLogical2,
        });
      });
    });
    return;
  }

  const plotFallback = Math.max(120, containerWidthPx);
  ts.fitContent();
  requestAnimationFrame(() => {
    const lr = ts.getVisibleLogicalRange();
    if (lr === null) {
      if (layoutAttempt < 4) {
        layoutChartingTimeScale(chart, containerWidthPx, layoutAttempt + 1, layoutOptions);
      }
      return;
    }
    const contentFrom = lr.from;
    const contentTo = lr.to;
    const contentSpan = Math.max(1, contentTo - contentFrom);
    const measuredPlot = ts.width();
    const plotW = measuredPlot > 8 ? measuredPlot : plotFallback;
    if (plotW < 16 && layoutAttempt < 4) {
      layoutChartingTimeScale(chart, containerWidthPx, layoutAttempt + 1, layoutOptions);
      return;
    }
    if (plotW < 16) return;

    const plotInner = plotW - 2 * CHARTING_TIME_SCALE_SIDE_GUTTER_PX;
    const spacing = Math.max(2, plotInner / contentSpan);
    ts.applyOptions({
      barSpacing: spacing,
      minBarSpacing: 2,
      maxBarSpacing: Math.max(spacing, fixedBarSpacingPx ?? HISTO_BAR_SPACING_MAX_PX),
    });

    const sidePadLogical = CHARTING_TIME_SCALE_SIDE_GUTTER_PX / spacing;
    ts.setVisibleLogicalRange({
      from: contentFrom - sidePadLogical,
      to: contentTo + sidePadLogical,
    });

    requestAnimationFrame(() => {
      const plotW2 = ts.width() > 8 ? ts.width() : plotW;
      const plotInner2 = plotW2 - 2 * CHARTING_TIME_SCALE_SIDE_GUTTER_PX;
      const refined = Math.max(2, plotInner2 / contentSpan);
      if (Math.abs(refined - spacing) > 0.5) {
        ts.applyOptions({
          barSpacing: refined,
          minBarSpacing: 2,
          maxBarSpacing: Math.max(refined, fixedBarSpacingPx ?? HISTO_BAR_SPACING_MAX_PX),
        });
      }
      const sidePadLogical2 = CHARTING_TIME_SCALE_SIDE_GUTTER_PX / refined;
      ts.setVisibleLogicalRange({
        from: contentFrom - sidePadLogical2,
        to: contentTo + sidePadLogical2,
      });
    });
  });
}

type HoverState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  rows: Array<{ id: ChartingMetricId; label: string; value: string; color: string }>;
  bandLeft: number;
  bandWidth: number;
  /** Line mode: soft halo at the crosshair point (Multichart-style). */
  lineHoverDot?: { leftPx: number; topPx: number } | null;
} | null;

const GROUPED_BAR_SHIFT_SEC = 24 * 60 * 60;
/** Calendar-timestamp grouped bars (standalone `/charting`). */
export const CHARTING_GROUPED_BAR_SHIFT_SEC = 36 * 60 * 60;
/** Stock tab: spread grouped bars as a fraction of the uniform period step. */
export const CHARTING_STOCK_GROUPED_BAR_SHIFT_FRAC = 0.18;
/** Gap “slot” after each bar (transparent histogram point) — one day, still well inside the next quarter. */
const BAR_GAP_SLOT_SEC = GROUPED_BAR_SHIFT_SEC;
const HISTO_BAR_SPACING_MAX_PX = 28;
/** Stock full-width bars: uniform period index (not calendar span) so barSpacing can fill the plot on wide screens. */
const CHARTING_STOCK_BAR_INDEX_EPOCH_SEC = Math.floor(Date.parse("2016-01-01T12:00:00.000Z") / 1000);
const CHARTING_STOCK_BAR_PERIOD_STEP_SEC = GROUPED_BAR_SHIFT_SEC * 4;

function chartingStockBarBaseTimeSec(periodIndex: number): number {
  return CHARTING_STOCK_BAR_INDEX_EPOCH_SEC + periodIndex * CHARTING_STOCK_BAR_PERIOD_STEP_SEC;
}

/** Column hover band behind bars — same treatment as Multicharts / Earnings estimates. */
export class ChartingHoverBandPrimitive implements IPanePrimitive {
  private _requestUpdate: (() => void) | null = null;
  private _x0: number | null = null;
  private _x1: number | null = null;
  private _y0: number | null = null;
  private _y1: number | null = null;

  setBand(
    x0: number | null,
    x1: number | null,
    y0: number | null = null,
    y1: number | null = null,
  ): void {
    if (this._x0 === x0 && this._x1 === x1 && this._y0 === y0 && this._y1 === y1) return;
    this._x0 = x0;
    this._x1 = x1;
    this._y0 = y0;
    this._y1 = y1;
    this._requestUpdate?.();
  }

  attached(param: PaneAttachedParameter): void {
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._requestUpdate = null;
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return [this._paneView];
  }

  private readonly _paneView: IPanePrimitivePaneView = {
    zOrder: () => "bottom",
    renderer: () => this._renderer,
  };

  private readonly _renderer: IPrimitivePaneRenderer = {
    draw: () => {},
    drawBackground: (target: CanvasRenderingTarget2D) => {
      if (this._x0 == null || this._x1 == null) return;
      const left = Math.min(this._x0, this._x1);
      const right = Math.max(this._x0, this._x1);
      const w = right - left;
      if (!Number.isFinite(w) || w <= 0) return;
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const top = this._y0 != null && Number.isFinite(this._y0) ? Math.max(0, this._y0) : 0;
        const bottom =
          this._y1 != null && Number.isFinite(this._y1) ? Math.min(mediaSize.height, this._y1) : mediaSize.height;
        const height = Math.max(0, bottom - top);
        if (height <= 0) return;
        context.fillStyle = FUNDAMENTALS_CHART_HOVER_BAND_BG;
        context.fillRect(left, top, w, height);
      });
    },
  };
}

function groupedBarShiftUnitSec(stockFullWidthFixedBars: boolean): number {
  return stockFullWidthFixedBars
    ? CHARTING_STOCK_BAR_PERIOD_STEP_SEC * CHARTING_STOCK_GROUPED_BAR_SHIFT_FRAC
    : CHARTING_GROUPED_BAR_SHIFT_SEC;
}

function groupedBarShiftSeconds(
  id: ChartingMetricId,
  ids: ChartingMetricId[],
  stockFullWidthFixedBars = false,
): number {
  if (ids.length <= 1) return 0;
  const idx = ids.indexOf(id);
  if (idx < 0) return 0;
  const center = (ids.length - 1) / 2;
  return Math.round((idx - center) * groupedBarShiftUnitSec(stockFullWidthFixedBars));
}

export function ChartingWorkspace({
  ticker,
  metricParam,
  initialAnnualPoints,
  initialQuarterlyPoints,
  allowedMetricIds,
  toolbarLayout = "default",
  fullPageCompanyChipSlot,
  fullPageCompanyAddSlot,
  metricControlsPlacement = "toolbar",
  pathRoute = "/charting",
  workspaceTitle = "Charting",
  timeRangeOrder = DEFAULT_CHART_TIME_RANGE_ORDER,
  histogramLayout = "default",
  animateBarsOnAppear = false,
}: Props) {
  const router = useRouter();
  const chartPlotCleanupRef = useRef<(() => void) | null>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerMenuPortalRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const isFigmaToolbar = toolbarLayout === "figma70857";
  const metricControlsInLegend = metricControlsPlacement === "legend";
  const stockFullWidthFixedBars = histogramLayout === "stockFullWidthFixedBars";
  const isFullPageCharting = fullPageCompanyChipSlot != null;
  const timeRangeTabOptions = useMemo(
    () => timeRangeTabOptionsFor(timeRangeOrder),
    [timeRangeOrder],
  );

  const [periodMode, setPeriodMode] = useState<"annual" | "quarterly">("annual");
  const [timeRange, setTimeRange] = useState<ChartTimeRange>(DEFAULT_CHART_TIME_RANGE);
  const [chartType, setChartType] = useState<ChartType>("bars");
  const unitScale: ChartingUnitScale = isFigmaToolbar ? "billions" : "auto";
  const chartHeight = CHARTING_HEIGHT_PX;
  const axisRowPx = chartingAxisRowPx(periodMode);
  const chartPlotHeight = chartingPlotHeightPx(periodMode);
  const seedPoints = useMemo(() => {
    const src = periodMode === "quarterly" ? initialQuarterlyPoints : initialAnnualPoints;
    return Array.isArray(src) && src.length > 0 ? src : null;
  }, [periodMode, initialAnnualPoints, initialQuarterlyPoints]);

  const [points, setPoints] = useState<ChartingSeriesPoint[] | null>(seedPoints);
  const [loading, setLoading] = useState(seedPoints == null);
  const [selected, setSelected] = useState<ChartingMetricId[]>(CHARTING_DEFAULT_METRICS);
  const [hover, setHover] = useState<HoverState>(null);
  const [lineEndBadges, setLineEndBadges] = useState<LineEndBadge[]>([]);
  const [barValueLabels, setBarValueLabels] = useState<BarValueLabel[]>([]);
  const [linePointMarkers, setLinePointMarkers] = useState<LinePointMarker[]>([]);
  const [periodAxisLabels, setPeriodAxisLabels] = useState<PeriodAxisLabel[]>([]);
  const [yGridTickTopsPx, setYGridTickTopsPx] = useState<number[] | null>(null);
  const [yPercentGridTickTopsPx, setYPercentGridTickTopsPx] = useState<number[] | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [showBarValuesByMetric, setShowBarValuesByMetric] = useState<
    Partial<Record<ChartingMetricId, boolean>>
  >({});

  const isBarValuesVisible = useCallback(
    (id: ChartingMetricId) => showBarValuesByMetric[id] !== false,
    [showBarValuesByMetric],
  );

  const setBarValuesVisibleForMetric = useCallback((id: ChartingMetricId, next: boolean) => {
    setShowBarValuesByMetric((prev) => ({ ...prev, [id]: next }));
  }, []);

  const visibleBarValueLabels = useMemo(
    () => barValueLabels.filter((b) => isBarValuesVisible(b.metricId)),
    [barValueLabels, isBarValuesVisible],
  );

  const chartRef = useRef<IChartApi | null>(null);
  const seriesByMetricRef = useRef<Map<ChartingMetricId, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(new Map());
  const hoverBandPrimitiveRef = useRef<ChartingHoverBandPrimitive | null>(null);
  const roundedBarsPrimitiveRef = useRef<FundamentalsRoundedBarsPrimitive | null>(null);
  const hoverRafRef = useRef<number>(0);
  const barSeriesPointsRef = useRef<Map<ChartingMetricId, ChartingBarSeriesPoint[]>>(new Map());
  const barSeriesColorIdxRef = useRef<Map<ChartingMetricId, number>>(new Map());
  const hoveredBarPeriodRef = useRef<number | null>(null);

  // Chart height is fixed (no resize handle).

  useEffect(() => {
    if (timeRangeOrder.includes(timeRange)) return;
    setTimeRange("all");
  }, [timeRange, timeRangeOrder]);

  useEffect(() => {
    const parsed = parseChartingMetricsParam(metricParam);
    if (fullPageCompanyChipSlot) {
      if (parsed.length) setSelected(parsed);
      else setSelected([...CHARTING_DEFAULT_METRICS]);
      return;
    }
    if (parsed.length) setSelected(parsed);
    else setSelected([...CHARTING_DEFAULT_METRICS]);
  }, [metricParam, fullPageCompanyChipSlot]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // SSR preloaded fundamentals series: render instantly, no client fetch / skeleton flash.
      if (seedPoints) {
        setPoints(seedPoints);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const period = periodMode === "quarterly" ? "quarterly" : "annual";
        const loaded = await fetchChartingFundamentalsSeriesCached(ticker, period);
        if (!cancelled) setPoints(loaded ?? null);
      } catch {
        if (!cancelled) setPoints(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, periodMode, seedPoints]);

  useEffect(() => {
    if (!pickerOpen) return;
    pickerInputRef.current?.focus({ preventScroll: true });
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (pickerWrapRef.current?.contains(t) || pickerMenuPortalRef.current?.contains(t)) return;
      setPickerOpen(false);
      setPickerQuery("");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPickerOpen(false);
        setPickerQuery("");
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const fullSeries = useMemo(() => points ?? [], [points]);
  const ordered = useMemo(
    () => applyTimeRange(fullSeries, periodMode, timeRange),
    [fullSeries, periodMode, timeRange],
  );

  const barTimeScaleLayoutOptions = useMemo(
    (): ChartingTimeScaleLayoutOptions | undefined =>
      stockFullWidthFixedBars && ordered.length > 0
        ? { fixedBarSpacingPx: HISTO_BAR_SPACING_MAX_PX, periodCount: ordered.length }
        : stockFullWidthFixedBars
          ? { fixedBarSpacingPx: HISTO_BAR_SPACING_MAX_PX }
          : undefined,
    [stockFullWidthFixedBars, ordered.length],
  );

  const barBaseTimeByPeriodEnd = useMemo(() => {
    if (chartType !== "bars") return null;
    const m = new Map<string, number>();
    for (let i = 0; i < ordered.length; i++) {
      const row = ordered[i]!;
      if (stockFullWidthFixedBars) {
        m.set(row.periodEnd, chartingStockBarBaseTimeSec(i));
        continue;
      }
      const ms = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
      if (!Number.isFinite(ms)) continue;
      m.set(row.periodEnd, Math.floor(ms / 1000));
    }
    return m;
  }, [chartType, ordered, stockFullWidthFixedBars]);

  const timeToRow = useMemo(() => {
    const m = new Map<number, ChartingSeriesPoint>();
    for (const row of ordered) {
      if (chartType === "bars" && barBaseTimeByPeriodEnd) {
        const base = barBaseTimeByPeriodEnd.get(row.periodEnd);
        if (base == null) continue;
        m.set(base, row);
      } else {
        const t = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
        if (!Number.isFinite(t)) continue;
        m.set(Math.floor(t / 1000), row);
      }
    }
    return m;
  }, [ordered, chartType, barBaseTimeByPeriodEnd]);

  // Grouped-bar mode: map each shifted bar time back to its original period row so tooltips work.
  const groupedTimeToRow = useMemo(() => {
    if (chartType !== "bars" || selected.length <= 1) return timeToRow;
    const ids = barMetricOrder(selected);
    const m = new Map<number, ChartingSeriesPoint>();
    for (const row of ordered) {
      const base = barBaseTimeByPeriodEnd?.get(row.periodEnd);
      if (base == null) continue;
      for (const id of ids) {
        m.set(base + groupedBarShiftSeconds(id, ids, stockFullWidthFixedBars), row);
      }
    }
    return m;
  }, [chartType, selected, ordered, timeToRow, barBaseTimeByPeriodEnd, stockFullWidthFixedBars]);

  const groupedTickLabelByTime = useMemo(() => {
    if (chartType !== "bars" || selected.length <= 1) return null;
    const ids = barMetricOrder(selected);
    const m = new Map<number, string>();
    for (const row of ordered) {
      const base = barBaseTimeByPeriodEnd?.get(row.periodEnd);
      if (base == null) continue;
      m.set(base, formatChartingPeriodLabel(row.periodEnd, periodMode));
    }
    return m;
  }, [chartType, selected, ordered, periodMode, barBaseTimeByPeriodEnd]);

  const allowedMetricSet = useMemo(() => {
    if (!allowedMetricIds || allowedMetricIds.length === 0) return null;
    return new Set(allowedMetricIds);
  }, [allowedMetricIds]);

  /** Metrics that have ≥1 value in-range — single pass over rows (avoids O(metrics × points) seriesData calls). */
  const availableInRange = useMemo(() => {
    const seen = new Set<ChartingMetricId>();
    for (const row of ordered) {
      for (const id of CHARTING_METRIC_IDS) {
        if (allowedMetricSet && !allowedMetricSet.has(id)) continue;
        if (seen.has(id)) continue;
        const v = rowValue(row, id);
        if (v != null && Number.isFinite(v)) seen.add(id);
      }
    }
    return CHARTING_METRIC_IDS.filter((id) => seen.has(id));
  }, [ordered, allowedMetricSet]);

  useEffect(() => {
    if (fullPageCompanyChipSlot) return;
    if (loading || !ordered.length) return;
    setSelected((prev) => {
      const next = prev.filter((id) => (!allowedMetricSet || allowedMetricSet.has(id)) && seriesData(ordered, id).length > 0);
      if (next.length === prev.length && next.length > 0) return prev;
      if (next.length >= 1) return next;
      for (const m of parseChartingMetricsParam(metricParam)) {
        if (allowedMetricSet && !allowedMetricSet.has(m)) continue;
        if (seriesData(ordered, m).length > 0) return [m];
      }
      for (const id of CHARTING_DEFAULT_METRICS) {
        if (allowedMetricSet && !allowedMetricSet.has(id)) continue;
        if (seriesData(ordered, id).length > 0) return [id];
      }
      const first = CHARTING_METRIC_IDS.find((id) => seriesData(ordered, id).length > 0);
      return first ? [first] : [];
    });
  }, [loading, ordered, metricParam, fullPageCompanyChipSlot, allowedMetricSet]);

  const removeMetric = useCallback(
    (id: ChartingMetricId) => {
      type Deferred = { kind: "tickerOnly" } | { kind: "metrics"; metrics: ChartingMetricId[] };
      let deferred: Deferred | null = null;
      setSelected((prev) => {
        const next = prev.filter((x) => x !== id);
        if (!fullPageCompanyChipSlot) {
          if (next.length === 0) return prev;
          return next;
        }
        if (next.length === 0) {
          deferred = { kind: "tickerOnly" };
          return prev;
        }
        deferred = { kind: "metrics", metrics: next };
        return next;
      });
      if (fullPageCompanyChipSlot && deferred) {
        queueMicrotask(() => {
          if (deferred!.kind === "tickerOnly") {
            router.replace(buildStandaloneChartPath(pathRoute, [ticker], []));
          } else {
            router.replace(buildStandaloneChartPath(pathRoute, [ticker], deferred!.metrics));
          }
        });
      }
    },
    [fullPageCompanyChipSlot, pathRoute, router, ticker],
  );

  const addMetric = useCallback(
    (id: ChartingMetricId) => {
      let nextMetrics: ChartingMetricId[] | null = null;
      setSelected((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        if (fullPageCompanyChipSlot) nextMetrics = next;
        return next;
      });
      if (fullPageCompanyChipSlot && nextMetrics) {
        queueMicrotask(() => router.replace(buildStandaloneChartPath(pathRoute, [ticker], nextMetrics!)));
      }
      setPickerOpen(false);
      setPickerQuery("");
    },
    [fullPageCompanyChipSlot, pathRoute, router, ticker],
  );

  const qLower = pickerQuery.trim().toLowerCase();

  const groupedAddable = useMemo(() => {
    return CHARTING_DROPDOWN_GROUPS.map((g) => {
      const ids = g.metricIds.filter(
        (id) =>
          !selected.includes(id) &&
          availableInRange.includes(id) &&
          (!qLower || CHARTING_METRIC_LABEL[id].toLowerCase().includes(qLower)),
      );
      return { ...g, ids };
    }).filter((g) => g.ids.length > 0);
  }, [selected, availableInRange, qLower]);

  const totalAddable = useMemo(() => groupedAddable.reduce((n, g) => n + g.ids.length, 0), [groupedAddable]);

  const canPlot = useMemo(
    () => selected.some((id) => seriesData(ordered, id).length > 0),
    [ordered, selected],
  );

  const chartAxes = useMemo(() => {
    if (!ordered.length || !selected.length) return { primary: null as ChartingYAxisConfig | null, percent: null as ChartingYAxisConfig | null };
    const seriesOrder = chartType === "bars" ? barMetricOrder(selected) : selected;
    const selectedSet = new Set(selected);

    const nonPercentIds = seriesOrder.filter((id) => selectedSet.has(id) && CHARTING_METRIC_KIND[id] !== "percent");
    const percentIds = seriesOrder.filter((id) => selectedSet.has(id) && CHARTING_METRIC_KIND[id] === "percent");

    let primary: ChartingYAxisConfig | null = null;
    if (nonPercentIds.length > 0) {
      const primaryId =
        nonPercentIds.find((id) => CHARTING_METRIC_KIND[id] === "usd") ?? nonPercentIds[0]!;
      const kind = CHARTING_METRIC_KIND[primaryId];
      const metricsOnAxis = nonPercentIds.filter((id) => CHARTING_METRIC_KIND[id] === kind);
      let rawMax = 0;
      for (const id of metricsOnAxis) {
        for (const row of ordered) {
          const v = rowValue(row, id);
          if (v != null && Number.isFinite(v)) rawMax = Math.max(rawMax, Math.abs(v));
        }
      }
      primary = {
        kind,
        ticks: buildFundamentalsYAxisTicks(rawMax || 1, kind),
      };
    }

    const percent: ChartingYAxisConfig | null =
      percentIds.length > 0
        ? {
            kind: "percent",
            ticks: buildFixedFundamentalsYAxisTicks(CHARTING_PERCENT_Y_AXIS_MAX),
          }
        : null;

    return { primary, percent };
  }, [chartType, ordered, selected]);

  const primaryYAxis = chartAxes.primary;
  const percentYAxis = chartAxes.percent;
  const yAxisColumnCount = (primaryYAxis ? 1 : 0) + (percentYAxis ? 1 : 0);
  const yAxisColumnsWidthPx = yAxisColumnCount * FUNDAMENTALS_CHART_Y_AXIS_W_PX;

  /** Single primitive dep — avoids React "dependency array changed size" when lists/maps are in deps. */
  const chartMountDepsKey = useMemo(() => {
    const valueSig = ordered
      .map((row) => selected.map((id) => rowValue(row, id) ?? "").join(","))
      .join("|");
    return [
      ordered.map((r) => r.periodEnd).join("|"),
      valueSig,
      selected.join(","),
      canPlot,
      chartType,
      chartPlotHeight,
      periodMode,
      timeRange,
      unitScale,
      stockFullWidthFixedBars,
      isFullPageCharting,
      animateBarsOnAppear,
      chartAxes.primary?.ticks.join(",") ?? "",
      chartAxes.percent?.ticks.join(",") ?? "",
    ].join("::");
  }, [
    ordered,
    selected,
    canPlot,
    chartType,
    chartPlotHeight,
    periodMode,
    timeRange,
    unitScale,
    stockFullWidthFixedBars,
    isFullPageCharting,
    animateBarsOnAppear,
    chartAxes,
  ]);

  const chartPlotRef = useCallback(
    (el: HTMLDivElement | null) => {
      chartPlotCleanupRef.current?.();
      chartPlotCleanupRef.current = null;
      if (!el) return;

      if (!ordered.length || !selected.length || !canPlot) {
      setLineEndBadges([]);
      setBarValueLabels([]);
      setLinePointMarkers([]);
      setPeriodAxisLabels([]);
      return;
    }

    let cancelled = false;
    let lastPlotWidthPx = el.clientWidth;
    let resizeObserver: ResizeObserver | null = null;
    let onVisibleRangeChange: (() => void) | null = null;
    let cancelBarEnterAnim: (() => void) | null = null;
    let barEnterElapsedMs = Number.POSITIVE_INFINITY;

    const mountChart = () => {
      if (cancelled) return;
      if (el.clientWidth < 2) {
        requestAnimationFrame(mountChart);
        return;
      }
      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;

          const nPoints = ordered.length;
          const stockInterGroupGapSlots = chartingStockInterGroupGapSlots(
            stockFullWidthFixedBars,
            periodMode,
            timeRange,
            nPoints,
          );
          const denseQuarterlyBars = chartingIsDenseQuarterlyStockBars(
            stockFullWidthFixedBars,
            periodMode,
            timeRange,
            nPoints,
          );
          const barSpacingRaw =
            chartType === "bars"
              ? stockFullWidthFixedBars
                ? 6
                : timeRange !== "all"
                  ? HISTO_BAR_SPACING_MAX_PX
                  : Math.max(24, Math.min(44, Math.floor(1800 / Math.max(1, nPoints))))
              : 9;
          const barSpacing =
            chartType === "bars" && !stockFullWidthFixedBars
              ? Math.min(barSpacingRaw, HISTO_BAR_SPACING_MAX_PX)
              : barSpacingRaw;

          const chart = createChart(el, {
            width: el.clientWidth,
            height: chartPlotHeight,
            autoSize: false,
            handleScroll: {
              mouseWheel: false,
              pressedMouseMove: false,
              horzTouchDrag: false,
              vertTouchDrag: false,
            },
            handleScale: {
              axisPressedMouseMove: false,
              mouseWheel: false,
              pinch: false,
            },
            layout: {
              background: { type: ColorType.Solid, color: "transparent" },
              textColor: "#71717A",
              fontSize: 12,
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              attributionLogo: false,
            },
            localization: {
              locale: "en-US",
              priceFormatter: (p: number) => formatAxisForUnit(p, unitScale),
              tickmarksPriceFormatter: HIDE_NATIVE_Y_AXIS_TICK_LABELS,
            },
            grid: {
              vertLines: { visible: false },
              horzLines: { visible: false },
            },
            rightPriceScale: {
              visible: false,
              borderVisible: false,
            },
            leftPriceScale: {
              visible: false,
              borderVisible: false,
            },
            timeScale: {
              /** Custom period row below — hide native scale so the plot uses full height ($0 on pane bottom). */
              visible: false,
              borderVisible: false,
              ticksVisible: false,
              fixLeftEdge: false,
              fixRightEdge: false,
              lockVisibleTimeRangeOnResize: !stockFullWidthFixedBars,
              rightOffset: 0,
              barSpacing,
              tickMarkFormatter: () => "",
              minimumHeight: 0,
            },
            crosshair: {
              mode: chartType === "line" ? CrosshairMode.Magnet : CrosshairMode.Normal,
              vertLine: { visible: false, labelVisible: false },
              horzLine: { visible: false, labelVisible: false },
            },
          });

          chartRef.current = chart;
          seriesByMetricRef.current = new Map();

          const hoverBandPrimitive = new ChartingHoverBandPrimitive();
          hoverBandPrimitiveRef.current = hoverBandPrimitive;
          chart.panes()[0]?.attachPrimitive(hoverBandPrimitive);

          const roundedBarsPrimitive = new FundamentalsRoundedBarsPrimitive();
          roundedBarsPrimitiveRef.current = roundedBarsPrimitive;
          chart.panes()[0]?.attachPrimitive(roundedBarsPrimitive);

          const usedScales = new Set<string>();

          const seriesOrder = chartType === "bars" ? barMetricOrder(selected) : selected;
          const fixedYAutoscaleForKind = (kind: ChartingMetricKind) => {
            if (kind === "percent" && chartAxes.percent) {
              return {
                autoscaleInfoProvider: () => ({
                  priceRange: { minValue: 0, maxValue: CHARTING_PERCENT_Y_AXIS_MAX },
                }),
              };
            }
            const top = chartAxes.primary?.ticks[0];
            if (kind !== "percent" && top != null && Number.isFinite(top) && top > 0) {
              return {
                autoscaleInfoProvider: () => ({
                  priceRange: { minValue: 0, maxValue: top },
                }),
              };
            }
            return {};
          };
          let seriesColorIdx = 0;
          for (const id of seriesOrder) {
            const shiftSec =
              chartType === "bars" && selected.length > 1
                ? groupedBarShiftSeconds(id, seriesOrder, stockFullWidthFixedBars)
                : 0;
            const data =
              chartType === "bars" && barBaseTimeByPeriodEnd
                ? stockFullWidthFixedBars
                  ? seriesDataBarsStockFullWidth(
                      ordered,
                      id,
                      barBaseTimeByPeriodEnd,
                      shiftSec,
                      seriesOrder,
                      stockInterGroupGapSlots,
                    )
                  : seriesDataBarsWithGapSlots(ordered, id, barBaseTimeByPeriodEnd, shiftSec)
                : seriesData(ordered, id, shiftSec);
            if (!data.length) continue;
            const kind = CHARTING_METRIC_KIND[id];
            const scaleId = scaleIdForKind(kind);
            usedScales.add(scaleId);
            if (chartType === "bars") {
              const barColor = fundamentalsBarSolidAtIndex(seriesColorIdx);
              const barPoints = chartingPlotBarPointsForKind(data as ChartingBarSeriesPoint[], kind);
              barSeriesPointsRef.current.set(id, barPoints);
              barSeriesColorIdxRef.current.set(id, seriesColorIdx);
              const s = chart.addSeries(HistogramSeries, {
                ...chartingFundamentalsSeriesNoReferenceLines,
                ...fixedYAutoscaleForKind(kind),
                color: barColor,
                priceScaleId: scaleId,
                priceFormat: priceFormatForKind(kind),
                title: CHARTING_METRIC_LABEL[id],
              });
              const shouldAnimateBars =
                animateBarsOnAppear &&
                !prefersReducedFundamentalsBarMotion() &&
                ordered.length > 0;
              const initialBarPoints = shouldAnimateBars
                ? scaleBarPointsForEnter(
                    barPoints,
                    ordered.length,
                    0,
                    isTransparentChartingBarPoint,
                  )
                : barPoints;
              s.setData(chartingBarPointsToHistogramData(initialBarPoints, seriesColorIdx, null));
              seriesByMetricRef.current.set(id, s);
            } else {
              const lineColor = fundamentalsBarSolidAtIndex(seriesColorIdx);
              const s = chart.addSeries(LineSeries, {
                ...chartingFundamentalsLineSeriesOptions(lineColor),
                ...fixedYAutoscaleForKind(kind),
                priceScaleId: scaleId,
                priceFormat: priceFormatForKind(kind),
                title: CHARTING_METRIC_LABEL[id],
              });
              s.setData(chartingPlotLinePointsForKind(data as ChartingBarSeriesPoint[], kind));
              seriesByMetricRef.current.set(id, s);
            }
            seriesColorIdx += 1;
          }

          const scaleOpts = {
            borderVisible: false,
            scaleMargins: {
              top: fundamentalsChartScaleMarginTop(chartType),
              bottom:
                chartType === "bars"
                  ? FUNDAMENTALS_CHART_SCALE_MARGIN_BOTTOM_BARS
                  : FUNDAMENTALS_CHART_SCALE_MARGIN_BOTTOM_LINE,
            },
          };
          for (const sid of ["usd", "shares", "eps", "pct", "mult"]) {
            if (usedScales.has(sid)) {
              chart.priceScale(sid).applyOptions({ visible: false, ...scaleOpts });
            }
          }

          if (chartType === "bars") {
            layoutChartingTimeScale(chart, el.clientWidth, 0, barTimeScaleLayoutOptions);
          } else {
            chart.timeScale().fitContent();
          }

          const willAnimateBars =
            chartType === "bars" &&
            animateBarsOnAppear &&
            !prefersReducedFundamentalsBarMotion() &&
            ordered.length > 0 &&
            barSeriesPointsRef.current.size > 0;
          if (willAnimateBars) {
            barEnterElapsedMs = 0;
          }

          const syncChartOverlays = () => {
            if (cancelled || !chartRef.current) return;
            const c = chartRef.current;
            setPeriodAxisLabels(
              computePeriodAxisLabelsLayout(
                c,
                ordered,
                periodMode,
                chartType,
                selected,
                barBaseTimeByPeriodEnd,
                stockFullWidthFixedBars,
              ),
            );
            const yRefSeries = (() => {
              for (const id of seriesOrder) {
                if (CHARTING_METRIC_KIND[id] !== "percent") {
                  return seriesByMetricRef.current.get(id);
                }
              }
              for (const id of seriesOrder) {
                if (CHARTING_METRIC_KIND[id] === "percent") {
                  return seriesByMetricRef.current.get(id);
                }
              }
              return seriesByMetricRef.current.values().next().value;
            })();
            const yPercentRefSeries = (() => {
              for (const id of seriesOrder) {
                if (CHARTING_METRIC_KIND[id] === "percent") {
                  return seriesByMetricRef.current.get(id);
                }
              }
              return undefined;
            })();
            setYGridTickTopsPx(
              chartAxes.primary
                ? computeYGridTickTopsPx(yRefSeries, chartAxes.primary.ticks)
                : chartAxes.percent
                  ? computeYGridTickTopsPx(yPercentRefSeries, chartAxes.percent.ticks)
                  : null,
            );
            setYPercentGridTickTopsPx(
              chartAxes.percent
                ? computeYGridTickTopsPx(yPercentRefSeries, chartAxes.percent.ticks)
                : null,
            );
            if (chartType === "line") {
              roundedBarsPrimitiveRef.current?.setBars([], 0);
              setBarValueLabels([]);
              setLinePointMarkers(
                computeLinePointMarkersLayout(c, seriesByMetricRef.current, ordered, selected),
              );
              setLineEndBadges(
                computeLineEndBadgeLayout(chartType, seriesByMetricRef.current, ordered, selected, chartPlotHeight),
              );
              return;
            }
            if (chartType === "bars") {
              setLineEndBadges([]);
              setLinePointMarkers([]);
              const displayedByMetric = new Map<ChartingMetricId, ChartingBarSeriesPoint[]>();
              for (const [metricId, barPoints] of barSeriesPointsRef.current) {
                const displayed =
                  Number.isFinite(barEnterElapsedMs) && barEnterElapsedMs < Number.POSITIVE_INFINITY
                    ? scaleBarPointsForEnter(
                        barPoints,
                        ordered.length,
                        barEnterElapsedMs,
                        isTransparentChartingBarPoint,
                      )
                    : barPoints;
                displayedByMetric.set(metricId, displayed);
              }
              const seriesOrderForBars = barMetricOrder(selected);
              roundedBarsPrimitiveRef.current?.setBars(
                computeRoundedBarDrawLayout(
                  c,
                  seriesByMetricRef.current,
                  displayedByMetric,
                  barSeriesColorIdxRef.current,
                  hoveredBarPeriodRef.current,
                ),
                chartingGroupedHistogramBarWidthPx(
                  c,
                  ordered,
                  seriesOrderForBars,
                  barBaseTimeByPeriodEnd,
                  stockFullWidthFixedBars,
                  denseQuarterlyBars,
                ),
              );
              const barValueLabelsReady =
                !animateBarsOnAppear ||
                prefersReducedFundamentalsBarMotion() ||
                barEnterElapsedMs >= Number.POSITIVE_INFINITY;
              setBarValueLabels(
                barValueLabelsReady
                  ? computeBarValueLabelsLayout(
                      c,
                      seriesByMetricRef.current,
                      ordered,
                      selected,
                      barBaseTimeByPeriodEnd,
                      stockFullWidthFixedBars,
                    )
                  : [],
              );
              return;
            }
            setLineEndBadges([]);
            setBarValueLabels([]);
            setLinePointMarkers([]);
          };
          if (willAnimateBars) {
            setBarValueLabels([]);
          }

          requestAnimationFrame(() => {
            if (cancelled) return;
            requestAnimationFrame(syncChartOverlays);
          });

          if (willAnimateBars) {
            cancelBarEnterAnim = runFundamentalsBarEnterAnimation({
              periodCount: ordered.length,
              onFrame: (elapsedMs) => {
                if (cancelled) return;
                syncAnimatedHistogramBars(elapsedMs);
              },
              onComplete: () => {
                if (cancelled) return;
                barEnterElapsedMs = Number.POSITIVE_INFINITY;
                applyBarHoverDimming(hoveredBarPeriodRef.current);
                syncChartOverlays();
              },
            });
          }

          onVisibleRangeChange = () => {
            requestAnimationFrame(syncChartOverlays);
          };
          chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

          const applyBarHoverDimming = (periodIndex: number | null) => {
            if (chartType !== "bars" || hoveredBarPeriodRef.current === periodIndex) return;
            hoveredBarPeriodRef.current = periodIndex;
            for (const [metricId, barPoints] of barSeriesPointsRef.current) {
              const s = seriesByMetricRef.current.get(metricId);
              if (!s) continue;
              const ci = barSeriesColorIdxRef.current.get(metricId) ?? 0;
              const displayed =
                Number.isFinite(barEnterElapsedMs) && barEnterElapsedMs < Number.POSITIVE_INFINITY
                  ? scaleBarPointsForEnter(
                      barPoints,
                      ordered.length,
                      barEnterElapsedMs,
                      isTransparentChartingBarPoint,
                    )
                  : barPoints;
              s.setData(chartingBarPointsToHistogramData(displayed, ci, periodIndex));
            }
          };

          const syncAnimatedHistogramBars = (elapsedMs: number) => {
            if (chartType !== "bars") return;
            barEnterElapsedMs = elapsedMs;
            const hovered = hoveredBarPeriodRef.current;
            for (const [metricId, barPoints] of barSeriesPointsRef.current) {
              const s = seriesByMetricRef.current.get(metricId);
              if (!s) continue;
              const ci = barSeriesColorIdxRef.current.get(metricId) ?? 0;
              const displayed = scaleBarPointsForEnter(
                barPoints,
                ordered.length,
                elapsedMs,
                isTransparentChartingBarPoint,
              );
              s.setData(chartingBarPointsToHistogramData(displayed, ci, hovered));
            }
            syncChartOverlays();
          };

          const onCrosshairMove = (param: MouseEventParams) => {
            if (!param.point || param.point.x < 0) {
              applyBarHoverDimming(null);
              hoverBandPrimitiveRef.current?.setBand(null, null);
              if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
              hoverRafRef.current = requestAnimationFrame(() => setHover(null));
              return;
            }

            const x = param.point.x;
            const pointerY = param.point.y ?? 0;

            const seriesOrder = chartType === "bars" ? barMetricOrder(selected) : selected;

            let row: ChartingSeriesPoint | null = null;
            let stockPeriodIndex = -1;
            let lineSnapX: number | null = null;

            if (chartType === "line") {
              const picked = pickChartingLinePeriodAtX(chart, x, ordered);
              if (!picked) {
                applyBarHoverDimming(null);
                hoverBandPrimitiveRef.current?.setBand(null, null);
                if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
                hoverRafRef.current = requestAnimationFrame(() => setHover(null));
                return;
              }
              row = picked.row;
              lineSnapX = picked.snapX;
            } else if (param.time === undefined) {
              applyBarHoverDimming(null);
              hoverBandPrimitiveRef.current?.setBand(null, null);
              if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
              hoverRafRef.current = requestAnimationFrame(() => setHover(null));
              return;
            } else {
              const rawTime = param.time as UTCTimestamp;
              const timeKey = typeof rawTime === "number" && Number.isFinite(rawTime) ? rawTime : null;
              if (timeKey == null) {
                applyBarHoverDimming(null);
                hoverBandPrimitiveRef.current?.setBand(null, null);
                if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
                hoverRafRef.current = requestAnimationFrame(() => setHover(null));
                return;
              }

            if (chartType === "bars" && stockFullWidthFixedBars && barBaseTimeByPeriodEnd) {
              const picked = pickChartingPeriodAtX(
                chart,
                x,
                ordered,
                seriesOrder,
                barBaseTimeByPeriodEnd,
                stockFullWidthFixedBars,
              );
              if (!picked) {
                applyBarHoverDimming(null);
                hoverBandPrimitiveRef.current?.setBand(null, null);
                if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
                hoverRafRef.current = requestAnimationFrame(() => setHover(null));
                return;
              }
              row = picked.row;
              stockPeriodIndex = picked.index;
            } else {
              row = groupedTimeToRow.get(timeKey) ?? null;
              if (!row) {
                applyBarHoverDimming(null);
                hoverBandPrimitiveRef.current?.setBand(null, null);
                if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
                hoverRafRef.current = requestAnimationFrame(() => setHover(null));
                return;
              }
            }
            }

            const timeKey =
              chartType === "line" && row
                ? chartingLinePeriodTimeSec(row)
                : typeof param.time === "number" && Number.isFinite(param.time)
                  ? (param.time as number)
                  : null;
            if (chartType === "bars") {
              let focusPeriodIndex = stockPeriodIndex;
              if (focusPeriodIndex < 0 && row) {
                focusPeriodIndex = ordered.findIndex((r) => r.periodEnd === row.periodEnd);
              }
              applyBarHoverDimming(focusPeriodIndex >= 0 ? focusPeriodIndex : null);
            }
            const periodLabel = row
              ? formatChartingPeriodLabel(row.periodEnd, periodMode)
              : timeKey != null
                ? String(timeKey)
                : "";
            const rows: Array<{ id: ChartingMetricId; label: string; value: string; color: string }> = [];
            for (const id of selected) {
              let v: number | null = null;
              if (row) {
                v = rowValue(row, id);
              } else {
                const series = seriesByMetricRef.current.get(id);
                if (series) {
                  const rawPoint = param.seriesData.get(series);
                  v =
                    rawPoint &&
                    typeof rawPoint === "object" &&
                    rawPoint !== null &&
                    "value" in rawPoint &&
                    typeof (rawPoint as { value: unknown }).value === "number"
                      ? (rawPoint as { value: number }).value
                      : null;
                }
              }
              const ci = seriesOrder.indexOf(id);
              rows.push({
                id,
                label: CHARTING_METRIC_LABEL[id],
                value: formatChartingTableCell(CHARTING_METRIC_KIND[id], v),
                color: fundamentalsBarSolidAtIndex(ci >= 0 ? ci : 0),
              });
            }

            let bandLeft = 0;
            let bandWidth = 0;
            const yRefSeries = seriesByMetricRef.current.values().next().value;
            const hoverVert = chartingHoverBandVerticalRangePx(
              yRefSeries,
              chartAxes.primary?.ticks ?? chartAxes.percent?.ticks,
            );
            const applyHoverBand = (x0: number, x1: number) => {
              hoverBandPrimitiveRef.current?.setBand(x0, x1, hoverVert?.y0 ?? null, hoverVert?.y1 ?? null);
            };
            if (chartType === "line") {
              hoverBandPrimitiveRef.current?.setBand(null, null);
            } else if (chartType === "bars" && stockFullWidthFixedBars && barBaseTimeByPeriodEnd && stockPeriodIndex >= 0) {
              const barBand = chartingPeriodBarHighlightRange(
                chart,
                stockPeriodIndex,
                ordered,
                seriesOrder,
                barBaseTimeByPeriodEnd,
                stockFullWidthFixedBars,
                "periodColumn",
              );
              if (barBand) {
                bandLeft = barBand.x0;
                bandWidth = barBand.x1 - barBand.x0;
                applyHoverBand(barBand.x0, barBand.x1);
              } else {
                hoverBandPrimitiveRef.current?.setBand(null, null);
              }
            } else if (chartType === "bars") {
              const ts = chart.timeScale();
              const barSpacing = ts.options().barSpacing;
              const idsForBars = seriesOrder;
              const baseMs =
                row?.periodEnd
                  ? Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`)
                  : NaN;
              const baseSec = Number.isFinite(baseMs) ? Math.floor(baseMs / 1000) : null;
              const centerTime =
                chartType === "bars" && selected.length > 1 && baseSec != null && row
                  ? (baseSec as UTCTimestamp)
                  : null;
              const centerX = centerTime != null ? ts.timeToCoordinate(centerTime) : null;
              const bandCenterX = Number.isFinite(centerX ?? NaN) ? (centerX as number) : x;
              bandWidth =
                chartType === "bars" && selected.length > 1
                  ? Math.max(36, barSpacing * Math.max(1, idsForBars.length))
                  : Math.max(24, barSpacing);
              bandLeft = Math.max(0, bandCenterX - bandWidth / 2);
              applyHoverBand(bandLeft, bandLeft + bandWidth);
            }

            const plotW = Math.max(1, el.clientWidth);
            const hoverAnchorX = lineSnapX ?? x;
            const { anchorX, side } = computeFundamentalsChartTooltipPlacement(hoverAnchorX, plotW);
            const lineHoverDot =
              chartType === "line" && row && lineSnapX != null
                ? chartingLineHoverDotAtPeriod(
                    row,
                    seriesOrder,
                    seriesByMetricRef.current,
                    lineSnapX,
                    pointerY,
                  )
                : null;
            const hoverY = lineHoverDot?.topPx ?? pointerY;

            if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
            hoverRafRef.current = requestAnimationFrame(() => {
              setHover({
                anchorX,
                y: hoverY,
                side,
                periodLabel,
                rows,
                bandLeft,
                bandWidth,
                lineHoverDot,
              });
            });
          };

          chart.subscribeCrosshairMove(onCrosshairMove);

          resizeObserver = new ResizeObserver(() => {
            const rw = el.clientWidth;
            if (rw <= 0 || !chartRef.current) return;
            if (rw === lastPlotWidthPx) return;
            lastPlotWidthPx = rw;
            chartRef.current.resize(rw, chartPlotHeight);
            const c = chartRef.current;
            if (chartType === "bars") {
              layoutChartingTimeScale(c, rw, 0, barTimeScaleLayoutOptions);
              if (!stockFullWidthFixedBars && !isFullPageCharting) {
                applySparseHistogramVisiblePadding(c, ordered, chartType, timeRange, ordered.length);
              }
            } else {
              c.timeScale().fitContent();
            }
            requestAnimationFrame(syncChartOverlays);
          });
          resizeObserver.observe(el);
          chart.resize(el.clientWidth, chartPlotHeight);
          if (chartType === "bars") {
            layoutChartingTimeScale(chart, el.clientWidth, 0, barTimeScaleLayoutOptions);
            if (!stockFullWidthFixedBars && !isFullPageCharting) {
              applySparseHistogramVisiblePadding(chart, ordered, chartType, timeRange, ordered.length);
            }
          } else {
            chart.timeScale().fitContent();
          }
        });
      });
    };

      mountChart();

      chartPlotCleanupRef.current = () => {
        cancelled = true;
        cancelBarEnterAnim?.();
        cancelBarEnterAnim = null;
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (chartRef.current) {
          if (onVisibleRangeChange) {
            chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
          }
          chartRef.current.remove();
          chartRef.current = null;
        }
        seriesByMetricRef.current = new Map();
        barSeriesPointsRef.current = new Map();
        barSeriesColorIdxRef.current = new Map();
        hoveredBarPeriodRef.current = null;
        hoverBandPrimitiveRef.current?.setBand(null, null);
        hoverBandPrimitiveRef.current = null;
        roundedBarsPrimitiveRef.current?.setBars([], 0);
        roundedBarsPrimitiveRef.current = null;
        if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
        setHover(null);
        setLineEndBadges([]);
        setBarValueLabels([]);
        setLinePointMarkers([]);
        setPeriodAxisLabels([]);
        setYGridTickTopsPx(null);
        setYPercentGridTickTopsPx(null);
      };
    },
    [chartMountDepsKey],
  );

  useEffect(() => {
    return () => chartPlotCleanupRef.current?.();
  }, []);

  const empty = !loading && (!points || points.length === 0);
  const noMetricData = !loading && !empty && !canPlot;

  const metricChipColorById = useMemo(() => {
    const seriesOrder = chartType === "bars" ? barMetricOrder(selected) : selected;
    const m = new Map<ChartingMetricId, string>();
    let idx = 0;
    for (const id of seriesOrder) {
      m.set(id, fundamentalsBarSolidAtIndex(idx));
      idx += 1;
    }
    return m;
  }, [chartType, selected]);

  const addMetricPicker = (
    <div ref={pickerWrapRef}>
      <button
        ref={pickerButtonRef}
        type="button"
        onClick={() => {
          setPickerOpen((o) => {
            if (o) setPickerQuery("");
            return !o;
          });
        }}
        className={cn(
          secondaryFillButtonClassName,
          metricControlsInLegend && "h-6 gap-1.5 rounded-[8px] px-3 text-[12px] font-medium leading-none",
        )}
      >
        <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        Add Metric
      </button>
      {pickerOpen ? (
        <TopbarDropdownPortal
          open={pickerOpen}
          anchorRef={pickerButtonRef}
          ref={pickerMenuPortalRef}
          align="leading"
          className="w-[min(calc(100vw-2rem),300px)]"
        >
          <div className={cn(dropdownMenuSurfaceClassName(), "overflow-hidden")} role="listbox">
            <div className={dropdownMenuSearchHeaderClassName}>
              <input
                ref={pickerInputRef}
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search metrics…"
                className={dropdownMenuSearchInputClassName}
                aria-label="Search metrics"
              />
            </div>
            <DropdownScrollArea className="flex max-h-[min(400px,calc(100vh-12rem))] flex-col gap-1 overflow-y-auto px-1 py-2">
              {groupedAddable.map((group) => (
                <div key={group.id} className="pb-2 last:pb-0">
                  <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                    {group.label}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {group.ids.map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          role="option"
                          className={dropdownMenuRichItemClassName()}
                          onClick={() => addMetric(id)}
                        >
                          {CHARTING_METRIC_LABEL[id]}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </DropdownScrollArea>
            {totalAddable === 0 ? (
              <p className="px-3 py-2 text-[12px] text-[#71717A]">
                {qLower ? "No metrics match" : "No additional metrics for this range"}
              </p>
            ) : null}
          </div>
        </TopbarDropdownPortal>
      ) : null}
    </div>
  );

  return (
    <>
      <DataFetchTopLoader active={loading} />
      <div className="space-y-4 pt-1">
      {/* Toolbar: Figma 8479:44846 — 24px title, 12px gaps, segmented controls */}
      <div className="flex flex-col gap-6">
        {/* Figma 8479:70857 — title row: period, line/bars, range, refresh */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="min-w-0 shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B] sm:flex-1">
            {workspaceTitle}
          </h2>
          {/* Web: keep controls on one line with range switcher (no wrap). */}
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:flex-nowrap sm:justify-end sm:overflow-x-auto sm:pb-0.5">
            <div className="flex shrink-0 flex-nowrap items-center gap-2">
              <TabSwitcher
                size="sm"
                options={PERIOD_TAB_OPTIONS}
                value={periodMode}
                onChange={setPeriodMode}
                aria-label="Reporting period"
              />
              <ChartingVisualSwitcher value={chartType} onChange={setChartType} />
            </div>
            <div className="shrink-0">
              <TabSwitcher
                className="inline-flex w-max min-w-0 flex-nowrap"
                options={timeRangeTabOptions}
                value={timeRange}
                onChange={(next) => {
                  setTimeRange(next);
                }}
                aria-label="Time range"
              />
            </div>
            {isFigmaToolbar ? (
              <button
                type="button"
                onClick={() => router.replace(buildStandaloneChartPath(pathRoute, [], []), { scroll: false })}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
                aria-label="Clear companies and metrics"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {/* Metric chips (+ Add Metric) in toolbar; full-page company row when compare workspace. */}
        {!metricControlsInLegend || fullPageCompanyChipSlot ? (
          <div className={metricControlsInLegend ? "pb-0" : "pb-4"}>
            <div className="flex flex-wrap items-center gap-4">
              {!metricControlsInLegend
                ? selected.map((id) => (
                    <div
                      key={id}
                      className="order-1 inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white"
                    >
                      <span className="flex min-h-[36px] min-w-0 items-center border-r border-[#E4E4E7] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B]">
                        <span className="truncate">{CHARTING_METRIC_LABEL[id]}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMetric(id)}
                        disabled={selected.length <= 1}
                        className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA] disabled:pointer-events-none disabled:opacity-30"
                        aria-label={`Remove ${CHARTING_METRIC_LABEL[id]}`}
                      >
                        <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                      </button>
                    </div>
                  ))
                : null}
              {!metricControlsInLegend ? <div className="order-2">{addMetricPicker}</div> : null}
              {fullPageCompanyChipSlot ? <div className="order-3">{fullPageCompanyChipSlot}</div> : null}
              {selected.length > 0 ? <div className="order-4">{fullPageCompanyAddSlot}</div> : null}
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <ChartLoadingIndicator
          minHeightPx={chartHeight}
          className="min-h-[min(50vh,420px)]"
        />
      ) : empty ? (
        <p className="max-w-md text-[14px] leading-6 text-[#71717A]">
          Financial statement data isn&apos;t available for this symbol.
        </p>
      ) : (
        <>
          {noMetricData ? (
            <p className="max-w-md text-[14px] leading-6 text-[#71717A]">
              No series data for the selected metrics on this symbol.
            </p>
          ) : (
            <div className="w-full min-w-0 overflow-visible" style={{ height: chartHeight }}>
              <div className="flex min-h-0 w-full overflow-visible" style={{ height: chartPlotHeight }}>
                <div className="relative min-h-0 min-w-0 flex-1 overflow-visible bg-white">
                  <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                    <div
                      className={cn(
                        "absolute inset-x-0 bg-white",
                        CHARTING_PLOT_BACKDROP_INSET_CLASS,
                      )}
                    >
                      <div className={CHART_PLOT_DOTS_PATTERN_CLASS} />
                    </div>
                    {(() => {
                      const zeroTop =
                        yGridTickTopsPx != null && yGridTickTopsPx.length > 0
                          ? yGridTickTopsPx[yGridTickTopsPx.length - 1]
                          : null;
                      if (zeroTop == null || !Number.isFinite(zeroTop)) return null;
                      return (
                        <div
                          className="absolute inset-x-0 border-t"
                          style={{
                            top: zeroTop,
                            borderColor: FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
                          }}
                        />
                      );
                    })()}
                  </div>
                  <div ref={chartPlotRef} className="relative z-[1] h-full w-full" />
                  {chartType === "bars" && visibleBarValueLabels.length > 0
                    ? visibleBarValueLabels.map((b) => (
                        <div
                          key={b.key}
                          className="pointer-events-none absolute z-[15] max-w-[5.5rem] -translate-x-1/2 -translate-y-full text-center"
                          style={{
                            left: b.leftPx,
                            top: b.topPx,
                          }}
                          title={b.text}
                        >
                          <span
                            className="fundamentals-bar-value-label-in truncate text-[11px] font-semibold leading-none tabular-nums text-[#09090B]"
                            style={{
                              animationDelay: `${b.periodIndex * FUNDAMENTALS_BAR_VALUE_LABEL_STAGGER_MS}ms`,
                              textShadow:
                                "0 0 3px rgba(255,255,255,0.95), 0 1px 2px rgba(255,255,255,0.8)",
                            }}
                          >
                            {b.text}
                          </span>
                        </div>
                      ))
                    : null}
                  {chartType === "line" && linePointMarkers.length > 0
                    ? linePointMarkers.map((m) => (
                        <div
                          key={m.key}
                          className="pointer-events-none absolute z-[12] rounded-full bg-white"
                          style={{
                            left: m.leftPx,
                            top: m.topPx,
                            width: CHARTING_LINE_POINT_MARKER_DIAMETER_PX,
                            height: CHARTING_LINE_POINT_MARKER_DIAMETER_PX,
                            borderWidth: CHARTING_LINE_POINT_MARKER_BORDER_PX,
                            borderStyle: "solid",
                            borderColor: m.color,
                            transform: "translate(-50%, -50%)",
                          }}
                          aria-hidden
                        />
                      ))
                    : null}
                  {chartType === "line" && hover?.lineHoverDot ? (
                    <div
                      className="pointer-events-none absolute z-[11] rounded-full"
                      style={{
                        left: hover.lineHoverDot.leftPx,
                        top: hover.lineHoverDot.topPx,
                        width: CHARTING_LINE_HOVER_HALO_RADIUS_PX * 2,
                        height: CHARTING_LINE_HOVER_HALO_RADIUS_PX * 2,
                        backgroundColor: CHARTING_LINE_HOVER_HALO_BG,
                        transform: "translate(-50%, -50%)",
                      }}
                      aria-hidden
                    />
                  ) : null}
                  {chartType === "line" && lineEndBadges.length > 0
                    ? lineEndBadges.map((b) => (
                        <div
                          key={`line-end-${b.id}`}
                          className="pointer-events-none absolute right-2 z-[15] max-w-[min(40%,9rem)] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums leading-none text-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.12)]"
                          style={{
                            top: b.topPx,
                            transform: "translateY(-50%)",
                            backgroundColor: b.color,
                          }}
                          title={`Latest ${CHARTING_METRIC_LABEL[b.id]}: ${b.text}`}
                        >
                          {b.text}
                        </div>
                      ))
                    : null}
                  {hover ? (
                    <>
                      <div
                        className={FUNDAMENTALS_CHART_TOOLTIP_CLASS}
                        style={{
                          left: `clamp(8px, ${hover.anchorX}px, calc(100% - 8px))`,
                          top: hover.y,
                          transform:
                            hover.side === "left"
                              ? "translate(calc(-100% - 10px), -50%)"
                              : "translate(10px, -50%)",
                        }}
                        role="tooltip"
                        aria-label="Chart tooltip"
                      >
                        {hover.side === "left" ? (
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
                        <p className="text-[12px] font-semibold leading-4 text-[#09090B]">{hover.periodLabel}</p>
                        <div className="mt-1.5 space-y-1">
                          {hover.rows.map((r) => (
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
                    </>
                  ) : null}
                </div>
                {yAxisColumnCount > 0 ? (
                  <div className="flex h-full shrink-0" aria-hidden>
                    {primaryYAxis ? (
                      <div
                        className={cn(
                          "relative h-full text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]",
                          FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
                        )}
                        style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
                      >
                        <div className="pointer-events-none absolute inset-0">
                          {primaryYAxis.ticks.map((t, i) => {
                            const topPx = yGridTickTopsPx?.[i];
                            const nt = primaryYAxis.ticks.length;
                            const pct = nt <= 1 ? 0 : i / (nt - 1);
                            const insetSpan = chartType === "bars" ? 0.92 : 0.84;
                            return (
                              <span
                                key={`y-tick-primary-${i}`}
                                className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                                style={{
                                  top:
                                    topPx != null && Number.isFinite(topPx)
                                      ? topPx
                                      : `${(0.08 + pct * insetSpan) * 100}%`,
                                }}
                              >
                                {formatFundamentalsAxisTickLabel(primaryYAxis.kind, t)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {percentYAxis ? (
                      <div
                        className={cn(
                          "relative h-full text-left font-['Inter'] text-[12px] tabular-nums leading-none text-[#71717A]",
                          FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
                        )}
                        style={{ width: FUNDAMENTALS_CHART_Y_AXIS_W_PX }}
                      >
                        <div className="pointer-events-none absolute inset-0">
                          {percentYAxis.ticks.map((t, i) => {
                            const topPx = yPercentGridTickTopsPx?.[i];
                            const nt = percentYAxis.ticks.length;
                            const pct = nt <= 1 ? 0 : i / (nt - 1);
                            const insetSpan = chartType === "bars" ? 0.92 : 0.84;
                            return (
                              <span
                                key={`y-tick-percent-${i}`}
                                className="absolute left-0 z-[1] block -translate-y-1/2 rounded-sm bg-white px-1 py-px"
                                style={{
                                  top:
                                    topPx != null && Number.isFinite(topPx)
                                      ? topPx
                                      : `${(0.08 + pct * insetSpan) * 100}%`,
                                }}
                              >
                                {formatFundamentalsAxisTickLabel("percent", t)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div
                className={cn(
                  "flex w-full min-w-0 overflow-visible",
                  periodMode === "annual" ? "pt-1.5" : "pt-0",
                )}
                style={{ height: axisRowPx }}
              >
                <div className="relative min-h-0 min-w-0 flex-1 overflow-visible">
                  {periodAxisLabels.map((lab, i) => {
                    if (!fundamentalsPeriodAxisShowsLabel(i, periodAxisLabels.length, periodMode)) {
                      return null;
                    }
                    const axisLabelRotateDeg =
                      periodMode === "annual" ? 0 : FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG;
                    return (
                      <span
                        key={lab.key}
                        className={cn(
                          "absolute inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]",
                          periodMode === "annual" ? "top-1.5" : "bottom-1",
                        )}
                        style={{
                          left: lab.leftPx,
                          transform: `translateX(-50%) rotate(${axisLabelRotateDeg}deg)`,
                          transformOrigin: "center bottom",
                        }}
                        title={lab.title}
                      >
                        {lab.axisText}
                      </span>
                    );
                  })}
                </div>
                <div
                  style={{ width: yAxisColumnsWidthPx }}
                  className={cn("shrink-0", FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS)}
                  aria-hidden
                />
              </div>
            </div>
          )}
          <div className="flex justify-center -mt-0.5 pt-0">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {selected.map((id) =>
                metricControlsInLegend ? (
                  <div
                    key={`chart-legend-${id}`}
                    className="inline-flex h-6 max-w-full min-w-0 items-stretch overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white text-[12px] font-medium leading-none text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]"
                  >
                    <span className="flex min-w-0 items-center gap-2 px-3 py-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: metricChipColorById.get(id) ?? "#2563EB" }}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">
                        {ticker.trim().toUpperCase()} {CHARTING_METRIC_LABEL[id]}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMetric(id)}
                      disabled={selected.length <= 1}
                      className="flex w-6 shrink-0 items-center justify-center border-l border-[#E4E4E7] text-[#09090B] transition-colors hover:bg-[#FAFAFA] disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`Remove ${CHARTING_METRIC_LABEL[id]}`}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <div
                    key={`chart-legend-${id}`}
                    className="inline-flex h-6 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white px-3 py-0 text-[12px] font-medium leading-none text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: metricChipColorById.get(id) ?? "#2563EB" }}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">
                      {ticker.trim().toUpperCase()} {CHARTING_METRIC_LABEL[id]}
                    </span>
                  </div>
                ),
              )}
              {metricControlsInLegend ? addMetricPicker : null}
            </div>
          </div>
          {canPlot ? (
            <ChartingIndividualCompanyTable
              ordered={ordered}
              selected={selected}
              periodMode={periodMode}
              ticker={ticker}
              metricColors={metricChipColorById}
              isBarValuesVisible={isBarValuesVisible}
              onShowBarValuesChange={setBarValuesVisibleForMetric}
            />
          ) : null}
        </>
      )}
    </div>
    </>
  );
}
