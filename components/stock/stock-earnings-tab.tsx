"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SkeletonBox } from "@/components/markets/skeleton";
import { EarningsEstimatesSection } from "@/components/stock/earnings-estimates-section";
import type { EstimatesMetric } from "@/components/stock/earnings-estimates-chart";
import { EarningsReportRowActions } from "@/components/stock/earnings-report-row-actions";
import {
  displayEps,
  displayRevenueUsd,
  isAnnualForecastPoint,
  sliceLatestAnnualEstimates,
  sliceLatestQuarterlyEstimates,
} from "@/lib/market/earnings-annual-display";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import { pctChange } from "@/lib/market/stock-financials-annual-slice";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import type {
  StockEarningsEstimatesChart,
  StockEarningsEstimatesPoint,
  StockEarningsHistoryRow,
  StockEarningsTabPayload,
} from "@/lib/market/stock-earnings-types";
import { buildReportsTableRows } from "@/lib/market/enrich-earnings-history-estimates";
import { fetchStockEarningsTabPayloadClient } from "@/lib/market/stock-earnings-tab-client";
import { SCREENER_TABLE_HEADER_STICKY_CLASS, ScreenerTableScroll } from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";
import {
  EARNINGS_CARD_LABEL_CLASS,
  EARNINGS_CARD_PRIOR_LINE_CLASS,
  EARNINGS_CARD_VALUE_CLASS,
} from "@/components/stock/earnings-card-styles";

function dash(v: string | null | undefined): string {
  return v != null && String(v).trim() !== "" ? String(v).trim() : "—";
}

function formatEpsEstimate(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMetricSummaryValue(raw: number | null, metric: EstimatesMetric): string | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return metric === "revenue" ? formatUsdCompact(raw) : formatEpsEstimate(raw);
}

function metricSummaryValueFromPoint(p: StockEarningsEstimatesPoint, metric: EstimatesMetric): number | null {
  return metric === "revenue" ? displayRevenueUsd(p) : displayEps(p);
}

type EarningsMetricSummarySlot = {
  label: string;
  value: string | null;
  changePct: number | null;
  priorValueDisplay: string | null;
};

