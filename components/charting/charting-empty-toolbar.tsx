"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, RefreshCw, X } from "lucide-react";

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import type { ChartTimeRange } from "@/components/charting/charting-workspace";
import { TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import {
  dropdownMenuRichItemClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import {
  CHARTING_DROPDOWN_GROUPS,
  CHARTING_MAX_COMPARE_TICKERS,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  buildChartingPath,
  parseChartingMetricsParam,
  parseChartingTickerList,
} from "@/lib/market/stock-charting-metrics";

/** Match standalone Charting chrome — Figma Charting empty / workspace header. */
type ChartType = "line" | "bars";

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

const CHART_TYPE_TAB_OPTIONS = [
  { value: "line" as const, label: "Line" },
  { value: "bars" as const, label: "Bars" },
] as const satisfies readonly TabSwitcherOption<ChartType>[];

const TIME_RANGE_LABELS: Record<ChartTimeRange, string> = {
  "1Y": "1Y",
  "2Y": "2Y",
  "3Y": "3Y",
  "5Y": "5Y",
  "10Y": "10Y",
  all: "All",
};

const TIME_RANGE_ORDER: ChartTimeRange[] = ["1Y", "2Y", "3Y", "5Y", "10Y", "all"];

const TIME_RANGE_TAB_OPTIONS: TabSwitcherOption<ChartTimeRange>[] = TIME_RANGE_ORDER.map((r) => ({
  value: r,
  label: TIME_RANGE_LABELS[r],
}));

type Props = {
  /** Syncs with `/charting?metric=` (comma-separated ids). */
  metricParam: string | null;
  /** Allowed tickers from URL (chips when company chosen without a full chart session). */
  tickers: string[];
  /** Same list as server Charting route — top 10 + screener page 2. */
  allowedChartingTickers: string[];
};

/**
 * Empty-state toolbar: title, switchers (visual), + Metric first; + Company only after ≥1 metric.
 */
export function ChartingEmptyToolbar({ metricParam, tickers, allowedChartingTickers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const chartingAllowSet = useMemo(
    () =>
      new Set(
        allowedChartingTickers.map((t) => t.trim().toUpperCase()).filter(Boolean),
      ),
    [allowedChartingTickers],
  );

  /** Next.js client query (updates with `router.push` / `replace`) — more reliable than `window.location` for same-tick sync. */
  const tickersFromRouter = useMemo(() => {
    const raw = searchParams.get("ticker")?.trim() ?? "";
    const parsed = parseChartingTickerList(raw || null);
    return parsed.filter((t) => {
      if (isSingleAssetMode()) return isSupportedAsset(t);
      return chartingAllowSet.has(t.trim().toUpperCase());
    });
  }, [searchParams, chartingAllowSet]);

  const displayTickers = useMemo(
    () => (tickersFromRouter.length > 0 ? tickersFromRouter : tickers),
    [tickers, tickersFromRouter],
  );

  const tickersForUrlSync = useCallback((): string[] => {
    return displayTickers;
  }, [displayTickers]);

  const [periodMode, setPeriodMode] = useState<"annual" | "quarterly">("annual");
  const [chartType, setChartType] = useState<ChartType>("bars");
  const [timeRange, setTimeRange] = useState<ChartTimeRange>("all");

  const parsedFromUrl = useMemo(() => parseChartingMetricsParam(metricParam), [metricParam]);

  const [pendingMetrics, setPendingMetrics] = useState<ChartingMetricId[]>(() =>
    parsedFromUrl.length ? parsedFromUrl : [],
  );

  /** Only apply metrics from the URL when the URL actually lists them — avoids clearing local picks before `router.replace` lands (company → metric). */
  useEffect(() => {
    if (parsedFromUrl.length === 0) return;
    const id = requestAnimationFrame(() => setPendingMetrics(parsedFromUrl));
    return () => cancelAnimationFrame(id);
  }, [parsedFromUrl]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const syncUrl = useCallback(
    (nextTickers: string[], nextMetrics: ChartingMetricId[]) => {
      router.replace(buildChartingPath(nextTickers, nextMetrics), { scroll: false });
    },
    [router],
  );

  const removeTicker = useCallback(
    (sym: string) => {
      syncUrl(
        displayTickers.filter((t) => t !== sym),
        pendingMetrics,
      );
    },
    [displayTickers, pendingMetrics, syncUrl],
  );

  const removeMetric = useCallback(
    (id: ChartingMetricId) => {
      let nextMetrics: ChartingMetricId[] | null = null;
      setPendingMetrics((prev) => {
        const next = prev.filter((x) => x !== id);
        nextMetrics = next;
        return next;
      });
      if (nextMetrics !== null) {
        syncUrl(tickersForUrlSync(), nextMetrics!);
      }
    },
    [syncUrl, tickersForUrlSync],
  );

  const addMetric = useCallback(
    (id: ChartingMetricId) => {
      let nextMetrics: ChartingMetricId[] | null = null;
      setPendingMetrics((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        nextMetrics = next;
        return next;
      });
      if (nextMetrics !== null) {
        syncUrl(tickersForUrlSync(), nextMetrics);
      }
      setPickerOpen(false);
      setPickerQuery("");
    },
    [syncUrl, tickersForUrlSync],
  );

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

  const qLower = pickerQuery.trim().toLowerCase();

  const groupedAddable = useMemo(() => {
    return CHARTING_DROPDOWN_GROUPS.map((g) => {
      const ids = g.metricIds.filter(
        (id) =>
          !pendingMetrics.includes(id) && (!qLower || CHARTING_METRIC_LABEL[id].toLowerCase().includes(qLower)),
      );
      return { ...g, ids };
    }).filter((g) => g.ids.length > 0);
  }, [pendingMetrics, qLower]);

  const totalAddable = useMemo(() => groupedAddable.reduce((n, g) => n + g.ids.length, 0), [groupedAddable]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <h1 className="min-w-0 shrink-0 text-2xl font-semibold leading-9 tracking-tight text-[#09090B] sm:flex-1">
          Charting
        </h1>
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
            disabled
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] opacity-40"
            aria-label="Refresh (add a company first)"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      <div className="pb-3">
        <div className="flex flex-wrap items-center gap-4">
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
                    {qLower ? "No metrics match" : "All available metrics are selected"}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {pendingMetrics.map((id) => (
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
                className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
                aria-label={`Remove ${CHARTING_METRIC_LABEL[id]}`}
              >
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          ))}

          {displayTickers.map((sym) => (
            <div
              key={sym}
              className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white"
            >
              <span className="flex min-h-[36px] min-w-0 items-center border-r border-[#E4E4E7] px-4 py-2 text-[14px] font-medium leading-5 text-[#09090B]">
                <span className="truncate">{sym}</span>
              </span>
              <button
                type="button"
                onClick={() => removeTicker(sym)}
                className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
                aria-label={`Remove ${sym}`}
              >
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          ))}

          {pendingMetrics.length > 0 ? (
            <ChartingCompanyAddDropdown
              onPickStock={(sym) => {
                const u = sym.trim().toUpperCase();
                if (displayTickers.includes(u)) return;
                if (displayTickers.length >= CHARTING_MAX_COMPARE_TICKERS) return;
                router.push(buildChartingPath([...displayTickers, u], pendingMetrics));
              }}
              disabled={displayTickers.length >= CHARTING_MAX_COMPARE_TICKERS}
              maxExtraCompanies={Math.max(0, CHARTING_MAX_COMPARE_TICKERS - displayTickers.length)}
              excludeSymbols={displayTickers}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
