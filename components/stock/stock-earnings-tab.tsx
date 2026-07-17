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
  sliceLatestQuarterlyEstimates,
} from "@/lib/market/earnings-annual-display";
import { pctChange } from "@/lib/market/stock-financials-annual-slice";
import type {
  StockEarningsEstimatesChart,
  StockEarningsEstimatesPoint,
  StockEarningsHistoryRow,
  StockEarningsTabPayload,
} from "@/lib/market/stock-earnings-types";
import { reportedRowMissingEarningsDocuments } from "@/lib/market/earnings-document-url";
import { buildReportsTableRows } from "@/lib/market/enrich-earnings-history-estimates";
import { fetchStockEarningsTabPayloadClient, peekStockEarningsTabPayloadClient } from "@/lib/market/stock-earnings-tab-client";
import { StockEarningsTabLoading } from "@/components/stock/stock-earnings-tab-loading";
import { SCREENER_TABLE_HEADER_STICKY_CLASS, ScreenerTableScroll } from "@/components/screener/screener-table-scroll";
import { STOCK_TABLE_LABEL_COL_WIDTH } from "@/components/stock/stock-income-statement-table";
import { cn } from "@/lib/utils";

function metricSummaryValueFromPoint(p: StockEarningsEstimatesPoint, metric: EstimatesMetric): number | null {
  return metric === "revenue" ? displayRevenueUsd(p) : displayEps(p);
}

