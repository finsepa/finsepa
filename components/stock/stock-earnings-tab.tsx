"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
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
import { EarningsCountdownBars } from "@/components/stock/earnings-countdown-bars";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { STOCK_TABLE_LABEL_COL_WIDTH } from "@/components/stock/stock-income-statement-table";
import { parseEarningsReportYmd } from "@/lib/market/earnings-countdown";
import { cn } from "@/lib/utils";
import { whiteSurfaceButtonChromeClass } from "@/components/design-system/secondary-button-styles";

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

type EarningsCountdownInfo = {
  /** e.g. "Q3, Aug 26". */
  nextEarningsLabel: string;
  daysLeft: number;
};

/** `Q1`–`Q4` from a fiscal label like "Q3 2026"; null when unknown. */
function quarterFromFiscalPeriodLabel(fiscalPeriodLabel: string | null | undefined): string | null {
  if (!fiscalPeriodLabel?.trim()) return null;
  const m = fiscalPeriodLabel.trim().match(/\b(Q[1-4])\b/i);
  return m ? m[1]!.toUpperCase() : null;
}

/** Reports row title — `Q1 2026` → `Q1 '26`. */
function formatReportsFiscalPeriodLabel(fiscalPeriodLabel: string | null | undefined): string {
  const raw = fiscalPeriodLabel?.trim();
  if (!raw) return "-";
  const m = raw.match(/^(Q[1-4])\s+(?:20)?(\d{2})$/i);
  if (m) return `${m[1]!.toUpperCase()} '${m[2]!}`;
  return raw;
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

const earningsHeaderStatLabelClass = "text-[13px] font-normal leading-5 text-fg-muted";
const earningsHeaderStatValueClass =
  "text-[16px] font-semibold leading-6 tabular-nums text-fg sm:text-[20px] sm:leading-7";

function EarningsHeaderChangePct({ changePct }: { changePct: number | null | undefined }) {
  if (changePct == null || !Number.isFinite(changePct)) return null;
  return (
    <span
      className={cn(
        earningsHeaderStatLabelClass,
        "font-semibold",
        changePct > 0 ? "text-up" : changePct < 0 ? "text-down" : "text-fg-muted",
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
      <div className="flex flex-col gap-1 border-r border-stroke pr-6">
        <dt className={earningsHeaderStatLabelClass}>Next earnings</dt>
        <dd className={earningsHeaderStatValueClass}>{info ? info.nextEarningsLabel : "TBA"}</dd>
      </div>
      <div className="flex flex-col gap-1 border-r border-stroke pr-6">
        <dt className={earningsHeaderStatLabelClass}>Days left</dt>
        <dd className="flex items-center gap-3">
          <span className={earningsHeaderStatValueClass}>{info ? info.daysLeft : "TBA"}</span>
          {info ? <EarningsCountdownBars daysLeft={info.daysLeft} /> : null}
        </dd>
      </div>
      <div className="flex flex-col gap-1 border-r border-stroke pr-6">
        <dt className={earningsHeaderStatLabelClass}>EPS estimate</dt>
        <dd className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <span className={earningsHeaderStatValueClass}>{epsEstimate ?? "—"}</span>
          {epsEstimate ? <EarningsHeaderChangePct changePct={epsEstimateChangePct} /> : null}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className={earningsHeaderStatLabelClass}>Revenue estimate</dt>
        <dd className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <span className={earningsHeaderStatValueClass}>{revenueEstimate ?? "—"}</span>
          {revenueEstimate ? <EarningsHeaderChangePct changePct={revenueEstimateChangePct} /> : null}
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

/** Reports table chrome — same inset stroke / hover pad as Stocks companies + Financials. */
const REPORTS_GRID_CLASS = "grid min-w-[760px] items-center gap-x-2";
const REPORTS_GRID_STYLE = {
  gridTemplateColumns: `${STOCK_TABLE_LABEL_COL_WIDTH} minmax(7rem, 1.1fr) minmax(6.5rem, 0.9fr) minmax(7rem, 1.1fr) minmax(6.5rem, 0.9fr) 224px`,
} as const;

const reportsHeaderLabelClass = cn(
  "min-w-0 text-left font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted",
  TABLE_START_ALIGNED_PAD_CLASS,
);

const reportsHeaderNumClass = cn(
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const reportsLabelCellClass = cn("min-w-0 text-left", TABLE_START_ALIGNED_PAD_CLASS);

const reportsNumCellClass = cn(
  "min-w-0 w-full text-right font-['Inter'] text-[14px] font-normal leading-5 tabular-nums text-fg",
  TABLE_END_ALIGNED_PAD_CLASS,
);

const reportsActionsCellClass = cn(
  "relative z-[1] flex w-full justify-end",
  TABLE_END_ALIGNED_PAD_CLASS,
);

function surprisePctFromEstimateActual(est: number | null, act: number | null): number | null {
  if (est == null || act == null || !Number.isFinite(est) || !Number.isFinite(act) || est === 0) {
    return null;
  }
  return ((act - est) / Math.abs(est)) * 100;
}

function formatSurprisePctDisplay(pct: number): string {
  if (Math.abs(pct) < 1e-9) return "0.00%";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

type ReportsBeatMissOutcome = "beat" | "miss" | "met";

function resolveReportsBeatMiss(args: {
  estimateDisplay: string | null | undefined;
  actualDisplay: string | null | undefined;
  estimateRaw: number | null;
  actualRaw: number | null;
  surprisePct?: number | null;
  surpriseDisplay?: string | null;
}): { outcome: ReportsBeatMissOutcome | null; pctDisplay: string | null; pct: number | null } {
  const est = tableCell(args.estimateDisplay);
  const act = tableCell(args.actualDisplay);
  const hasBoth = est !== "-" && act !== "-";
  const pct =
    args.surprisePct != null && Number.isFinite(args.surprisePct)
      ? args.surprisePct
      : surprisePctFromEstimateActual(args.estimateRaw, args.actualRaw);

  const outcome: ReportsBeatMissOutcome | null = (() => {
    if (!hasBoth) return null;
    if (est === act) return "met";
    if (pct != null) {
      if (Math.abs(pct) < 1e-9) return "met";
      return pct > 0 ? "beat" : "miss";
    }
    if (args.estimateRaw != null && args.actualRaw != null) {
      if (args.estimateRaw === args.actualRaw) return "met";
      return args.actualRaw > args.estimateRaw ? "beat" : "miss";
    }
    return null;
  })();

  const pctDisplay =
    pct != null
      ? formatSurprisePctDisplay(pct)
      : outcome === "met"
        ? "0.00%"
        : args.surpriseDisplay && args.surpriseDisplay !== "—"
          ? args.surpriseDisplay
          : null;

  return { outcome, pctDisplay, pct };
}

/** Actual EPS / Revenue only (Surprise lives in its own column). */
function ReportsActualCell({ actualDisplay }: { actualDisplay: string | null | undefined }) {
  const act = tableCell(actualDisplay);
  return (
    <div className={reportsNumCellClass}>
      {act === "-" ? (
        <div className="text-[14px] font-medium leading-5 text-fg-muted">-</div>
      ) : (
        <div className="text-[14px] leading-5 tabular-nums text-fg">{act}</div>
      )}
    </div>
  );
}

function ReportsBeatMissCell({
  estimateDisplay,
  actualDisplay,
  estimateRaw,
  actualRaw,
  surprisePct,
  surpriseDisplay,
}: {
  estimateDisplay: string | null | undefined;
  actualDisplay: string | null | undefined;
  estimateRaw: number | null;
  actualRaw: number | null;
  surprisePct?: number | null;
  surpriseDisplay?: string | null;
}) {
  const { outcome, pctDisplay, pct } = resolveReportsBeatMiss({
    estimateDisplay,
    actualDisplay,
    estimateRaw,
    actualRaw,
    surprisePct,
    surpriseDisplay,
  });

  const outcomeLabel =
    outcome === "beat" ? "Beat" : outcome === "miss" ? "Miss" : outcome === "met" ? "Met" : null;
  const outcomeTone =
    outcome === "beat"
      ? "text-up"
      : outcome === "miss"
        ? "text-down"
        : outcome === "met"
          ? "text-fg-muted"
          : null;

  return (
    <div className={cn(reportsNumCellClass, "font-medium")}>
      {outcomeLabel && pctDisplay ? (
        <div className={cn("text-[14px] leading-5 tabular-nums", outcomeTone)}>
          {outcomeLabel} {pctDisplay}
        </div>
      ) : outcomeLabel ? (
        <div className={cn("text-[14px] leading-5", outcomeTone)}>{outcomeLabel}</div>
      ) : pctDisplay ? (
        <div
          className={cn(
            "text-[14px] leading-5 tabular-nums",
            pct != null && pct > 0
              ? "text-up"
              : pct != null && pct < 0
                ? "text-down"
                : "text-fg-muted",
          )}
        >
          {pctDisplay}
        </div>
      ) : (
        <div className="text-[14px] leading-5 text-fg-muted">-</div>
      )}
    </div>
  );
}

function ReportsHeaderRow() {
  return (
    <div
      className={cn(
        SCREENER_TABLE_HEADER_STICKY_CLASS,
        SCREENER_TABLE_ROUNDED_HEADER_CLASS,
        SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
        "md:border-b-0",
      )}
    >
      <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
        <div
          className={cn(REPORTS_GRID_CLASS, "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted")}
          style={REPORTS_GRID_STYLE}
        >
          <div className={reportsHeaderLabelClass}>Date</div>
          <div className={reportsHeaderNumClass}>EPS</div>
          <div className={cn(reportsHeaderNumClass, "whitespace-nowrap")}>Surprise</div>
          <div className={reportsHeaderNumClass}>Revenue</div>
          <div className={cn(reportsHeaderNumClass, "whitespace-nowrap")}>Surprise</div>
          <div className={cn(reportsHeaderNumClass, "whitespace-nowrap")}>
            <span className="sr-only">Document actions</span>
          </div>
        </div>
      </div>
      <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
    </div>
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

function EstimatesHeaderSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-stretch gap-x-6 gap-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-1.5",
              i < 3 && "border-r border-stroke pr-6",
            )}
          >
            <SkeletonBox className="h-4 w-24 rounded" />
            <SkeletonBox className="h-7 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
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
    <div className="w-full space-y-5">
      <div>
        <SkeletonBox className="h-[320px] w-full rounded" />
        <div className="mt-4 flex justify-center gap-6">
          <SkeletonBox className="h-4 w-36 rounded" />
          <SkeletonBox className="h-4 w-36 rounded" />
        </div>
      </div>
      <div className="-mx-1 overflow-x-auto sm:-mx-0">
        <div className="min-w-[640px] overflow-hidden rounded-2xl border border-stroke-subtle bg-surface px-4 py-4 shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
          <SkeletonBox className="h-[200px] w-full rounded" />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <ScreenerTableScroll mobileScroll minWidthClassName="min-w-[760px]">
      <div className="bg-surface">
        <ReportsHeaderRow />
        {Array.from({ length: 4 }).map((_, r) => (
          <div key={r} className={SCREENER_TABLE_DATA_ROW_CLASS}>
            <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
              <div
                className={cn(
                  REPORTS_GRID_CLASS,
                  "min-h-[60px] text-[14px] font-normal leading-5",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
                style={REPORTS_GRID_STYLE}
              >
                <div className={reportsLabelCellClass}>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <SkeletonBox className="h-4 w-[55%] rounded" />
                    <SkeletonBox className="h-3.5 w-[40%] rounded" />
                  </div>
                </div>
                {Array.from({ length: 4 }).map((__, c) => (
                  <div key={c} className={reportsNumCellClass}>
                    <SkeletonBox className="ml-auto block h-4 w-[65%] max-w-16 rounded" />
                  </div>
                ))}
                <div className={reportsActionsCellClass}>
                  <div className="inline-flex w-max max-w-full shrink-0 flex-nowrap justify-end gap-2">
                    <SkeletonBox className="h-9 w-[5.5rem] shrink-0 rounded-[10px]" />
                    <SkeletonBox className="h-9 w-[5.5rem] shrink-0 rounded-[10px]" />
                  </div>
                </div>
              </div>
            </div>
            {r < 3 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
          </div>
        ))}
      </div>
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
  const earningsHistorySentinelRef = useRef<HTMLDivElement | null>(null);

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
    <div className="min-w-0 space-y-5">
      {loading ? (
        <>
          <EstimatesHeaderSkeleton />
          <EstimatesChartSkeleton />
          <div className="min-w-0 space-y-5">
            <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Earnings history</h2>
            <TableSkeleton />
          </div>
        </>
      ) : null}

      {!loading && loadError ? (
        <div className="space-y-3">
          <p className="text-[14px] leading-6 text-fg-muted">
            Earnings data didn&apos;t load. This can happen when the data provider is slow — try again.
          </p>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-[10px] px-3 text-[14px] font-medium text-fg hover:bg-surface-muted",
              whiteSurfaceButtonChromeClass,
            )}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !loadError && empty ? (
        <p className="text-[14px] leading-6 text-fg-muted">No earnings history is available for this symbol.</p>
      ) : null}

      {!loading && data?.estimatesChart ? (
        <EarningsEstimatesSection
          data={data.estimatesChart}
          lastPrice={data.lastPrice ?? null}
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
        <div className="min-w-0 space-y-5">
          <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Earnings history</h2>
          <ScreenerTableScroll mobileScroll minWidthClassName="min-w-[760px]">
            <div className="bg-surface">
              <ReportsHeaderRow />
              {earningsHistoryRendered.map((entry, idx) => {
                const isLast = idx === earningsHistoryRendered.length - 1;
                if (entry.kind === "year") {
                  return (
                    <div key={`reports-year-${entry.year}-${idx}`}>
                      <div className="px-0">
                        <div className="rounded-none bg-surface-section px-[20px] py-2.5">
                          <div className="font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted">
                            {entry.year}
                          </div>
                        </div>
                      </div>
                      {!isLast ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
                    </div>
                  );
                }
                return (
                  <div
                    key={`${entry.row.fiscalPeriodEndYmd ?? idx}-${entry.row.reportDateDisplay ?? idx}`}
                    className={SCREENER_TABLE_DATA_ROW_CLASS}
                  >
                    <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                      <div
                        className={cn(
                          REPORTS_GRID_CLASS,
                          "min-h-[60px] text-[14px] font-normal leading-5",
                          SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                        )}
                        style={REPORTS_GRID_STYLE}
                      >
                        <div className={reportsLabelCellClass}>
                          <div className="truncate font-semibold leading-5 text-fg">
                            {formatReportsFiscalPeriodLabel(entry.row.fiscalPeriodLabel)}
                          </div>
                          <div className="truncate font-['Inter'] text-[14px] font-medium leading-5 text-fg-muted">
                            {reportDayLineFromDisplay(entry.row.reportDateDisplay)}
                          </div>
                        </div>
                        <ReportsActualCell actualDisplay={entry.row.epsActualDisplay} />
                        <ReportsBeatMissCell
                          estimateDisplay={entry.row.epsEstimateDisplay}
                          actualDisplay={entry.row.epsActualDisplay}
                          estimateRaw={entry.row.epsEstimateRaw}
                          actualRaw={entry.row.epsActualRaw}
                          surprisePct={entry.row.surprisePct}
                          surpriseDisplay={entry.row.surpriseDisplay}
                        />
                        <ReportsActualCell actualDisplay={entry.row.revenueActualDisplay} />
                        <ReportsBeatMissCell
                          estimateDisplay={entry.row.revenueEstimateDisplay}
                          actualDisplay={entry.row.revenueActualDisplay}
                          estimateRaw={entry.row.revenueEstimateUsd}
                          actualRaw={entry.row.revenueActualUsd}
                        />
                        <div className={reportsActionsCellClass}>
                          <div className="inline-flex w-max max-w-full justify-end">
                            <EarningsReportRowActions listingTicker={sym} row={entry.row} />
                          </div>
                        </div>
                      </div>
                    </div>
                    {!isLast ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
                  </div>
                );
              })}
              {earningsHistoryHasMore ? (
                <div
                  ref={earningsHistorySentinelRef}
                  className="pointer-events-none h-1"
                  aria-hidden
                />
              ) : null}
            </div>
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
