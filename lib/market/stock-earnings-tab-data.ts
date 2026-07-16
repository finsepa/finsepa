import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import {
  fetchEodhdFundamentalsJson,
  fetchEodhdFundamentalsJsonFresh,
  formatEarningsDateEnUS,
  parseUnknownDateToUtcMs,
} from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdEarningsCalendarForSymbol, type EodhdRawEarningRow } from "@/lib/market/eodhd-earnings-calendar";
import type {
  StockEarningsEstimatesChart,
  StockEarningsEstimatesPoint,
  StockEarningsHistoryRow,
  StockEarningsReportTiming,
  StockEarningsTabPayload,
  StockEarningsUpcoming,
} from "@/lib/market/stock-earnings-types";
import {
  buildReportsTableRows,
  enrichReportedHistoryRevenueFromEstimatesChart,
  quarterlyEstimateMapsByQuarterLabel,
  resolveUpcomingFromEstimates,
} from "@/lib/market/enrich-earnings-history-estimates";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { parseEarningsDocumentHubFromFundamentalsRoot } from "@/lib/market/earnings-report-external-links";
import { applyCuratedIrEarningsDocumentUrls } from "@/lib/market/earnings-ir-curated-lookup";
import {
  SEC_ENRICHMENT_INDEX_FETCHES_FULL,
  SEC_ENRICHMENT_ROWS_FULL,
} from "@/lib/market/ir-seed-limits";
import {
  reportedRowMissingEarningsDocuments,
  reportedRowNeedsIrDocumentSeed,
} from "@/lib/market/earnings-document-url";
import {
  classifyEarningsDocumentWarmResult,
  type EarningsDocumentWarmFailureClass,
} from "@/lib/market/earnings-document-warm-taxonomy";
import {
  applyEarningsDocumentCacheToHistory,
  loadEarningsDocumentCacheForHistory,
  persistResolvedEarningsDocuments,
} from "@/lib/market/earnings-document-cache-store";
import {
  fiscalQuarterLabelFromPeriodEndYmd,
  inferDominantFiscalYearEndMonthDay,
} from "@/lib/market/fiscal-quarter-label";
import { applyIrSeedDocumentUrls, earningsIrSeedResolutionSource } from "@/lib/market/ir-seed-apply";
import {
  enrichEarningsHistoryWithSecDocuments,
  enrichReportedHistoryRevenueFromSec8k,
} from "@/lib/market/sec-edgar-earnings-documents";
import { fetchChartingSeries } from "@/lib/market/eodhd-charting-series";
import {
  applyDerivedEpsToForwardEstimates,
  backfillAnnualEpsEstimates,
  isAnnualForecastPoint,
  mergeFundamentalsIntoAnnualEstimates,
  sliceEarningsHistoryForReports,
} from "@/lib/market/earnings-annual-display";
import { fundamentalsNeedsFreshForRevenueGap } from "@/lib/market/earnings-reported-actuals-overlay";
import { ymdYearLabel } from "@/lib/market/stock-financials-annual-slice";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function startOfTodayUtcMs(): number {
  const today = new Date();
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numFromRow(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) return n;
  }
  return null;
}

/** EODHD `Earnings.History` rows — field names vary by exchange / data vintage. */
const EARNINGS_REVENUE_ESTIMATE_KEYS = [
  "revenueEstimate",
  "RevenueEstimate",
  "estimatedRevenue",
  "EstimatedRevenue",
  "revenueEstimated",
  "estimatedAverageRevenue",
  "EstimatedAverageRevenue",
  "averageRevenueEstimate",
  "AverageRevenueEstimate",
  "consensusRevenueEstimate",
  "ConsensusRevenueEstimate",
  "estimatedSales",
  "EstimatedSales",
  "salesEstimate",
  "SalesEstimate",
  "revenueEst",
  "RevenueEst",
  "revenueConsensus",
  "RevenueConsensus",
  "revEstimate",
  "RevEstimate",
  "revenueAverage",
  "RevenueAverage",
  "averageRevenue",
  "AverageRevenue",
  "avgRevenue",
  "AvgRevenue",
  "revenueEstimates",
  "RevenueEstimates",
];

const EARNINGS_REVENUE_ACTUAL_KEYS = [
  "revenueActual",
  "RevenueActual",
  "actualRevenue",
  "ActualRevenue",
  "revenue_actual",
  "reportedRevenue",
  "ReportedRevenue",
  "salesActual",
  "SalesActual",
  "revenueReported",
  "RevenueReported",
  "revActual",
  "RevActual",
  "totalRevenueReported",
  "TotalRevenueReported",
  /** Some `Earnings.History` rows only expose GAAP revenue under the same keys as financials. */
  "totalRevenue",
  "TotalRevenue",
];

const INCOME_STATEMENT_REVENUE_KEYS = [
  "totalRevenue",
  "TotalRevenue",
  "revenue",
  "Revenue",
  "totalRevenueFromOperations",
  "Sales",
];

/**
 * Map fiscal period-end `YYYY-MM-DD` → reported total revenue from income statements
 * (quarterly first, then yearly fill-in) for rows where `Earnings.History` omits revenue actual.
 */
function buildRevenueByFiscalPeriodEndYmd(root: Record<string, unknown>): Map<string, number> {
  const out = new Map<string, number>();
  const ingest = (block: unknown) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return;
    const b = block as Record<string, unknown>;
    for (const [periodKey, row] of Object.entries(b)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const ymd = toYmdUtcFromUnknown(periodKey);
      if (!ymd) continue;
      const rev = numFromRow(row as Record<string, unknown>, INCOME_STATEMENT_REVENUE_KEYS);
      if (rev == null) continue;
      if (!out.has(ymd)) out.set(ymd, rev);
    }
  };

  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return out;
  const f = fin as Record<string, unknown>;
  const is = (f.Income_Statement ?? f.IncomeStatement) as unknown;
  if (!is || typeof is !== "object") return out;
  const inc = is as Record<string, unknown>;
  ingest(inc.quarterly ?? inc.Quarterly);
  ingest(inc.yearly ?? inc.Yearly);
  return out;
}