function formatSummaryChangePct(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function summaryPriorChangePct(
  cols: StockEarningsEstimatesPoint[],
  index: number,
  metric: EstimatesMetric,
): number | null {
  if (index <= 0 || index >= cols.length) return null;
  const cur = metricSummaryValueFromPoint(cols[index]!, metric);
  const prev = metricSummaryValueFromPoint(cols[index - 1]!, metric);
  if (cur == null || prev == null) return null;
  return pctChange(cur, prev);
}

/** QoQ change for the next forward consensus period vs prior column. */
function upcomingEstimateChangePct(
  chart: StockEarningsEstimatesChart | null | undefined,
  metric: EstimatesMetric,
): number | null {
  const sliced = sliceLatestQuarterlyEstimates(chart?.quarterly ?? []);
  if (!sliced.length) return null;
  const forward = sliced.filter((p) => isAnnualForecastPoint(p));
  const upcoming = forward[0];
  if (!upcoming) return null;
  const colIndex = sliced.findIndex((row) => row.sortKey === upcoming.sortKey);
  return summaryPriorChangePct(sliced, colIndex, metric);
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

const EARNINGS_MONTH_ABBREV = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Total meter bars — 12 bars, 1 bar ≈ 1 week (~one quarter window). */
const EARNINGS_COUNTDOWN_BARS = 12;

type EarningsCountdownInfo = {
  /** e.g. "Q3, Aug 26". */
  nextEarningsLabel: string;
  daysLeft: number;
};

/** Parse a `YYYY-MM-DD` report date into calendar parts (no time-of-day, no locale). */
function parseEarningsReportYmd(ymd: string | null | undefined): { utcMs: number; monthIdx: number; day: string } | null {
  const raw = ymd?.trim() ?? "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return null;
  return {
    day: String(day),
    monthIdx,
    utcMs: Date.UTC(year, monthIdx, day),
  };
}

/** `Q1`–`Q4` from a fiscal label like "Q3 2026"; null when unknown. */
function quarterFromFiscalPeriodLabel(fiscalPeriodLabel: string | null | undefined): string | null {
  if (!fiscalPeriodLabel?.trim()) return null;
  const m = fiscalPeriodLabel.trim().match(/\b(Q[1-4])\b/i);
  return m ? m[1]!.toUpperCase() : null;
}

/** e.g. "Q3, Aug 26" — quarter when known, otherwise just "Aug 26". */
function formatNextEarningsLabel(
  monthIdx: number,
  day: string,
  fiscalPeriodLabel: string | null | undefined,
): string {
  const datePart = `${EARNINGS_MONTH_ABBREV[monthIdx]!} ${day}`;
  const quarter = quarterFromFiscalPeriodLabel(fiscalPeriodLabel);
  return quarter ? `${quarter}, ${datePart}` : datePart;
}

/**
 * Green bars fill as earnings approaches (empty/grey when far, full green when due).
 * 1 bar ≈ 1 week remaining emptied from the meter; clamp to the 12-bar window.
 */
function earningsCountdownFilledBars(daysLeft: number): number {
  if (!Number.isFinite(daysLeft) || daysLeft <= 0) return EARNINGS_COUNTDOWN_BARS;
  const weeksLeft = Math.min(EARNINGS_COUNTDOWN_BARS, Math.max(0, Math.ceil(daysLeft / 7)));
  return EARNINGS_COUNTDOWN_BARS - weeksLeft;
}

const earningsHeaderStatLabelClass = "text-[13px] font-normal leading-5 text-[#71717A]";
const earningsHeaderStatValueClass =
  "text-[16px] font-semibold leading-6 tabular-nums text-[#09090B] sm:text-[20px] sm:leading-7";

function EarningsHeaderChangePct({ changePct }: { changePct: number | null | undefined }) {
  if (changePct == null || !Number.isFinite(changePct)) return null;
  return (
    <span
      className={cn(
        earningsHeaderStatLabelClass,
        "font-semibold",
        changePct > 0 ? "text-[#16A34A]" : changePct < 0 ? "text-[#DC2626]" : "text-[#71717A]",
      )}
    >
      ({formatSummaryChangePct(changePct)})
    </span>
  );
}

/** Flat stats row — matches superinvestor Size / No. of stocks header (no cards). */
function EarningsCountdownStats({
  reportDateYmd,
  fiscalPeriodLabel,
  revenueEstimateDisplay,
  epsEstimateDisplay,
  revenueEstimateChangePct,
  epsEstimateChangePct,
}: {
  reportDateYmd: string | null | undefined;
  fiscalPeriodLabel?: string | null;
  revenueEstimateDisplay?: string | null;
  epsEstimateDisplay?: string | null;
  revenueEstimateChangePct?: number | null;
  epsEstimateChangePct?: number | null;
}) {
  /** Compute "today" on the client only so the SSR seed can't disagree on the day boundary. */
  const [nowUtcMs, setNowUtcMs] = useState<number | null>(null);
  useEffect(() => {
    const now = new Date();
    setNowUtcMs(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);

  const info = useMemo<EarningsCountdownInfo | null>(() => {
    const parsed = parseEarningsReportYmd(reportDateYmd);
    if (!parsed || nowUtcMs == null) return null;
    const daysLeft = Math.round((parsed.utcMs - nowUtcMs) / 86_400_000);
    if (daysLeft < 0) return null;
    return {
      nextEarningsLabel: formatNextEarningsLabel(parsed.monthIdx, parsed.day, fiscalPeriodLabel),
      daysLeft,
    };
  }, [reportDateYmd, fiscalPeriodLabel, nowUtcMs]);

  const filledBars = info ? earningsCountdownFilledBars(info.daysLeft) : 0;
  const revenueEstimate =
    revenueEstimateDisplay != null && String(revenueEstimateDisplay).trim() !== ""
      ? String(revenueEstimateDisplay).trim()
      : null;
  const epsEstimate =
    epsEstimateDisplay != null && String(epsEstimateDisplay).trim() !== ""
      ? String(epsEstimateDisplay).trim()
      : null;

  return (
    <dl className="flex flex-row flex-wrap items-stretch gap-x-6 gap-y-4" suppressHydrationWarning>
      <div className="flex flex-col gap-1 border-r border-[#E4E4E7] pr-6">
        <dt className={earningsHeaderStatLabelClass}>Next earnings</dt>
        <dd className={earningsHeaderStatValueClass}>{info ? info.nextEarningsLabel : "TBA"}</dd>
      </div>
      <div className="flex flex-col gap-1 border-r border-[#E4E4E7] pr-6">
        <dt className={earningsHeaderStatLabelClass}>Days left</dt>
        <dd className="flex items-center gap-3">
          <span className={earningsHeaderStatValueClass}>{info ? info.daysLeft : "TBA"}</span>
          {info ? (
            <div className="flex shrink-0 items-center gap-1" aria-hidden>
              {Array.from({ length: EARNINGS_COUNTDOWN_BARS }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-3 w-[3px] max-w-[3px] shrink-0 rounded-[1px]",
                    i < filledBars ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
                  )}
                />
              ))}
            </div>
          ) : null}
        </dd>
      </div>
      <div className="flex flex-col gap-1 border-r border-[#E4E4E7] pr-6">
        <dt className={earningsHeaderStatLabelClass}>Revenue estimate</dt>
        <dd className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <span className={earningsHeaderStatValueClass}>{revenueEstimate ?? "—"}</span>
          {revenueEstimate ? <EarningsHeaderChangePct changePct={revenueEstimateChangePct} /> : null}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className={earningsHeaderStatLabelClass}>EPS estimate</dt>
        <dd className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <span className={earningsHeaderStatValueClass}>{epsEstimate ?? "—"}</span>
          {epsEstimate ? <EarningsHeaderChangePct changePct={epsEstimateChangePct} /> : null}
        </dd>
      </div>
    </dl>
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
const reportsTableClass = "w-full min-w-0 table-fixed border-collapse bg-white text-[14px]";

const reportsHeaderTh =
  "min-h-[44px] px-2 py-2 align-middle font-['Inter'] text-[12px] font-medium leading-5 text-[#71717A] sm:px-4 sm:text-[14px]";

const reportsHeaderThLabel = cn(reportsHeaderTh, "text-left");

const reportsHeaderThNum = cn(reportsHeaderTh, "text-right");

const reportsDataRowClass =
  "min-h-[60px] border-b border-[#E4E4E7] bg-white transition-colors duration-75 hover:bg-neutral-50";

const reportsYearRowClass =
  "min-h-[44px] border-b border-[#E4E4E7] bg-[#FAFAFA] font-['Inter'] text-[12px] font-medium leading-5 text-[#71717A] sm:text-[14px]";

const reportsLabelTd =
  "min-w-0 px-2 py-3 align-middle text-left sm:px-4";

const reportsNumTd =
  "px-2 py-3 text-right align-middle font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B] sm:px-4";

const reportsActionsTd = "w-[180px] min-w-[180px] px-2 py-3 text-right align-middle sm:px-4";

function ReportsColGroup() {
  return (
    <colgroup>
      <col style={{ width: STOCK_TABLE_LABEL_COL_WIDTH }} />
      <col />
      <col />
      <col />
      <col />
      <col />
      <col style={{ width: 180 }} />
    </colgroup>
  );
}

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

function EstimatesHeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-stretch gap-x-6 gap-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-1.5",
              i < 3 && "border-r border-[#E4E4E7] pr-6",
            )}
          >
            <SkeletonBox className="h-4 w-24 rounded" />
            <SkeletonBox className="h-7 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBox className="h-7 w-28 rounded" />
        <div className="flex flex-wrap gap-3">
          <SkeletonBox className="h-10 w-[200px] rounded-[10px]" />
          <SkeletonBox className="h-10 w-[200px] rounded-[10px]" />
        </div>
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
        <ReportsColGroup />
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

/** Re-export loading shell for callers that imported it from this module. */
export { StockEarningsTabLoading };

function isEarningsTabPayload(v: unknown): v is StockEarningsTabPayload {
  return (
    v != null &&
    typeof v === "object" &&
    typeof (v as StockEarningsTabPayload).ticker === "string" &&
    Array.isArray((v as StockEarningsTabPayload).history)
  );
}

/** SSR seed may predate IR slide resolution — refresh when any released row still lacks docs. */
function seedNeedsDocumentRefresh(payload: StockEarningsTabPayload | null): boolean {
  if (!payload?.history?.length) return true;
  return payload.history.some(reportedRowMissingEarningsDocuments);
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
  /** Prefetch / prior visit may already have preview or full in memory — paint without waiting. */
  const memoryPaint =
    seedPayload ??
    peekStockEarningsTabPayloadClient(sym, previewMode) ??
    (!previewMode ? peekStockEarningsTabPayloadClient(sym, true) : null);
  /** SSR seed, preview modal, or warm memory: paint immediately; otherwise defer one frame for hydration parity. */
  const [clientReady, setClientReady] = useState(() => previewMode || !!memoryPaint);
  const [loading, setLoading] = useState(() => !memoryPaint);
  const [loadError, setLoadError] = useState(false);
  const [data, setData] = useState<StockEarningsTabPayload | null>(() => memoryPaint);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [earningsHistoryVisible, setEarningsHistoryVisible] = useState(EARNINGS_HISTORY_PAGE_SIZE);
  const earningsHistorySentinelRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!previewMode && !memoryPaint) setClientReady(true);
  }, [previewMode, memoryPaint]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const painted =
      seedPayload ??
      peekStockEarningsTabPayloadClient(sym, previewMode) ??
      (!previewMode ? peekStockEarningsTabPayloadClient(sym, true) : null);
    const fullCached = !previewMode ? peekStockEarningsTabPayloadClient(sym, false) : null;
    const canSkipFetch = previewMode
      ? !!painted && !seedNeedsDocumentRefresh(painted)
      : !!fullCached && !seedNeedsDocumentRefresh(fullCached);

    if (painted) {
      setData(painted);
      setLoading(false);
      setLoadError(false);
      setEarningsHistoryVisible(EARNINGS_HISTORY_PAGE_SIZE);
      if (canSkipFetch) {
        return () => controller.abort();
      }
    }

    async function load() {
      // Keep existing paint while upgrading preview → full / filling documents.
      if (!painted) {
        setLoading(true);
        setLoadError(false);
        setEarningsHistoryVisible(EARNINGS_HISTORY_PAGE_SIZE);
      }
      const json = await fetchStockEarningsTabPayloadClient(sym, {
        preview: previewMode,
        signal: controller.signal,
      });
      if (cancelled) return;
      if (!json) {
        if (!painted) {
          setData(null);
          setLoadError(true);
        }
      } else {
        setData(json);
        setLoadError(false);
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
    const revenueEstimateChangePct = upcomingEstimateChangePct(data.estimatesChart, "revenue");
    const epsEstimateChangePct = upcomingEstimateChangePct(data.estimatesChart, "eps");
    const rows = data.history ?? [];
    if (data.upcoming) {
      return {
        reportDateYmd: data.upcoming.reportDateYmd,
        fiscalPeriodLabel: data.upcoming.fiscalPeriodLabel,
        upcomingRevenueFallback,
        upcomingEpsFallback,
        revenueEstimateChangePct,
        epsEstimateChangePct,
      };
    }
    const nextUnreported = rows.find((r) => !r.reported);
    if (nextUnreported) {
      return {
        reportDateYmd: nextUnreported.reportDateYmd,
        fiscalPeriodLabel: nextUnreported.fiscalPeriodLabel,
        upcomingRevenueFallback: nextUnreported.revenueEstimateDisplay ?? null,
        upcomingEpsFallback: nextUnreported.epsEstimateDisplay ?? null,
        revenueEstimateChangePct,
        epsEstimateChangePct,
      };
    }
    /** All rows reported — still show summary cards from the latest quarter (first row). */
    const latest = rows[0];
    if (!latest) return null;
    return {
      reportDateYmd: latest.reportDateYmd,
      fiscalPeriodLabel: latest.fiscalPeriodLabel,
      upcomingRevenueFallback: latest.revenueEstimateDisplay ?? null,
      upcomingEpsFallback: latest.epsEstimateDisplay ?? null,
      revenueEstimateChangePct,
      epsEstimateChangePct,
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
          aboveHeader={
            summaryForCards ? (
              <EarningsCountdownStats
                reportDateYmd={summaryForCards.reportDateYmd}
                fiscalPeriodLabel={summaryForCards.fiscalPeriodLabel}
                revenueEstimateDisplay={summaryForCards.upcomingRevenueFallback}
                epsEstimateDisplay={summaryForCards.upcomingEpsFallback}
                revenueEstimateChangePct={summaryForCards.revenueEstimateChangePct}
                epsEstimateChangePct={summaryForCards.epsEstimateChangePct}
              />
            ) : null
          }
        />
      ) : null}

      {!loading && !data?.estimatesChart && summaryForCards ? (
        <EarningsCountdownStats
          reportDateYmd={summaryForCards.reportDateYmd}
          fiscalPeriodLabel={summaryForCards.fiscalPeriodLabel}
          revenueEstimateDisplay={summaryForCards.upcomingRevenueFallback}
          epsEstimateDisplay={summaryForCards.upcomingEpsFallback}
          revenueEstimateChangePct={summaryForCards.revenueEstimateChangePct}
          epsEstimateChangePct={summaryForCards.epsEstimateChangePct}
        />
      ) : null}

      {!loading && data && historyRows.length > 0 ? (
        <div className="min-w-0 space-y-6">
          <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Reports</h3>
          <ScreenerTableScroll mobileScroll>
            <table className={reportsTableClass}>
              <ReportsColGroup />
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
                      <td colSpan={7} className="px-2 py-2 sm:px-4">
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
