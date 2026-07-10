"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, X } from "@/lib/icons";
import { Spinner } from "@/components/ui/spinner";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import {
  useChartingRailPickerAnchors,
  useRegisterChartingCompanyRail,
} from "@/components/charting/charting-company-rail-context";
import type { CompanyPickerOpenControls } from "@/components/charting/company-picker";
import { formatChartingTableCell } from "@/components/charting/charting-individual-company-table";
import { ChartingCompareCompanyTable } from "@/components/charting/charting-compare-company-table";
import {
  DEFAULT_CHART_TIME_RANGE,
  DEFAULT_CHART_TIME_RANGE_ORDER,
  CHARTING_HEIGHT_PX,
  CHARTING_PLOT_BACKDROP_INSET_CLASS,
  chartingAxisRowPx,
  chartingPlotHeightPx,
  chartingUsesHorizontalPeriodAxisLabels,
  chartingUsesSpacedHorizontalPeriodAxis,
  CHARTING_STOCK_GROUPED_BAR_SHIFT_FRAC,
  ChartingHoverBandPrimitive,
  layoutChartingTimeScale,
  type ChartTimeRange,
  type ChartType,
  type ChartingUnitScale,
} from "@/components/charting/charting-workspace";
import { CHART_PLOT_DOTS_PATTERN_CLASS } from "@/components/chart/overview-bottom-axis";
import { ChartingVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import { DataFetchTopLoader } from "@/components/layout/data-fetch-top-loader";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { ChartLoadingIndicator } from "@/components/ui/chart-loading-indicator";
import { secondaryFillButtonClassName, TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import {
  dropdownMenuRichItemClassName,
  dropdownMenuSearchHeaderClassName,
  dropdownMenuSearchInputClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  buildChartingPercentYAxisTicks,
  buildFundamentalsYAxisTicks,
  chartingPercentPlotValue,
  chartingFundamentalsSeriesNoReferenceLines,
  chartingFundamentalsLineSeriesOptions,
  computeFundamentalsChartTooltipPlacement,
  formatFundamentalsAxisTickLabel,
  FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG,
  FUNDAMENTALS_CHART_SCALE_MARGIN_BOTTOM_BARS,
  FUNDAMENTALS_CHART_SCALE_MARGIN_BOTTOM_LINE,
  FUNDAMENTALS_CHART_TOOLTIP_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_PADDING_CLASS,
  FUNDAMENTALS_CHART_Y_AXIS_W_PX,
  FUNDAMENTALS_CHART_ZERO_BASELINE_BORDER,
  fundamentalsChartScaleMarginTop,
  HIDE_NATIVE_Y_AXIS_TICK_LABELS,
} from "@/lib/chart/fundamentals-chart-surface";
import {
  prefersReducedFundamentalsBarMotion,
  runFundamentalsBarEnterAnimation,
  scaleBarPointsForEnter,
} from "@/lib/chart/fundamentals-bar-enter-animation";
import {
  fundamentalsBarColorAtIndex,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";
import { cn } from "@/lib/utils";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  appendChartingTtmPeriod,
  compareChartingPeriodColumnLabels,
  formatChartingPeriodAxisLabel,
  formatChartingPeriodLabel,
  fundamentalsPeriodAxisShowsLabel,
  parseChartingTtmPoint,
} from "@/lib/market/charting-period-display";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import {
  CHARTING_DROPDOWN_GROUPS,
  CHARTING_MAX_COMPARE_TICKERS,
  CHARTING_METRIC_IDS,
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  type ChartingMetricKind,
  buildStandaloneChartPath,
  parseChartingMetricsParam,
  readChartingMetricValue,
  type StandaloneChartRoute,
} from "@/lib/market/stock-charting-metrics";
import { fetchChartingFundamentalsSeriesCached } from "@/lib/charting/charting-fundamentals-client-cache";

function formatChartAxisPrice(p: number): string {
  if (!Number.isFinite(p)) return "";
  const abs = Math.abs(p);
  if (abs >= 1e9) return `${Math.round(p / 1e9)} B`;
  if (abs >= 1e6) return `${Math.round(p / 1e6)} M`;
  if (abs >= 1e3) return `${Math.round(p / 1e3)} K`;
  if (abs < 1e-9) return "0";
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

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

function chartingPlotValueForKind(kind: ChartingMetricKind, raw: number): number {
  if (kind !== "percent") return raw;
  return chartingPercentPlotValue(raw);
}

type ChartingYAxisConfig = {
  kind: ChartingMetricKind;
  ticks: number[];
};

type ChartingBarSeriesPoint = {
  time: UTCTimestamp;
  value: number;
  color?: string;
  periodIndex: number;
};

type PeriodAxisLabel = {
  key: string;
  leftPx: number;
  axisText: string;
  title: string;
};

const CHARTING_BAR_TRANSPARENT = "rgba(0,0,0,0)";
const CHARTING_BAR_HOVER_DIM_OPACITY = 0.6;
const GROUPED_BAR_SHIFT_SEC = 24 * 60 * 60;
const BAR_GAP_SLOT_SEC = GROUPED_BAR_SHIFT_SEC;
const HISTO_BAR_SPACING_MAX_PX = 28;
const CHARTING_BAR_INDEX_EPOCH_SEC = Math.floor(Date.parse("2016-01-01T12:00:00.000Z") / 1000);
const CHARTING_BAR_PERIOD_STEP_SEC = GROUPED_BAR_SHIFT_SEC * 4;

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
  colorIdx: number,
  hoveredPeriodIndex: number | null,
) {
  return points.map((p) => ({
    time: p.time,
    value: p.value,
    color: isTransparentChartingBarPoint(p)
      ? CHARTING_BAR_TRANSPARENT
      : chartingBarPointFillColor(colorIdx, p.periodIndex, hoveredPeriodIndex),
  }));
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

function compareBarBaseTimeSec(labelIndex: number): number {
  return CHARTING_BAR_INDEX_EPOCH_SEC + labelIndex * CHARTING_BAR_PERIOD_STEP_SEC;
}

function compareSeriesShiftSec(colorIdx: number, seriesCount: number): number {
  if (seriesCount <= 1) return 0;
  const center = (seriesCount - 1) / 2;
  return Math.round((colorIdx - center) * CHARTING_BAR_PERIOD_STEP_SEC * CHARTING_STOCK_GROUPED_BAR_SHIFT_FRAC);
}

function comparePeriodCenterTimeSec(
  labelIndex: number,
  seriesCount: number,
  barBaseTimeByLabel: Map<string, number>,
  label: string,
): number | null {
  const base = barBaseTimeByLabel.get(label);
  if (base == null) return null;
  if (seriesCount <= 1) return base;
  const centerIdx = Math.floor((seriesCount - 1) / 2);
  return base + compareSeriesShiftSec(centerIdx, seriesCount);
}

/** Full period-column hover band — matches Key Stats / stock charting column width. */
function comparePeriodColumnBoundsPx(
  chart: IChartApi,
  labelIndex: number,
  tableColumnLabels: string[],
  baseTimeByLabel: Map<string, number>,
  seriesCount: number,
): { x0: number; x1: number } | null {
  const ts = chart.timeScale();
  const n = tableColumnLabels.length;
  if (n <= 0 || labelIndex < 0 || labelIndex >= n) return null;

  const centerAt = (li: number): number | null => {
    const label = tableColumnLabels[li];
    if (!label) return null;
    const centerTime = comparePeriodCenterTimeSec(li, seriesCount, baseTimeByLabel, label);
    if (centerTime == null) return null;
    const x = ts.timeToCoordinate(centerTime as UTCTimestamp);
    return x != null && Number.isFinite(x) ? x : null;
  };

  const centerX = centerAt(labelIndex);
  if (centerX == null) return null;

  const prevX = labelIndex > 0 ? centerAt(labelIndex - 1) : null;
  const nextX = labelIndex < n - 1 ? centerAt(labelIndex + 1) : null;

  const halfSpan =
    prevX != null && nextX != null
      ? Math.min(centerX - prevX, nextX - centerX) / 2
      : prevX != null
        ? (centerX - prevX) / 2
        : nextX != null
          ? (nextX - centerX) / 2
          : Math.max(24, ts.options().barSpacing / 2);

  return { x0: centerX - halfSpan, x1: centerX + halfSpan };
}

function compareSeriesDataBarsWithGapSlots(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  tableColumnLabels: string[],
  periodMode: "annual" | "quarterly",
  barBaseTimeByLabel: Map<string, number>,
  shiftSeconds: number,
): ChartingBarSeriesPoint[] {
  const out: ChartingBarSeriesPoint[] = [];
  for (let li = 0; li < tableColumnLabels.length; li++) {
    const label = tableColumnLabels[li]!;
    const row = points.find(
      (r) => Boolean(r.periodEnd) && formatChartingPeriodLabel(r.periodEnd, periodMode) === label,
    );
    if (!row) continue;
    const v = rowValue(row, metricId);
    if (v == null || !Number.isFinite(v)) continue;
    const base = barBaseTimeByLabel.get(label);
    if (base == null) continue;
    const barTime = (base + shiftSeconds) as UTCTimestamp;
    out.push({
      time: barTime,
      value: v,
      periodIndex: li,
    });
    // Gap must follow the shifted bar so lightweight-charts data stays time-ascending.
    out.push({
      time: (barTime + BAR_GAP_SLOT_SEC) as UTCTimestamp,
      value: 0,
      color: CHARTING_BAR_TRANSPARENT,
      periodIndex: -1,
    });
  }
  return out;
}

function compareSeriesDataLine(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  tableColumnLabels: string[],
  periodMode: "annual" | "quarterly",
  barBaseTimeByLabel: Map<string, number>,
  shiftSeconds: number,
): ChartingBarSeriesPoint[] {
  const out: ChartingBarSeriesPoint[] = [];
  for (let li = 0; li < tableColumnLabels.length; li++) {
    const label = tableColumnLabels[li]!;
    const row = points.find(
      (r) => Boolean(r.periodEnd) && formatChartingPeriodLabel(r.periodEnd, periodMode) === label,
    );
    if (!row) continue;
    const v = rowValue(row, metricId);
    if (v == null || !Number.isFinite(v)) continue;
    const base = barBaseTimeByLabel.get(label);
    if (base == null) continue;
    out.push({
      time: (base + shiftSeconds) as UTCTimestamp,
      value: v,
      periodIndex: li,
    });
  }
  return out;
}

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

function computeComparePeriodAxisLabelsLayout(
  chart: IChartApi,
  tableColumnLabels: string[],
  periodMode: "annual" | "quarterly",
  seriesCount: number,
  barBaseTimeByLabel: Map<string, number>,
  labelToSampleEnd: Map<string, string>,
): PeriodAxisLabel[] {
  if (!tableColumnLabels.length) return [];
  const ts = chart.timeScale();
  const labels: PeriodAxisLabel[] = [];
  for (let i = 0; i < tableColumnLabels.length; i++) {
    const label = tableColumnLabels[i]!;
    const timeSec = comparePeriodCenterTimeSec(i, seriesCount, barBaseTimeByLabel, label);
    if (timeSec == null) continue;
    const x = ts.timeToCoordinate(timeSec as UTCTimestamp);
    if (x == null || !Number.isFinite(x)) continue;
    const sampleEnd = labelToSampleEnd.get(label) ?? label;
    labels.push({
      key: label,
      leftPx: x,
      axisText: formatChartingPeriodAxisLabel(sampleEnd, periodMode),
      title: formatChartingPeriodLabel(sampleEnd, periodMode),
    });
  }
  return labels;
}

function applyCompareSparseHistogramVisiblePadding(
  chart: IChartApi,
  labelCount: number,
  chartType: ChartType,
  timeRange: ChartTimeRange,
): void {
  if (chartType !== "bars" || timeRange === "all" || labelCount === 0 || labelCount > 10) return;
  const lo = compareBarBaseTimeSec(0);
  const hi = compareBarBaseTimeSec(labelCount - 1);
  const span = Math.max(hi - lo, 28 * 86400);
  const pad = Math.max(Math.floor(span * 0.52), 110 * 86400);
  chart.timeScale().applyOptions({ fixLeftEdge: false, fixRightEdge: false });
  chart.timeScale().setVisibleRange({
    from: (lo - pad) as UTCTimestamp,
    to: (hi + pad) as UTCTimestamp,
  });
}

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
  return readChartingMetricValue(row, id);
}

function compareSeriesHasData(
  points: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
  tableColumnLabels: string[],
  periodMode: "annual" | "quarterly",
): boolean {
  for (const label of tableColumnLabels) {
    const row = points.find(
      (r) => Boolean(r.periodEnd) && formatChartingPeriodLabel(r.periodEnd, periodMode) === label,
    );
    if (!row) continue;
    const v = rowValue(row, metricId);
    if (v != null && Number.isFinite(v)) return true;
  }
  return false;
}

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

function timeRangeTabOptionsFor(order: ChartTimeRange[]): TabSwitcherOption<ChartTimeRange>[] {
  return order.map((r) => ({ value: r, label: TIME_RANGE_LABELS[r] }));
}

type SeriesDef = { key: string; ticker: string; metricId: ChartingMetricId; colorIdx: number };

type HoverState = {
  anchorX: number;
  y: number;
  side: "left" | "right";
  periodLabel: string;
  rows: Array<{ key: string; label: string; value: string; color: string }>;
  bandLeft: number;
  bandWidth: number;
} | null;

type Props = {
  tickers: string[];
  metricParam: string;
  initialByTicker: Record<string, StockPageInitialData>;
  pathRoute?: StandaloneChartRoute;
  workspaceTitle?: string;
  /** Defaults to {@link DEFAULT_CHART_TIME_RANGE_ORDER}; standalone `/charting` passes {@link STANDALONE_CHARTING_TIME_RANGE_ORDER}. */
  timeRangeOrder?: ChartTimeRange[];
  animateBarsOnAppear?: boolean;
};

export function ChartingCompareWorkspace({
  tickers,
  metricParam,
  initialByTicker,
  pathRoute = "/charting",
  workspaceTitle = "Charting",
  timeRangeOrder = DEFAULT_CHART_TIME_RANGE_ORDER,
  animateBarsOnAppear = false,
}: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const companyPickerControlsRef = useRef<CompanyPickerOpenControls | null>(null);
  const { useRailPickers, metricAddAnchorRef, companyAddAnchorRef } = useChartingRailPickerAnchors();
  const useRailMetricPicker = pathRoute === "/charting" && useRailPickers;
  const pickerMenuPortalRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const timeRangeTabOptions = useMemo(
    () => timeRangeTabOptionsFor(timeRangeOrder),
    [timeRangeOrder],
  );

  const [periodMode, setPeriodMode] = useState<"annual" | "quarterly">("annual");
  const [timeRange, setTimeRange] = useState<ChartTimeRange>(DEFAULT_CHART_TIME_RANGE);
  const [chartType, setChartType] = useState<ChartType>("bars");
  const unitScale: ChartingUnitScale = "auto";
  const chartHeight = CHARTING_HEIGHT_PX;
  const axisRowPx = chartingAxisRowPx(periodMode, timeRange);
  const chartPlotHeight = chartingPlotHeightPx(periodMode, timeRange);
  const horizontalPeriodAxisLabels = chartingUsesHorizontalPeriodAxisLabels(periodMode, timeRange);
  const spacedHorizontalPeriodAxis = chartingUsesSpacedHorizontalPeriodAxis(timeRange);

  const seedByTicker = useMemo(() => {
    const out: Record<string, ChartingSeriesPoint[] | null> = {};
    for (const t of tickers) {
      const d = initialByTicker[t];
      if (!d) {
        out[t] = null;
        continue;
      }
      const pts = periodMode === "quarterly" ? d.fundamentalsSeriesQuarterly : d.fundamentalsSeriesAnnual;
      out[t] = Array.isArray(pts) ? pts : null;
    }
    return out;
  }, [tickers, periodMode, initialByTicker]);

  const seedTtmByTicker = useMemo(() => {
    const out: Record<string, ChartingSeriesPoint | null> = {};
    for (const t of tickers) {
      const d = initialByTicker[t];
      out[t] = periodMode === "annual" && d ? parseChartingTtmPoint(d.fundamentalsTtmPoint) : null;
    }
    return out;
  }, [tickers, periodMode, initialByTicker]);

  const [pointsByTicker, setPointsByTicker] = useState<Record<string, ChartingSeriesPoint[] | null>>({});
  const [ttmByTicker, setTtmByTicker] = useState<Record<string, ChartingSeriesPoint | null>>({});
  const [loading, setLoading] = useState(true);
  /** Newly added tickers still fetching fundamentals — chip shows spinner until row loads (not used on first mount). */
  const [pendingTickerChips, setPendingTickerChips] = useState<string[]>([]);
  const [selected, setSelected] = useState<ChartingMetricId[]>(() => parseChartingMetricsParam(metricParam));
  const [hover, setHover] = useState<HoverState>(null);
  const [periodAxisLabels, setPeriodAxisLabels] = useState<PeriodAxisLabel[]>([]);
  const [yGridTickTopsPx, setYGridTickTopsPx] = useState<number[] | null>(null);
  const [yPercentGridTickTopsPx, setYPercentGridTickTopsPx] = useState<number[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const chartRef = useRef<IChartApi | null>(null);
  const seriesByKeyRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(new Map());
  const barSeriesPointsRef = useRef<Map<string, ChartingBarSeriesPoint[]>>(new Map());
  const hoveredBarPeriodRef = useRef<number | null>(null);
  const hoverBandPrimitiveRef = useRef<ChartingHoverBandPrimitive | null>(null);
  const hoverRafRef = useRef<number>(0);
  const tickersSeenRef = useRef<string[]>([]);
  const animateBarsOnAppearRef = useRef(animateBarsOnAppear);
  animateBarsOnAppearRef.current = animateBarsOnAppear;

  useEffect(() => {
    const parsed = parseChartingMetricsParam(metricParam);
    if (parsed.length) setSelected(parsed);
  }, [metricParam]);

  useEffect(() => {
    if (timeRangeOrder.includes(timeRange)) return;
    setTimeRange(timeRangeOrder[0] ?? "3Y");
  }, [timeRange, timeRangeOrder]);

  useEffect(() => {
    let cancelled = false;
    const prevSeen = tickersSeenRef.current;
    const newlyAdded =
      prevSeen.length === 0 ? [] : tickers.filter((t) => !prevSeen.includes(t));
    tickersSeenRef.current = [...tickers];

    async function load() {
      const allSeeded =
        tickers.length > 0 && tickers.every((t) => Array.isArray(seedByTicker[t]));

      if (allSeeded) {
        const next: Record<string, ChartingSeriesPoint[]> = {};
        const nextTtm: Record<string, ChartingSeriesPoint | null> = {};
        for (const t of tickers) {
          const s = seedByTicker[t];
          next[t] = Array.isArray(s) ? s : [];
          nextTtm[t] = seedTtmByTicker[t] ?? null;
        }
        if (!cancelled) {
          setPointsByTicker(next);
          setTtmByTicker(nextTtm);
          setLoading(false);
          setPendingTickerChips((p) => p.filter((x) => tickers.includes(x)));
        }
        return;
      }

      const needFetch = tickers.filter((t) => !Array.isArray(seedByTicker[t]));
      const fullRefetch = needFetch.length > 0 && needFetch.length === tickers.length;

      setPointsByTicker((prev) => {
        const next: Record<string, ChartingSeriesPoint[]> = {};
        for (const t of tickers) {
          if (Array.isArray(seedByTicker[t])) {
            next[t] = seedByTicker[t]!;
          } else if (needFetch.includes(t)) {
            next[t] = [];
          } else if (Array.isArray(prev[t])) {
            next[t] = prev[t]!;
          } else {
            next[t] = [];
          }
        }
        return next;
      });

      setPendingTickerChips((p) => {
        if (fullRefetch) return [];
        const keep = p.filter((x) => tickers.includes(x));
        const spin = newlyAdded.filter((t) => needFetch.includes(t));
        return [...new Set([...keep, ...spin])];
      });

      if (needFetch.length === 0) {
        if (!cancelled) setLoading(false);
        return;
      }

      if (fullRefetch) {
        if (!cancelled) setLoading(true);
      }

      try {
        await Promise.all(
          needFetch.map(async (t) => {
            try {
              const period = periodMode === "quarterly" ? "quarterly" : "annual";
              const payload = (await fetchChartingFundamentalsSeriesCached(t, period)) ?? null;
              if (!cancelled) {
                setPointsByTicker((p) => ({ ...p, [t]: payload?.points ?? [] }));
                setTtmByTicker((p) => ({
                  ...p,
                  [t]: period === "annual" ? payload?.ttmPoint ?? null : null,
                }));
              }
            } finally {
              if (!cancelled) {
                setPendingTickerChips((p) => p.filter((x) => x !== t));
              }
            }
          }),
        );
      } catch {
        if (!cancelled) {
          setPointsByTicker((prev) => {
            const out: Record<string, ChartingSeriesPoint[]> = {};
            for (const x of tickers) {
              out[x] = Array.isArray(prev[x]) ? prev[x]! : [];
            }
            return out;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tickers, periodMode, seedByTicker, seedTtmByTicker]);

  const orderedByTicker = useMemo(() => {
    const o: Record<string, ChartingSeriesPoint[]> = {};
    for (const t of tickers) {
      const pts = pointsByTicker[t];
      const ranged = applyTimeRange(Array.isArray(pts) ? pts : [], periodMode, timeRange);
      o[t] =
        periodMode === "annual"
          ? appendChartingTtmPeriod(ranged, ttmByTicker[t] ?? null)
          : ranged;
    }
    return o;
  }, [tickers, pointsByTicker, ttmByTicker, periodMode, timeRange]);

  /** One column per calendar period label — tickers can share the same FY (e.g. "2025") with different `periodEnd` dates. */
  const tableColumnLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const t of tickers) {
      for (const row of orderedByTicker[t] ?? []) {
        if (row.periodEnd) labels.add(formatChartingPeriodLabel(row.periodEnd, periodMode));
      }
    }
    const arr = [...labels];
    if (periodMode === "annual") {
      arr.sort((a, b) => compareChartingPeriodColumnLabels(a, b, periodMode, new Map()));
    } else {
      const labelToSampleEnd = new Map<string, string>();
      for (const t of tickers) {
        for (const row of orderedByTicker[t] ?? []) {
          if (!row.periodEnd) continue;
          const lab = formatChartingPeriodLabel(row.periodEnd, periodMode);
          const cur = labelToSampleEnd.get(lab);
          if (!cur || row.periodEnd.localeCompare(cur) < 0) labelToSampleEnd.set(lab, row.periodEnd);
        }
      }
      arr.sort((a, b) => (labelToSampleEnd.get(a) ?? "").localeCompare(labelToSampleEnd.get(b) ?? ""));
    }
    return arr;
  }, [tickers, orderedByTicker, periodMode]);

  const labelToSampleEnd = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tickers) {
      for (const row of orderedByTicker[t] ?? []) {
        if (!row.periodEnd) continue;
        const lab = formatChartingPeriodLabel(row.periodEnd, periodMode);
        const cur = m.get(lab);
        if (!cur || row.periodEnd.localeCompare(cur) < 0) m.set(lab, row.periodEnd);
      }
    }
    return m;
  }, [tickers, orderedByTicker, periodMode]);

  const barBaseTimeByLabel = useMemo(() => {
    if (chartType !== "bars") return null;
    const m = new Map<string, number>();
    tableColumnLabels.forEach((label, i) => {
      m.set(label, compareBarBaseTimeSec(i));
    });
    return m;
  }, [chartType, tableColumnLabels]);

  const lineBaseTimeByLabel = useMemo(() => {
    if (chartType !== "line") return null;
    const m = new Map<string, number>();
    tableColumnLabels.forEach((label, i) => {
      m.set(label, compareBarBaseTimeSec(i));
    });
    return m;
  }, [chartType, tableColumnLabels]);

  const availableInRange = useMemo(() => {
    const seen = new Set<ChartingMetricId>();
    for (const t of tickers) {
      for (const row of orderedByTicker[t] ?? []) {
        for (const id of CHARTING_METRIC_IDS) {
          if (seen.has(id)) continue;
          const v = rowValue(row, id);
          if (v != null && Number.isFinite(v)) seen.add(id);
        }
      }
    }
    return CHARTING_METRIC_IDS.filter((id) => seen.has(id));
  }, [tickers, orderedByTicker]);

  const seriesDefs: SeriesDef[] = useMemo(() => {
    const out: SeriesDef[] = [];
    let idx = 0;
    for (const t of tickers) {
      for (const m of selected) {
        out.push({ key: `${t}|${m}`, ticker: t, metricId: m, colorIdx: idx });
        idx += 1;
      }
    }
    return out;
  }, [tickers, selected]);

  const groupedTimeToLabel = useMemo(() => {
    if (chartType !== "bars" || seriesDefs.length <= 1 || !barBaseTimeByLabel) {
      return new Map<number, string>();
    }
    const m = new Map<number, string>();
    for (let li = 0; li < tableColumnLabels.length; li++) {
      const label = tableColumnLabels[li]!;
      const base = barBaseTimeByLabel.get(label);
      if (base == null) continue;
      for (const s of seriesDefs) {
        m.set(base + compareSeriesShiftSec(s.colorIdx, seriesDefs.length), label);
      }
    }
    return m;
  }, [chartType, seriesDefs, tableColumnLabels, barBaseTimeByLabel]);

  const canPlot = useMemo(() => {
    return seriesDefs.some((s) =>
      compareSeriesHasData(
        orderedByTicker[s.ticker] ?? [],
        s.metricId,
        tableColumnLabels,
        periodMode,
      ),
    );
  }, [seriesDefs, orderedByTicker, tableColumnLabels, periodMode]);

  const chartAxes = useMemo(() => {
    if (!tableColumnLabels.length || !seriesDefs.length) {
      return { primary: null as ChartingYAxisConfig | null, percent: null as ChartingYAxisConfig | null };
    }

    const nonPercentSeries = seriesDefs.filter((s) => CHARTING_METRIC_KIND[s.metricId] !== "percent");
    const percentSeries = seriesDefs.filter((s) => CHARTING_METRIC_KIND[s.metricId] === "percent");

    let primary: ChartingYAxisConfig | null = null;
    if (nonPercentSeries.length > 0) {
      const primarySeries =
        nonPercentSeries.find((s) => CHARTING_METRIC_KIND[s.metricId] === "usd") ?? nonPercentSeries[0]!;
      const kind = CHARTING_METRIC_KIND[primarySeries.metricId];
      const metricsOnAxis = nonPercentSeries.filter((s) => CHARTING_METRIC_KIND[s.metricId] === kind);
      let rawMax = 0;
      for (const s of metricsOnAxis) {
        for (const label of tableColumnLabels) {
          const row = (orderedByTicker[s.ticker] ?? []).find(
            (r) => Boolean(r.periodEnd) && formatChartingPeriodLabel(r.periodEnd, periodMode) === label,
          );
          if (!row) continue;
          const v = rowValue(row, s.metricId);
          if (v != null && Number.isFinite(v)) rawMax = Math.max(rawMax, Math.abs(v));
        }
      }
      primary = {
        kind,
        ticks: buildFundamentalsYAxisTicks(rawMax || 1, kind),
      };
    }

    const percent: ChartingYAxisConfig | null =
      percentSeries.length > 0
        ? (() => {
            let rawMax = 0;
            for (const s of percentSeries) {
              for (const label of tableColumnLabels) {
                const row = (orderedByTicker[s.ticker] ?? []).find(
                  (r) => Boolean(r.periodEnd) && formatChartingPeriodLabel(r.periodEnd, periodMode) === label,
                );
                if (!row) continue;
                const v = rowValue(row, s.metricId);
                if (v != null && Number.isFinite(v)) {
                  rawMax = Math.max(rawMax, Math.abs(chartingPercentPlotValue(v)));
                }
              }
            }
            return {
              kind: "percent",
              ticks: buildChartingPercentYAxisTicks(rawMax || 1),
            };
          })()
        : null;

    return { primary, percent };
  }, [tableColumnLabels, seriesDefs, orderedByTicker, periodMode]);

  const primaryYAxis = chartAxes.primary;
  const percentYAxis = chartAxes.percent;
  const yAxisColumnCount = (primaryYAxis ? 1 : 0) + (percentYAxis ? 1 : 0);
  const yAxisColumnsWidthPx = yAxisColumnCount * FUNDAMENTALS_CHART_Y_AXIS_W_PX;

  const pushChartingUrl = useCallback(
    (nextTickers: string[], metrics: ChartingMetricId[]) => {
      router.replace(buildStandaloneChartPath(pathRoute, nextTickers, metrics), { scroll: false });
    },
    [router, pathRoute],
  );

  const removeTicker = useCallback(
    (sym: string) => {
      const next = tickers.filter((x) => x !== sym);
      pushChartingUrl(next, selected);
    },
    [tickers, selected, pushChartingUrl],
  );

  const addTickerFromPicker = useCallback(
    (sym: string) => {
      const u = sym.trim().toUpperCase();
      if (!u || tickers.includes(u)) return;
      if (tickers.length >= CHARTING_MAX_COMPARE_TICKERS) return;
      pushChartingUrl([...tickers, u], selected);
    },
    [tickers, selected, pushChartingUrl],
  );

  const removeMetric = useCallback(
    (id: ChartingMetricId) => {
      let next: ChartingMetricId[] | null = null;
      setSelected((prev) => {
        const n = prev.filter((x) => x !== id);
        next = n;
        return n;
      });
      if (next !== null) {
        queueMicrotask(() => pushChartingUrl(tickers, next!));
      }
    },
    [tickers, pushChartingUrl],
  );

  const addMetric = useCallback(
    (id: ChartingMetricId) => {
      let next: ChartingMetricId[] | null = null;
      setSelected((prev) => {
        if (prev.includes(id)) return prev;
        const n = [...prev, id];
        next = n;
        return n;
      });
      if (next !== null) {
        queueMicrotask(() => pushChartingUrl(tickers, next!));
      }
      setPickerOpen(false);
      setPickerQuery("");
    },
    [tickers, pushChartingUrl],
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

  useEffect(() => {
    if (!pickerOpen) return;
    pickerInputRef.current?.focus({ preventScroll: true });
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      const anchor = useRailMetricPicker ? metricAddAnchorRef.current : pickerButtonRef.current;
      if (
        pickerWrapRef.current?.contains(t) ||
        pickerMenuPortalRef.current?.contains(t) ||
        anchor?.contains(t)
      ) {
        return;
      }
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
  }, [pickerOpen, useRailMetricPicker, metricAddAnchorRef]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (loading || !canPlot || !tableColumnLabels.length) {
      setPeriodAxisLabels([]);
      setYGridTickTopsPx(null);
      setYPercentGridTickTopsPx(null);
      return;
    }

    let cancelled = false;
    let lastPlotWidthPx = el.clientWidth;
    let resizeObserver: ResizeObserver | null = null;
    let onVisibleRangeChange: (() => void) | null = null;
    let barEnterElapsedMs = Number.POSITIVE_INFINITY;
    let cancelBarEnterAnim: (() => void) | null = null;

    const barTimeScaleLayoutOptions =
      chartType === "bars" && tableColumnLabels.length > 0
        ? { fixedBarSpacingPx: HISTO_BAR_SPACING_MAX_PX, periodCount: tableColumnLabels.length }
        : undefined;

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

          const nPoints = tableColumnLabels.length;
          const barSpacingRaw =
            chartType === "bars"
              ? timeRange !== "all"
                ? HISTO_BAR_SPACING_MAX_PX
                : Math.max(24, Math.min(44, Math.floor(1800 / Math.max(1, nPoints))))
              : 9;
          const barSpacing =
            chartType === "bars" ? Math.min(barSpacingRaw, HISTO_BAR_SPACING_MAX_PX) : barSpacingRaw;

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
            rightPriceScale: { visible: false, borderVisible: false },
            leftPriceScale: { visible: false, borderVisible: false },
            timeScale: {
              visible: false,
              borderVisible: false,
              ticksVisible: false,
              fixLeftEdge: false,
              fixRightEdge: false,
              lockVisibleTimeRangeOnResize: true,
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
          seriesByKeyRef.current = new Map();
          barSeriesPointsRef.current = new Map();
          hoveredBarPeriodRef.current = null;

          const hoverBandPrimitive = new ChartingHoverBandPrimitive();
          hoverBandPrimitiveRef.current = hoverBandPrimitive;
          chart.panes()[0]?.attachPrimitive(hoverBandPrimitive);

          const usedScales = new Set<string>();
          const baseTimeByLabel = chartType === "bars" ? barBaseTimeByLabel : lineBaseTimeByLabel;
          const shouldAnimateBars =
            chartType === "bars" &&
            animateBarsOnAppearRef.current &&
            !prefersReducedFundamentalsBarMotion() &&
            tableColumnLabels.length > 0;

          const fixedYAutoscaleForKind = (kind: ChartingMetricKind) => {
            if (kind === "percent" && chartAxes.percent) {
              const top = chartAxes.percent.ticks[0];
              if (top != null && Number.isFinite(top) && top > 0) {
                return {
                  autoscaleInfoProvider: () => ({
                    priceRange: { minValue: 0, maxValue: top },
                  }),
                };
              }
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

          for (const s of seriesDefs) {
            if (!baseTimeByLabel) continue;
            const shiftSec =
              chartType === "bars" && seriesDefs.length > 1
                ? compareSeriesShiftSec(s.colorIdx, seriesDefs.length)
                : chartType === "line" && seriesDefs.length > 1
                  ? compareSeriesShiftSec(s.colorIdx, seriesDefs.length)
                  : 0;
            const points = orderedByTicker[s.ticker] ?? [];
            const data =
              chartType === "bars"
                ? compareSeriesDataBarsWithGapSlots(
                    points,
                    s.metricId,
                    tableColumnLabels,
                    periodMode,
                    baseTimeByLabel,
                    shiftSec,
                  )
                : compareSeriesDataLine(
                    points,
                    s.metricId,
                    tableColumnLabels,
                    periodMode,
                    baseTimeByLabel,
                    shiftSec,
                  );
            if (!data.length) continue;
            const kind = CHARTING_METRIC_KIND[s.metricId];
            const scaleId = scaleIdForKind(kind);
            usedScales.add(scaleId);
            const solid = fundamentalsBarSolidAtIndex(s.colorIdx);
            if (chartType === "bars") {
              const barPoints = chartingPlotBarPointsForKind(data, kind);
              barSeriesPointsRef.current.set(s.key, barPoints);
              const series = chart.addSeries(HistogramSeries, {
                ...chartingFundamentalsSeriesNoReferenceLines,
                ...fixedYAutoscaleForKind(kind),
                color: solid,
                priceScaleId: scaleId,
                priceFormat: priceFormatForKind(kind),
                title: `${s.ticker} ${CHARTING_METRIC_LABEL[s.metricId]}`,
              });
              const initialBarPoints = shouldAnimateBars
                ? scaleBarPointsForEnter(
                    barPoints,
                    tableColumnLabels.length,
                    0,
                    isTransparentChartingBarPoint,
                  )
                : barPoints;
              series.setData(chartingBarPointsToHistogramData(initialBarPoints, s.colorIdx, null));
              seriesByKeyRef.current.set(s.key, series);
            } else {
              const series = chart.addSeries(LineSeries, {
                ...chartingFundamentalsLineSeriesOptions(solid),
                ...fixedYAutoscaleForKind(kind),
                priceScaleId: scaleId,
                priceFormat: priceFormatForKind(kind),
                title: `${s.ticker} ${CHARTING_METRIC_LABEL[s.metricId]}`,
              });
              series.setData(chartingPlotLinePointsForKind(data, kind));
              seriesByKeyRef.current.set(s.key, series);
            }
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
            shouldAnimateBars && barSeriesPointsRef.current.size > 0;
          if (willAnimateBars) {
            barEnterElapsedMs = 0;
          }

          const syncAnimatedHistogramBars = (elapsedMs: number) => {
            if (chartType !== "bars") return;
            barEnterElapsedMs = elapsedMs;
            const hovered = hoveredBarPeriodRef.current;
            for (const s of seriesDefs) {
              const barPoints = barSeriesPointsRef.current.get(s.key);
              const series = seriesByKeyRef.current.get(s.key);
              if (!barPoints || !series) continue;
              const displayed = scaleBarPointsForEnter(
                barPoints,
                tableColumnLabels.length,
                elapsedMs,
                isTransparentChartingBarPoint,
              );
              series.setData(chartingBarPointsToHistogramData(displayed, s.colorIdx, hovered));
            }
          };

          if (willAnimateBars) {
            cancelBarEnterAnim = runFundamentalsBarEnterAnimation({
              periodCount: tableColumnLabels.length,
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

          const syncChartOverlays = () => {
            if (cancelled || !chartRef.current || !baseTimeByLabel) return;
            const c = chartRef.current;
            setPeriodAxisLabels(
              computeComparePeriodAxisLabelsLayout(
                c,
                tableColumnLabels,
                periodMode,
                seriesDefs.length,
                baseTimeByLabel,
                labelToSampleEnd,
              ),
            );
            const yRefSeries = (() => {
              for (const s of seriesDefs) {
                if (CHARTING_METRIC_KIND[s.metricId] !== "percent") {
                  return seriesByKeyRef.current.get(s.key);
                }
              }
              for (const s of seriesDefs) {
                if (CHARTING_METRIC_KIND[s.metricId] === "percent") {
                  return seriesByKeyRef.current.get(s.key);
                }
              }
              return seriesByKeyRef.current.values().next().value;
            })();
            const yPercentRefSeries = (() => {
              for (const s of seriesDefs) {
                if (CHARTING_METRIC_KIND[s.metricId] === "percent") {
                  return seriesByKeyRef.current.get(s.key);
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
          };
          requestAnimationFrame(() => {
            if (cancelled) return;
            requestAnimationFrame(syncChartOverlays);
          });

          onVisibleRangeChange = () => {
            requestAnimationFrame(syncChartOverlays);
          };
          chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

          const applyBarHoverDimming = (periodIndex: number | null) => {
            if (chartType !== "bars" || hoveredBarPeriodRef.current === periodIndex) return;
            hoveredBarPeriodRef.current = periodIndex;
            for (const s of seriesDefs) {
              const barPoints = barSeriesPointsRef.current.get(s.key);
              const series = seriesByKeyRef.current.get(s.key);
              if (!barPoints || !series) continue;
              const displayed =
                Number.isFinite(barEnterElapsedMs) && barEnterElapsedMs < Number.POSITIVE_INFINITY
                  ? scaleBarPointsForEnter(
                      barPoints,
                      tableColumnLabels.length,
                      barEnterElapsedMs,
                      isTransparentChartingBarPoint,
                    )
                  : barPoints;
              series.setData(chartingBarPointsToHistogramData(displayed, s.colorIdx, periodIndex));
            }
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

            if (chartType === "line") {
              if (param.time === undefined) {
                applyBarHoverDimming(null);
                hoverBandPrimitiveRef.current?.setBand(null, null);
                if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
                hoverRafRef.current = requestAnimationFrame(() => setHover(null));
                return;
              }
            } else if (param.time === undefined) {
              applyBarHoverDimming(null);
              hoverBandPrimitiveRef.current?.setBand(null, null);
              if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
              hoverRafRef.current = requestAnimationFrame(() => setHover(null));
              return;
            }

            const rawTime = param.time as UTCTimestamp;
            const timeKey = typeof rawTime === "number" && Number.isFinite(rawTime) ? rawTime : null;
            if (timeKey == null) {
              applyBarHoverDimming(null);
              hoverBandPrimitiveRef.current?.setBand(null, null);
              if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
              hoverRafRef.current = requestAnimationFrame(() => setHover(null));
              return;
            }

            let periodLabel =
              chartType === "bars" && seriesDefs.length > 1
                ? (groupedTimeToLabel.get(timeKey) ?? "")
                : "";
            if (!periodLabel && baseTimeByLabel) {
              for (let li = 0; li < tableColumnLabels.length; li++) {
                const label = tableColumnLabels[li]!;
                const base = baseTimeByLabel.get(label);
                if (base == null) continue;
                const shift =
                  seriesDefs.length > 1 ? compareSeriesShiftSec(0, seriesDefs.length) : 0;
                if (Math.abs(timeKey - (base + shift)) <= GROUPED_BAR_SHIFT_SEC * seriesDefs.length) {
                  periodLabel = label;
                  break;
                }
              }
            }
            if (!periodLabel) {
              periodLabel = tableColumnLabels.find((label) => {
                const base = baseTimeByLabel?.get(label);
                return base != null && Math.abs(timeKey - base) <= BAR_GAP_SLOT_SEC;
              }) ?? String(timeKey);
            }

            let focusPeriodIndex = tableColumnLabels.indexOf(periodLabel);
            if (focusPeriodIndex < 0) {
              for (let li = 0; li < tableColumnLabels.length; li++) {
                const label = tableColumnLabels[li]!;
                const base = baseTimeByLabel?.get(label);
                if (base == null) continue;
                if (timeKey >= base && timeKey <= base + BAR_GAP_SLOT_SEC) {
                  focusPeriodIndex = li;
                  periodLabel = label;
                  break;
                }
              }
            }

            if (chartType === "bars") {
              applyBarHoverDimming(focusPeriodIndex >= 0 ? focusPeriodIndex : null);
            }

            const rows: Array<{ key: string; label: string; value: string; color: string }> = [];
            for (const s of seriesDefs) {
              const rowForHover = (orderedByTicker[s.ticker] ?? []).find(
                (r) =>
                  Boolean(r.periodEnd) && formatChartingPeriodLabel(r.periodEnd, periodMode) === periodLabel,
              );
              const v = rowForHover ? rowValue(rowForHover, s.metricId) : null;
              rows.push({
                key: s.key,
                label: `${s.ticker} ${CHARTING_METRIC_LABEL[s.metricId]}`,
                value: formatChartingTableCell(CHARTING_METRIC_KIND[s.metricId], v),
                color: fundamentalsBarSolidAtIndex(s.colorIdx),
              });
            }

            let bandLeft = 0;
            let bandWidth = 0;
            const yRefSeries = seriesByKeyRef.current.values().next().value;
            const hoverVert = chartingHoverBandVerticalRangePx(
              yRefSeries,
              chartAxes.primary?.ticks ?? chartAxes.percent?.ticks,
            );
            const applyHoverBand = (x0: number, x1: number) => {
              hoverBandPrimitiveRef.current?.setBand(x0, x1, hoverVert?.y0 ?? null, hoverVert?.y1 ?? null);
            };

            if (chartType === "line") {
              hoverBandPrimitiveRef.current?.setBand(null, null);
            } else if (chartType === "bars" && baseTimeByLabel && focusPeriodIndex >= 0) {
              const columnBand = comparePeriodColumnBoundsPx(
                chart,
                focusPeriodIndex,
                tableColumnLabels,
                baseTimeByLabel,
                seriesDefs.length,
              );
              if (columnBand) {
                bandLeft = columnBand.x0;
                bandWidth = columnBand.x1 - columnBand.x0;
                applyHoverBand(columnBand.x0, columnBand.x1);
              } else {
                hoverBandPrimitiveRef.current?.setBand(null, null);
              }
            }

            const plotW = Math.max(1, el.clientWidth);
            const { anchorX, side } = computeFundamentalsChartTooltipPlacement(x, plotW);

            if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
            hoverRafRef.current = requestAnimationFrame(() => {
              setHover({
                anchorX,
                y: pointerY,
                side,
                periodLabel:
                  labelToSampleEnd.has(periodLabel) || tableColumnLabels.includes(periodLabel)
                    ? formatChartingPeriodLabel(labelToSampleEnd.get(periodLabel) ?? periodLabel, periodMode)
                    : periodLabel,
                rows,
                bandLeft,
                bandWidth,
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
              applyCompareSparseHistogramVisiblePadding(
                c,
                tableColumnLabels.length,
                chartType,
                timeRange,
              );
            } else {
              c.timeScale().fitContent();
            }
            requestAnimationFrame(syncChartOverlays);
          });
          resizeObserver.observe(el);
          chart.resize(el.clientWidth, chartPlotHeight);
          if (chartType === "bars") {
            layoutChartingTimeScale(chart, el.clientWidth, 0, barTimeScaleLayoutOptions);
            applyCompareSparseHistogramVisiblePadding(
              chart,
              tableColumnLabels.length,
              chartType,
              timeRange,
            );
          } else {
            chart.timeScale().fitContent();
          }
        });
      });
    };

    mountChart();

    return () => {
      cancelled = true;
      cancelBarEnterAnim?.();
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (chartRef.current) {
        if (onVisibleRangeChange) {
          chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
        }
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesByKeyRef.current = new Map();
      barSeriesPointsRef.current = new Map();
      hoveredBarPeriodRef.current = null;
      hoverBandPrimitiveRef.current?.setBand(null, null);
      hoverBandPrimitiveRef.current = null;
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      setHover(null);
      setPeriodAxisLabels([]);
      setYGridTickTopsPx(null);
      setYPercentGridTickTopsPx(null);
    };
  }, [
    loading,
    canPlot,
    orderedByTicker,
    seriesDefs,
    tickers,
    chartType,
    chartPlotHeight,
    groupedTimeToLabel,
    periodMode,
    timeRange,
    tableColumnLabels,
    barBaseTimeByLabel,
    lineBaseTimeByLabel,
    labelToSampleEnd,
    unitScale,
    chartAxes,
  ]);

  const empty =
    !loading && tickers.every((t) => !pointsByTicker[t] || (pointsByTicker[t]?.length ?? 0) === 0);
  const noMetricData = !loading && !empty && !canPlot;

  const atCompanyCap = tickers.length >= CHARTING_MAX_COMPARE_TICKERS;

  const openMetricPicker = useCallback(() => {
    setPickerOpen(true);
    setPickerQuery("");
  }, []);

  const openCompanyPicker = useCallback(() => {
    companyPickerControlsRef.current?.open();
  }, []);

  const railMetricRows = useMemo(
    () =>
      selected.map((id) => {
        const def = seriesDefs.find((s) => s.metricId === id);
        return {
          id,
          label: CHARTING_METRIC_LABEL[id],
          color: fundamentalsBarSolidAtIndex(def?.colorIdx ?? 0),
          removeDisabled: selected.length <= 1,
        };
      }),
    [selected, seriesDefs],
  );

  useRegisterChartingCompanyRail(
    {
      openMetricPicker,
      openCompanyPicker,
      metricAddDisabled: false,
      companyAddDisabled: selected.length === 0 || atCompanyCap,
      companies: useRailMetricPicker
        ? tickers.map((ticker) => ({
            ticker,
            removeDisabled: tickers.length <= 1,
          }))
        : undefined,
      metrics: useRailMetricPicker ? railMetricRows : undefined,
      onRemoveCompany: useRailMetricPicker ? removeTicker : undefined,
      onRemoveMetric: useRailMetricPicker ? removeMetric : undefined,
    },
    pathRoute === "/charting",
  );

  return (
    <>
      <DataFetchTopLoader active={loading} />
      <div className="space-y-4 pt-1">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="min-w-0 shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B] sm:flex-1">
            {workspaceTitle}
          </h2>
          {/* Web: keep controls on one line with range switcher (no stretch). */}
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
                onChange={setTimeRange}
                aria-label="Time range"
              />
            </div>
            <button
              type="button"
              onClick={() => router.replace(buildStandaloneChartPath(pathRoute, [], []), { scroll: false })}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
              aria-label="Clear companies and metrics"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

        {useRailMetricPicker ? (
          <div className="sr-only">
            <div ref={pickerWrapRef}>
              {pickerOpen ? (
                <TopbarDropdownPortal
                  open={pickerOpen}
                  anchorRef={metricAddAnchorRef}
                  ref={pickerMenuPortalRef}
                  align="trailing"
                  placement="below"
                  className="w-[min(calc(100vw-2rem),300px)]"
                  onRequestClose={() => {
                    setPickerOpen(false);
                    setPickerQuery("");
                  }}
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
                            {group.ids.map((mid) => (
                              <li key={mid}>
                                <button
                                  type="button"
                                  role="option"
                                  className={dropdownMenuRichItemClassName()}
                                  onClick={() => addMetric(mid)}
                                >
                                  {CHARTING_METRIC_LABEL[mid]}
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
            {selected.length > 0 ? (
              <ChartingCompanyAddDropdown
                hideTrigger
                anchorRef={companyAddAnchorRef}
                menuPortal
                menuAlign="trailing"
                registerOpenControl={(controls) => {
                  companyPickerControlsRef.current = controls;
                  return () => {
                    if (companyPickerControlsRef.current === controls) {
                      companyPickerControlsRef.current = null;
                    }
                  };
                }}
                onPickStock={addTickerFromPicker}
                disabled={atCompanyCap}
                maxExtraCompanies={Math.max(0, CHARTING_MAX_COMPARE_TICKERS - tickers.length)}
                excludeSymbols={tickers}
              />
            ) : null}
          </div>
        ) : (
        <div className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            {selected.map((id) => (
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
            ))}

            <div className="relative order-2" ref={pickerWrapRef}>
              <button
                ref={pickerButtonRef}
                type="button"
                onClick={() => {
                  setPickerOpen((o) => {
                    if (o) setPickerQuery("");
                    return !o;
                  });
                }}
                className={secondaryFillButtonClassName}
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
                  placement="auto"
                  className="w-[min(calc(100vw-2rem),300px)]"
                  onRequestClose={() => {
                    setPickerOpen(false);
                    setPickerQuery("");
                  }}
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
                            {group.ids.map((mid) => (
                              <li key={mid}>
                                <button
                                  type="button"
                                  role="option"
                                  className={dropdownMenuRichItemClassName()}
                                  onClick={() => addMetric(mid)}
                                >
                                  {CHARTING_METRIC_LABEL[mid]}
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

            {tickers.map((t) => {
              const chipLoading = pendingTickerChips.includes(t);
              return (
                <div
                  key={t}
                  className="order-3 inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white"
                >
                  <span className="flex min-h-[36px] min-w-0 items-center border-r border-[#E4E4E7] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B]">
                    <span className="truncate">{t}</span>
                  </span>
                  {chipLoading ? (
                    <span
                      className="flex w-9 shrink-0 items-center justify-center text-[#71717A]"
                      role="status"
                      aria-live="polite"
                      aria-label={`Loading ${t}`}
                    >
                      <Spinner className="size-5 text-[#71717A]" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeTicker(t)}
                      disabled={tickers.length <= 1}
                      className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA] disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`Remove ${t}`}
                    >
                      <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}

            {selected.length > 0 ? (
              <div className="order-4">
                <ChartingCompanyAddDropdown
                  onPickStock={addTickerFromPicker}
                  disabled={atCompanyCap}
                  maxExtraCompanies={Math.max(0, CHARTING_MAX_COMPARE_TICKERS - tickers.length)}
                  excludeSymbols={tickers}
                />
              </div>
            ) : null}
          </div>
        </div>
        )}
      </div>

      {loading ? (
        <ChartLoadingIndicator
          minHeightPx={chartHeight}
          className="min-h-[min(50vh,420px)]"
        />
      ) : empty ? (
        <p className="max-w-md text-[14px] leading-6 text-[#71717A]">
          Financial statement data isn&apos;t available for these symbols.
        </p>
      ) : (
        <>
          {noMetricData ? (
            <p className="max-w-md text-[14px] leading-6 text-[#71717A]">
              No series data for the selected metrics on these symbols.
            </p>
          ) : (
            <>
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
                    <div ref={wrapRef} className="relative z-[1] h-full w-full" />
                    {hover ? (
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
                        <div className="mt-1.5 max-h-[min(240px,40vh)] space-y-1 overflow-y-auto">
                          {hover.rows.map((r) => (
                            <div key={r.key} className="flex items-baseline justify-between gap-3">
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
                    spacedHorizontalPeriodAxis
                      ? "pt-2.5"
                      : periodMode === "annual"
                        ? "pt-1.5"
                        : "pt-0",
                  )}
                  style={{ height: axisRowPx }}
                >
                  <div className="relative min-h-0 min-w-0 flex-1 overflow-visible">
                    {periodAxisLabels.map((lab, i) => {
                      if (!fundamentalsPeriodAxisShowsLabel(i, periodAxisLabels.length, periodMode)) {
                        return null;
                      }
                      const axisLabelRotateDeg = horizontalPeriodAxisLabels
                        ? 0
                        : FUNDAMENTALS_CHART_AXIS_LABEL_ROTATE_DEG;
                      return (
                        <span
                          key={lab.key}
                          className={cn(
                            "absolute inline-block whitespace-nowrap font-['Inter'] text-[11px] font-normal tabular-nums leading-none text-[#71717A] sm:text-[12px]",
                            horizontalPeriodAxisLabels
                              ? spacedHorizontalPeriodAxis
                                ? "top-3"
                                : "top-1.5"
                              : "bottom-1",
                          )}
                          style={{
                            left: lab.leftPx,
                            transform: horizontalPeriodAxisLabels
                              ? "translateX(-50%)"
                              : `translateX(-50%) rotate(${axisLabelRotateDeg}deg)`,
                            transformOrigin: horizontalPeriodAxisLabels ? undefined : "center bottom",
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

              {!useRailMetricPicker ? (
              <div className="flex flex-wrap justify-center gap-2 px-0.5 pt-2">
                {seriesDefs.map((s) => (
                  <div
                    key={s.key}
                    className="inline-flex h-6 min-w-0 items-center gap-2 overflow-hidden rounded-[8px] border border-[#E4E4E7] bg-white px-2.5 py-0 text-[12px] font-medium leading-none text-[#09090B]"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: fundamentalsBarSolidAtIndex(s.colorIdx) }}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate leading-none">
                      {s.ticker} {CHARTING_METRIC_LABEL[s.metricId]}
                    </span>
                  </div>
                ))}
              </div>
              ) : null}

              <ChartingCompareCompanyTable
                tableColumnLabels={tableColumnLabels}
                seriesDefs={seriesDefs}
                orderedByTicker={orderedByTicker}
                periodMode={periodMode}
                timeRange={timeRange}
                className="pt-1"
              />
            </>
          )}
        </>
      )}
    </div>
    </>
  );
}
