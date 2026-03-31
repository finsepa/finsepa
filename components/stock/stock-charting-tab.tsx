"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  CHARTING_DROPDOWN_GROUPS,
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_IDS,
  CHARTING_METRIC_KIND,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  type ChartingMetricKind,
  parseChartingMetricParam,
} from "@/lib/market/stock-charting-metrics";
import {
  formatPercentMetric,
  formatRatio,
  formatSharesOutstanding,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";

const DEFAULT_METRICS: ChartingMetricId[] = ["revenue", "net_income"];

/** Stable hue per metric id (deterministic, not random per render). */
function metricColor(id: ChartingMetricId): string {
  const i = CHARTING_METRIC_IDS.indexOf(id);
  const h = ((i < 0 ? 0 : i) * 47) % 360;
  return `hsl(${h} 52% 42%)`;
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

type Props = {
  ticker: string;
  metricParam: string | null;
};

const TIME_RANGE_ORDER: ChartTimeRange[] = ["1Y", "2Y", "3Y", "5Y", "10Y", "all"];

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

export function StockChartingTab({ ticker, metricParam }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const [periodMode, setPeriodMode] = useState<"annual" | "quarterly">("annual");
  const [timeRange, setTimeRange] = useState<ChartTimeRange>("all");
  const [chartType, setChartType] = useState<ChartType>("bars");
  const [chartHeight, setChartHeight] = useState<number>(CHARTING_HEIGHT_MIN);
  const [points, setPoints] = useState<ChartingSeriesPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChartingMetricId[]>(DEFAULT_METRICS);
  const [hover, setHover] = useState<HoverState>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const resizeDragRef = useRef<{
    active: boolean;
    startY: number;
    startH: number;
  } | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesByMetricRef = useRef<Map<ChartingMetricId, ISeriesApi<any>>>(new Map());
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
    const m = parseChartingMetricParam(metricParam);
    if (m) setSelected([m]);
    else setSelected([...DEFAULT_METRICS]);
  }, [metricParam]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=${periodMode === "quarterly" ? "quarterly" : "annual"}`,
          { cache: "no-store", credentials: "include" },
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
  }, [ticker, periodMode]);

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

  /** Metrics that have ≥1 plotted point in the current time range (for add + pruning selection). */
  const availableInRange = useMemo(() => {
    return CHARTING_METRIC_IDS.filter((id) => seriesData(ordered, id).length > 0);
  }, [ordered]);

  useEffect(() => {
    if (loading || !ordered.length) return;
    setSelected((prev) => {
      const next = prev.filter((id) => seriesData(ordered, id).length > 0);
      if (next.length === prev.length && next.length > 0) return prev;
      if (next.length >= 1) return next;
      const m = parseChartingMetricParam(metricParam);
      if (m && seriesData(ordered, m).length > 0) return [m];
      for (const id of DEFAULT_METRICS) {
        if (seriesData(ordered, id).length > 0) return [id];
      }
      const first = CHARTING_METRIC_IDS.find((id) => seriesData(ordered, id).length > 0);
      return first ? [first] : [];
    });
  }, [loading, ordered, metricParam]);

  const removeMetric = useCallback((id: ChartingMetricId) => {
    setSelected((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((x) => x !== id);
    });
  }, []);

  const addMetric = useCallback((id: ChartingMetricId) => {
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPickerOpen(false);
    setPickerQuery("");
  }, []);

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

    const chart = createChart(el, {
      width: el.clientWidth,
      height: chartHeight,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: "#00000000" },
        textColor: "#A1A1AA",
        fontSize: 11,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(228, 228, 231, 0.85)" },
      },
      rightPriceScale: {
        visible: false,
        borderVisible: false,
      },
      leftPriceScale: {
        visible: false,
        borderVisible: false,
      },
      timeScale: { borderVisible: false, rightOffset: 0, barSpacing: chartType === "bars" ? 11 : 9 },
      crosshair: { vertLine: { labelVisible: false }, horzLine: { labelVisible: true } },
    });

    chartRef.current = chart;
    seriesByMetricRef.current = new Map();

    const usedScales = new Set<string>();

    for (const id of selected) {
      const data = seriesData(ordered, id);
      if (!data.length) continue;
      const kind = CHARTING_METRIC_KIND[id];
      const scaleId = scaleIdForKind(kind);
      usedScales.add(scaleId);
      if (chartType === "bars") {
        const barColor = withAlpha(metricColor(id), 0.55);
        const s = chart.addSeries(HistogramSeries, {
          color: barColor,
          priceScaleId: scaleId,
          priceFormat: priceFormatForKind(kind),
          title: CHARTING_METRIC_LABEL[id],
          // Overlay bars for multiple metrics; transparency helps readability.
          // lightweight-charts does not support true grouped bars per timestamp.
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

      const row = timeToRow.get(timeKey);
      const periodLabel = row ? formatPeriodLabel(row.periodEnd, periodMode) : String(timeKey);

      const rows: Array<{ id: ChartingMetricId; label: string; value: string }> = [];
      for (const id of selected) {
        const series = seriesByMetricRef.current.get(id);
        if (!series) continue;
        const d = param.seriesData.get(series as any) as any;
        const v = d && typeof d === "object" && "value" in d && typeof d.value === "number" ? (d.value as number) : null;
        rows.push({ id, label: CHARTING_METRIC_LABEL[id], value: formatTableCell(CHARTING_METRIC_KIND[id], v) });
      }

      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = requestAnimationFrame(() => {
        setHover({ x, time: timeKey, periodLabel, rows });
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) chart.resize(w, chartHeight);
    });
    ro.observe(el);
    chart.resize(el.clientWidth, chartHeight);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      chartRef.current = null;
      seriesByMetricRef.current = new Map();
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      setHover(null);
    };
  }, [ordered, selected, canPlot, chartType, chartHeight, timeToRow, periodMode]);

  const empty = !loading && (!points || points.length === 0);
  const noMetricData = !loading && !empty && !canPlot;

  return (
    <div className="space-y-4 pt-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#09090B]">Charting</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#E4E4E7] bg-white p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setPeriodMode("annual")}
              className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                periodMode === "annual" ? "bg-[#09090B] text-white" : "text-[#71717A] hover:text-[#09090B]"
              }`}
            >
              Annual
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("quarterly")}
              className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                periodMode === "quarterly" ? "bg-[#09090B] text-white" : "text-[#71717A] hover:text-[#09090B]"
              }`}
            >
              Quarterly
            </button>
          </div>
          <div className="flex rounded-lg border border-[#E4E4E7] bg-white p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setChartType("line")}
              className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                chartType === "line" ? "bg-[#F4F4F5] text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"
              }`}
            >
              Line
            </button>
            <button
              type="button"
              onClick={() => setChartType("bars")}
              className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                chartType === "bars" ? "bg-[#F4F4F5] text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"
              }`}
            >
              Bars
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#E4E4E7] bg-white p-0.5 text-[12px]">
            {TIME_RANGE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`rounded-md px-2 py-1.5 font-medium transition-colors ${
                  timeRange === r ? "bg-[#F4F4F5] text-[#09090B]" : "text-[#71717A] hover:text-[#09090B]"
                }`}
              >
                {TIME_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selected.map((id) => (
          <div
            key={id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#E4E4E7] bg-[#FAFAFA] pl-2.5 pr-1 text-[12px] font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
          >
            <span className="truncate">{CHARTING_METRIC_LABEL[id]}</span>
            <button
              type="button"
              onClick={() => removeMetric(id)}
              disabled={selected.length <= 1}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#A1A1AA] transition-colors hover:bg-[#E4E4E7]/80 hover:text-[#52525B] disabled:pointer-events-none disabled:opacity-30"
              aria-label={`Remove ${CHARTING_METRIC_LABEL[id]}`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="opacity-80">
                <path
                  d="M1.5 1.5l7 7M8.5 1.5l-7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
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
            className="inline-flex items-center rounded-full border border-dashed border-[#D4D4D8] bg-white px-2.5 py-1 text-[12px] font-medium text-[#71717A] transition-colors hover:border-[#C4C4C8] hover:bg-[#FAFAFA] hover:text-[#09090B]"
          >
            + Metric
          </button>
          {pickerOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-1 w-[min(calc(100vw-2rem),300px)] rounded-lg border border-[#E4E4E7] bg-white py-1 shadow-md"
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
              <div className="max-h-[min(400px,calc(100vh-12rem))] overflow-y-auto py-1">
                {groupedAddable.map((group) => (
                  <div key={group.id} className="pb-2 last:pb-0">
                    <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                      {group.label}
                    </div>
                    <ul>
                      {group.ids.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            role="option"
                            className="w-full px-3 py-1.5 text-left text-[13px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
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
      </div>

      {loading ? (
        <div className="h-[320px] rounded-xl border border-[#E4E4E7] bg-neutral-50 animate-pulse" aria-hidden />
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
            <div className="relative w-full overflow-hidden rounded-xl bg-transparent">
              <div ref={wrapRef} className="w-full" style={{ height: chartHeight }} />
              {hover ? (
                <>
                  {/* Hover band */}
                  <div
                    className="pointer-events-none absolute inset-y-0"
                    style={{
                      left: `${Math.max(0, hover.x - 24)}px`,
                      width: "48px",
                      background: "rgba(9, 9, 11, 0.04)",
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
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-t border-b border-[#E4E4E7] bg-white">
                  <th className="px-4 py-3 text-left text-[14px] font-semibold leading-5 text-[#71717A]">
                    Period
                  </th>
                  {selected.map((id) => (
                    <th
                      key={id}
                      className="px-4 py-3 text-right text-[14px] font-semibold leading-5 text-[#71717A]"
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
                    className="border-b border-[#E4E4E7] transition-colors duration-75 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3 text-[14px] leading-5 tabular-nums text-[#09090B]">
                      {row.periodEnd}
                    </td>
                    {selected.map((id) => (
                      <td
                        key={id}
                        className="px-4 py-3 text-right text-[14px] leading-5 tabular-nums text-[#09090B]"
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
  );
}