function formatSummaryChangePct(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function summaryPriorPeriod(
  cols: StockEarningsEstimatesPoint[],
  index: number,
  metric: EstimatesMetric,
): Pick<EarningsMetricSummarySlot, "changePct" | "priorValueDisplay"> {
  if (index <= 0 || index >= cols.length) {
    return { changePct: null, priorValueDisplay: null };
  }
  const cur = metricSummaryValueFromPoint(cols[index]!, metric);
  const prev = metricSummaryValueFromPoint(cols[index - 1]!, metric);
  if (cur == null || prev == null) {
    return { changePct: null, priorValueDisplay: null };
  }
  return {
    changePct: pctChange(cur, prev),
    priorValueDisplay: formatMetricSummaryValue(prev, metric),
  };
}

/** Middle + right summary cards — same slice + display helpers as Estimates summary table / chart. */
function buildEarningsMetricSummarySlots(
  chart: StockEarningsEstimatesChart | null | undefined,
  period: FundamentalsSeriesMode,
  metric: EstimatesMetric,
  upcomingRevenueFallback: string | null,
  upcomingEpsFallback: string | null,
): [EarningsMetricSummarySlot, EarningsMetricSummarySlot] {
  const metricTitle = metric === "revenue" ? "Revenue" : "EPS";
  const upcomingFallback = metric === "revenue" ? upcomingRevenueFallback : upcomingEpsFallback;

  if (period === "quarterly" && chart?.quarterly?.length) {
    const forward = sliceLatestQuarterlyEstimates(chart.quarterly)
      .filter((p) => isAnnualForecastPoint(p))
      .slice(0, 2);
    const sliced = sliceLatestQuarterlyEstimates(chart.quarterly);
    const slot = (p: (typeof forward)[number] | undefined, idx: number): EarningsMetricSummarySlot => {
      if (!p) return { label: metricTitle, value: null, changePct: null, priorValueDisplay: null };
      const periodLabel = p.label?.trim();
      const label = periodLabel ? `${metricTitle} ${periodLabel}` : metricTitle;
      const colIndex = sliced.findIndex((row) => row.sortKey === p.sortKey);
      const prior = colIndex >= 0 ? summaryPriorPeriod(sliced, colIndex, metric) : { changePct: null, priorValueDisplay: null };
      return {
        label,
        value:
          formatMetricSummaryValue(metricSummaryValueFromPoint(p, metric), metric) ??
          (idx === 0 ? upcomingFallback : null),
        ...prior,
      };
    };
    return [slot(forward[0], 0), slot(forward[1], 1)];
  }

  const cols = sliceLatestAnnualEstimates(chart?.annual ?? []);
  const slotForYear = (year: string, idx: number): EarningsMetricSummarySlot => {
    const colIndex = cols.findIndex((p) => p.label === year);
    const pt = colIndex >= 0 ? cols[colIndex] : undefined;
    const value = pt ? formatMetricSummaryValue(metricSummaryValueFromPoint(pt, metric), metric) : null;
    const prior = colIndex >= 0 ? summaryPriorPeriod(cols, colIndex, metric) : { changePct: null, priorValueDisplay: null };
    return {
      label: `${metricTitle} ${year}`,
      value: value ?? (idx === 0 ? upcomingFallback : null),
      ...prior,
    };
  };

  return [slotForYear("2026", 0), slotForYear("2027", 1)];
}

function EarningsMetricSummaryCard({ slot }: { slot: EarningsMetricSummarySlot }) {
  const main = slot.value != null && String(slot.value).trim() !== "" ? String(slot.value).trim() : null;
  const changePct =
    slot.changePct != null && Number.isFinite(slot.changePct) ? slot.changePct : null;
  const prior =
    slot.priorValueDisplay != null && String(slot.priorValueDisplay).trim() !== ""
      ? String(slot.priorValueDisplay).trim()
      : null;

  if (!main) {
    return <p className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>—</p>;
  }

  return (
    <div className="mt-0.5 flex min-w-0 flex-col items-start gap-0.5">
      <p className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>
        {main}
        {changePct != null ? (
          <span
            className={cn(
              "ml-1.5 text-[18px] font-semibold leading-7",
              changePct > 0 ? "text-[#16A34A]" : changePct < 0 ? "text-[#DC2626]" : "text-[#71717A]",
            )}
          >
            ({formatSummaryChangePct(changePct)})
          </span>
        ) : null}
      </p>
      {prior ? <p className={EARNINGS_CARD_PRIOR_LINE_CLASS}>from {prior}</p> : null}
    </div>
  );
}

/** Screener-style empty cell (hyphen, not em dash). */
function tableCell(v: string | null | undefined): string {
  const s = v != null && String(v).trim() !== "" ? String(v).trim() : "";
  return s || "-";
}

/** Month + day for stacked "Report date" cell (year omitted; fiscal line carries year). */
function reportDayLineFromDisplay(reportDateDisplay: string | null | undefined): string {
  const raw = reportDateDisplay != null && String(reportDateDisplay).trim() !== "" ? String(reportDateDisplay).trim() : "";
  if (!raw || raw === "-") return "-";
  const noYear = raw.replace(/,\s*\d{4}\s*$/, "").replace(/\s+\d{4}\s*$/, "").trim();
  return noYear || raw;
}

function quarterPrefixForEarningsDateLabel(fiscalPeriodLabel: string | null | undefined): string {
  if (!fiscalPeriodLabel?.trim()) return "Next";
  const m = fiscalPeriodLabel.trim().match(/^(Q[1-4])/i);
  if (m) return m[1]!.toUpperCase();
  const first = fiscalPeriodLabel.trim().split(/\s+/)[0];
  return first || "Next";
}

function upcomingEarningsSubtitle(
  reportDateDisplay: string | null | undefined,
  fiscalPeriodLabel: string | null | undefined,
): string | null {
  const date = dash(reportDateDisplay);
  if (date === "—") return null;
  const quarter = quarterPrefixForEarningsDateLabel(fiscalPeriodLabel);
  if (quarter === "Next") return `Upcoming Earnings on ${date}`;
  return `Upcoming Earnings on ${quarter} ${date}`;
}

/** Matches `components/screener/index-cards.tsx` card chrome. */
const SCREENER_INDEX_CARD_CLASS =
  "overflow-hidden rounded-xl border border-[#E4E4E7] bg-white px-4 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_4px_0px_rgba(10,10,10,0.08)]";

function EarningsSummaryCards({
  period,
  metric,
  estimatesChart,
  upcomingRevenueFallback,
  upcomingEpsFallback,
}: {
  period: FundamentalsSeriesMode;
  metric: EstimatesMetric;
  estimatesChart: StockEarningsEstimatesChart | null | undefined;
  upcomingRevenueFallback: string | null;
  upcomingEpsFallback: string | null;
}) {
  const [metricSlot1, metricSlot2] = useMemo(
    () =>
      buildEarningsMetricSummarySlots(
        estimatesChart,
        period,
        metric,
        upcomingRevenueFallback,
        upcomingEpsFallback,
      ),
    [estimatesChart, period, metric, upcomingRevenueFallback, upcomingEpsFallback],
  );
  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
      <div className={`flex h-fit flex-col gap-0.5 text-left ${SCREENER_INDEX_CARD_CLASS}`}>
        <p className={EARNINGS_CARD_LABEL_CLASS}>{metricSlot1.label}</p>
        <EarningsMetricSummaryCard slot={metricSlot1} />
      </div>
      <div className={`flex h-fit flex-col gap-0.5 text-left ${SCREENER_INDEX_CARD_CLASS}`}>
        <p className={EARNINGS_CARD_LABEL_CLASS}>{metricSlot2.label}</p>
        <EarningsMetricSummaryCard slot={metricSlot2} />
      </div>
    </div>
  );
}

