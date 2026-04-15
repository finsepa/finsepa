"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SkeletonBox } from "@/components/markets/skeleton";
import { EarningsEstimatesChart } from "@/components/stock/earnings-estimates-chart";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import type { StockEarningsReportTiming, StockEarningsTabPayload } from "@/lib/market/stock-earnings-types";
import { cn } from "@/lib/utils";

function dash(v: string | null | undefined): string {
  return v != null && String(v).trim() !== "" ? String(v).trim() : "—";
}

/** Screener-style empty cell (hyphen, not em dash). */
function tableCell(v: string | null | undefined): string {
  const s = v != null && String(v).trim() !== "" ? String(v).trim() : "";
  return s || "-";
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

/** Figma: card value titles — Inter Semi Bold 24 / 36, #09090B. */
const EARNINGS_CARD_VALUE_CLASS =
  "font-['Inter'] text-[24px] font-semibold leading-[36px] tracking-normal text-[#09090B]";

/** Figma: card labels — Inter Semi Bold 14 / 20, #71717A. */
const EARNINGS_CARD_LABEL_CLASS =
  "font-['Inter'] text-[14px] font-semibold leading-5 tracking-normal text-[#71717A]";

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

/** Same rhythm as screener table: `screener-table.tsx` header + row heights. */
const EARNINGS_TABLE_GRID =
  "grid min-w-[min(960px,100%)] w-full grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2";

const screenerNumCell =
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-[#09090B]";

const screenerHeaderNumCell =
  "min-w-0 w-full text-right text-[14px] font-medium leading-5 text-[#71717A]";

function SurpriseCell({ value, pct }: { value: string | null; pct: number | null }) {
  if (!value || value === "—" || value === "-") {
    return <div className={`${screenerNumCell} font-medium text-[#71717A]`}>-</div>;
  }
  const n = pct;
  if (n == null || !Number.isFinite(n)) {
    return <div className={screenerNumCell}>{value}</div>;
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
    <div className="w-full">
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
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white">
        <div className={`${EARNINGS_TABLE_GRID} min-h-[44px] items-center px-4 py-0`}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBox key={i} className="h-4 w-[72%] rounded" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, r) => (
          <div key={r} className={`${EARNINGS_TABLE_GRID} h-[60px] max-h-[60px] items-center px-4`}>
            {Array.from({ length: 7 }).map((_, c) => (
              <SkeletonBox
                key={c}
                className={cn("h-4 rounded", c >= 2 ? "ml-auto w-[65%]" : "w-[72%]")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** SSR-safe shell for `next/dynamic` while the client bundle loads (matches tab title + skeletons). */
export function StockEarningsTabLoading({ showHeading = true }: { showHeading?: boolean } = {}) {
  return (
    <div className="space-y-6 pt-1">
      {showHeading ? (
        <h2 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Earnings</h2>
      ) : null}
      <SummaryCardsSkeleton />
      <EstimatesChartSkeleton />
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
  const earningsHistorySentinelRef = useRef<HTMLDivElement | null>(null);

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

  const historyRows = useMemo(() => data?.history ?? [], [data?.history]);
  const earningsHistoryHasMore = earningsHistoryVisible < historyRows.length;
  const earningsHistorySlice = useMemo(
    () => historyRows.slice(0, earningsHistoryVisible),
    [historyRows, earningsHistoryVisible],
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
    <div className="space-y-6 pt-1">
      {showHeading ? (
        <h2 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Earnings</h2>
      ) : null}

      {loading ? (
        <>
          <SummaryCardsSkeleton />
          <EstimatesChartSkeleton />
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

      {!loading && data && historyRows.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white">
            <div
              className={`${EARNINGS_TABLE_GRID} min-h-[44px] items-center px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]`}
            >
              <div className="text-left">Fiscal period</div>
              <div className="text-left">Report date</div>
              <div className={screenerHeaderNumCell}>EPS est.</div>
              <div className={screenerHeaderNumCell}>EPS actual</div>
              <div className={screenerHeaderNumCell}>Surprise</div>
              <div className={screenerHeaderNumCell}>Rev. est.</div>
              <div className={screenerHeaderNumCell}>Rev. actual</div>
            </div>
            {earningsHistorySlice.map((row, idx) => (
              <div
                key={`${row.fiscalPeriodEndYmd ?? idx}-${row.reportDateDisplay ?? idx}`}
                className={`${EARNINGS_TABLE_GRID} h-[60px] max-h-[60px] items-center bg-white px-4 transition-colors duration-75 hover:bg-neutral-50`}
              >
                <div className="min-w-0 truncate text-left text-[14px] font-normal leading-5 text-[#09090B]">
                  {tableCell(row.fiscalPeriodLabel)}
                </div>
                <div className="min-w-0 truncate text-left text-[14px] font-normal leading-5 text-[#09090B]">
                  {tableCell(row.reportDateDisplay)}
                </div>
                <div className={screenerNumCell}>{tableCell(row.epsEstimateDisplay)}</div>
                <div className={screenerNumCell}>{tableCell(row.epsActualDisplay)}</div>
                <SurpriseCell value={row.surpriseDisplay} pct={row.surprisePct} />
                <div className={screenerNumCell}>{tableCell(row.revenueEstimateDisplay)}</div>
                <div className={screenerNumCell}>{tableCell(row.revenueActualDisplay)}</div>
              </div>
            ))}
            {earningsHistoryHasMore ? (
              <div
                ref={earningsHistorySentinelRef}
                className="pointer-events-none h-1 w-full shrink-0"
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StockEarningsTab({ ticker }: { ticker: string }) {
  return <StockEarningsTabContent ticker={ticker} showHeading />;
}
