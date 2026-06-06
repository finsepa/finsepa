"use client";

import { GripVertical, Maximize2, Plus, Search, Trash2, TrendingDown, TrendingUp } from "@/lib/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MultichartFundamentalsBar,
  MULTICHART_BAR_WIDTH_ALL_QUARTERLY_PX,
  MULTICHART_MAX_ANNUAL_BARS,
  MULTICHART_MAX_QUARTERLY_BARS,
  readChartingMetricValue,
  sliceLastAnnualWithMetric,
  type MultichartVisual,
} from "@/components/stock/multichart-fundamentals-bar";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  CHARTING_DROPDOWN_GROUPS,
  CHARTING_METRIC_IDS,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import {
  formatMultichartHeadlineValue,
  multichartComparisonFromLastTwo,
  multichartPriorPeriodComparisonLabel,
} from "@/lib/market/multichart-period-comparison";
import { MultichartsTabSkeletonGrid } from "@/components/stock/stock-multicharts-tab-skeleton";
import {
  dropdownMenuFloatingScrollClassName,
  dropdownMenuPanelBodyClassName,
  dropdownMenuSearchHeaderClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  EARNINGS_CARD_LABEL_CLASS,
  EARNINGS_CARD_VALUE_CLASS,
  MULTICHART_CARD_CHART_HEIGHT_PX,
  MULTICHART_CARD_CLASS,
} from "@/components/stock/earnings-card-styles";
import { secondaryOutlineButtonClassName, TabSwitcher } from "@/components/design-system";
import { MultichartVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import { cn } from "@/lib/utils";

/** Previous shipped default — used to migrate stored layouts that were never customized. */
const LEGACY_DEFAULT_MULTICHART_METRICS = [
  "revenue",
  "net_income",
  "eps",
  "free_cash_flow",
  "ebitda",
] as const satisfies readonly ChartingMetricId[];

const DEFAULT_MULTICHART_METRICS = [
  "revenue",
  "net_income",
  "net_margin",
  "eps",
  "free_cash_flow",
  "ebitda",
  "pe_ratio",
  "return_on_capital_employed",
] as const satisfies readonly ChartingMetricId[];

function isSameMetricList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

type Props = {
  ticker: string;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialQuarterlyPoints?: ChartingSeriesPoint[];
  /** Page heading (default “Multicharts”). */
  title?: string;
  /** Which fundamentals metrics to render as cards (defaults to the standard Multicharts set). */
  metricIds?: readonly ChartingMetricId[];
  /** Opens the same fundamentals chart modal as Overview Key Stats (expand on each card). */
  onOpenMetricChart?: (metricId: ChartingMetricId) => void;
};

export function StockMultichartsTab({
  ticker,
  initialAnnualPoints,
  initialQuarterlyPoints,
  title = "Multicharts",
  metricIds,
  onOpenMetricChart,
}: Props) {
  const storageKey = useMemo(() => `multicharts:${ticker.toUpperCase()}:metrics:v1`, [ticker]);
  const baseMetrics = useMemo(() => {
    if (Array.isArray(metricIds) && metricIds.length > 0) return [...metricIds];
    return [...DEFAULT_MULTICHART_METRICS];
  }, [metricIds]);
  const [metrics, setMetrics] = useState<ChartingMetricId[]>(baseMetrics);
  const [periodMode, setPeriodMode] = useState<FundamentalsSeriesMode>("annual");
  const [chartVisual, setChartVisual] = useState<MultichartVisual>("bar");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const pickerWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingIndexRef = useRef<number | null>(null);

  useEffect(() => {
    // Prefer explicit prop metrics over local storage.
    if (Array.isArray(metricIds) && metricIds.length > 0) {
      setMetrics([...metricIds]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setMetrics(baseMetrics);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setMetrics(baseMetrics);
        return;
      }
      const ids = parsed.map(String) as string[];
      const allowed = new Set<string>(CHARTING_METRIC_IDS as readonly string[]);
      const next = ids.filter((id) => allowed.has(id)) as ChartingMetricId[];
      if (next.length > 0 && isSameMetricList(next, LEGACY_DEFAULT_MULTICHART_METRICS)) {
        setMetrics([...DEFAULT_MULTICHART_METRICS]);
        return;
      }
      setMetrics(next.length > 0 ? next : baseMetrics);
    } catch {
      setMetrics(baseMetrics);
    }
  }, [storageKey, baseMetrics, metricIds]);

  useEffect(() => {
    // Persist only when metrics are user-controlled (no explicit prop override).
    if (Array.isArray(metricIds) && metricIds.length > 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(metrics));
    } catch {
      /* ignore */
    }
  }, [metrics, storageKey, metricIds]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (pickerWrapRef.current && pickerWrapRef.current.contains(t)) return;
      setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);

  const seedPoints = useMemo(() => {
    if (periodMode === "quarterly") {
      return Array.isArray(initialQuarterlyPoints) && initialQuarterlyPoints.length > 0
        ? initialQuarterlyPoints
        : null;
    }
    return Array.isArray(initialAnnualPoints) && initialAnnualPoints.length > 0 ? initialAnnualPoints : null;
  }, [periodMode, initialAnnualPoints, initialQuarterlyPoints]);

  const [points, setPoints] = useState<ChartingSeriesPoint[]>(() =>
    Array.isArray(initialAnnualPoints) && initialAnnualPoints.length > 0 ? initialAnnualPoints : [],
  );
  const [loading, setLoading] = useState(
    !(Array.isArray(initialAnnualPoints) && initialAnnualPoints.length > 0),
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (seedPoints) {
        setPoints(seedPoints);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=${
            periodMode === "quarterly" ? "quarterly" : "annual"
          }`,
          { credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled) setPoints([]);
          return;
        }
        const json = (await res.json()) as { points?: ChartingSeriesPoint[] };
        if (!cancelled) setPoints(Array.isArray(json.points) ? json.points : []);
      } catch {
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, periodMode, seedPoints]);

  const maxBars = periodMode === "quarterly" ? MULTICHART_MAX_QUARTERLY_BARS : MULTICHART_MAX_ANNUAL_BARS;
  const hasAny = useMemo(
    () => metrics.some((id) => sliceLastAnnualWithMetric(points, id, maxBars).length > 0),
    [points, maxBars, metrics],
  );

  const addMetric = useCallback((id: ChartingMetricId) => {
    setMetrics((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPickerQuery("");
    setPickerOpen(false);
  }, []);

  const removeMetric = useCallback((id: ChartingMetricId) => {
    setMetrics((prev) => prev.filter((x) => x !== id));
  }, []);

  const startDragMetric = useCallback((idx: number) => {
    draggingIndexRef.current = idx;
  }, []);

  const endDragMetric = useCallback(() => {
    draggingIndexRef.current = null;
  }, []);

  const moveMetric = useCallback((fromIdx: number, toIdx: number) => {
    setMetrics((prev) => {
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= prev.length || toIdx >= prev.length) return prev;
      if (fromIdx === toIdx) return prev;
      const next = [...prev];
      const [m] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, m!);
      return next;
    });
  }, []);

  const dropMetric = useCallback(
    (toIdx: number) => {
      const fromIdx = draggingIndexRef.current;
      draggingIndexRef.current = null;
      if (fromIdx == null) return;
      moveMetric(fromIdx, toIdx);
    },
    [moveMetric],
  );

  const qLower = pickerQuery.trim().toLowerCase();
  const addableGroups = useMemo(() => {
    return CHARTING_DROPDOWN_GROUPS.map((g) => {
      const ids = g.metricIds.filter(
        (id) => !metrics.includes(id) && (!qLower || CHARTING_METRIC_LABEL[id].toLowerCase().includes(qLower)),
      );
      return { ...g, ids };
    }).filter((g) => g.ids.length > 0);
  }, [metrics, qLower]);

  const totalAddable = useMemo(() => addableGroups.reduce((n, g) => n + g.ids.length, 0), [addableGroups]);

  return (
    <div className="space-y-6 pt-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">{title}</h2>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="flex shrink-0 flex-nowrap items-center gap-2">
            <TabSwitcher
              size="sm"
              options={PERIOD_TAB_OPTIONS}
              value={periodMode}
              onChange={setPeriodMode}
              aria-label="Reporting period"
            />
            <MultichartVisualSwitcher variant="icon" value={chartVisual} onChange={setChartVisual} />
          </div>
          <div className="relative shrink-0" ref={pickerWrapRef}>
            <button
              type="button"
              className={cn(secondaryOutlineButtonClassName, "gap-2 px-4")}
              onClick={() => setPickerOpen((v) => !v)}
              aria-label="Add metric"
              title="Add metric"
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Add Metric
            </button>
            {pickerOpen ? (
              <div
                className={dropdownMenuSurfaceClassName(
                  "absolute right-0 z-[60] mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden",
                )}
              >
                <div className={cn(dropdownMenuSearchHeaderClassName, "flex h-11 items-center gap-2")}>
                  <Search className="h-4 w-4 shrink-0 text-[#71717A]" aria-hidden />
                  <input
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search metrics…"
                    className="w-full bg-transparent text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] focus:outline-none"
                    autoFocus
                  />
                  <span className="text-[12px] font-medium text-[#71717A]">{totalAddable}</span>
                </div>
                <div
                  className={cn(
                    dropdownMenuPanelBodyClassName,
                    dropdownMenuFloatingScrollClassName,
                    "max-h-[320px] overflow-y-auto",
                  )}
                >
                  {addableGroups.map((g) => (
                    <div key={g.id} className="py-1">
                      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#71717A]">
                        {g.label}
                      </div>
                      <div className="space-y-0.5">
                        {g.ids.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => addMetric(id)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-[13px] text-[#09090B] hover:bg-[#F4F4F5]"
                          >
                            <span className="truncate">{CHARTING_METRIC_LABEL[id]}</span>
                            <Plus className="h-4 w-4 shrink-0 text-[#71717A]" aria-hidden />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {addableGroups.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[13px] text-[#71717A]">
                      {qLower ? "No matching metrics." : "All metrics already added."}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <MultichartsTabSkeletonGrid />
      ) : !hasAny ? (
        <p className="text-[14px] leading-6 text-[#71717A]">No fundamentals data available for this symbol.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {metrics.map((metricId, idx) => (
            <MultichartCard
              key={metricId}
              metricId={metricId}
              points={points}
              periodMode={periodMode}
              chartVisual={chartVisual}
              onOpenMetricChart={onOpenMetricChart}
              onRemove={() => removeMetric(metricId)}
              dragIndex={idx}
              onDragStartIndex={startDragMetric}
              onDragEnd={endDragMetric}
              onDropOnIndex={dropMetric}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MultichartCard({
  metricId,
  points,
  periodMode,
  chartVisual,
  onOpenMetricChart,
  onRemove,
  dragIndex,
  onDragStartIndex,
  onDragEnd,
  onDropOnIndex,
}: {
  metricId: ChartingMetricId;
  points: ChartingSeriesPoint[];
  periodMode: FundamentalsSeriesMode;
  chartVisual: MultichartVisual;
  onOpenMetricChart?: (metricId: ChartingMetricId) => void;
  onRemove: () => void;
  dragIndex: number;
  onDragStartIndex: (idx: number) => void;
  onDragEnd: () => void;
  onDropOnIndex: (idx: number) => void;
}) {
  const maxBars = periodMode === "quarterly" ? MULTICHART_MAX_QUARTERLY_BARS : MULTICHART_MAX_ANNUAL_BARS;
  const rows = useMemo(() => sliceLastAnnualWithMetric(points, metricId, maxBars), [points, metricId, maxBars]);
  const last = rows.length ? readChartingMetricValue(rows[rows.length - 1]!, metricId) : null;
  const comparison = multichartComparisonFromLastTwo(rows, metricId);
  const priorRow = rows.length >= 2 ? rows[rows.length - 2]! : null;

  const metricLabel = CHARTING_METRIC_LABEL[metricId];

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      onDragStartIndex(dragIndex);
      // Helps Safari/Firefox actually initiate a drag.
      try {
        e.dataTransfer.setData("text/plain", String(dragIndex));
      } catch {
        /* ignore */
      }
      e.dataTransfer.effectAllowed = "move";
    },
    [dragIndex, onDragStartIndex],
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDropOnIndex(dragIndex);
    },
    [dragIndex, onDropOnIndex],
  );

  return (
    <div
      className={MULTICHART_CARD_CLASS}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={EARNINGS_CARD_LABEL_CLASS}>{metricLabel}</p>
          {last != null && Number.isFinite(last) ? (
            <div className="mt-1 flex min-w-0 flex-col items-start gap-0.5">
              <span className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>{formatMultichartHeadlineValue(metricId, last)}</span>
              {comparison != null && priorRow != null ? (
                <span className="inline-flex items-center gap-1 font-['Inter'] text-[14px] font-medium tabular-nums leading-5">
                  {comparison.delta > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" strokeWidth={2.25} aria-hidden />
                  ) : comparison.delta < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" strokeWidth={2.25} aria-hidden />
                  ) : null}
                  <span className={comparison.delta >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}>
                    {comparison.display}
                  </span>
                  <span className="text-[#71717A]">
                    vs {multichartPriorPeriodComparisonLabel(priorRow.periodEnd, periodMode)}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {onOpenMetricChart ? (
          <button
            type="button"
            onClick={() => onOpenMetricChart(metricId)}
            className="shrink-0 rounded-lg p-1.5 text-[#71717A] outline-none transition-colors hover:bg-black/5 hover:text-[#09090B] focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
            aria-label={`Open ${metricLabel} in full view`}
          >
            <Maximize2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg p-1.5 text-[#71717A] outline-none transition-colors hover:bg-black/5 hover:text-[#09090B] focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
          aria-label={`Remove ${metricLabel}`}
          title="Remove"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <span
          className="shrink-0 cursor-grab rounded-lg p-1.5 text-[#71717A]"
          title="Drag to reorder"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
      </div>
      <MultichartFundamentalsBar
        metricId={metricId}
        points={points}
        height={MULTICHART_CARD_CHART_HEIGHT_PX}
        periodMode={periodMode}
        visual={chartVisual}
        maxBars={maxBars}
        barWidthPx={
          periodMode === "quarterly" ? MULTICHART_BAR_WIDTH_ALL_QUARTERLY_PX : undefined
        }
      />
    </div>
  );
}