const EARNINGS_HISTORY_PAGE_SIZE = 20;

/** Find the scrollable ancestor used for vertical infinite-scroll (e.g. `<main>` or modal body). */
function nearestVerticalScrollParent(start: HTMLElement | null): HTMLElement | null {
  let el = start?.parentElement ?? null;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return el;
    el = el.parentElement;
  }
  return null;
}

/** Reports table chrome — aligned with {@link StockIncomeStatementTable} / Financials. */
const reportsTableClass = "w-full min-w-0 table-auto border-collapse bg-white text-[14px]";

const reportsHeaderTh =
  "min-h-[44px] px-2 py-2 align-middle font-['Inter'] text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]";

const reportsHeaderThLabel = cn(reportsHeaderTh, "border-r border-[#E4E4E7] text-left");

const reportsHeaderThNum = cn(reportsHeaderTh, "text-right");

const reportsDataRowClass =
  "min-h-[60px] border-b border-[#E4E4E7] bg-white transition-colors duration-75 hover:bg-neutral-50";

const reportsYearRowClass =
  "border-b border-[#E4E4E7] bg-white font-['Inter'] text-[14px] font-semibold leading-5 text-[#09090B]";

const reportsLabelTd =
  "min-w-0 border-r border-[#E4E4E7] px-2 py-3 align-middle text-left sm:px-4";

const reportsNumTd =
  "px-2 py-3 text-right align-middle font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B] sm:px-4";

const reportsActionsTd = "min-w-0 max-w-[min(100%,20rem)] px-2 py-3 text-right align-middle sm:px-4";

function calendarYearFromEarningsHistoryRow(r: StockEarningsHistoryRow): string | null {
  const ymd = r.fiscalPeriodEndYmd;
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd.slice(0, 4);
  const label = r.fiscalPeriodLabel?.trim();
  if (label) {
    const m = label.match(/\b(19|20)\d{2}\b/);
    if (m) return m[0]!;
  }
  return null;
}

type EarningsHistoryRenderedEntry =
  | { kind: "year"; year: string }
  | { kind: "row"; row: StockEarningsHistoryRow };