/** Last-resort: any numeric field whose name suggests revenue + estimate. */
function revenueEstimateFromLooseKeys(row: Record<string, unknown>): number | null {
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase();
    const looksRev = kl.includes("revenue") || kl.includes("sales") || kl.includes("turnover");
    const looksEst =
      kl.includes("est") ||
      kl.includes("avg") ||
      kl.includes("mean") ||
      kl.includes("consensus") ||
      kl.includes("forecast") ||
      kl.includes("expected") ||
      kl.includes("projected") ||
      kl.includes("guidance");
    if (!looksRev || !looksEst) continue;
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

/** Last-resort: EPS consensus fields on `Earnings.Trend` rows (`earningsEstimateAvg`, etc.). */
function epsEstimateFromLooseKeys(row: Record<string, unknown>): number | null {
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase();
    const looksEps =
      kl.includes("eps") ||
      (kl.includes("earnings") &&
        (kl.includes("est") || kl.includes("avg") || kl.includes("mean") || kl.includes("consensus")));
    if (!looksEps) continue;
    if (
      kl.includes("actual") ||
      kl.includes("report") ||
      kl.includes("yoy") ||
      kl.includes("growth") ||
      kl.includes("pct") ||
      kl.includes("percent") ||
      kl.includes("surprise") ||
      kl.includes("numberofanalysts")
    ) {
      continue;
    }
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

/** Any revenue-like numeric that is not clearly “actual / reported / yoy”. */
function revenueEstimateFromRevenueNamedFields(row: Record<string, unknown>): number | null {
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase();
    if (!(kl.includes("revenue") || kl.includes("sales"))) continue;
    if (
      kl.includes("actual") ||
      kl.includes("report") ||
      kl.includes("posted") ||
      kl.includes("yoy") ||
      kl.includes("growth") ||
      kl.includes("qoq") ||
      kl.includes("pct") ||
      kl.includes("percent") ||
      kl.includes("ratio") ||
      kl.includes("margin")
    ) {
      continue;
    }
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

/**
 * EODHD often encodes revenue **estimates** in millions USD while income-statement / GAAP lines are full USD.
 * Scale when the raw number is implausibly small next to actual revenue for the same fiscal period.
 */
function coerceRevenueEstimateToUsd(raw: number, actualUsd: number | null): number {
  if (!Number.isFinite(raw)) return raw;
  const absR = Math.abs(raw);
  const absA = actualUsd != null && Number.isFinite(actualUsd) ? Math.abs(actualUsd) : null;

  if (absA != null && absA > 1e9) {
    const scaledM = raw * 1e6;
    if (absR >= 50 && absR < 2e7 && scaledM > absA * 0.12 && scaledM < absA * 5) return scaledM;
    const scaledB = raw * 1e9;
    if (absR >= 0.5 && absR < 500 && scaledB > absA * 0.12 && scaledB < absA * 5) return scaledB;
  }

  if (absA == null && absR >= 500 && absR < 2e7) return raw * 1e6;

  return raw;
}

/** `Earnings.History` is usually a period-keyed object; some feeds use an array or only `Earnings.Annual`. */
function collectEarningsHistoryRawRows(earn: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const history = earn.History;
  if (Array.isArray(history)) {
    for (const row of history) {
      if (row && typeof row === "object" && !Array.isArray(row)) out.push(row as Record<string, unknown>);
    }
  } else if (history && typeof history === "object") {
    for (const row of Object.values(history as Record<string, unknown>)) {
      if (row && typeof row === "object" && !Array.isArray(row)) out.push(row as Record<string, unknown>);
    }
  }
  if (out.length > 0) return out;

  const annual = earn.Annual;
  if (!annual || typeof annual !== "object" || Array.isArray(annual)) return out;
  for (const [periodKey, row] of Object.entries(annual as Record<string, unknown>)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    out.push({
      ...r,
      date: r.date ?? r.Date ?? periodKey,
      periodEnd: r.periodEnd ?? r.PeriodEnd ?? periodKey,
    });
  }
  return out;
}

function fundamentalsHasEarningsRows(root: Record<string, unknown>): boolean {
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return false;
  return collectEarningsHistoryRawRows(earn as Record<string, unknown>).length > 0;
}

function ymdDaysAgoUtc(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return toYmdUtc(d);
}

/** Cached fundamentals; fresh retry on cache miss or recent statement gaps after earnings. */
async function fetchFundamentalsRootForEarningsTab(ticker: string): Promise<Record<string, unknown> | null> {
  let root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return fetchEodhdFundamentalsJsonFresh(ticker);
  if (fundamentalsNeedsFreshForRevenueGap(root)) {
    const fresh = await fetchEodhdFundamentalsJsonFresh(ticker);
    if (fresh) root = fresh;
  }
  return root;
}

function collectEarningsTrendRows(trend: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (!trend) return out;
  if (Array.isArray(trend)) {
    for (const row of trend) {
      if (row && typeof row === "object" && !Array.isArray(row)) out.push(row as Record<string, unknown>);
    }
    return out;
  }
  if (typeof trend === "object" && !Array.isArray(trend)) {
    for (const v of Object.values(trend as Record<string, unknown>)) {
      if (v && typeof v === "object" && !Array.isArray(v)) out.push(v as Record<string, unknown>);
    }
  }
  return out;
}

const EARNINGS_EPS_ESTIMATE_KEYS = [
  "epsEstimate",
  "epsEstimated",
  "estimatedEps",
  "estimatedEPS",
  "EPSEstimate",
  "epsAverage",
  "epsAvg",
  /** EODHD `Earnings.Trend` quarterly / annual consensus rows */
  "earningsEstimateAvg",
  "earningsEstimateAverage",
  "EarningsEstimateAvg",
  "epsTrendCurrent",
  "epsTrend7daysAgo",
];

/** Quarterly/history rows — may include generic `eps` fields. */
const INCOME_STATEMENT_EPS_KEYS = [
  "dilutedEPS",
  "DilutedEPS",
  "epsDiluted",
  "dilutedEps",
  "DilutedEps",
  "normalizedDilutedEPS",
  "NormalizedDilutedEPS",
  "trailingEps",
  "TrailingEps",
  "trailingEPS",
  "TrailingEPS",
  "eps",
  "EPS",
  "basicEPS",
  "BasicEPS",
  "basicEps",
  "BasicEps",
];

/** Yearly income only — avoid bare `eps` that EODHD sometimes maps to a single quarter. */
const ANNUAL_INCOME_STATEMENT_EPS_KEYS = [
  "dilutedEPS",
  "DilutedEPS",
  "epsDiluted",
  "dilutedEps",
  "DilutedEps",
  "normalizedDilutedEPS",
  "NormalizedDilutedEPS",
  "basicEPS",
  "BasicEPS",
  "basicEps",
  "BasicEps",
];

const INCOME_STATEMENT_NET_INCOME_KEYS = [
  "netIncome",
  "NetIncome",
  "netIncomeApplicableToCommonShares",
  "NetIncomeApplicableToCommonShares",
];

const INCOME_STATEMENT_SHARES_KEYS = [
  "weightedAverageShsOutDil",
  "weightedAverageShsOutDiluted",
  "WeightedAverageShsOutDil",
  "weightedAverageShsOut",
  "WeightedAverageShsOut",
  "weightedAverageShares",
  "WeightedAverageShares",
  "commonStockSharesOutstanding",
  "CommonStockSharesOutstanding",
];

const BALANCE_SHEET_SHARES_KEYS = [
  "commonStockSharesOutstanding",
  "CommonStockSharesOutstanding",
  "commonStockTotalSharesOutstanding",
  "CommonStockTotalSharesOutstanding",
];

/** When yearly income uses `YYYY-MM-DD` but `Earnings.Trend` uses a nearby fiscal end, pick closest trend EPS in the same calendar year (within ~4 months). */
function nearestEpsTrendForAnnualYmd(ymd: string, epsTrend: Map<string, number>): number | null {
  const direct = epsTrend.get(ymd);
  if (direct != null) return direct;
  const targetMs = parseUnknownDateToUtcMs(ymd);
  if (targetMs == null) return null;
  const yPrefix = ymd.slice(0, 4);
  let best: number | null = null;
  let bestDist = Infinity;
  const maxMs = 125 * 24 * 60 * 60 * 1000;
  for (const [k, v] of epsTrend) {
    if (!k.startsWith(yPrefix)) continue;
    const km = parseUnknownDateToUtcMs(k);
    if (km == null) continue;
    const d = Math.abs(km - targetMs);
    if (d <= maxMs && d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

export type EpsEstimateTrendMaps = {
  quarterly: Map<string, number>;
  annual: Map<string, number>;
};

function yearlyIncomePeriodEndYmds(root: Record<string, unknown>): Set<string> {
  const block = getYearlyIncomeBlock(root);
  if (!block) return new Set();
  const ymds = new Set<string>();
  for (const periodKey of Object.keys(block)) {
    const ymd = toYmdUtcFromUnknown(periodKey);
    if (ymd) ymds.add(ymd);
  }
  return ymds;
}

function isAnnualFiscalYearEndTrendYmd(
  ymd: string,
  yearlyPeriodEnds: Set<string>,
  dominantFyEndMonthDay: string | null,
): boolean {
  if (yearlyPeriodEnds.has(ymd)) return true;
  if (dominantFyEndMonthDay && ymd.slice(5) === dominantFyEndMonthDay) return true;
  const targetMs = parseUnknownDateToUtcMs(ymd);
  if (targetMs == null) return false;
  const yPrefix = ymd.slice(0, 4);
  const maxMs = 125 * 24 * 60 * 60 * 1000;
  for (const k of yearlyPeriodEnds) {
    if (!k.startsWith(yPrefix)) continue;
    const km = parseUnknownDateToUtcMs(k);
    if (km == null) continue;
    if (Math.abs(km - targetMs) <= maxMs) return true;
  }
  return false;
}

function roundAnnualEpsDerived(v: number): number {
  return Math.round(v * 100) / 100;
}

function quarterlyPointHasReportedActuals(p: StockEarningsEstimatesPoint): boolean {
  return (
    p.reported ||
    (p.epsActual != null && Number.isFinite(p.epsActual)) ||
    (p.revenueActualUsd != null && Number.isFinite(p.revenueActualUsd))
  );
}

function deriveAnnualEpsFromNetIncomeAndShares(
  incomeRow: Record<string, unknown>,
  balanceSheetRow: Record<string, unknown> | null,
): number | null {
  const ni = numFromRow(incomeRow, INCOME_STATEMENT_NET_INCOME_KEYS);
  if (ni == null || !Number.isFinite(ni)) return null;
  const sh =
    numFromRow(incomeRow, INCOME_STATEMENT_SHARES_KEYS) ??
    (balanceSheetRow ? numFromRow(balanceSheetRow, BALANCE_SHEET_SHARES_KEYS) : null);
  if (sh == null || !Number.isFinite(sh) || Math.abs(sh) < 1e-6) return null;
  const eps = ni / sh;
  if (!Number.isFinite(eps)) return null;
  return roundAnnualEpsDerived(eps);
}

function historyRowsInFiscalYearEnding(
  fyEndYmd: string,
  history: StockEarningsHistoryRow[],
): StockEarningsHistoryRow[] {
  const endMs = parseUnknownDateToUtcMs(fyEndYmd);
  if (endMs == null) return [];
  const startMs = endMs - 366 * 24 * 60 * 60 * 1000;
  return history.filter((r) => {
    if (!r.reported) return false;
    const ymd = r.fiscalPeriodEndYmd;
    if (!ymd) return false;
    const ms = parseUnknownDateToUtcMs(ymd);
    if (ms == null) return false;
    return ms > startMs && ms <= endMs;
  });
}

function sumReportedEpsForFiscalYear(
  fyEndYmd: string,
  history: StockEarningsHistoryRow[],
): number | null {
  const rows = historyRowsInFiscalYearEnding(fyEndYmd, history);
  const epsVals = rows
    .map((r) => r.epsActualRaw)
    .filter((n): n is number => n != null && Number.isFinite(n));
  if (epsVals.length < 2) return null;
  const sum = epsVals.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum <= 0) return null;
  return roundAnnualEpsDerived(sum);
}

function enrichAnnualEpsActualFromHistory(
  annual: StockEarningsEstimatesPoint[],
  history: StockEarningsHistoryRow[],
): StockEarningsEstimatesPoint[] {
  return annual.map((p) => {
    if (p.epsActual != null && Number.isFinite(p.epsActual)) return p;
    if (!p.reported || !/^\d{4}-\d{2}-\d{2}$/.test(p.sortKey)) return p;
    const summed = sumReportedEpsForFiscalYear(p.sortKey, history);
    if (summed == null) return p;
    return { ...p, epsActual: summed };
  });
}

/**
 * `Earnings.Trend` mixes quarterly and FY EPS — split by fiscal year-end alignment first, then magnitude.
 * Fiscal period-end keys only (no report dates).
 */
function buildEpsEstimateTrendMaps(root: Record<string, unknown>): EpsEstimateTrendMaps {
  const quarterly = new Map<string, number>();
  const annual = new Map<string, number>();
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return { quarterly, annual };
  const trend = (earn as Record<string, unknown>).Trend;
  const rows = collectEarningsTrendRows(trend);
  const yearlyPeriodEnds = yearlyIncomePeriodEndYmds(root);
  const dominantFyEndMonthDay = inferDominantFiscalYearEndMonthDay(yearlyPeriodEnds);

  const parsed: { ymds: string[]; est: number }[] = [];
  for (const r of rows) {
    let est = numFromRow(r, EARNINGS_EPS_ESTIMATE_KEYS);
    if (est == null) est = epsEstimateFromLooseKeys(r);
    if (est == null || !Number.isFinite(est)) continue;
    const ymds = trendRowFiscalPeriodEndYmds(r);
    if (ymds.length === 0) continue;
    parsed.push({ ymds, est });
  }

  const median = medianPositive(parsed.map((p) => p.est));
  const annualThreshold = Math.max(median * 2.25, 1);

  for (const { ymds, est } of parsed) {
    const anyAnnualEnd = ymds.some((ymd) =>
      isAnnualFiscalYearEndTrendYmd(ymd, yearlyPeriodEnds, dominantFyEndMonthDay),
    );
    const target = anyAnnualEnd || est >= annualThreshold ? annual : quarterly;
    for (const ymd of ymds) {
      if (!target.has(ymd)) target.set(ymd, est);
    }
  }

  return { quarterly, annual };
}

/** Fiscal period-end keys only — report dates must not map FY revenue onto a single quarter. */
function trendRowFiscalPeriodEndYmds(r: Record<string, unknown>): string[] {
  const ymds = new Set<string>();
  for (const raw of [
    r.date,
    r.Date,
    r.periodEnd,
    r.PeriodEnd,
    r.endDate,
    r.EndDate,
    r.fiscalDate,
    r.FiscalDate,
  ]) {
    const y = toYmdUtcFromUnknown(raw);
    if (y) ymds.add(y);
  }
  return [...ymds];
}

function medianPositive(values: number[]): number {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

export type RevenueEstimateTrendMaps = {
  /** Per-quarter consensus revenue (Earnings.Trend). */
  quarterly: Map<string, number>;
  /** Full-year / FY revenue estimates — for annual chart only. */
  annual: Map<string, number>;
};

/**
 * EODHD `Earnings.Trend` mixes quarterly and FY revenue rows. Split by magnitude so Q3 columns
 * do not inherit ~$400B annual estimates keyed on fiscal year-end dates.
 */
function buildRevenueEstimateTrendMaps(root: Record<string, unknown>): RevenueEstimateTrendMaps {
  const quarterly = new Map<string, number>();
  const annual = new Map<string, number>();
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return { quarterly, annual };
  const trend = (earn as Record<string, unknown>).Trend;
  const rows = collectEarningsTrendRows(trend);

  const parsed: { ymds: string[]; est: number }[] = [];
  for (const r of rows) {
    let est = numFromRow(r, EARNINGS_REVENUE_ESTIMATE_KEYS);
    if (est == null) est = revenueEstimateFromLooseKeys(r);
    if (est == null) est = revenueEstimateFromRevenueNamedFields(r);
    if (est == null || !Number.isFinite(est)) continue;
    est = coerceRevenueEstimateToUsd(est, null);
    const ymds = trendRowFiscalPeriodEndYmds(r);
    if (ymds.length === 0) continue;
    parsed.push({ ymds, est });
  }

  const median = medianPositive(parsed.map((p) => p.est));
  const annualThreshold = Math.max(median * 2.25, 1);

  for (const { ymds, est } of parsed) {
    const target = est >= annualThreshold ? annual : quarterly;
    for (const ymd of ymds) {
      if (!target.has(ymd)) target.set(ymd, est);
    }
  }

  return { quarterly, annual };
}

/** Drop FY-scale revenue mistaken for a single quarter (chart + history table). */
function sanitizeQuarterlyRevenueEstimateUsd(
  estimate: number | null,
  actualUsd: number | null,
): number | null {
  if (estimate == null || !Number.isFinite(estimate)) return null;
  const coerced = coerceRevenueEstimateToUsd(estimate, actualUsd);
  if (actualUsd != null && Number.isFinite(actualUsd) && actualUsd > 0) {
    if (coerced > actualUsd * 2.25) return null;
    return coerced;
  }
  if (coerced > 180e9) return null;
  return coerced;
}

function toYmdUtcFromUnknown(raw: unknown): string | null {
  const ms = parseUnknownDateToUtcMs(raw);
  if (ms == null) return null;
  return toYmdUtc(new Date(ms));
}

function quarterLabelFromPeriodEndYmd(
  ymd: string | null,
  fyEndMonthDay: string | null = null,
): string | null {
  return fiscalQuarterLabelFromPeriodEndYmd(ymd, fyEndMonthDay);
}

/** Report / announcement date for the row (same field order as `historyRowFromRaw`). */
function earningsHistoryReportYmd(r: Record<string, unknown>): string | null {
  return (
    toYmdUtcFromUnknown(r.reportDate ?? r.ReportDate ?? r.report_date) ??
    toYmdUtcFromUnknown(r.date ?? r.Date)
  );
}

/** True when the row’s report date is after today (UTC calendar day). Upcoming quarters often ship `epsActual: 0` as a placeholder — treat as not yet reported. */
function isEarningsReportDateStrictlyFuture(r: Record<string, unknown>): boolean {
  const ymd = earningsHistoryReportYmd(r);
  if (!ymd) return false;
  const todayYmd = toYmdUtc(new Date());
  return ymd > todayYmd;
}

function rowHasEpsActualField(r: Record<string, unknown>): boolean {
  const a = r.epsActual ?? r.EPSActual ?? r.eps_actual;
  if (a == null || a === "") return false;
  if (typeof a === "string" && !a.trim()) return false;
  return true;
}

function rowHasRevenueActualField(r: Record<string, unknown>): boolean {
  return numFromRow(r, EARNINGS_REVENUE_ACTUAL_KEYS) != null;
}

function rowIsReported(r: Record<string, unknown>): boolean {
  if (isEarningsReportDateStrictlyFuture(r)) return false;
  if (rowHasEpsActualField(r)) return true;
  /** EODHD sometimes lags `epsActual` while revenue / GAAP lines are already present. */
  return rowHasRevenueActualField(r);
}

function formatEps(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function surprisePctFromRow(row: Record<string, unknown>, epsEst: number | null, epsAct: number | null): number | null {
  const direct = numFromRow(row, [
    "surprisePercent",
    "surprise",
    "epsSurprisePercent",
    "EPSSurprisePercent",
    "eps_surprise_percent",
    "surprisePercentage",
  ]);
  if (direct != null) return direct;
  if (epsEst == null || epsAct == null || epsEst === 0) return null;
  return ((epsAct - epsEst) / Math.abs(epsEst)) * 100;
}

function formatSurprisePct(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function timingFromCalendar(raw: string | null | undefined): {
  timing: StockEarningsReportTiming;
  timingShortLabel: string;
  timingPhrase: string;
} {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("before")) {
    return { timing: "bmo", timingShortLabel: "BMO", timingPhrase: "Before market" };
  }
  if (s.includes("after")) {
    return { timing: "amc", timingShortLabel: "AMC", timingPhrase: "After market" };
  }
  return { timing: "unknown", timingShortLabel: "", timingPhrase: "" };
}

function eodhdListingCode(listingTicker: string): string {
  return `${listingTicker.trim().toUpperCase().replace(/\./g, "-")}.US`;
}

function normalizeCalendarReportYmd(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return toYmdUtc(new Date(t));
}

function pickCalendarTimingForReport(
  rows: EodhdRawEarningRow[],
  wantCode: string,
  reportYmd: string | null,
): string | null {
  if (!reportYmd) return null;
  for (const r of rows) {
    const code = r.code?.trim().toUpperCase();
    if (!code || code !== wantCode) continue;
    const cal = normalizeCalendarReportYmd(r.report_date) ?? normalizeCalendarReportYmd(r.date);
    if (cal === reportYmd) {
      return r.before_after_market ?? null;
    }
  }
  return null;
}

function historyRowFromRaw(
  r: Record<string, unknown>,
  revenueByFiscalPeriodEnd: Map<string, number>,
  quarterlyRevenueEstimateFromTrend: Map<string, number>,
  quarterlyEpsEstimateFromTrend: Map<string, number>,
  quarterlyRevenueEstimateByLabel: Map<string, number>,
  quarterlyEpsEstimateByLabel: Map<string, number>,
  fyEndMonthDay: string | null = null,
): StockEarningsHistoryRow {
  const explicitPeriodEndYmd = toYmdUtcFromUnknown(
    r.periodEnd ?? r.PeriodEnd ?? r.endDate ?? r.EndDate ?? r.fiscalDate ?? r.FiscalDate,
  );
  const rawRowDateYmd = toYmdUtcFromUnknown(r.date ?? r.Date);
  const reported = rowIsReported(r);
  /** Forward rows often use `date` as the announcement date — not the fiscal period end. */
  const fiscalPeriodEndYmd =
    explicitPeriodEndYmd ?? (reported ? rawRowDateYmd : null);

  const reportDateDisplay =
    formatEarningsDateEnUS(r.reportDate ?? r.ReportDate ?? r.report_date) ??
    formatEarningsDateEnUS(r.date ?? r.Date);

  const fiscalPeriodLabel =
    quarterLabelFromPeriodEndYmd(fiscalPeriodEndYmd, fyEndMonthDay) ??
    quarterLabelFromPeriodEndYmd(rawRowDateYmd, fyEndMonthDay);

  let epsEst = numFromRow(r, [
    "epsEstimate",
    "epsEstimated",
    "estimatedEps",
    "estimatedEPS",
    "EPSEstimate",
    "epsAverage",
    "epsAvg",
  ]);
  if (epsEst == null && fiscalPeriodEndYmd) {
    epsEst = quarterlyEpsEstimateFromTrend.get(fiscalPeriodEndYmd) ?? null;
  }
  if (epsEst == null && fiscalPeriodLabel) {
    epsEst = quarterlyEpsEstimateByLabel.get(fiscalPeriodLabel) ?? null;
  }
  const epsAct = numFromRow(r, [
    "epsActual",
    "EPSActual",
    "eps_actual",
    "actualEps",
    "ActualEPS",
    "reportedEps",
    "ReportedEPS",
    "gaapEPS",
    "GAAP_EPS",
  ]);

  let revAct = numFromRow(r, EARNINGS_REVENUE_ACTUAL_KEYS);
  if (revAct == null && fiscalPeriodEndYmd) {
    const fromStmt = revenueByFiscalPeriodEnd.get(fiscalPeriodEndYmd);
    if (fromStmt != null) revAct = fromStmt;
  }

  let revEst = numFromRow(r, EARNINGS_REVENUE_ESTIMATE_KEYS);
  if (revEst == null) revEst = revenueEstimateFromLooseKeys(r);
  if (revEst == null) revEst = revenueEstimateFromRevenueNamedFields(r);
  if (revEst == null && fiscalPeriodEndYmd) {
    revEst = quarterlyRevenueEstimateFromTrend.get(fiscalPeriodEndYmd) ?? null;
  }
  if (revEst == null && fiscalPeriodLabel) {
    revEst = quarterlyRevenueEstimateByLabel.get(fiscalPeriodLabel) ?? null;
  }
  if (revEst == null && revAct != null) {
    const revSurprisePct = numFromRow(r, [
      "revenueSurprise",
      "RevenueSurprise",
      "revenueSurprisePercent",
      "RevenueSurprisePercent",
      "revenue_surprise_percent",
      "salesSurprise",
      "SalesSurprise",
    ]);
    if (revSurprisePct != null && Math.abs(revSurprisePct) < 500 && revSurprisePct !== -100) {
      const denom = 1 + revSurprisePct / 100;
      if (Math.abs(denom) > 1e-6) {
        const implied = revAct / denom;
        if (Number.isFinite(implied) && implied > 0) revEst = implied;
      }
    }
  }
  if (revEst != null) {
    revEst = sanitizeQuarterlyRevenueEstimateUsd(revEst, revAct);
  }

  const surprisePct = reported ? surprisePctFromRow(r, epsEst, epsAct) : null;

  return {
    fiscalPeriodEndYmd,
    fiscalPeriodLabel,
    reportDateDisplay,
    reportDateYmd: earningsHistoryReportYmd(r),
    epsEstimateDisplay: epsEst != null ? formatEps(epsEst) : null,
    epsActualDisplay: reported && epsAct != null ? formatEps(epsAct) : null,
    surprisePct,
    surpriseDisplay: reported ? formatSurprisePct(surprisePct) : null,
    revenueEstimateDisplay: revEst != null ? formatUsdCompact(revEst) : null,
    revenueActualDisplay: revAct != null ? formatUsdCompact(revAct) : null,
    reported,
    revenueEstimateUsd: revEst,
    revenueActualUsd: revAct,
    epsEstimateRaw: epsEst,
    epsActualRaw: epsAct,
    secSlidesUrl: null,
    secFilingsUrl: null,
  };
}

function getYearlyIncomeBlock(root: Record<string, unknown>): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const f = fin as Record<string, unknown>;
  const is = (f.Income_Statement ?? f.IncomeStatement) as unknown;
  if (!is || typeof is !== "object") return null;
  const inc = is as Record<string, unknown>;
  const block = inc.yearly ?? inc.Yearly;
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  return block as Record<string, unknown>;
}

function getYearlyBalanceSheetBlock(root: Record<string, unknown>): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const f = fin as Record<string, unknown>;
  const bs = (f.Balance_Sheet ?? f.BalanceSheet) as unknown;
  if (!bs || typeof bs !== "object") return null;
  const sheet = bs as Record<string, unknown>;
  const block = sheet.yearly ?? sheet.Yearly;
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  return block as Record<string, unknown>;
}

function mergeQuarterlyEstimatePoint(
  prev: StockEarningsEstimatesPoint,
  next: StockEarningsEstimatesPoint,
): StockEarningsEstimatesPoint {
  return {
    ...next,
    revenueEstimateUsd: next.revenueEstimateUsd ?? prev.revenueEstimateUsd,
    epsEstimate: next.epsEstimate ?? prev.epsEstimate,
    revenueActualUsd: next.revenueActualUsd ?? prev.revenueActualUsd,
    epsActual: next.epsActual ?? prev.epsActual,
    reported: prev.reported || next.reported,
  };
}

function buildQuarterlyEstimatesFromHistory(history: StockEarningsHistoryRow[]): StockEarningsEstimatesPoint[] {
  const byKey = new Map<string, StockEarningsEstimatesPoint>();
  for (const r of [...history].reverse()) {
    if (!r.fiscalPeriodEndYmd && !r.fiscalPeriodLabel) continue;
    const sortKey = r.fiscalPeriodEndYmd ?? r.fiscalPeriodLabel ?? "";
    const revAct = r.reported ? r.revenueActualUsd : null;
    const next: StockEarningsEstimatesPoint = {
      sortKey,
      label: r.fiscalPeriodLabel ?? "—",
      revenueEstimateUsd: sanitizeQuarterlyRevenueEstimateUsd(r.revenueEstimateUsd, revAct),
      revenueActualUsd: revAct,
      epsEstimate: r.epsEstimateRaw,
      epsActual: r.reported ? r.epsActualRaw : null,
      reported: r.reported,
    };
    const prev = byKey.get(sortKey);
    byKey.set(sortKey, prev ? mergeQuarterlyEstimatePoint(prev, next) : next);
  }
  return [...byKey.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/** Copy reported EPS / revenue actuals (+ missing estimates) from history into quarterly chart points. */
function backfillQuarterlyActualsFromHistory(
  quarterly: StockEarningsEstimatesPoint[],
  history: StockEarningsHistoryRow[],
): StockEarningsEstimatesPoint[] {
  const historyByYmd = new Map<string, StockEarningsHistoryRow>();
  const historyByLabel = new Map<string, StockEarningsHistoryRow>();
  for (const row of history) {
    if (row.fiscalPeriodEndYmd) historyByYmd.set(row.fiscalPeriodEndYmd, row);
    if (row.fiscalPeriodLabel) historyByLabel.set(row.fiscalPeriodLabel, row);
  }

  return quarterly.map((point) => {
    const hist = historyByYmd.get(point.sortKey) ?? historyByLabel.get(point.label);
    if (!hist?.reported) return point;

    let next = point;
    if (next.epsActual == null && hist.epsActualRaw != null && Number.isFinite(hist.epsActualRaw)) {
      next = { ...next, epsActual: hist.epsActualRaw, reported: true };
    }
    if (next.revenueActualUsd == null && hist.revenueActualUsd != null && Number.isFinite(hist.revenueActualUsd)) {
      next = { ...next, revenueActualUsd: hist.revenueActualUsd, reported: true };
    }
    if (next.epsEstimate == null && hist.epsEstimateRaw != null && Number.isFinite(hist.epsEstimateRaw)) {
      next = { ...next, epsEstimate: hist.epsEstimateRaw };
    }
    if (next.revenueEstimateUsd == null && hist.revenueEstimateUsd != null && Number.isFinite(hist.revenueEstimateUsd)) {
      next = { ...next, revenueEstimateUsd: hist.revenueEstimateUsd };
    }
    return next;
  });
}

/** Restore consensus revenue on reported quarters so Estimates beat/miss lines can render. */
function backfillQuarterlyRevenueEstimates(
  quarterly: StockEarningsEstimatesPoint[],
  history: StockEarningsHistoryRow[],
  quarterlyRevenueTrend: Map<string, number>,
  annualRevenueTrend: Map<string, number>,
  annual: StockEarningsEstimatesPoint[],
): StockEarningsEstimatesPoint[] {
  const historyByYmd = new Map<string, StockEarningsHistoryRow>();
  const historyByLabel = new Map<string, StockEarningsHistoryRow>();
  for (const row of history) {
    if (row.fiscalPeriodEndYmd) historyByYmd.set(row.fiscalPeriodEndYmd, row);
    if (row.fiscalPeriodLabel) historyByLabel.set(row.fiscalPeriodLabel, row);
  }
  const annualByYmd = new Map(annual.map((p) => [p.sortKey, p]));

  return quarterly.map((point) => {
    if (!point.reported || point.revenueActualUsd == null || point.revenueEstimateUsd != null) {
      return point;
    }
    const actual = point.revenueActualUsd;
    const hist = historyByYmd.get(point.sortKey) ?? historyByLabel.get(point.label);

    const candidates: number[] = [];
    const trend = quarterlyRevenueTrend.get(point.sortKey);
    if (trend != null) candidates.push(trend);
    if (hist?.revenueEstimateUsd != null) candidates.push(hist.revenueEstimateUsd);

    const annualTrend = annualRevenueTrend.get(point.sortKey);
    if (annualTrend != null) {
      candidates.push(annualTrend, annualTrend / 4);
    }
    const annualPoint = annualByYmd.get(point.sortKey);
    if (annualPoint?.revenueEstimateUsd != null) {
      candidates.push(annualPoint.revenueEstimateUsd, annualPoint.revenueEstimateUsd / 4);
    }

    for (const raw of candidates) {
      const est = sanitizeQuarterlyRevenueEstimateUsd(coerceRevenueEstimateToUsd(raw, actual), actual);
      if (est != null) return { ...point, revenueEstimateUsd: est };
    }
    return point;
  });
}

function buildAnnualEstimatesSeries(
  root: Record<string, unknown>,
  annualRevenueEstimateFromTrend: Map<string, number>,
  annualEpsEstimateFromTrend: Map<string, number>,
): StockEarningsEstimatesPoint[] {
  const block = getYearlyIncomeBlock(root);
  if (!block) return [];
  const balanceSheetYearly = getYearlyBalanceSheetBlock(root);
  const todayYmd = toYmdUtc(new Date());
  const points: StockEarningsEstimatesPoint[] = [];

  for (const [periodKey, rawRow] of Object.entries(block)) {
    if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) continue;
    const row = rawRow as Record<string, unknown>;
    const ymd = toYmdUtcFromUnknown(periodKey);
    if (!ymd) continue;
    const revAct = numFromRow(row, INCOME_STATEMENT_REVENUE_KEYS);
    let epsAct = numFromRow(row, ANNUAL_INCOME_STATEMENT_EPS_KEYS);
    if (epsAct == null) {
      const bsRow = balanceSheetYearly?.[periodKey];
      const bsRec =
        bsRow && typeof bsRow === "object" && !Array.isArray(bsRow)
          ? (bsRow as Record<string, unknown>)
          : balanceSheetYearly?.[ymd] && typeof balanceSheetYearly[ymd] === "object"
            ? (balanceSheetYearly[ymd] as Record<string, unknown>)
            : null;
      epsAct = deriveAnnualEpsFromNetIncomeAndShares(row, bsRec);
    }
    let revEst = annualRevenueEstimateFromTrend.get(ymd) ?? null;
    const epsEst =
      annualEpsEstimateFromTrend.get(ymd) ?? nearestEpsTrendForAnnualYmd(ymd, annualEpsEstimateFromTrend);
    if (revEst != null) revEst = coerceRevenueEstimateToUsd(revEst, revAct);
    const periodEnded = ymd <= todayYmd;
    points.push({
      sortKey: ymd,
      label: ymd.slice(0, 4),
      revenueEstimateUsd: revEst,
      revenueActualUsd: periodEnded && revAct != null ? revAct : null,
      epsEstimate: epsEst,
      epsActual: periodEnded && epsAct != null ? epsAct : null,
      reported: periodEnded,
    });
  }

  points.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return points;
}

/**
 * Add forward fiscal years from `Earnings.Trend` annual revenue (e.g. FY2026 estimate) when the
 * yearly income block has not caught up yet — shows the light-blue estimate bar on the annual chart.
 */
function extendAnnualEstimatesWithForwardTrend(
  annual: StockEarningsEstimatesPoint[],
  annualRevenueEstimateFromTrend: Map<string, number>,
  annualEpsEstimateFromTrend: Map<string, number>,
): StockEarningsEstimatesPoint[] {
  const todayYmd = toYmdUtc(new Date());
  const maxLabelYear = new Date().getUTCFullYear() + 1;
  const byLabel = new Map<string, StockEarningsEstimatesPoint>();
  for (const p of annual) {
    const prev = byLabel.get(p.label);
    if (!prev || p.sortKey.localeCompare(prev.sortKey) > 0) byLabel.set(p.label, p);
  }

  for (const [ymd, revEstRaw] of annualRevenueEstimateFromTrend) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const label = ymdYearLabel(ymd);
    const labelYear = Number(label);
    if (!Number.isFinite(labelYear) || labelYear > maxLabelYear) continue;

    const periodEnded = ymd <= todayYmd;
    const revEst =
      revEstRaw != null && Number.isFinite(revEstRaw)
        ? coerceRevenueEstimateToUsd(revEstRaw, null)
        : null;
    const epsEst =
      annualEpsEstimateFromTrend.get(ymd) ?? nearestEpsTrendForAnnualYmd(ymd, annualEpsEstimateFromTrend);

    const existing = byLabel.get(label);
    if (existing) {
      const nextEstimate = existing.revenueEstimateUsd ?? revEst;
      const nextEps = existing.epsEstimate ?? epsEst;
      if (nextEstimate === existing.revenueEstimateUsd && nextEps === existing.epsEstimate) {
        continue;
      }
      byLabel.set(label, {
        ...existing,
        sortKey: existing.sortKey.localeCompare(ymd) >= 0 ? existing.sortKey : ymd,
        revenueEstimateUsd: nextEstimate,
        epsEstimate: nextEps,
        reported: existing.reported || periodEnded,
        revenueActualUsd: existing.revenueActualUsd,
        epsActual: existing.epsActual,
      });
      continue;
    }

    if (!periodEnded && revEst == null && epsEst == null) continue;

    byLabel.set(label, {
      sortKey: ymd,
      label,
      revenueEstimateUsd: revEst,
      revenueActualUsd: null,
      epsEstimate: epsEst,
      epsActual: null,
      reported: false,
    });
  }

  return [...byLabel.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/** Match annual forward cap — include calendar years through UTC year + 1 (2 years of forecast). */
function maxQuarterlyForwardPeriodEndYmd(): string {
  const maxYear = new Date().getUTCFullYear() + 1;
  return `${maxYear}-12-31`;
}

function addMonthsToPeriodEndYmd(ymd: string, monthDelta: number): string | null {
  const ms = parseUnknownDateToUtcMs(ymd);
  if (ms == null) return null;
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + monthDelta);
  return toYmdUtc(d);
}

/** Four fiscal quarter period-ends stepping back from the FY end date on the annual consensus row. */
function fiscalQuarterEndYmdsFromFyEnd(fyEndYmd: string): string[] {
  const ends = [
    addMonthsToPeriodEndYmd(fyEndYmd, -9),
    addMonthsToPeriodEndYmd(fyEndYmd, -6),
    addMonthsToPeriodEndYmd(fyEndYmd, -3),
    fyEndYmd,
  ].filter((x): x is string => x != null && /^\d{4}-\d{2}-\d{2}$/.test(x));
  return [...new Set(ends)].sort((a, b) => a.localeCompare(b));
}

/**
 * Add upcoming quarters from `Earnings.Trend` quarterly revenue through year + 1.
 */
function extendQuarterlyEstimatesWithForwardTrend(
  quarterly: StockEarningsEstimatesPoint[],
  quarterlyRevenueEstimateFromTrend: Map<string, number>,
  quarterlyEpsEstimateFromTrend: Map<string, number>,
  revenueByFiscalPeriodEnd: Map<string, number>,
  fyEndMonthDay: string | null = null,
): StockEarningsEstimatesPoint[] {
  const todayYmd = toYmdUtc(new Date());
  const maxForwardYmd = maxQuarterlyForwardPeriodEndYmd();
  const bySortKey = new Map<string, StockEarningsEstimatesPoint>();
  for (const p of quarterly) {
    bySortKey.set(p.sortKey, p);
  }

  const upsertForwardQuarter = (ymd: string, revEstRaw: number | null, epsEstRaw: number | null) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
    if (ymd > maxForwardYmd) return;

    const periodEnded = ymd <= todayYmd;
    const revEst =
      revEstRaw != null && Number.isFinite(revEstRaw)
        ? sanitizeQuarterlyRevenueEstimateUsd(coerceRevenueEstimateToUsd(revEstRaw, null), null)
        : null;
    const epsEst = epsEstRaw != null && Number.isFinite(epsEstRaw) ? epsEstRaw : null;

    const existing = bySortKey.get(ymd);
    if (existing) {
      const nextRev = existing.revenueEstimateUsd ?? revEst;
      const nextEps = existing.epsEstimate ?? epsEst;
      let nextRevAct = existing.revenueActualUsd;
      if (periodEnded && nextRevAct == null) {
        const ra = revenueByFiscalPeriodEnd.get(ymd);
        if (ra != null && Number.isFinite(ra)) {
          nextRevAct = sanitizeQuarterlyRevenueEstimateUsd(ra, ra);
        }
      }
      if (
        nextRev === existing.revenueEstimateUsd &&
        nextEps === existing.epsEstimate &&
        nextRevAct === existing.revenueActualUsd
      ) {
        return;
      }
      bySortKey.set(ymd, {
        ...existing,
        revenueEstimateUsd: nextRev,
        epsEstimate: nextEps,
        revenueActualUsd: nextRevAct,
        reported: existing.reported || (periodEnded && nextRevAct != null),
        epsActual: existing.epsActual,
      });
      return;
    }

    if (revEst == null && epsEst == null) return;

    const revActRaw = periodEnded ? revenueByFiscalPeriodEnd.get(ymd) : undefined;
    const revAct =
      revActRaw != null && Number.isFinite(revActRaw)
        ? sanitizeQuarterlyRevenueEstimateUsd(revActRaw, revActRaw)
        : null;

    bySortKey.set(ymd, {
      sortKey: ymd,
      label: quarterLabelFromPeriodEndYmd(ymd, fyEndMonthDay) ?? ymd,
      revenueEstimateUsd: revEst,
      revenueActualUsd: revAct,
      epsEstimate: epsEst,
      epsActual: null,
      reported: periodEnded && revAct != null,
    });
  };

  for (const [ymd, revEstRaw] of quarterlyRevenueEstimateFromTrend) {
    const epsEst = quarterlyEpsEstimateFromTrend.get(ymd) ?? null;
    upsertForwardQuarter(ymd, revEstRaw, epsEst);
  }

  for (const [ymd, epsEst] of quarterlyEpsEstimateFromTrend) {
    if (quarterlyRevenueEstimateFromTrend.has(ymd)) continue;
    upsertForwardQuarter(ymd, null, epsEst);
  }

  return [...bySortKey.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/**
 * When trend only has some forward quarters (e.g. Q1–Q2 FY26), fill the rest of each forward
 * fiscal year from the annual consensus row (revenue/EPS ÷ 4), so 2026 and 2027 show four quarters.
 */
function fillForwardQuartersFromAnnualEstimates(
  quarterly: StockEarningsEstimatesPoint[],
  annual: StockEarningsEstimatesPoint[],
  quarterlyRevenueEstimateFromTrend: Map<string, number>,
  quarterlyEpsEstimateFromTrend: Map<string, number>,
  fyEndMonthDay: string | null = null,
): StockEarningsEstimatesPoint[] {
  const todayYmd = toYmdUtc(new Date());
  const maxForwardYmd = maxQuarterlyForwardPeriodEndYmd();
  const bySortKey = new Map<string, StockEarningsEstimatesPoint>();
  for (const p of quarterly) {
    bySortKey.set(p.sortKey, p);
  }

  const upsertQuarter = (ymd: string, revEstRaw: number | null, epsEstRaw: number | null) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || ymd > maxForwardYmd) return;

    const periodEnded = ymd <= todayYmd;
    const revEst =
      revEstRaw != null && Number.isFinite(revEstRaw)
        ? sanitizeQuarterlyRevenueEstimateUsd(coerceRevenueEstimateToUsd(revEstRaw, null), null)
        : null;
    const epsEst = epsEstRaw != null && Number.isFinite(epsEstRaw) ? epsEstRaw : null;

    const existing = bySortKey.get(ymd);
    if (existing) {
      if (existing.reported && periodEnded) return;
      const nextRev = existing.revenueEstimateUsd ?? revEst;
      const nextEps = existing.epsEstimate ?? epsEst;
      if (nextRev === existing.revenueEstimateUsd && nextEps === existing.epsEstimate) return;
      bySortKey.set(ymd, {
        ...existing,
        revenueEstimateUsd: nextRev,
        epsEstimate: nextEps,
        reported: existing.reported || quarterlyPointHasReportedActuals(existing) || periodEnded,
        revenueActualUsd: existing.revenueActualUsd,
        epsActual: existing.epsActual,
      });
      return;
    }

    if (periodEnded || (revEst == null && epsEst == null)) return;

    bySortKey.set(ymd, {
      sortKey: ymd,
      label: quarterLabelFromPeriodEndYmd(ymd, fyEndMonthDay) ?? ymd,
      revenueEstimateUsd: revEst,
      revenueActualUsd: null,
      epsEstimate: epsEst,
      epsActual: null,
      reported: false,
    });
  };

  for (const annualPoint of annual) {
    if (!isAnnualForecastPoint(annualPoint, todayYmd)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(annualPoint.sortKey)) continue;

    const quarterYmds = fiscalQuarterEndYmdsFromFyEnd(annualPoint.sortKey);
    const revAnnual = annualPoint.revenueEstimateUsd;
    const epsAnnual = annualPoint.epsEstimate;
    const perQuarter = 4;

    for (const ymd of quarterYmds) {
      const revTrend = quarterlyRevenueEstimateFromTrend.get(ymd) ?? null;
      const epsTrend = quarterlyEpsEstimateFromTrend.get(ymd) ?? null;
      const revEst =
        revTrend ??
        (revAnnual != null && Number.isFinite(revAnnual) ? revAnnual / perQuarter : null);
      const epsEst =
        epsTrend ?? (epsAnnual != null && Number.isFinite(epsAnnual) ? epsAnnual / perQuarter : null);
      upsertQuarter(ymd, revEst, epsEst);
    }
  }

  return [...bySortKey.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function buildEstimatesChart(
  root: Record<string, unknown>,
  history: StockEarningsHistoryRow[],
  revenueTrendMaps: RevenueEstimateTrendMaps,
  epsTrendMaps: EpsEstimateTrendMaps,
  fyEndMonthDay: string | null = null,
): StockEarningsEstimatesChart | null {
  const revenueByFiscalPeriodEnd = buildRevenueByFiscalPeriodEndYmd(root);
  let quarterly = backfillQuarterlyActualsFromHistory(buildQuarterlyEstimatesFromHistory(history), history);
  let annual = buildAnnualEstimatesSeries(root, revenueTrendMaps.annual, epsTrendMaps.annual);
  annual = extendAnnualEstimatesWithForwardTrend(annual, revenueTrendMaps.annual, epsTrendMaps.annual);
  annual = applyDerivedEpsToForwardEstimates(annual);
  quarterly = extendQuarterlyEstimatesWithForwardTrend(
    quarterly,
    revenueTrendMaps.quarterly,
    epsTrendMaps.quarterly,
    revenueByFiscalPeriodEnd,
    fyEndMonthDay,
  );
  quarterly = fillForwardQuartersFromAnnualEstimates(
    quarterly,
    annual,
    revenueTrendMaps.quarterly,
    epsTrendMaps.quarterly,
    fyEndMonthDay,
  );
  quarterly = applyDerivedEpsToForwardEstimates(quarterly, annual);
  annual = enrichAnnualEpsActualFromHistory(annual, history);
  annual = backfillAnnualEpsEstimates(annual, history, epsTrendMaps.annual);
  quarterly = backfillQuarterlyRevenueEstimates(
    quarterly,
    history,
    revenueTrendMaps.quarterly,
    revenueTrendMaps.annual,
    annual,
  );
  quarterly = backfillQuarterlyActualsFromHistory(quarterly, history);
  if (quarterly.length === 0 && annual.length === 0) return null;
  return { quarterly, annual };
}

async function enrichEstimatesChartWithFundamentals(
  ticker: string,
  estimatesChart: StockEarningsEstimatesChart,
  revenueTrendMaps: RevenueEstimateTrendMaps,
  epsTrendMaps: EpsEstimateTrendMaps,
  historyParsed: StockEarningsHistoryRow[],
): Promise<StockEarningsEstimatesChart> {
  const annualSeries = await fetchChartingSeries(ticker, "annual");
  const fundamentalsPoints = annualSeries?.points ?? [];
  let annual = estimatesChart.annual;
  if (fundamentalsPoints.length > 0) {
    annual = mergeFundamentalsIntoAnnualEstimates(annual, fundamentalsPoints);
  }
  annual = enrichAnnualEpsActualFromHistory(annual, historyParsed);
  const annualExtended = extendAnnualEstimatesWithForwardTrend(
    annual,
    revenueTrendMaps.annual,
    epsTrendMaps.annual,
  );
  const quarterlyDerived = applyDerivedEpsToForwardEstimates(estimatesChart.quarterly, annualExtended);
  const annualBackfilled = backfillAnnualEpsEstimates(
    applyDerivedEpsToForwardEstimates(annualExtended),
    historyParsed,
    epsTrendMaps.annual,
  );
  const quarterlyBackfilled = backfillQuarterlyActualsFromHistory(
    backfillQuarterlyRevenueEstimates(
      quarterlyDerived,
      historyParsed,
      revenueTrendMaps.quarterly,
      revenueTrendMaps.annual,
      annualBackfilled,
    ),
    historyParsed,
  );
  return {
    ...estimatesChart,
    annual: annualBackfilled,
    quarterly: quarterlyBackfilled,
  };
}

function sortHistoryRows(rows: StockEarningsHistoryRow[]): StockEarningsHistoryRow[] {
  return [...rows].sort((a, b) => {
    const da = a.fiscalPeriodEndYmd ?? "";
    const db = b.fiscalPeriodEndYmd ?? "";
    if (da !== db) return db.localeCompare(da);
    const ra = a.reportDateDisplay ?? "";
    const rb = b.reportDateDisplay ?? "";
    return rb.localeCompare(ra);
  });
}

/**
 * For each fiscal period-end, earliest `reportDate` (or `date`) seen in `Earnings.History`.
 * When EODHD keeps a stale “rescheduled” row (e.g. Apr 28) alongside an earlier real line (e.g. Apr 22),
 * the minimum is already in the past — that quarter should not surface as “upcoming” from the later row.
 */
function buildMinReportYmdByFiscalPeriodEnd(rawRows: Record<string, unknown>[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rawRows) {
    const fiscal = toYmdUtcFromUnknown(r.date ?? r.Date ?? r.periodEnd ?? r.PeriodEnd);
    const report = earningsHistoryReportYmd(r);
    if (!fiscal || !report) continue;
    const prev = out.get(fiscal);
    if (!prev || report < prev) out.set(fiscal, report);
  }
  return out;
}

function pickUpcomingFromHistory(
  rawRows: Record<string, unknown>[],
  calendarTimingRaw: string | null,
  revenueByFiscalPeriodEnd: Map<string, number>,
  quarterlyRevenueEstimateFromTrend: Map<string, number>,
  quarterlyRevenueEstimateByLabel: Map<string, number>,
  quarterlyEpsEstimateFromTrend: Map<string, number>,
  quarterlyEpsEstimateByLabel: Map<string, number>,
): StockEarningsUpcoming | null {
  const startToday = startOfTodayUtcMs();
  const todayYmd = toYmdUtc(new Date());
  const minReportByFiscal = buildMinReportYmdByFiscalPeriodEnd(rawRows);
  let best: { r: Record<string, unknown>; dayStart: number; reportYmd: string | null } | null = null;

  for (const r of rawRows) {
    const rawReport = r.reportDate ?? r.ReportDate ?? r.report_date;
    const rawDate = r.date ?? r.Date;
    const primary = (typeof rawReport === "string" && rawReport.trim() ? rawReport : null) ?? rawDate;
    const ms = parseUnknownDateToUtcMs(primary);
    if (ms == null) continue;
    const d = new Date(ms);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    if (dayStart < startToday) continue;
    if (rowIsReported(r)) continue;
    const periodYmdForDedupe = toYmdUtcFromUnknown(r.date ?? r.Date ?? r.periodEnd ?? r.PeriodEnd);
    if (periodYmdForDedupe) {
      const minR = minReportByFiscal.get(periodYmdForDedupe);
      if (minR && minR < todayYmd) continue;
    }
    if (best == null || dayStart < best.dayStart) {
      best = { r, dayStart, reportYmd: toYmdUtcFromUnknown(rawReport) ?? toYmdUtcFromUnknown(rawDate) };
    }
  }

  if (!best) return null;

  const r = best.r;
  const periodYmd =
    toYmdUtcFromUnknown(r.periodEnd ?? r.PeriodEnd ?? r.endDate ?? r.EndDate ?? r.fiscalDate ?? r.FiscalDate) ??
    toYmdUtcFromUnknown(r.date ?? r.Date);
  const reportDisp =
    formatEarningsDateEnUS(r.reportDate ?? r.ReportDate ?? r.report_date) ??
    formatEarningsDateEnUS(r.date ?? r.Date);

  let epsEst = numFromRow(r, [
    "epsEstimate",
    "epsEstimated",
    "estimatedEps",
    "estimatedEPS",
    "EPSEstimate",
    "epsAverage",
    "epsAvg",
  ]);
  if (epsEst == null && periodYmd) {
    epsEst = quarterlyEpsEstimateFromTrend.get(periodYmd) ?? null;
  }
  const periodLabel = quarterLabelFromPeriodEndYmd(periodYmd);
  if (epsEst == null && periodLabel) {
    epsEst = quarterlyEpsEstimateByLabel.get(periodLabel) ?? null;
  }

  let revEst = numFromRow(r, EARNINGS_REVENUE_ESTIMATE_KEYS);
  if (revEst == null) revEst = revenueEstimateFromLooseKeys(r);
  if (revEst == null) revEst = revenueEstimateFromRevenueNamedFields(r);
  if (revEst == null && periodYmd) {
    revEst = quarterlyRevenueEstimateFromTrend.get(periodYmd) ?? null;
  }
  if (revEst == null && periodLabel) {
    revEst = quarterlyRevenueEstimateByLabel.get(periodLabel) ?? null;
  }

  let revActRef = numFromRow(r, EARNINGS_REVENUE_ACTUAL_KEYS);
  if (revActRef == null && periodYmd) revActRef = revenueByFiscalPeriodEnd.get(periodYmd) ?? null;
  if (revEst != null) {
    revEst = sanitizeQuarterlyRevenueEstimateUsd(revEst, revActRef);
  }

  const timing = timingFromCalendar(calendarTimingRaw);

  return {
    reportDateDisplay: reportDisp,
    reportDateYmd: best.reportYmd,
    timing: timing.timing,
    timingShortLabel: timing.timingShortLabel,
    timingPhrase: timing.timingPhrase,
    fiscalPeriodLabel: quarterLabelFromPeriodEndYmd(periodYmd),
    epsEstimateDisplay: epsEst != null ? formatEps(epsEst) : null,
    revenueEstimateDisplay: revEst != null ? formatUsdCompact(revEst) : null,
  };
}

export type EarningsPeriodMetrics = {
  fiscalPeriodLabel: string | null;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
  revenueSurprisePct: number | null;
};

/** Same EPS/revenue actuals and estimates as the stock earnings tab (preview path). */
export function resolveEarningsPeriodMetricsFromFundamentals(
  root: Record<string, unknown>,
  fiscalPeriodEndYmd: string,
): EarningsPeriodMetrics | null {
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return null;
  const history = (earn as Record<string, unknown>).History;
  if (!history || typeof history !== "object") return null;
  const h = history as Record<string, unknown>;

  let rawRow: Record<string, unknown> | null = null;
  const direct = h[fiscalPeriodEndYmd];
  if (direct && typeof direct === "object") {
    rawRow = direct as Record<string, unknown>;
  } else {
    for (const row of Object.values(h)) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const dateYmd = toYmdUtcFromUnknown(r.date ?? r.Date);
      if (dateYmd === fiscalPeriodEndYmd) {
        rawRow = r;
        break;
      }
    }
  }
  if (!rawRow) return null;

  const revenueByFiscalPeriodEnd = buildRevenueByFiscalPeriodEndYmd(root);
  const revenueTrendMaps = buildRevenueEstimateTrendMaps(root);
  const epsTrendMaps = buildEpsEstimateTrendMaps(root);
  const quarterlyRevenueByLabel = quarterlyEstimateMapsByQuarterLabel(
    revenueTrendMaps.quarterly,
    quarterLabelFromPeriodEndYmd,
  );
  const quarterlyEpsByLabel = quarterlyEstimateMapsByQuarterLabel(
    epsTrendMaps.quarterly,
    quarterLabelFromPeriodEndYmd,
  );

  const parsed = historyRowFromRaw(
    rawRow,
    revenueByFiscalPeriodEnd,
    revenueTrendMaps.quarterly,
    epsTrendMaps.quarterly,
    quarterlyRevenueByLabel,
    quarterlyEpsByLabel,
  );

  let revenueSurprisePct: number | null = null;
  if (
    parsed.revenueActualUsd != null &&
    parsed.revenueEstimateUsd != null &&
    parsed.revenueEstimateUsd !== 0
  ) {
    revenueSurprisePct =
      ((parsed.revenueActualUsd - parsed.revenueEstimateUsd) /
        Math.abs(parsed.revenueEstimateUsd)) *
      100;
  }

  return {
    fiscalPeriodLabel: parsed.fiscalPeriodLabel,
    epsActual: parsed.epsActualRaw,
    epsEstimate: parsed.epsEstimateRaw,
    surprisePct: parsed.surprisePct,
    revenueActual: parsed.revenueActualUsd,
    revenueEstimate: parsed.revenueEstimateUsd,
    revenueSurprisePct,
  };
}

export type StockEarningsTabFetchMode = "full" | "preview";

/**
 * Earnings tab: `Earnings.History` from fundamentals plus optional calendar timing (BMO/AMC).
 * Cached per ticker so the first viewer pays EODHD/SEC cost and others reuse the payload.
 *
 * `preview` skips SEC index crawls, IR seed HTTP, and earnings-calendar timing — used by the
 * earnings calendar modal for a fast first paint. Documents come from DB cache + curated URLs only;
 * full SEC/IR resolution still runs on the stock earnings tab (`full` mode).
 */
async function fetchStockEarningsTabPayloadUncached(
  listingTicker: string,
  mode: StockEarningsTabFetchMode = "full",
): Promise<StockEarningsTabPayload | null> {
  const preview = mode === "preview";
  const ticker = listingTicker.trim().toUpperCase();
  const root = await fetchFundamentalsRootForEarningsTab(ticker);
  if (!root) return null;

  const rootRec = root as Record<string, unknown>;
  const documentHub = parseEarningsDocumentHubFromFundamentalsRoot(rootRec);

  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") {
    return { ticker, upcoming: null, history: [], estimatesChart: null, documentHub };
  }

  const e = earn as Record<string, unknown>;
  const rawRows = collectEarningsHistoryRawRows(e);
  if (rawRows.length === 0) {
    return { ticker, upcoming: null, history: [], estimatesChart: null, documentHub };
  }

  const revenueByFiscalPeriodEnd = buildRevenueByFiscalPeriodEndYmd(root);
  const revenueTrendMaps = buildRevenueEstimateTrendMaps(root);
  const epsTrendMaps = buildEpsEstimateTrendMaps(root);
  const fyEndMonthDay = inferDominantFiscalYearEndMonthDay(yearlyIncomePeriodEndYmds(rootRec));
  const periodEndLabel = (ymd: string | null) => quarterLabelFromPeriodEndYmd(ymd, fyEndMonthDay);
  const quarterlyRevenueByLabel = quarterlyEstimateMapsByQuarterLabel(
    revenueTrendMaps.quarterly,
    periodEndLabel,
  );
  const quarterlyEpsByLabel = quarterlyEstimateMapsByQuarterLabel(
    epsTrendMaps.quarterly,
    periodEndLabel,
  );
  let historyParsed = sliceEarningsHistoryForReports(
    sortHistoryRows(
      rawRows.map((row) =>
        historyRowFromRaw(
          row,
          revenueByFiscalPeriodEnd,
          revenueTrendMaps.quarterly,
          epsTrendMaps.quarterly,
          quarterlyRevenueByLabel,
          quarterlyEpsByLabel,
          fyEndMonthDay,
        ),
      ),
    ),
  );

  const docCache = await loadEarningsDocumentCacheForHistory(ticker, historyParsed);
  historyParsed = applyEarningsDocumentCacheToHistory(ticker, historyParsed, docCache);
  const afterCacheApply = historyParsed;

  const needsDocumentEnrichment =
    !preview && historyParsed.some(reportedRowMissingEarningsDocuments);

  if (needsDocumentEnrichment) {
    try {
      historyParsed = await enrichEarningsHistoryWithSecDocuments(
        historyParsed,
        documentHub.cik,
        { maxRows: SEC_ENRICHMENT_ROWS_FULL, maxIndexFetches: SEC_ENRICHMENT_INDEX_FETCHES_FULL },
      );
    } catch {
      /* Best-effort */
    }
  }
  const afterSec = historyParsed;
  historyParsed = applyCuratedIrEarningsDocumentUrls(ticker, historyParsed);
  const afterCurated = historyParsed;

  const needsIrSeed = !preview && historyParsed.some(reportedRowNeedsIrDocumentSeed);
  let afterIrSeed = historyParsed;
  if (needsIrSeed) {
    try {
      const [irRows, revenueRows] = await Promise.all([
        applyIrSeedDocumentUrls(ticker, historyParsed, documentHub, {
          preview: false,
          fyEndMonthDay,
        }),
        enrichReportedHistoryRevenueFromSec8k(historyParsed, documentHub.cik, {
          maxRows: SEC_ENRICHMENT_ROWS_FULL,
        }),
      ]);
      afterIrSeed = irRows;
      historyParsed = irRows.map((row, i) => {
        const rev = revenueRows[i]!;
        if (rev.revenueActualUsd == null || row.revenueActualUsd != null) return row;
        return {
          ...row,
          revenueActualUsd: rev.revenueActualUsd,
          revenueActualDisplay: rev.revenueActualDisplay,
        };
      });
      afterIrSeed = historyParsed;
    } catch {
      /* Best-effort */
    }
  } else if (!preview) {
    try {
      historyParsed = await enrichReportedHistoryRevenueFromSec8k(historyParsed, documentHub.cik, {
        maxRows: SEC_ENRICHMENT_ROWS_FULL,
      });
    } catch {
      /* Best-effort — fills revenue when EODHD lags same-day reports */
    }
  }

  const irSeedSource = earningsIrSeedResolutionSource(ticker);
  if (!preview) {
    void persistResolvedEarningsDocuments(ticker, historyParsed, afterCacheApply, docCache, [
      { step: "sec", rows: afterSec },
      { step: "curated", rows: afterCurated },
      { step: irSeedSource, rows: afterIrSeed },
    ]);
  }

  let estimatesChart = buildEstimatesChart(
    root,
    historyParsed,
    revenueTrendMaps,
    epsTrendMaps,
    fyEndMonthDay,
  );

  if (estimatesChart && estimatesChart.annual.length > 0) {
    const upcomingForCalendar = pickUpcomingFromHistory(
      rawRows,
      null,
      revenueByFiscalPeriodEnd,
      revenueTrendMaps.quarterly,
      quarterlyRevenueByLabel,
      epsTrendMaps.quarterly,
      quarterlyEpsByLabel,
    );
    const [enrichedChart, calendarTiming] = await Promise.all([
      enrichEstimatesChartWithFundamentals(
        ticker,
        estimatesChart,
        revenueTrendMaps,
        epsTrendMaps,
        historyParsed,
      ),
      !preview && upcomingForCalendar?.reportDateYmd
        ? fetchEodhdEarningsCalendarForSymbol(eodhdListingCode(ticker)).then((cal) =>
            pickCalendarTimingForReport(cal, eodhdListingCode(ticker), upcomingForCalendar.reportDateYmd!),
          )
        : Promise.resolve(null),
    ]);
    estimatesChart = enrichedChart;

    let upcoming = upcomingForCalendar;
    if (estimatesChart) {
      historyParsed = enrichReportedHistoryRevenueFromEstimatesChart(
        historyParsed,
        estimatesChart.quarterly,
      );
      upcoming = resolveUpcomingFromEstimates(upcoming, historyParsed, estimatesChart.quarterly);
      historyParsed = buildReportsTableRows(historyParsed, estimatesChart.quarterly, upcoming);
    } else if (upcoming) {
      upcoming = resolveUpcomingFromEstimates(upcoming, historyParsed, []);
    }
    if (calendarTiming && upcoming?.reportDateYmd) {
      const t = timingFromCalendar(calendarTiming);
      return {
        ticker,
        upcoming: {
          ...upcoming,
          timing: t.timing,
          timingShortLabel: t.timingShortLabel,
          timingPhrase: t.timingPhrase,
        },
        history: historyParsed,
        estimatesChart,
        documentHub,
      };
    }
    return { ticker, upcoming, history: historyParsed, estimatesChart, documentHub };
  }

  let upcoming = pickUpcomingFromHistory(
    rawRows,
    null,
    revenueByFiscalPeriodEnd,
    revenueTrendMaps.quarterly,
    quarterlyRevenueByLabel,
    epsTrendMaps.quarterly,
    quarterlyEpsByLabel,
  );
  if (estimatesChart) {
    historyParsed = enrichReportedHistoryRevenueFromEstimatesChart(
      historyParsed,
      estimatesChart.quarterly,
    );
    upcoming = resolveUpcomingFromEstimates(upcoming, historyParsed, estimatesChart.quarterly);
    historyParsed = buildReportsTableRows(historyParsed, estimatesChart.quarterly, upcoming);
  } else if (upcoming) {
    upcoming = resolveUpcomingFromEstimates(upcoming, historyParsed, []);
  }
  if (!preview && upcoming?.reportDateYmd) {
    const cal = await fetchEodhdEarningsCalendarForSymbol(eodhdListingCode(ticker));
    const calendarTiming = pickCalendarTimingForReport(cal, eodhdListingCode(ticker), upcoming.reportDateYmd);
    const t = timingFromCalendar(calendarTiming);
    upcoming = {
      ...upcoming,
      timing: t.timing,
      timingShortLabel: t.timingShortLabel,
      timingPhrase: t.timingPhrase,
    };
  }

  return { ticker, upcoming, history: historyParsed, estimatesChart, documentHub };
}

const fetchStockEarningsTabPayloadCached = unstable_cache(
  fetchStockEarningsTabPayloadUncached,
  ["stock-earnings-tab-payload-v44-preview-lean-docs"],
  { revalidate: REVALIDATE_WARM_LONG },
);

export async function fetchStockEarningsTabPayload(
  listingTicker: string,
  options?: { preview?: boolean },
): Promise<StockEarningsTabPayload | null> {
  const ticker = listingTicker.trim().toUpperCase();
  const mode: StockEarningsTabFetchMode = options?.preview ? "preview" : "full";
  return fetchStockEarningsTabPayloadCached(ticker, mode);
}

export type EarningsDocumentWarmStats = {
  ticker: string;
  failureClass: EarningsDocumentWarmFailureClass;
  reportedRows: number;
  recentReportedRows: number;
  withSlides: number;
  withFilings: number;
  missingSlides: number;
  missingFilings: number;
  slideFormats: Record<string, number>;
};

/** Bypass Next cache — runs full SEC + IR pipeline and persists document cache rows. */
export async function warmStockEarningsDocumentCache(
  listingTicker: string,
): Promise<EarningsDocumentWarmStats> {
  const ticker = listingTicker.trim().toUpperCase();
  const payload = await fetchStockEarningsTabPayloadUncached(ticker, "full");
  return classifyEarningsDocumentWarmResult(ticker, payload?.history ?? null);
}
