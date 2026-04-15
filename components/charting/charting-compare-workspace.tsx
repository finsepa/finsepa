"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import type { ChartTimeRange, ChartType, ChartingUnitScale } from "@/components/charting/charting-workspace";
import { DataFetchTopLoader } from "@/components/layout/data-fetch-top-loader";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import {
  dropdownMenuRichItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import {
  CHARTING_DROPDOWN_GROUPS,
  CHARTING_MAX_COMPARE_TICKERS,
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_IDS,
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  type ChartingMetricKind,
  buildChartingPath,
  parseChartingMetricsParam,
} from "@/lib/market/stock-charting-metrics";
import {
  formatPercentMetric,
  formatRatio,
  formatSharesOutstanding,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";

const COMPARE_COLORS_SOLID = [
  "#2563EB",
  "#EA580C",
  "#16A34A",
  "#9333EA",
  "#0891B2",
  "#DC2626",
  "#CA8A04",
  "#7C3AED",
];

function compareBarColor(idx: number): string {
  const solid = COMPARE_COLORS_SOLID[idx % COMPARE_COLORS_SOLID.length];
  const m = solid.match(/^#([0-9a-f]{6})$/i);
  if (!m) return solid;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},0.58)`;
}

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

function seriesDataForTicker(
  points: ChartingSeriesPoint[],
  id: ChartingMetricId,
): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (const row of points) {
    const v = rowValue(row, id);
    if (v == null || !Number.isFinite(v)) continue;
    const t = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ time: Math.floor(t / 1000) as UTCTimestamp, value: v });
  }
  return out;
}

function formatPeriodLabel(periodEnd: string, periodMode: "annual" | "quarterly"): string {
  const s = periodEnd.trim();
  const year = s.slice(0, 4);
  if (periodMode === "annual") return year && /^\d{4}$/.test(year) ? year : s;
  const m = s.slice(5, 7);
  const mm = /^\d{2}$/.test(m) ? Number(m) : NaN;
  const q = Number.isFinite(mm) ? Math.min(4, Math.max(1, Math.floor((mm - 1) / 3) + 1)) : null;
  return year && q ? `Q${q} ${year}` : s;
}

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

const CHARTING_HEIGHT_MIN = 320;
const CHARTING_HEIGHT_MAX = 600;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type SeriesDef = { key: string; ticker: string; metricId: ChartingMetricId; colorIdx: number };

type HoverState = {
  x: number;
  time: UTCTimestamp;
  periodLabel: string;
  rows: Array<{ key: string; label: string; value: string }>;
} | null;

type Props = {
  tickers: string[];
  metricParam: string;
  initialByTicker: Record<string, StockPageInitialData>;
};

export function ChartingCompareWorkspace({ tickers, metricParam, initialByTicker }: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const [periodMode, setPeriodMode] = useState<"annual" | "quarterly">("annual");
  const [timeRange, setTimeRange] = useState<ChartTimeRange>("all");
  const [chartType, setChartType] = useState<ChartType>("bars");
  const unitScale: ChartingUnitScale = "billions";
  const [chartHeight, setChartHeight] = useState<number>(CHARTING_HEIGHT_MIN);

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

  const [pointsByTicker, setPointsByTicker] = useState<Record<string, ChartingSeriesPoint[] | null>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChartingMetricId[]>(() => parseChartingMetricsParam(metricParam));
  const [hover, setHover] = useState<HoverState>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const resizeDragRef = useRef<{ active: boolean; startY: number; startH: number } | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesByKeyRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(new Map());
  const hoverRafRef = useRef<number>(0);

  useEffect(() => {
    const parsed = parseChartingMetricsParam(metricParam);
    if (parsed.length) setSelected(parsed);
  }, [metricParam]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const allSeeded =
        tickers.length > 0 && tickers.every((t) => Array.isArray(seedByTicker[t]));

      if (allSeeded) {
        const next: Record<string, ChartingSeriesPoint[]> = {};
        for (const t of tickers) {
          const s = seedByTicker[t];
          next[t] = Array.isArray(s) ? s : [];
        }
        if (!cancelled) {
          setPointsByTicker(next);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const next: Record<string, ChartingSeriesPoint[]> = {};
      try {
        await Promise.all(
          tickers.map(async (t) => {
            const res = await fetch(
              `/api/stocks/${encodeURIComponent(t)}/fundamentals-series?period=${periodMode === "quarterly" ? "quarterly" : "annual"}`,
              { credentials: "include" },
            );
            if (!res.ok) {
              next[t] = [];
              return;
            }
            const json = (await res.json()) as { points?: ChartingSeriesPoint[] };
            next[t] = Array.isArray(json.points) ? json.points : [];
          }),
        );
        if (!cancelled) setPointsByTicker(next);
      } catch {
        if (!cancelled) {
          const empty: Record<string, ChartingSeriesPoint[]> = {};
          for (const t of tickers) empty[t] = [];
          setPointsByTicker(empty);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tickers, periodMode, seedByTicker]);

  const orderedByTicker = useMemo(() => {
    const o: Record<string, ChartingSeriesPoint[]> = {};
    for (const t of tickers) {
      const pts = pointsByTicker[t];
      o[t] = applyTimeRange(Array.isArray(pts) ? pts : [], periodMode, timeRange);
    }
    return o;
  }, [tickers, pointsByTicker, periodMode, timeRange]);

  /** One column per calendar period label — tickers can share the same FY (e.g. "2025") with different `periodEnd` dates. */
  const tableColumnLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const t of tickers) {
      for (const row of orderedByTicker[t] ?? []) {
        if (row.periodEnd) labels.add(formatPeriodLabel(row.periodEnd, periodMode));
      }
    }
    const arr = [...labels];
    if (periodMode === "annual") {
      arr.sort((a, b) => Number(a) - Number(b));
    } else {
      const labelToSampleEnd = new Map<string, string>();
      for (const t of tickers) {
        for (const row of orderedByTicker[t] ?? []) {
          if (!row.periodEnd) continue;
          const lab = formatPeriodLabel(row.periodEnd, periodMode);
          const cur = labelToSampleEnd.get(lab);
          if (!cur || row.periodEnd.localeCompare(cur) < 0) labelToSampleEnd.set(lab, row.periodEnd);
        }
      }
      arr.sort((a, b) => (labelToSampleEnd.get(a) ?? "").localeCompare(labelToSampleEnd.get(b) ?? ""));
    }
    return arr;
  }, [tickers, orderedByTicker, periodMode]);

  const timeToRowByTicker = useMemo(() => {
    const out = new Map<string, Map<number, ChartingSeriesPoint>>();
    for (const t of tickers) {
      const m = new Map<number, ChartingSeriesPoint>();
      for (const row of orderedByTicker[t] ?? []) {
        const ts = Date.parse(row.periodEnd.includes("T") ? row.periodEnd : `${row.periodEnd}T12:00:00.000Z`);
        if (Number.isFinite(ts)) m.set(Math.floor(ts / 1000), row);
      }
      out.set(t, m);
    }
    return out;
  }, [tickers, orderedByTicker]);

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

  const canPlot = useMemo(() => {
    return seriesDefs.some((s) => seriesDataForTicker(orderedByTicker[s.ticker] ?? [], s.metricId).length > 0);
  }, [seriesDefs, orderedByTicker]);

  const pushChartingUrl = useCallback(
    (nextTickers: string[], metrics: ChartingMetricId[]) => {
      router.replace(buildChartingPath(nextTickers, metrics), { scroll: false });
    },
    [router],
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

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (loading || !canPlot) return;

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

          const maxPts = Math.max(1, ...tickers.map((t) => (orderedByTicker[t] ?? []).length));
          const barSpacing =
            chartType === "bars"
              ? timeRange === "all"
                ? Math.max(4, Math.min(11, Math.floor(680 / maxPts)))
                : Math.max(4, 11 - Math.min(4, seriesDefs.length))
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
            rightPriceScale: { visible: false, borderVisible: false },
            leftPriceScale: { visible: false, borderVisible: false },
            timeScale: { borderVisible: false, rightOffset: 0, barSpacing },
            crosshair: { vertLine: { labelVisible: false }, horzLine: { labelVisible: true } },
          });

          chartRef.current = chart;
          seriesByKeyRef.current = new Map();
          const usedScales = new Set<string>();

          for (const s of seriesDefs) {
            const data = seriesDataForTicker(orderedByTicker[s.ticker] ?? [], s.metricId);
            if (!data.length) continue;
            const kind = CHARTING_METRIC_KIND[s.metricId];
            const scaleId = scaleIdForKind(kind);
            usedScales.add(scaleId);
            const solid = COMPARE_COLORS_SOLID[s.colorIdx % COMPARE_COLORS_SOLID.length];
            if (chartType === "bars") {
              const barColor = compareBarColor(s.colorIdx);
              const series = chart.addSeries(HistogramSeries, {
                color: barColor,
                priceScaleId: scaleId,
                priceFormat: priceFormatForKind(kind),
                title: `${s.ticker} ${CHARTING_METRIC_LABEL[s.metricId]}`,
              });
              series.setData(data.map((d) => ({ time: d.time, value: d.value, color: barColor })));
              seriesByKeyRef.current.set(s.key, series);
            } else {
              const series = chart.addSeries(LineSeries, {
                color: solid,
                lineWidth: 2,
                lineType: LineType.Curved,
                priceScaleId: scaleId,
                priceFormat: priceFormatForKind(kind),
                title: `${s.ticker} ${CHARTING_METRIC_LABEL[s.metricId]}`,
              });
              series.setData(data);
              seriesByKeyRef.current.set(s.key, series);
            }
          }

          const scaleOpts = { borderVisible: false, scaleMargins: { top: 0.07, bottom: 0.1 } };
          for (const sid of ["usd", "shares", "eps", "pct", "mult"]) {
            if (usedScales.has(sid)) chart.priceScale(sid).applyOptions({ visible: true, ...scaleOpts });
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

            let periodLabel = String(timeKey);
            for (const t of tickers) {
              const row = timeToRowByTicker.get(t)?.get(timeKey);
              if (row) {
                periodLabel = formatPeriodLabel(row.periodEnd, periodMode);
                break;
              }
            }

            const rows: Array<{ key: string; label: string; value: string }> = [];
            for (const s of seriesDefs) {
              const series = seriesByKeyRef.current.get(s.key);
              if (!series) continue;
              // Crosshair `time` matches one series' point; peers use different `periodEnd` timestamps
              // for the same FY label. Resolve values by period label, not `param.seriesData`.
              const rowForHover =
                periodLabel !== String(timeKey)
                  ? (orderedByTicker[s.ticker] ?? []).find(
                      (r) =>
                        Boolean(r.periodEnd) && formatPeriodLabel(r.periodEnd, periodMode) === periodLabel,
                    )
                  : timeToRowByTicker.get(s.ticker)?.get(timeKey);
              const v = rowForHover ? rowValue(rowForHover, s.metricId) : null;
              rows.push({
                key: s.key,
                label: `${s.ticker} ${CHARTING_METRIC_LABEL[s.metricId]}`,
                value: formatTableCell(CHARTING_METRIC_KIND[s.metricId], v),
              });
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
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesByKeyRef.current = new Map();
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      setHover(null);
    };
  }, [
    loading,
    canPlot,
    orderedByTicker,
    seriesDefs,
    tickers,
    chartType,
    chartHeight,
    timeToRowByTicker,
    periodMode,
    timeRange,
  ]);

  const empty =
    !loading && tickers.every((t) => !pointsByTicker[t] || (pointsByTicker[t]?.length ?? 0) === 0);
  const noMetricData = !loading && !empty && !canPlot;

  const atCompanyCap = tickers.length >= CHARTING_MAX_COMPARE_TICKERS;

  return (
    <>
      <DataFetchTopLoader active={loading} />
      <div className="space-y-4 pt-1">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="min-w-0 shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B] sm:flex-1">
            Charting
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
                onChange={setTimeRange}
                aria-label="Time range"
              />
            </div>
            <button
              type="button"
              onClick={() => router.replace(buildChartingPath([], []), { scroll: false })}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
              aria-label="Clear companies and metrics"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

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
                  </div>
                  {totalAddable === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-[#71717A]">
                      {qLower ? "No metrics match" : "No additional metrics for this range"}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {tickers.map((t) => (
              <div
                key={t}
                className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white"
              >
                <span className="flex min-h-[36px] min-w-0 items-center border-r border-[#E4E4E7] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B]">
                  <span className="truncate">{t}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeTicker(t)}
                  disabled={tickers.length <= 1}
                  className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA] disabled:pointer-events-none disabled:opacity-30"
                  aria-label={`Remove ${t}`}
                >
                  <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            ))}

            {selected.length > 0 ? (
              <ChartingCompanyAddDropdown
                onPickStock={addTickerFromPicker}
                disabled={atCompanyCap}
                maxExtraCompanies={Math.max(0, CHARTING_MAX_COMPARE_TICKERS - tickers.length)}
                excludeSymbols={tickers}
              />
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <ChartSkeleton heightPx={chartHeight} />
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
              <div className="relative w-full overflow-hidden rounded-xl bg-white">
                <div ref={wrapRef} className="w-full" style={{ height: chartHeight }} />
                {hover ? (
                  <>
                    <div
                      className="pointer-events-none absolute inset-y-0"
                      style={{
                        left: `${Math.max(0, hover.x - 24)}px`,
                        width: "48px",
                        background: "rgba(37, 99, 235, 0.12)",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute top-3 z-20 max-w-[min(calc(100vw-2rem),280px)] rounded-xl bg-[#09090B] px-3 py-2.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                      style={{
                        left: `${clamp(hover.x + 12, 12, Math.max(12, (wrapRef.current?.clientWidth ?? 0) - 292))}px`,
                      }}
                      role="tooltip"
                      aria-label="Chart tooltip"
                    >
                      <div className="text-[12px] font-semibold tracking-wide text-white/90">{hover.periodLabel}</div>
                      <div className="mt-2 max-h-[min(240px,40vh)] space-y-1 overflow-y-auto">
                        {hover.rows.map((r) => (
                          <div key={r.key} className="flex items-baseline justify-between gap-3">
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
                  className="absolute inset-x-0 bottom-0 h-3 cursor-ns-resize bg-transparent"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    resizeDragRef.current = { active: true, startY: e.clientY, startH: chartHeight };
                    try {
                      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                    } catch {
                      // ignore
                    }
                    e.preventDefault();
                  }}
                  onPointerMove={(e) => {
                    const st = resizeDragRef.current;
                    if (!st?.active) return;
                    const dy = e.clientY - st.startY;
                    setChartHeight(clamp(Math.round(st.startH + dy), CHARTING_HEIGHT_MIN, CHARTING_HEIGHT_MAX));
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

              <div className="flex flex-wrap gap-2 px-0.5 pt-2">
                {seriesDefs.map((s) => (
                  <div
                    key={s.key}
                    className="inline-flex items-center gap-2 rounded-full border border-[#E4E4E7] bg-white px-3 py-1.5 text-[13px] font-medium text-[#09090B]"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: COMPARE_COLORS_SOLID[s.colorIdx % COMPARE_COLORS_SOLID.length] }}
                      aria-hidden
                    />
                    <span>
                      {s.ticker} {CHARTING_METRIC_LABEL[s.metricId]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto pt-4">
                <table className="w-full min-w-[560px] border-collapse bg-white">
                  <thead>
                    <tr className="border-t border-b border-[#E4E4E7] bg-white">
                      <th className="min-w-[200px] px-3 py-2.5 text-left text-[14px] font-semibold leading-5 text-[#71717A]">
                        Data
                      </th>
                      {[...tableColumnLabels].reverse().map((label) => (
                        <th
                          key={label}
                          className="min-w-[100px] px-3 py-2.5 text-right text-[14px] font-semibold leading-5 text-[#71717A]"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {seriesDefs.map((s) => (
                      <tr
                        key={s.key}
                        className="h-[52px] border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50"
                      >
                        <td className="px-3 align-middle">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-8 w-1 shrink-0 rounded-sm"
                              style={{
                                background: COMPARE_COLORS_SOLID[s.colorIdx % COMPARE_COLORS_SOLID.length],
                              }}
                              aria-hidden
                            />
                            <span className="text-[14px] font-medium leading-5 text-[#09090B]">
                              {s.ticker} {CHARTING_METRIC_LABEL[s.metricId]}
                            </span>
                          </div>
                        </td>
                        {[...tableColumnLabels].reverse().map((label) => {
                          const row = (orderedByTicker[s.ticker] ?? []).find(
                            (r) =>
                              Boolean(r.periodEnd) && formatPeriodLabel(r.periodEnd, periodMode) === label,
                          );
                          const v = row ? rowValue(row, s.metricId) : null;
                          return (
                            <td
                              key={label}
                              className="px-3 align-middle text-right text-[14px] font-normal leading-5 tabular-nums text-[#09090B]"
                            >
                              {formatTableCell(CHARTING_METRIC_KIND[s.metricId], v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
    </>
  );
}