/** Inserts a full-width year band before the first row of each calendar year (list is newest → oldest). */
function withEarningsYearBandRows(rows: StockEarningsHistoryRow[]): EarningsHistoryRenderedEntry[] {
  const out: EarningsHistoryRenderedEntry[] = [];
  let previousYear: string | null = null;
  for (const row of rows) {
    const cy = calendarYearFromEarningsHistoryRow(row);
    if (cy != null && cy !== previousYear) {
      out.push({ kind: "year", year: cy });
      previousYear = cy;
    }
    out.push({ kind: "row", row });
  }
  return out;
}

function ReportsNumCell({ value }: { value: string | null | undefined }) {
  const text = tableCell(value);
  return (
    <td className={cn(reportsNumTd, text === "-" && "font-medium text-[#71717A]")}>{text}</td>
  );
}

function SurpriseCell({ value, pct }: { value: string | null; pct: number | null }) {
  const innerBase = "min-w-0 w-full text-right tabular-nums text-[14px] leading-5";
  if (!value || value === "—" || value === "-") {
    return <div className={cn(innerBase, "font-medium text-[#71717A]")}>-</div>;
  }
  const n = pct;
  if (n == null || !Number.isFinite(n)) {
    return <div className={innerBase}>{value}</div>;
  }
  const pos = n >= 0;
  return (
    <div
      className={cn(innerBase, "font-medium", pos ? "text-[#16A34A]" : "text-[#DC2626]")}
    >
      {value}
    </div>
  );
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className={cn("flex h-fit flex-col gap-2", SCREENER_INDEX_CARD_CLASS)}>
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBox className="h-5 w-32 rounded" />
            <SkeletonBox className="h-9 w-36 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EstimatesHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <SkeletonBox className="h-7 w-28 rounded" />
        <SkeletonBox className="h-5 w-64 max-w-full rounded" />
      </div>
      <div className="flex flex-wrap gap-3">
        <SkeletonBox className="h-10 w-[200px] rounded-[10px]" />
        <SkeletonBox className="h-10 w-[200px] rounded-[10px]" />
      </div>
    </div>
  );
}

function EstimatesChartSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div>
        <SkeletonBox className="h-[320px] w-full rounded" />
        <div className="mt-4 flex justify-center gap-6">
          <SkeletonBox className="h-4 w-36 rounded" />
          <SkeletonBox className="h-4 w-36 rounded" />
        </div>
      </div>
      <div className="-mx-1 overflow-x-auto sm:-mx-0">
        <div className="min-w-[640px] rounded-lg border border-[#E4E4E7] bg-white px-4 py-4 sm:rounded-none sm:border-x-0 sm:border-t sm:border-b">
          <SkeletonBox className="h-[200px] w-full rounded" />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <ScreenerTableScroll mobileScroll>
      <table className={reportsTableClass}>
        <thead className={SCREENER_TABLE_HEADER_STICKY_CLASS}>
          <tr className="border-b border-[#E4E4E7]">
            {[
              reportsHeaderThLabel,
              reportsHeaderThNum,
              reportsHeaderThNum,
              reportsHeaderThNum,
              reportsHeaderThNum,
              reportsHeaderThNum,
              reportsHeaderThNum,
            ].map((thClass, i) => (
              <th key={i} scope="col" className={thClass}>
                <SkeletonBox
                  className={cn("h-4 rounded", i === 0 && "w-[72%]", i > 0 && i < 6 && "ml-auto w-[70%] max-w-20", i === 6 && "ml-auto w-20")}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, r) => (
            <tr key={r} className={cn(reportsDataRowClass, "last:border-b-0")}>
              <td className={reportsLabelTd}>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <SkeletonBox className="h-4 w-[55%] rounded" />
                  <SkeletonBox className="h-3.5 w-[40%] rounded" />
                </div>
              </td>
              <td className={reportsNumTd}>
                <SkeletonBox className="ml-auto block h-4 w-[65%] max-w-16 rounded" />
              </td>
              <td className={reportsNumTd}>
                <SkeletonBox className="ml-auto block h-4 w-[65%] max-w-16 rounded" />
              </td>
              <td className={reportsNumTd}>
                <SkeletonBox className="ml-auto block h-4 w-[50%] max-w-20 rounded" />
              </td>
              <td className={reportsNumTd}>
                <SkeletonBox className="ml-auto block h-4 w-[65%] max-w-24 rounded" />
              </td>
              <td className={reportsNumTd}>
                <SkeletonBox className="ml-auto block h-4 w-[65%] max-w-24 rounded" />
              </td>
              <td className={reportsActionsTd}>
                <div className="inline-flex w-max max-w-full shrink-0 flex-nowrap justify-end gap-2">
                  <SkeletonBox className="h-9 w-[5.5rem] shrink-0 rounded-[10px]" />
                  <SkeletonBox className="h-9 w-[5.5rem] shrink-0 rounded-[10px]" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScreenerTableScroll>
  );
}

/** SSR-safe shell for `next/dynamic` while the client bundle loads (matches tab skeletons). */
export function StockEarningsTabLoading() {
  return (
    <div className="min-w-0 space-y-6 pt-1">
      <EstimatesHeaderSkeleton />
      <SummaryCardsSkeleton />
      <EstimatesChartSkeleton />
      <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Reports</h3>
      <TableSkeleton />
    </div>
  );
}

function isEarningsTabPayload(v: unknown): v is StockEarningsTabPayload {
  return (
    v != null &&
    typeof v === "object" &&
    typeof (v as StockEarningsTabPayload).ticker === "string" &&
    Array.isArray((v as StockEarningsTabPayload).history)
  );
}

export type StockEarningsTabContentProps = {
  ticker: string;
  /** SSR / stock page initial load — same JSON as GET `/api/stocks/[ticker]/earnings`. */
  initialPayload?: StockEarningsTabPayload | null;
  /** When set (e.g. modal body), history infinite-scroll observes this scroll container instead of `main`. */
  scrollRoot?: HTMLElement | null;
  /** Earnings calendar modal — fast `?preview=1` API (no SEC crawl) and no extra mount skeleton frame. */
  previewMode?: boolean;
};

/** Full earnings experience (summary cards, estimates chart, history table) — reusable on stock page and calendar modal. */
export function StockEarningsTabContent({
  ticker,
  initialPayload = null,
  scrollRoot = null,
  previewMode = false,
}: StockEarningsTabContentProps) {
  const sym = ticker.trim().toUpperCase();
  const seedPayload =
    initialPayload?.ticker.trim().toUpperCase() === sym && isEarningsTabPayload(initialPayload)
      ? initialPayload
      : null;
  /** Defer interactive tree until after mount so SSR HTML matches first paint on the stock page tab. */
  const [clientReady, setClientReady] = useState(previewMode);
  const [loading, setLoading] = useState(() => !seedPayload);
  const [loadError, setLoadError] = useState(false);
  const [data, setData] = useState<StockEarningsTabPayload | null>(() => seedPayload);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [earningsHistoryVisible, setEarningsHistoryVisible] = useState(EARNINGS_HISTORY_PAGE_SIZE);
  const earningsHistorySentinelRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!previewMode) setClientReady(true);
  }, [previewMode]);

  useEffect(() => {
    if (seedPayload) {
      setData(seedPayload);
      setLoading(false);
      setLoadError(false);
      setEarningsHistoryVisible(EARNINGS_HISTORY_PAGE_SIZE);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      setEarningsHistoryVisible(EARNINGS_HISTORY_PAGE_SIZE);
      const json = await fetchStockEarningsTabPayloadClient(sym, {
        preview: previewMode,
        signal: controller.signal,
      });
      if (cancelled) return;
      if (!json) {
        setData(null);
        setLoadError(true);
      } else {
        setData(json);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sym, seedPayload, previewMode, reloadNonce]);

  const historyRows = useMemo(() => {
    if (!data) return [];
    return buildReportsTableRows(
      data.history ?? [],
      data.estimatesChart?.quarterly ?? [],
      data.upcoming ?? null,
    );
  }, [data]);
  const earningsHistoryHasMore = earningsHistoryVisible < historyRows.length;
  const earningsHistorySlice = useMemo(
    () => historyRows.slice(0, earningsHistoryVisible),
    [historyRows, earningsHistoryVisible],
  );

  const earningsHistoryRendered = useMemo(
    () => withEarningsYearBandRows(earningsHistorySlice),
    [earningsHistorySlice],
  );

  const historyRowCountRef = useRef(0);
  historyRowCountRef.current = historyRows.length;

  useEffect(() => {
    if (!data?.history) return;
    setEarningsHistoryVisible(Math.min(EARNINGS_HISTORY_PAGE_SIZE, data.history.length));
  }, [data]);

  useEffect(() => {
    const el = earningsHistorySentinelRef.current;
    if (!el || !earningsHistoryHasMore) return;
    const rootEl =
      scrollRoot ??
      (el.closest("main") instanceof HTMLElement ? (el.closest("main") as HTMLElement) : null) ??
      nearestVerticalScrollParent(el);
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        const cap = historyRowCountRef.current;
        setEarningsHistoryVisible((c) => Math.min(c + EARNINGS_HISTORY_PAGE_SIZE, cap));
      },
      { root: rootEl, rootMargin: "160px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [earningsHistoryHasMore, historyRows.length, scrollRoot]);

  const empty = useMemo(() => {
    if (!data) return true;
    const hasHistory = (data.history?.length ?? 0) > 0;
    const hasUpcoming = !!data.upcoming;
    const hasEstimates =
      (data.estimatesChart?.quarterly?.length ?? 0) > 0 ||
      (data.estimatesChart?.annual?.length ?? 0) > 0;
    return !hasUpcoming && !hasHistory && !hasEstimates;
  }, [data]);

  const summaryForCards = useMemo(() => {
    if (!data) return null;
    const upcomingRevenueFallback = data.upcoming?.revenueEstimateDisplay ?? null;
    const upcomingEpsFallback = data.upcoming?.epsEstimateDisplay ?? null;
    const rows = data.history ?? [];
    if (data.upcoming) {
      return {
        reportDateDisplay: data.upcoming.reportDateDisplay,
        fiscalPeriodLabel: data.upcoming.fiscalPeriodLabel,
        upcomingRevenueFallback,
        upcomingEpsFallback,
      };
    }
    const nextUnreported = rows.find((r) => !r.reported);
    if (nextUnreported) {
      return {
        reportDateDisplay: nextUnreported.reportDateDisplay,
        fiscalPeriodLabel: nextUnreported.fiscalPeriodLabel,
        upcomingRevenueFallback: nextUnreported.revenueEstimateDisplay ?? null,
        upcomingEpsFallback: nextUnreported.epsEstimateDisplay ?? null,
      };
    }
    /** All rows reported — still show summary cards from the latest quarter (first row). */
    const latest = rows[0];
    if (!latest) return null;
    return {
      reportDateDisplay: latest.reportDateDisplay,
      fiscalPeriodLabel: latest.fiscalPeriodLabel,
      upcomingRevenueFallback: latest.revenueEstimateDisplay ?? null,
      upcomingEpsFallback: latest.epsEstimateDisplay ?? null,
    };
  }, [data]);

  if (!clientReady) {
    return <StockEarningsTabLoading />;
  }

  return (
    <div className="min-w-0 space-y-6 pt-1">
      {loading ? (
        <>
          <EstimatesHeaderSkeleton />
          <SummaryCardsSkeleton />
          <EstimatesChartSkeleton />
          <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Reports</h3>
          <TableSkeleton />
        </>
      ) : null}

      {!loading && loadError ? (
        <div className="space-y-3">
          <p className="text-[14px] leading-6 text-[#71717A]">
            Earnings data didn&apos;t load. This can happen when the data provider is slow — try again.
          </p>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="inline-flex h-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-[14px] font-medium text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] hover:bg-[#F4F4F5]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !loadError && empty ? (
        <p className="text-[14px] leading-6 text-[#71717A]">No earnings history is available for this symbol.</p>
      ) : null}

      {!loading && data?.estimatesChart ? (
        <EarningsEstimatesSection
          data={data.estimatesChart}
          upcomingEarningsSubtitle={
            summaryForCards
              ? upcomingEarningsSubtitle(
                  summaryForCards.reportDateDisplay,
                  summaryForCards.fiscalPeriodLabel,
                )
              : null
          }
          belowHeader={(period, metric) =>
            summaryForCards ? (
              <EarningsSummaryCards
                period={period}
                metric={metric}
                estimatesChart={data.estimatesChart}
                upcomingRevenueFallback={summaryForCards.upcomingRevenueFallback}
                upcomingEpsFallback={summaryForCards.upcomingEpsFallback}
              />
            ) : null
          }
        />
      ) : null}

      {!loading && !data?.estimatesChart && summaryForCards ? (
        <EarningsSummaryCards
          period="annual"
          metric="revenue"
          estimatesChart={null}
          upcomingRevenueFallback={summaryForCards.upcomingRevenueFallback}
          upcomingEpsFallback={summaryForCards.upcomingEpsFallback}
        />
      ) : null}

      {!loading && data && historyRows.length > 0 ? (
        <div className="min-w-0 space-y-6">
          <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Reports</h3>
          <ScreenerTableScroll mobileScroll>
            <table className={reportsTableClass}>
              <thead className={SCREENER_TABLE_HEADER_STICKY_CLASS}>
                <tr className="border-b border-[#E4E4E7]">
                  <th scope="col" className={reportsHeaderThLabel}>
                    Report date
                  </th>
                  <th scope="col" className={reportsHeaderThNum}>
                    EPS est.
                  </th>
                  <th scope="col" className={reportsHeaderThNum}>
                    EPS actual
                  </th>
                  <th scope="col" className={reportsHeaderThNum}>
                    Surprise
                  </th>
                  <th scope="col" className={reportsHeaderThNum}>
                    Rev. est.
                  </th>
                  <th scope="col" className={reportsHeaderThNum}>
                    Rev. actual
                  </th>
                  <th scope="col" className={cn(reportsHeaderThNum, "whitespace-nowrap")}>
                    <span className="sr-only">Document actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {earningsHistoryRendered.map((entry, idx) =>
                  entry.kind === "year" ? (
                    <tr key={`reports-year-${entry.year}-${idx}`} className={reportsYearRowClass}>
                      <td colSpan={7} className="px-2 py-3 sm:px-4">
                        {entry.year}
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={`${entry.row.fiscalPeriodEndYmd ?? idx}-${entry.row.reportDateDisplay ?? idx}`}
                      className={cn(reportsDataRowClass, "last:border-b-0")}
                    >
                      <td className={reportsLabelTd}>
                        <div className="truncate font-semibold leading-5 text-[#09090B]">
                          {tableCell(entry.row.fiscalPeriodLabel)}
                        </div>
                        <div className="truncate font-['Inter'] text-[12px] font-medium leading-5 text-[#71717A] sm:text-[14px]">
                          {reportDayLineFromDisplay(entry.row.reportDateDisplay)}
                        </div>
                      </td>
                      <ReportsNumCell value={entry.row.epsEstimateDisplay} />
                      <ReportsNumCell value={entry.row.epsActualDisplay} />
                      <td className={reportsNumTd}>
                        <SurpriseCell value={entry.row.surpriseDisplay} pct={entry.row.surprisePct} />
                      </td>
                      <ReportsNumCell value={entry.row.revenueEstimateDisplay} />
                      <ReportsNumCell value={entry.row.revenueActualDisplay} />
                      <td className={cn(reportsActionsTd, "relative z-[1]")}>
                        <div className="inline-flex w-max max-w-full justify-end">
                          <EarningsReportRowActions listingTicker={sym} row={entry.row} />
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                {earningsHistoryHasMore ? (
                  <tr ref={earningsHistorySentinelRef} className="pointer-events-none h-1" aria-hidden>
                    <td colSpan={7} className="h-1 p-0" />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </ScreenerTableScroll>
        </div>
      ) : null}
    </div>
  );
}

export function StockEarningsTab({
  ticker,
  initialPayload = null,
}: {
  ticker: string;
  initialPayload?: StockEarningsTabPayload | null;
}) {
  return <StockEarningsTabContent ticker={ticker} initialPayload={initialPayload} />;
}
