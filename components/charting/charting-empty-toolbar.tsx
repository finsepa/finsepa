"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, RefreshCw, X } from "@/lib/icons";

import { ChartingCompanyAddDropdown } from "@/components/charting/charting-company-add-dropdown";
import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import {
  DEFAULT_CHART_TIME_RANGE,
  STANDALONE_CHARTING_TIME_RANGE_ORDER,
  type ChartTimeRange,
} from "@/components/charting/charting-workspace";
import { ChartingVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import { secondaryFillButtonClassName, TabSwitcher, type TabSwitcherOption } from "@/components/design-system";
import {
  dropdownMenuRichItemClassName,
  dropdownMenuSearchHeaderClassName,
  dropdownMenuSearchInputClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";
import { filterChartingUrlTickersForSession } from "@/lib/charting/charting-allowed-tickers";
import {
  CHARTING_DROPDOWN_GROUPS,
  CHARTING_MAX_COMPARE_TICKERS,
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
  buildChartingPath,
  parseChartingMetricsParam,
  parseChartingTickerList,
} from "@/lib/market/stock-charting-metrics";

/** Align picker output with charting URLs / allowlist (EODHD-style `BRK-B.US` → `BRK.B`). */
function normalizePickerEquitySymbol(raw: string): string {
  let u = raw.trim().toUpperCase();
  if (u.endsWith(".US")) u = u.slice(0, -3);
  return u.replace(/-/g, ".");
}

/** Match standalone Charting chrome — Figma Charting empty / workspace header. */
type ChartType = "line" | "bars";

const PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
];

const TIME_RANGE_LABELS: Record<ChartTimeRange, string> = {
  "1Y": "1Y",
  "2Y": "2Y",
  "3Y": "3Y",
  "5Y": "5Y",
  "10Y": "10Y",
  all: "All",
};

const TIME_RANGE_TAB_OPTIONS: TabSwitcherOption<ChartTimeRange>[] = STANDALONE_CHARTING_TIME_RANGE_ORDER.map(
  (r) => ({
    value: r,
    label: TIME_RANGE_LABELS[r],
  }),
);

type Props = {
  /** Syncs with `/charting?metric=` (comma-separated ids). */
  metricParam: string | null;
  /** Allowed tickers from URL (chips when company chosen without a full chart session). */
  tickers: string[];
  /** Same list as server Charting route — top 10 + screener page 2. */
  allowedChartingTickers: string[];
  /** Called synchronously before navigating to a full chart session so the page can show a chart skeleton. */
  onBeginChartSessionNavigation?: () => void;
};

/**
 * Empty-state toolbar: title, switchers (visual), metric chips then + Add Metric; + Add Company only after ≥1 metric.
 */
export function ChartingEmptyToolbar({
  metricParam,
  tickers,
  allowedChartingTickers,
  onBeginChartSessionNavigation,
}: Props) {
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
    const fromClient = parseChartingTickerList(raw || null);
    const candidates = fromClient.length > 0 ? fromClient : tickers;
    return filterChartingUrlTickersForSession(candidates, chartingAllowSet);
  }, [searchParams, chartingAllowSet, tickers]);

  const displayTickers = useMemo(
    () => (tickersFromRouter.length > 0 ? tickersFromRouter : tickers),
    [tickers, tickersFromRouter],
  );

  const pendingMetricsRef = useRef<ChartingMetricId[]>([]);
  const displayTickersRef = useRef<string[]>([]);

  const [periodMode, setPeriodMode] = useState<"annual" | "quarterly">("annual");
  const [chartType, setChartType] = useState<ChartType>("bars");
  const [timeRange, setTimeRange] = useState<ChartTimeRange>(DEFAULT_CHART_TIME_RANGE);

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
        displayTickersRef.current.filter((t) => t !== sym),
        pendingMetricsRef.current,
      );
    },
    [syncUrl],
  );

  const removeMetric = useCallback(
    (id: ChartingMetricId) => {
      const prev = pendingMetricsRef.current;
      const next = prev.filter((x) => x !== id);
      if (next.length === prev.length) return;
      pendingMetricsRef.current = next;
      setPendingMetrics(next);
      syncUrl(displayTickersRef.current, next);
    },
    [syncUrl],
  );

  const addMetric = useCallback(
    (id: ChartingMetricId) => {
      const hadTicker = displayTickersRef.current.length > 0;
      const prev = pendingMetricsRef.current;
      if (prev.includes(id)) return;
      const next = [...prev, id];
      pendingMetricsRef.current = next;
      setPendingMetrics(next);
      if (hadTicker && prev.length === 0) {
        onBeginChartSessionNavigation?.();
      }
      syncUrl(displayTickersRef.current, next);
      setPickerOpen(false);
      setPickerQuery("");
    },
    [syncUrl, onBeginChartSessionNavigation],
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

  pendingMetricsRef.current = pendingMetrics;
  displayTickersRef.current = displayTickers;

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
          {pendingMetrics.map((id) => (
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
                className="flex w-9 shrink-0 items-center justify-center text-[#09090B] transition-colors hover:bg-[#FAFAFA]"
                aria-label={`Remove ${CHARTING_METRIC_LABEL[id]}`}
              >
                <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          ))}

          <div className="relative order-2" ref={pickerWrapRef}>
            <button
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
            {pickerOpen && (
              <div
                className={cn(
                  dropdownMenuSurfaceClassName(),
                  "absolute left-0 top-full z-[210] mt-1 w-[min(calc(100vw-2rem),300px)] overflow-hidden",
                )}
                role="listbox"
              >
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
                    {qLower ? "No metrics match" : "All available metrics are selected"}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {displayTickers.map((sym) => (
            <div
              key={sym}
              className="order-3 inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-[10px] border border-[#E4E4E7] bg-white"
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
            <div className="order-4">
              <ChartingCompanyAddDropdown
                onPickStock={(sym) => {
                  const u = normalizePickerEquitySymbol(sym);
                  if (!u) return;
                  const dt = displayTickersRef.current;
                  if (dt.includes(u)) return;
                  if (dt.length >= CHARTING_MAX_COMPARE_TICKERS) return;
                  const fromState = pendingMetricsRef.current;
                  const fromUrl = parseChartingMetricsParam(metricParam);
                  const metrics = fromState.length > 0 ? fromState : fromUrl;
                  if (metrics.length === 0) return;
                  onBeginChartSessionNavigation?.();
                  router.push(buildChartingPath([...dt, u], metrics));
                }}
                disabled={displayTickers.length >= CHARTING_MAX_COMPARE_TICKERS}
                maxExtraCompanies={Math.max(0, CHARTING_MAX_COMPARE_TICKERS - displayTickers.length)}
                excludeSymbols={displayTickers}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
