"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, X } from "lucide-react";
import {
  ColorType,
  HistogramSeries,
  LineSeries,
  LineType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";

import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
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
  formatPercentMetric,
  formatRatio,
  formatSharesOutstanding,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";
import { DataFetchTopLoader } from "@/components/layout/data-fetch-top-loader";
import { TransactionPortfolioField } from "@/components/portfolio/transaction-portfolio-field";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import {
  dropdownMenuRichItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

/** Figma Charting reference — primary series colors (grouped bars / lines). */
const METRIC_CHART_COLOR: Partial<Record<ChartingMetricId, string>> = {
  revenue: "#2563EB",
  net_income: "#EA580C",
};

/** Stable hue per metric id (deterministic, not random per render). */
function metricColor(id: ChartingMetricId): string {
  const branded = METRIC_CHART_COLOR[id];
  if (branded) return branded;
  const i = CHARTING_METRIC_IDS.indexOf(id);
  const h = ((i < 0 ? 0 : i) * 47) % 360;
  return `hsl(${h} 52% 42%)`;
}

/** Histogram columns share one x-slot in LW; transparency lets both series read when values differ. */
function metricBarDisplayColor(id: ChartingMetricId): string {
  const solid = metricColor(id);
  const m = solid.match(/^#([0-9a-f]{6})$/i);
  if (!m) return withAlpha(solid, 0.58);
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},0.58)`;
}

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

function withAlpha(cssColor: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const m = cssColor.match(/^hsl\((\d+)\s+(\d+)%\s+(\d+)%\)$/i);
  if (!m) return cssColor;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  return `hsla(${h} ${s}% ${l}% / ${a})`;
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

function formatTableCell(kind: ChartingMetricKind, v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (kind) {
    case "usd":
      return formatUsdCompact(v);
    case "eps":
      return formatUsdPrice(v);
    case "shares":
      return formatSharesOutstanding(v);
    case "percent":
      return formatPercentMetric(v);
    case "multiple":
    case "ratio":
      return formatRatio(v);
    default:
      return formatUsdCompact(v);
  }
}

export type ChartTimeRange = "1Y" | "2Y" | "3Y" | "5Y" | "10Y" | "all";
export type ChartType = "line" | "bars";

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

function seriesData(
  points: ChartingSeriesPoint[],
  id: ChartingMetricId,
  shiftSeconds = 0,
): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (const row of points) {
    const v = rowValue(row, id);
    if (v == null || !Number.isFinite(v)) continue;
    const t = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ time: (Math.floor(t / 1000) + shiftSeconds) as UTCTimestamp, value: v });
  }
  return out;
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
  /** Full-page Charting only: company chip row (rendered after metric chips + + Metric). */
  fullPageCompanyChipSlot?: ReactNode;
  /** Full-page Charting only: + Company (shown when ≥1 metric selected). */
  fullPageCompanyAddSlot?: ReactNode;
  pathRoute?: StandaloneChartRoute;
  workspaceTitle?: string;
};

const TIME_RANGE_ORDER: ChartTimeRange[] = ["1Y", "2Y", "3Y", "5Y", "10Y", "all"];

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

const CHART_TYPE_TAB_OPTIONS = [
  { value: "line" as const, label: "Line" },
  { value: "bars" as const, label: "Bars" },
] as const satisfies readonly TabSwitcherOption<ChartType>[];

function timeRangeTabOptionsFor(order: ChartTimeRange[]): TabSwitcherOption<ChartTimeRange>[] {
  return order.map((r) => ({ value: r, label: TIME_RANGE_LABELS[r] }));
}

const TIME_RANGE_TAB_OPTIONS: TabSwitcherOption<ChartTimeRange>[] = timeRangeTabOptionsFor(TIME_RANGE_ORDER);

const CHARTING_HEIGHT_STORAGE_KEY = "finsepa:chartingHeightPx";
const CHARTING_HEIGHT_MIN = 320;
const CHARTING_HEIGHT_MAX = 600;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatPeriodLabel(periodEnd: string, periodMode: "annual" | "quarterly"): string {
  const s = periodEnd.trim();
  // Expected: YYYY-MM-DD
  const year = s.slice(0, 4);
  if (periodMode === "annual") return year && /^\d{4}$/.test(year) ? year : s;
  const m = s.slice(5, 7);
  const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
  const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
  return year && q ? `Q${q} ${year}` : s;
}

type HoverState = {
  x: number;
  time: UTCTimestamp;
  periodLabel: string;
  rows: Array<{ id: ChartingMetricId; label: string; value: string }>;
} | null;

const GROUPED_BAR_SHIFT_SEC = 24 * 60 * 60;

function groupedBarShiftSeconds(id: ChartingMetricId, ids: ChartingMetricId[]): number {
  if (ids.length <= 1) return 0;
  const idx = ids.indexOf(id);
  if (idx < 0) return 0;
  // Center the group around the original period end timestamp.
  const center = (ids.length - 1) / 2;
  return Math.round((idx - center) * GROUPED_BAR_SHIFT_SEC);
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
  pathRoute = "/charting",
  workspaceTitle = "Charting",
}: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const isFigmaToolbar = toolbarLayout === "figma70857";

  const [periodMode, setPeriodMode] = useState<"annual" | "quarterly">("annual");
  const [timeRange, setTimeRange] = useState<ChartTimeRange>("all");
  const [chartType, setChartType] = useState<ChartType>("bars");
  const unitScale: ChartingUnitScale = isFigmaToolbar ? "billions" : "auto";
  const [chartHeight, setChartHeight] = useState<number>(CHARTING_HEIGHT_MIN);
  const seedPoints = useMemo(() => {
    if (periodMode === "quarterly") return Array.isArray(initialQuarterlyPoints) ? initialQuarterlyPoints : null;
    return Array.isArray(initialAnnualPoints) ? initialAnnualPoints : null;
  }, [periodMode, initialAnnualPoints, initialQuarterlyPoints]);

  const [points, setPoints] = useState<ChartingSeriesPoint[] | null>(seedPoints);
  const [loading, setLoading] = useState(seedPoints == null);
  const [selected, setSelected] = useState<ChartingMetricId[]>(CHARTING_DEFAULT_METRICS);
  const [hover, setHover] = useState<HoverState>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const resizeDragRef = useRef<{
    active: boolean;
    startY: number;
    startH: number;
  } | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesByMetricRef = useRef<Map<ChartingMetricId, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(new Map());
  const hoverRafRef = useRef<number>(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHARTING_HEIGHT_STORAGE_KEY);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n)) setChartHeight(clamp(Math.round(n), CHARTING_HEIGHT_MIN, CHARTING_HEIGHT_MAX));
      else setChartHeight(CHARTING_HEIGHT_MIN);
    } catch {
      setChartHeight(CHARTING_HEIGHT_MIN);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHARTING_HEIGHT_STORAGE_KEY, String(chartHeight));
    } catch {
      // ignore
    }
  }, [chartHeight]);

  useEffect(() => {
    const parsed = parseChartingMetricsParam(metricParam);
    if (fullPageCompanyChipSlot) {
      if (parsed.length) setSelected(parsed);
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
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=${periodMode === "quarterly" ? "quarterly" : "annual"}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled) setPoints(null);
          return;
        }
        const json = (await res.json()) as { points?: ChartingSeriesPoint[] };
        if (!cancelled) setPoints(Array.isArray(json.points) ? json.points : []);
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
    pickerInputRef.current?.focus();
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = pickerWrapRef.current;
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return;
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

  const timeToRow = useMemo(() => {
    const m = new Map<number, ChartingSeriesPoint>();
    for (const row of ordered) {
      const t = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
      if (!Number.isFinite(t)) continue;
      m.set(Math.floor(t / 1000), row);
    }
    return m;
  }, [ordered]);

  // Grouped-bar mode: map each shifted bar time back to its original period row so tooltips work.
  const groupedTimeToRow = useMemo(() => {
    if (chartType !== "bars" || selected.length <= 1) return timeToRow;
    const ids = barMetricOrder(selected);
    const m = new Map<number, ChartingSeriesPoint>();
    for (const row of ordered) {
      const t = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
      if (!Number.isFinite(t)) continue;
      const base = Math.floor(t / 1000);
      for (const id of ids) {
        m.set(base + groupedBarShiftSeconds(id, ids), row);
      }
    }
    return m;
  }, [chartType, selected, ordered, timeToRow]);

  const groupedTickLabelByTime = useMemo(() => {
    if (chartType !== "bars" || selected.length <= 1) return null;
    const ids = barMetricOrder(selected);
    const centerId = ids[Math.floor((ids.length - 1) / 2)] ?? ids[0];
    const m = new Map<number, string>();
    for (const row of ordered) {
      const t = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
      if (!Number.isFinite(t)) continue;
      const base = Math.floor(t / 1000);
      m.set(base + groupedBarShiftSeconds(centerId, ids), formatPeriodLabel(row.periodEnd, periodMode));
    }
    return m;
  }, [chartType, selected, ordered, periodMode]);

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

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (!ordered.length || !selected.length || !canPlot) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

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
          const barSpacing =
            chartType === "bars"
              ? timeRange === "all"
                ? Math.max(5, Math.min(11, Math.floor(680 / Math.max(1, nPoints))))
                : 11
              : 9;

          const chart = createChart(el, {
            width: el.clientWidth,
            height: chartHeight,
            autoSize: false,
            layout: {
              background: { type: ColorType.Solid, color: "#FFFFFF" },
              textColor: "#71717A",
              fontSize: 12,
              fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              attributionLogo: false,
            },
            localization: {
              locale: "en-US",
              priceFormatter: (p: number) => formatAxisForUnit(p, unitScale),
            },
            grid: {
              vertLines: { visible: false },
              horzLines: { color: "#E4E4E7" },
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
              borderVisible: false,
              rightOffset: 0,
              barSpacing,
              tickMarkFormatter: (time: UTCTimestamp) => {
                if (!groupedTickLabelByTime) return "";
                const t = typeof time === "number" && Number.isFinite(time) ? time : null;
                if (t == null) return "";
                return groupedTickLabelByTime.get(t) ?? "";
              },
            },
            crosshair: { vertLine: { labelVisible: false }, horzLine: { labelVisible: true } },
          });

          chartRef.current = chart;
          seriesByMetricRef.current = new Map();

          const usedScales = new Set<string>();

          const seriesOrder = chartType === "bars" ? barMetricOrder(selected) : selected;
          for (const id of seriesOrder) {
            const shiftSec =
              chartType === "bars" && selected.length > 1 ? groupedBarShiftSeconds(id, seriesOrder) : 0;
            const data = seriesData(ordered, id, shiftSec);
            if (!data.length) continue;
            const kind = CHARTING_METRIC_KIND[id];
            const scaleId = scaleIdForKind(kind);
            usedScales.add(scaleId);
            if (chartType === "bars") {
              const barColor = metricBarDisplayColor(id);
              const s = chart.addSeries(HistogramSeries, {
                color: barColor,
                priceScaleId: scaleId,
                priceFormat: priceFormatForKind(kind),
                title: CHARTING_METRIC_LABEL[id],
              });
              s.setData(
                data.map((d) => ({
                  time: d.time,
                  value: d.value,
                  color: barColor,
                })),
              );
              seriesByMetricRef.current.set(id, s);
            } else {
              const s = chart.addSeries(LineSeries, {
                color: metricColor(id),
                lineWidth: 2,
                lineType: LineType.Curved,
                priceScaleId: scaleId,
                priceFormat: priceFormatForKind(kind),
                title: CHARTING_METRIC_LABEL[id],
              });
              s.setData(data);
              seriesByMetricRef.current.set(id, s);
            }
          }

          const scaleOpts = {
            borderVisible: false,
            scaleMargins: { top: 0.07, bottom: 0.1 },
          };
          for (const sid of ["usd", "shares", "eps", "pct", "mult"]) {
            if (usedScales.has(sid)) {
              chart.priceScale(sid).applyOptions({ visible: true, ...scaleOpts });
            }
          }

          chart.timeScale().fitContent();

          const onCrosshairMove = (param: MouseEventParams) => {
            if (!param.point || param.point.x < 0 || param.time === undefined) {
              if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
              hoverRafRef.current = requestAnimationFrame(() => setHover(null));
              return;
            }

            const x = param.point.x;
            const rawTime = param.time as UTCTimestamp;
            const timeKey = typeof rawTime === "number" && Number.isFinite(rawTime) ? rawTime : null;
            if (timeKey == null) {
              if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
              hoverRafRef.current = requestAnimationFrame(() => setHover(null));
              return;
            }

            const row = groupedTimeToRow.get(timeKey);
            const periodLabel = row ? formatPeriodLabel(row.periodEnd, periodMode) : String(timeKey);

            const rows: Array<{ id: ChartingMetricId; label: string; value: string }> = [];
            for (const id of selected) {
              const series = seriesByMetricRef.current.get(id);
              if (!series) continue;
              const rawPoint = param.seriesData.get(series);
              const v =
                rawPoint &&
                typeof rawPoint === "object" &&
                rawPoint !== null &&
                "value" in rawPoint &&
                typeof (rawPoint as { value: unknown }).value === "number"
                  ? (rawPoint as { value: number }).value
                  : null;
              rows.push({ id, label: CHARTING_METRIC_LABEL[id], value: formatTableCell(CHARTING_METRIC_KIND[id], v) });
            }

            if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
            hoverRafRef.current = requestAnimationFrame(() => {
              setHover({ x, time: timeKey, periodLabel, rows });
            });
          };

          chart.subscribeCrosshairMove(onCrosshairMove);

          resizeObserver = new ResizeObserver(() => {
            const rw = el.clientWidth;
            if (rw > 0 && chartRef.current) chartRef.current.resize(rw, chartHeight);
          });
          resizeObserver.observe(el);
          chart.resize(el.clientWidth, chartHeight);
        });
      });
    };

    mountChart();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesByMetricRef.current = new Map();
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      setHover(null);
    };
  }, [ordered, selected, canPlot, chartType, chartHeight, timeToRow, periodMode, timeRange, unitScale]);

  const empty = !loading && (!points || points.length === 0);
  const noMetricData = !loading && !empty && !canPlot;

  return (
    <>
      <DataFetchTopLoader active={loading} />
      <div className="space-y-4 pt-1">
      {isFigmaToolbar ? (
        <div className="w-full max-w-[min(100%,320px)]">
          <TransactionPortfolioField variant="field" />
        </div>
      ) : null}
      {/* Toolbar: Figma 8479:44846 — 24px title, 12px gaps, segmented controls */}
      <div className="flex flex-col gap-6">
        {/* Figma 8479:70857 — title row: period, line/bars, range, refresh */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="min-w-0 shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B] sm:flex-1">
            {workspaceTitle}
          </h2>
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end">
            <TabSwitcher
              options={PERIOD_TAB_OPTIONS}
              value={periodMode}
              onChange={setPeriodMode}
              aria-label="Reporting period"
            />
            <TabSwitcher
              options={CHART_TYPE_TAB_OPTIONS}
              value={chartType}
              onChange={setChartType}
              aria-label="Chart type"
            />
            <div className="max-w-full overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
              <TabSwitcher
                className="inline-flex w-max min-w-0 flex-nowrap"
                options={TIME_RANGE_TAB_OPTIONS}
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

        {/* Metric chips first, then full-page company row (+ Company after ≥1 metric). */}
        <div className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
          {selected.map((id) => (
            <div
              key={id}
              className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white"
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

          <div className="relative" ref={pickerWrapRef}>
            <button
              type="button"
              onClick={() => {
                setPickerOpen((o) => {
                  if (o) setPickerQuery("");
                  return !o;
                });
              }}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#F4F4F5] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B] transition-colors hover:bg-[#EBEBEB]"
            >
              <Plus className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              Metric
            </button>
          {pickerOpen && (
            <div
              className={cn(
                dropdownMenuSurfaceClassName(),
                "absolute left-0 top-full z-[210] mt-1 w-[min(calc(100vw-2rem),300px)] overflow-hidden",
              )}
              role="listbox"
            >
              <div className="border-b border-[#F4F4F5] px-2 pb-1 pt-1">
                <input
                  ref={pickerInputRef}
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search metrics…"
                  className="w-full rounded-md border-0 bg-[#FAFAFA] px-2 py-1.5 text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] outline-none ring-1 ring-transparent focus:ring-[#E4E4E7]"
                  aria-label="Search metrics"
                />
              </div>
              <div className="flex max-h-[min(400px,calc(100vh-12rem))] flex-col gap-1 overflow-y-auto px-1 py-2">
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
              </div>
              {totalAddable === 0 ? (
                <p className="px-3 py-2 text-[12px] text-[#71717A]">
                  {qLower ? "No metrics match" : "No additional metrics for this range"}
                </p>
              ) : null}
            </div>
          )}
          </div>
          {fullPageCompanyChipSlot}
          {selected.length > 0 ? fullPageCompanyAddSlot : null}
          </div>
        </div>
      </div>

      {loading ? (
        <ChartSkeleton heightPx={chartHeight} />
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
            <div className="relative w-full overflow-hidden rounded-xl bg-white">
              <div ref={wrapRef} className="w-full" style={{ height: chartHeight }} />
              {hover ? (
                <>
                  {/* Hover band — light blue column (Figma Charting reference) */}
                  <div
                    className="pointer-events-none absolute inset-y-0"
                    style={{
                      left: `${Math.max(0, hover.x - 24)}px`,
                      width: "48px",
                      background: "rgba(37, 99, 235, 0.12)",
                    }}
                  />
                  {/* Tooltip */}
                  <div
                    className="pointer-events-none absolute top-3 z-20 w-[240px] rounded-xl bg-[#09090B] px-3 py-2.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                    style={{
                      left: `${clamp(hover.x + 12, 12, Math.max(12, (wrapRef.current?.clientWidth ?? 0) - 252))}px`,
                    }}
                    role="tooltip"
                    aria-label="Chart tooltip"
                  >
                    <div className="text-[12px] font-semibold tracking-wide text-white/90">{hover.periodLabel}</div>
                    <div className="mt-2 space-y-1">
                      {hover.rows.map((r) => (
                        <div key={r.id} className="flex items-baseline justify-between gap-3">
                          <span className="text-[12px] text-white/70">{r.label}</span>
                          <span className="text-[12px] font-semibold tabular-nums text-white">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
              <div
                role="separator"
                aria-label="Resize chart"
                aria-orientation="vertical"
                className="absolute inset-x-0 bottom-0 h-3 cursor-ns-resize bg-transparent"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  const start = { active: true, startY: e.clientY, startH: chartHeight };
                  resizeDragRef.current = start;
                  try {
                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                  e.preventDefault();
                }}
                onPointerMove={(e) => {
                  const st = resizeDragRef.current;
                  if (!st || !st.active) return;
                  const dy = e.clientY - st.startY;
                  const next = clamp(Math.round(st.startH + dy), CHARTING_HEIGHT_MIN, CHARTING_HEIGHT_MAX);
                  setChartHeight(next);
                }}
                onPointerUp={(e) => {
                  const st = resizeDragRef.current;
                  if (st) st.active = false;
                  try {
                    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                }}
              >
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded bg-[#E4E4E7]/80" />
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            {/* Table — Figma 8479:44939: header #71717A semibold; body #09090B regular; strokes #E4E4E7. Row hover/height aligned with screener tables. */}
            <table className="w-full min-w-[560px] border-collapse bg-white [&_tbody_td:first-child]:text-left [&_tbody_td:not(:first-child)]:text-right [&_thead_th:first-child]:text-left [&_thead_th:not(:first-child)]:text-right">
              <thead>
                <tr className="border-t border-b border-[#E4E4E7] bg-white">
                  <th
                    scope="col"
                    className="min-w-[160px] px-3 py-2.5 text-left align-middle text-[14px] font-semibold leading-5 text-[#71717A]"
                  >
                    Period
                  </th>
                  {selected.map((id) => (
                    <th
                      key={id}
                      scope="col"
                      className="min-w-[96px] px-3 py-2.5 text-right align-middle text-[14px] font-semibold leading-5 tabular-nums text-[#71717A]"
                    >
                      {CHARTING_METRIC_LABEL[id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ordered].reverse().map((row) => (
                  <tr
                    key={row.periodEnd}
                    className="h-[60px] max-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50"
                  >
                    <td className="whitespace-nowrap px-3 align-middle text-left text-[14px] font-normal leading-5 text-[#09090B]">
                      {row.periodEnd}
                    </td>
                    {selected.map((id) => (
                      <td
                        key={id}
                        className="min-w-[96px] px-3 align-middle text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]"
                      >
                        {formatTableCell(CHARTING_METRIC_KIND[id], rowValue(row, id))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
    </>
  );
}
