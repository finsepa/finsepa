"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SkeletonBox } from "@/components/markets/skeleton";
import { EarningsAnnualSummaryTable } from "@/components/stock/earnings-annual-summary-table";
import { EarningsEstimatesChart } from "@/components/stock/earnings-estimates-chart";
import { EarningsReportRowActions } from "@/components/stock/earnings-report-row-actions";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import type {
  StockEarningsHistoryRow,
  StockEarningsReportTiming,
  StockEarningsTabPayload,
} from "@/lib/market/stock-earnings-types";
import { cn } from "@/lib/utils";
import { EARNINGS_CARD_LABEL_CLASS, EARNINGS_CARD_VALUE_CLASS } from "@/components/stock/earnings-card-styles";

function dash(v: string | null | undefined): string {
  return v != null && String(v).trim() !== "" ? String(v).trim() : "—";
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

/** Matches `components/screener/index-cards.tsx` card chrome. */
const SCREENER_INDEX_CARD_CLASS =
  "overflow-hidden rounded-xl border border-[#E4E4E7] bg-white px-4 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_4px_0px_rgba(10,10,10,0.08)]";

function TimingBadge({ timing }: { timing: StockEarningsReportTiming }) {
  if (timing === "amc") {
    return (
      <span className="inline-flex shrink-0" title="After market" role="img" aria-label="After market">
        <PostMarketEarningsIcon />
      </span>
    );
  }
  if (timing === "bmo") {
    return (
      <span className="inline-flex shrink-0" title="Before market" role="img" aria-label="Before market">
        <PreMarketEarningsIcon />
      </span>
    );
  }
  return null;
}

function EarningsSummaryCards({
  reportDateDisplay,
  fiscalPeriodLabel,
  revenueEstimateDisplay,
  epsEstimateDisplay,
  timing,
}: {
  reportDateDisplay: string | null;
  fiscalPeriodLabel: string | null;
  revenueEstimateDisplay: string | null;
  epsEstimateDisplay: string | null;
  timing: StockEarningsReportTiming;
}) {
  const dateLabel = `${quarterPrefixForEarningsDateLabel(fiscalPeriodLabel)} Earnings Date`;
  const badge = <TimingBadge timing={timing} />;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className={`flex h-fit items-center justify-between gap-2 ${SCREENER_INDEX_CARD_CLASS}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
          <p className={EARNINGS_CARD_LABEL_CLASS}>{dateLabel}</p>
          <p className={EARNINGS_CARD_VALUE_CLASS}>{dash(reportDateDisplay)}</p>
        </div>
        {badge}
      </div>
      <div className={`flex h-fit flex-col gap-0.5 text-left ${SCREENER_INDEX_CARD_CLASS}`}>
        <p className={EARNINGS_CARD_LABEL_CLASS}>Estimated Revenue</p>
        <p className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>{dash(revenueEstimateDisplay)}</p>
      </div>
      <div className={`flex h-fit flex-col gap-0.5 text-left ${SCREENER_INDEX_CARD_CLASS}`}>
        <p className={EARNINGS_CARD_LABEL_CLASS}>Estimated EPS</p>
        <p className={`${EARNINGS_CARD_VALUE_CLASS} tabular-nums`}>{dash(epsEstimateDisplay)}</p>
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

/** Number cells in the Reports `<table>` — one table = aligned columns (separate per-row CSS grids do not). */
const earningsReportsTdNum =
  "px-2 py-1.5 text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]";

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

function SurpriseCell({ value, pct }: { value: string | null; pct: number | null }) {
  if (!value || value === "—" || value === "-") {
    return <div className={`${earningsReportsTdNum} font-medium text-[#71717A]`}>-</div>;
  }
  const n = pct;
  if (n == null || !Number.isFinite(n)) {
    return <div className={earningsReportsTdNum}>{value}</div>;
  }
  const pos = n >= 0;
  return (
    <div className={`min-w-0 w-full text-right tabular-nums text-[14px] leading-5 font-medium ${pos ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
      {value}
    </div>
  );
}

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex h-fit gap-2",
            SCREENER_INDEX_CARD_CLASS,
            i === 0 ? "flex-row items-center justify-between" : "flex-col",
          )}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBox className="h-5 w-32 rounded" />
            <SkeletonBox className="h-9 w-36 rounded" />
          </div>
          {i === 0 ? <SkeletonBox className="h-6 w-6 shrink-0 rounded-full" /> : null}
        </div>
      ))}
    </div>
  );
}

function EstimatesChartSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SkeletonBox className="h-7 w-28 rounded" />
          <div className="flex flex-wrap gap-3">
            <SkeletonBox className="h-10 w-[200px] rounded-[10px]" />
            <SkeletonBox className="h-10 w-[200px] rounded-[10px]" />
          </div>
        </div>
        <div>
          <SkeletonBox className="h-[320px] w-full rounded" />
          <div className="mt-4 flex justify-center gap-6">
            <SkeletonBox className="h-4 w-36 rounded" />
            <SkeletonBox className="h-4 w-36 rounded" />
          </div>
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

const reportsTableShell =
  "w-full min-w-0 table-auto border-collapse border-y border-[#E4E4E7] bg-white text-[14px]";

function TableSkeleton() {
  return (
    <div className="min-w-0 w-full max-w-full overflow-x-auto touch-pan-x md:overflow-x-visible [-webkit-overflow-scrolling:touch]">
      <table className={reportsTableShell}>
        <thead>
          <tr className="border-b border-[#E4E4E7]">
            {[
              { pad: "pl-4 pr-2 text-left max-sm:pl-3" },
              { pad: "px-2 text-right" },
              { pad: "px-2 text-right" },
              { pad: "px-2 text-right" },
              { pad: "px-2 text-right" },
              { pad: "px-2 text-right" },
              { pad: "pl-2 pr-4 text-right max-sm:pr-3" },
            ].map((c, i) => (
              <th key={i} scope="col" className={cn("py-2 font-medium text-[#71717A]", c.pad)}>
                <SkeletonBox
                  className={cn("h-4 rounded", i === 0 && "w-[72%]", i > 0 && i < 6 && "ml-auto w-[70%] max-w-20", i === 6 && "ml-auto w-20")}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, r) => (
            <tr key={r} className="border-b border-[#E4E4E7] last:border-b-0">
              <td className="min-w-0 py-1.5 pl-4 pr-2 align-top max-sm:pl-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <SkeletonBox className="h-4 w-[55%] rounded" />
                  <SkeletonBox className="h-3.5 w-[40%] rounded" />
                </div>
              </td>
              <td className="px-2 py-1.5 text-right">
                <SkeletonBox className="ml-auto h-4 w-[65%] max-w-16 rounded" />
              </td>
              <td className="px-2 py-1.5 text-right">
                <SkeletonBox className="ml-auto h-4 w-[65%] max-w-16 rounded" />
              </td>
              <td className="px-2 py-1.5 text-right">
                <SkeletonBox className="ml-auto h-4 w-[50%] max-w-20 rounded" />
              </td>
              <td className="px-2 py-1.5 text-right">
                <SkeletonBox className="ml-auto h-4 w-[65%] max-w-24 rounded" />
              </td>
              <td className="px-2 py-1.5 text-right">
                <SkeletonBox className="ml-auto h-4 w-[65%] max-w-24 rounded" />
              </td>
              <td className="py-1.5 pl-2 pr-4 text-right align-top max-sm:pr-3">
                <div className="inline-flex w-max max-w-full shrink-0 flex-nowrap justify-end gap-2">
                  <SkeletonBox className="h-9 w-[5.5rem] shrink-0 rounded-[10px]" />
                  <SkeletonBox className="h-9 w-[5.5rem] shrink-0 rounded-[10px]" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** SSR-safe shell for `next/dynamic` while the client bundle loads (matches tab title + skeletons). */
export function StockEarningsTabLoading({ showHeading = true }: { showHeading?: boolean } = {}) {
  return (
    <div className="min-w-0 space-y-6 pt-1">
      {showHeading ? (
        <h2 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Earnings</h2>
      ) : null}
      <SummaryCardsSkeleton />
      <EstimatesChartSkeleton />
      <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Reports</h3>
      <TableSkeleton />
    </div>
  );
}

export type StockEarningsTabContentProps = {
  ticker: string;
  /** When set (e.g. modal body), history infinite-scroll observes this scroll container instead of `main`. */
  scrollRoot?: HTMLElement | null;
  /** Stock page shows “Earnings”; calendar modal omits it. */
  showHeading?: boolean;
};

/** Full earnings experience (summary cards, estimates chart, history table) — reusable on stock page and calendar modal. */
export function StockEarningsTabContent({
  ticker,
  scrollRoot = null,
  showHeading = true,
}: StockEarningsTabContentProps) {
  const sym = ticker.trim().toUpperCase();
  /** Defer interactive tree until after mount so SSR HTML always matches the first client paint (avoids hydration drift from HMR / dev caches). */
  const [clientReady, setClientReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StockEarningsTabPayload | null>(null);
  const [earningsHistoryVisible, setEarningsHistoryVisible] = useState(EARNINGS_HISTORY_PAGE_SIZE);
  const earningsHistorySentinelRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setEarningsHistoryVisible(EARNINGS_HISTORY_PAGE_SIZE);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/earnings`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const json = (await res.json()) as StockEarningsTabPayload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sym]);

  const historyRows = useMemo(() => {
    const rows = data?.history ?? [];
    const u = data?.upcoming;
    if (!u?.reportDateYmd) return rows;

    // Prepend a synthetic “upcoming” row so the Reports table always shows the next report.
    // Actuals stay blank ("-"); document buttons stay disabled until sources publish URLs.
    const already =
      rows.some((r) => (r.reportDateYmd && r.reportDateYmd === u.reportDateYmd) || (r.reportDateDisplay && r.reportDateDisplay === u.reportDateDisplay)) ||
      rows.some((r) => (r.fiscalPeriodLabel && u.fiscalPeriodLabel && r.fiscalPeriodLabel === u.fiscalPeriodLabel));
    if (already) return rows;

    const synthetic: StockEarningsHistoryRow = {
      fiscalPeriodEndYmd: null,
      fiscalPeriodLabel: u.fiscalPeriodLabel,
      reportDateDisplay: u.reportDateDisplay,
      reportDateYmd: u.reportDateYmd,
      epsEstimateDisplay: u.epsEstimateDisplay,
      epsActualDisplay: null,
      surprisePct: null,
      surpriseDisplay: null,
      revenueEstimateDisplay: u.revenueEstimateDisplay,
      revenueActualDisplay: null,
      reported: false,
      revenueEstimateUsd: null,
      revenueActualUsd: null,
      epsEstimateRaw: null,
      epsActualRaw: null,
      secSlidesUrl: null,
      secFilingsUrl: null,
    };
    return [synthetic, ...rows];
  }, [data?.history, data?.upcoming]);
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
    return !data.upcoming && (!data.history || data.history.length === 0);
  }, [data]);

  const summaryForCards = useMemo(() => {
    if (!data) return null;
    const rows = data.history ?? [];
    if (data.upcoming) {
      return {
        reportDateDisplay: data.upcoming.reportDateDisplay,
        fiscalPeriodLabel: data.upcoming.fiscalPeriodLabel,
        revenueEstimateDisplay: data.upcoming.revenueEstimateDisplay,
        epsEstimateDisplay: data.upcoming.epsEstimateDisplay,
        timing: data.upcoming.timing,
      };
    }
    const nextUnreported = rows.find((r) => !r.reported);
    if (nextUnreported) {
      return {
        reportDateDisplay: nextUnreported.reportDateDisplay,
        fiscalPeriodLabel: nextUnreported.fiscalPeriodLabel,
        revenueEstimateDisplay: nextUnreported.revenueEstimateDisplay,
        epsEstimateDisplay: nextUnreported.epsEstimateDisplay,
        timing: "unknown" as StockEarningsReportTiming,
      };
    }
    /** All rows reported — still show the three summary cards from the latest quarter (first row). */
    const latest = rows[0];
    if (!latest) return null;
    return {
      reportDateDisplay: latest.reportDateDisplay,
      fiscalPeriodLabel: latest.fiscalPeriodLabel,
      revenueEstimateDisplay: latest.revenueEstimateDisplay,
      epsEstimateDisplay: latest.epsEstimateDisplay,
      timing: "unknown" as StockEarningsReportTiming,
    };
  }, [data]);

  if (!clientReady) {
    return <StockEarningsTabLoading showHeading={showHeading} />;
  }

  return (
    <div className="min-w-0 space-y-6 pt-1">
      {showHeading ? (
        <h2 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Earnings</h2>
      ) : null}

      {loading ? (
        <>
          <SummaryCardsSkeleton />
          <EstimatesChartSkeleton />
          <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Reports</h3>
          <TableSkeleton />
        </>
      ) : null}

      {!loading && empty ? (
        <p className="text-[14px] leading-6 text-[#71717A]">No earnings history is available for this symbol.</p>
      ) : null}

      {!loading && summaryForCards ? (
        <EarningsSummaryCards
          reportDateDisplay={summaryForCards.reportDateDisplay}
          fiscalPeriodLabel={summaryForCards.fiscalPeriodLabel}
          revenueEstimateDisplay={summaryForCards.revenueEstimateDisplay}
          epsEstimateDisplay={summaryForCards.epsEstimateDisplay}
          timing={summaryForCards.timing}
        />
      ) : null}

      {!loading && data?.estimatesChart ? <EarningsEstimatesChart data={data.estimatesChart} /> : null}

      {!loading && data?.estimatesChart?.annual && data.estimatesChart.annual.length > 0 ? (
        <EarningsAnnualSummaryTable annual={data.estimatesChart.annual} />
      ) : null}

      {!loading && data && historyRows.length > 0 ? (
        <div className="min-w-0 space-y-6">
          <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Reports</h3>
          <div className="min-w-0 w-full max-w-full overflow-x-auto touch-pan-x md:overflow-x-visible [-webkit-overflow-scrolling:touch]">
            <table className={reportsTableShell}>
              <thead>
                <tr className="min-h-11 border-b border-[#E4E4E7] text-[14px] font-medium leading-5 text-[#71717A]">
                  <th scope="col" className="min-w-0 py-2 pl-4 pr-2 text-left max-sm:pl-3">
                    Report date
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    EPS est.
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    EPS actual
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    Surprise
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    Rev. est.
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    Rev. actual
                  </th>
                  <th scope="col" className="min-w-0 max-w-[min(100%,20rem)] py-2 pl-2 pr-4 text-right whitespace-nowrap max-sm:pr-3">
                    <span className="sr-only">Document actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {earningsHistoryRendered.map((entry, idx) =>
                  entry.kind === "year" ? (
                    <tr
                      key={`reports-year-${entry.year}-${idx}`}
                      className="border-b border-[#E4E4E7] bg-neutral-100 text-[15px] font-semibold leading-6 text-[#09090B]"
                    >
                      <td colSpan={7} className="px-4 py-2.5 max-sm:px-3">
                        {entry.year}
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={`${entry.row.fiscalPeriodEndYmd ?? idx}-${entry.row.reportDateDisplay ?? idx}`}
                      className="min-h-[60px] border-b border-[#E4E4E7] transition-colors duration-75 last:border-b-0 hover:bg-neutral-50"
                    >
                      <td className="min-w-0 py-1.5 pl-4 pr-2 align-top text-left text-[14px] max-sm:pl-3">
                        <div className="truncate font-semibold leading-5 text-[#09090B]">{tableCell(entry.row.fiscalPeriodLabel)}</div>
                        <div className="truncate text-[13px] font-normal leading-[18px] text-[#71717A]">
                          {reportDayLineFromDisplay(entry.row.reportDateDisplay)}
                        </div>
                      </td>
                      <td className={cn(earningsReportsTdNum, "align-middle")}>{tableCell(entry.row.epsEstimateDisplay)}</td>
                      <td className={cn(earningsReportsTdNum, "align-middle")}>{tableCell(entry.row.epsActualDisplay)}</td>
                      <td className="min-w-0 px-2 py-1.5 text-right align-middle">
                        <SurpriseCell value={entry.row.surpriseDisplay} pct={entry.row.surprisePct} />
                      </td>
                      <td className={cn(earningsReportsTdNum, "align-middle")}>{tableCell(entry.row.revenueEstimateDisplay)}</td>
                      <td className={cn(earningsReportsTdNum, "align-middle")}>{tableCell(entry.row.revenueActualDisplay)}</td>
                      <td className="relative z-[1] min-w-0 max-w-[min(100%,20rem)] py-1.5 pl-2 pr-4 text-right align-top max-sm:pr-3">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StockEarningsTab({ ticker }: { ticker: string }) {
  return <StockEarningsTabContent ticker={ticker} showHeading />;
}
