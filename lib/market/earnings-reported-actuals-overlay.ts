import "server-only";

import { cache } from "react";

import {
  fetchEodhdFundamentalsJson,
  fetchEodhdFundamentalsJsonFresh,
  parseUnknownDateToUtcMs,
} from "@/lib/market/eodhd-fundamentals";
import {
  normalizeSecCik,
  parseEarningsDocumentHubFromFundamentalsRoot,
} from "@/lib/market/earnings-report-external-links";
import {
  extractTotalRevenueUsdFromPressReleaseHtml,
  pickExhibit99PressReleaseHtmlUrl,
} from "@/lib/market/sec-earnings-press-release-revenue";
import { findBestIssuer8kNearReportDate } from "@/lib/market/sec-edgar-earnings-documents";
import { getSecEdgarUserAgent } from "@/lib/env/server";

export type ReportedEarningsActual = {
  fiscalPeriodEndYmd: string;
  reportDateYmd: string | null;
  revenueUsd: number | null;
  eps: number | null;
};

export type EarningsActualByPeriod = Map<string, ReportedEarningsActual>;

const SEC_ORIGIN = "https://www.sec.gov";

const EPS_ACTUAL_KEYS = [
  "epsActual",
  "EPSActual",
  "eps_actual",
  "actualEps",
  "ActualEPS",
  "reportedEps",
  "ReportedEPS",
];

const REVENUE_ACTUAL_KEYS = [
  "revenueActual",
  "RevenueActual",
  "actualRevenue",
  "ActualRevenue",
  "revenue_actual",
  "reportedRevenue",
  "ReportedRevenue",
  "salesActual",
  "SalesActual",
  "totalRevenue",
  "TotalRevenue",
];

const INCOME_REVENUE_KEYS = [
  "totalRevenue",
  "TotalRevenue",
  "revenue",
  "Revenue",
  "totalRevenueFromOperations",
  "Sales",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function toYmdUtcFromUnknown(raw: unknown): string | null {
  const ms = parseUnknownDateToUtcMs(raw);
  if (ms == null) return null;
  return toYmdUtc(new Date(ms));
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

function comparePeriodKeys(a: string, b: string): number {
  const ta = Date.parse(a.includes("T") ? a : `${a}T12:00:00.000Z`);
  const tb = Date.parse(b.includes("T") ? b : `${b}T12:00:00.000Z`);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return a.localeCompare(b);
}

function normalizePeriodEndYmd(raw: string): string | null {
  const ymd = toYmdUtcFromUnknown(raw);
  return ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

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
  return out;
}

const INCOME_OPERATING_INCOME_KEYS = [
  "operatingIncome",
  "OperatingIncome",
  "operationIncome",
  "operatingIncomeLoss",
  "OperatingIncomeLoss",
];

function buildStatementMetricByFiscalPeriodEndYmd(
  root: Record<string, unknown>,
  keys: string[],
): Map<string, number> {
  const out = new Map<string, number>();
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return out;
  const f = fin as Record<string, unknown>;
  const is = (f.Income_Statement ?? f.IncomeStatement) as unknown;
  if (!is || typeof is !== "object") return out;
  const inc = is as Record<string, unknown>;
  for (const block of [inc.quarterly ?? inc.Quarterly, inc.yearly ?? inc.Yearly]) {
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    for (const [periodKey, row] of Object.entries(block as Record<string, unknown>)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const ymd = toYmdUtcFromUnknown(periodKey);
      if (!ymd) continue;
      const val = numFromRow(row as Record<string, unknown>, keys);
      if (val == null) continue;
      if (!out.has(ymd)) out.set(ymd, val);
    }
  }
  return out;
}

function buildRevenueByFiscalPeriodEndYmd(root: Record<string, unknown>): Map<string, number> {
  return buildStatementMetricByFiscalPeriodEndYmd(root, INCOME_REVENUE_KEYS);
}

function buildOperatingIncomeByFiscalPeriodEndYmd(root: Record<string, unknown>): Map<string, number> {
  return buildStatementMetricByFiscalPeriodEndYmd(root, INCOME_OPERATING_INCOME_KEYS);
}

function fiscalPeriodEndYmdFromEarningsRow(r: Record<string, unknown>): string | null {
  return (
    toYmdUtcFromUnknown(
      r.periodEnd ?? r.PeriodEnd ?? r.endDate ?? r.EndDate ?? r.fiscalDate ?? r.FiscalDate,
    ) ?? toYmdUtcFromUnknown(r.date ?? r.Date)
  );
}

function earningsHistoryReportYmd(r: Record<string, unknown>): string | null {
  return (
    toYmdUtcFromUnknown(r.reportDate ?? r.ReportDate ?? r.report_date) ??
    toYmdUtcFromUnknown(r.date ?? r.Date)
  );
}

function isEarningsReportDateStrictlyFuture(r: Record<string, unknown>): boolean {
  const ymd = earningsHistoryReportYmd(r);
  if (!ymd) return false;
  return ymd > toYmdUtc(new Date());
}

function rowHasEpsActualField(r: Record<string, unknown>): boolean {
  const a = r.epsActual ?? r.EPSActual ?? r.eps_actual;
  if (a == null || a === "") return false;
  if (typeof a === "string" && !a.trim()) return false;
  return true;
}

function rowHasRevenueActualField(r: Record<string, unknown>): boolean {
  return numFromRow(r, REVENUE_ACTUAL_KEYS) != null;
}

function rowIsReported(r: Record<string, unknown>): boolean {
  if (isEarningsReportDateStrictlyFuture(r)) return false;
  if (rowHasEpsActualField(r)) return true;
  return rowHasRevenueActualField(r);
}

function ymdDaysAgoUtc(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return toYmdUtc(d);
}

/** EODHD posts EPS/revenue in `Earnings.History` before quarterly income statements catch up. */
export function fundamentalsNeedsFreshForRevenueGap(root: Record<string, unknown>): boolean {
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return false;
  const rawRows = collectEarningsHistoryRawRows(earn as Record<string, unknown>);
  if (rawRows.length === 0) return false;

  const revenueByFiscal = buildRevenueByFiscalPeriodEndYmd(root);
  const operatingIncomeByFiscal = buildOperatingIncomeByFiscalPeriodEndYmd(root);
  const minReportYmd = ymdDaysAgoUtc(21);

  for (const r of rawRows) {
    if (!rowIsReported(r)) continue;
    const reportYmd = earningsHistoryReportYmd(r);
    if (!reportYmd || reportYmd < minReportYmd) continue;
    const fiscalEnd = fiscalPeriodEndYmdFromEarningsRow(r);
    if (!fiscalEnd) continue;

    if (revenueByFiscal.has(fiscalEnd) && !operatingIncomeByFiscal.has(fiscalEnd)) {
      return true;
    }

    if (rowHasRevenueActualField(r)) continue;
    if (numFromRow(r, EPS_ACTUAL_KEYS) == null) continue;
    if (revenueByFiscal.has(fiscalEnd)) continue;
    return true;
  }
  return false;
}

/** Reported EPS / revenue from `Earnings.History` + income-statement backfill (sync). */
export function collectReportedEarningsActualsSync(root: Record<string, unknown>): EarningsActualByPeriod {
  const out: EarningsActualByPeriod = new Map();
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return out;

  const revenueByFiscal = buildRevenueByFiscalPeriodEndYmd(root);
  const rawRows = collectEarningsHistoryRawRows(earn as Record<string, unknown>);

  for (const r of rawRows) {
    if (!rowIsReported(r)) continue;

    const explicitPeriodEndYmd = toYmdUtcFromUnknown(
      r.periodEnd ?? r.PeriodEnd ?? r.endDate ?? r.EndDate ?? r.fiscalDate ?? r.FiscalDate,
    );
    const rawRowDateYmd = toYmdUtcFromUnknown(r.date ?? r.Date);
    const fiscalPeriodEndYmd = explicitPeriodEndYmd ?? rawRowDateYmd;
    if (!fiscalPeriodEndYmd) continue;

    const eps = numFromRow(r, EPS_ACTUAL_KEYS);
    let revenueUsd = numFromRow(r, REVENUE_ACTUAL_KEYS);
    if (revenueUsd == null) revenueUsd = revenueByFiscal.get(fiscalPeriodEndYmd) ?? null;

    if (eps == null && revenueUsd == null) continue;

    out.set(fiscalPeriodEndYmd, {
      fiscalPeriodEndYmd,
      reportDateYmd: earningsHistoryReportYmd(r),
      revenueUsd,
      eps,
    });
  }

  return out;
}

function latestReportedEarningsEntry(actuals: EarningsActualByPeriod): ReportedEarningsActual | null {
  let best: ReportedEarningsActual | null = null;
  for (const entry of actuals.values()) {
    if (!best || entry.fiscalPeriodEndYmd > best.fiscalPeriodEndYmd) best = entry;
  }
  return best;
}

export function latestReportedEarningsSnapshot(
  actuals: EarningsActualByPeriod,
): ReportedEarningsActual | null {
  return latestReportedEarningsEntry(actuals);
}

async function secFetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": getSecEdgarUserAgent(),
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function accessionToFlat(accessionDashed: string): string {
  return accessionDashed.replace(/-/g, "");
}

function cikToNumericPathSegment(cik10: string): string {
  const n = parseInt(cik10.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? String(n) : cik10.replace(/^0+/, "") || "0";
}

function filingIndexHtmUrl(cikNumeric: string, accessionDashed: string): string {
  const flat = accessionToFlat(accessionDashed);
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNumeric}/${flat}/${accessionDashed}-index.htm`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type SubmissionsRecent = {
  form: string[];
  filingDate: string[];
  accessionNumber: string[];
  primaryDocument: string[];
};

function parseSubmissionsRecent(root: unknown): SubmissionsRecent | null {
  if (!root || typeof root !== "object") return null;
  const filings = (root as Record<string, unknown>).filings;
  if (!filings || typeof filings !== "object") return null;
  const recent = (filings as Record<string, unknown>).recent;
  if (!recent || typeof recent !== "object") return null;
  const r = recent as Record<string, unknown>;
  if (
    !Array.isArray(r.form) ||
    !Array.isArray(r.filingDate) ||
    !Array.isArray(r.accessionNumber) ||
    !Array.isArray(r.primaryDocument)
  ) {
    return null;
  }
  return {
    form: r.form.map(String),
    filingDate: r.filingDate.map(String),
    accessionNumber: r.accessionNumber.map(String),
    primaryDocument: r.primaryDocument.map(String),
  };
}

/** SEC Exhibit 99.1 when EODHD has EPS but income statement / history omit revenue. */
export async function backfillEarningsRevenueGapsFromSec(
  actuals: EarningsActualByPeriod,
  root: Record<string, unknown>,
  listingTicker: string,
  options?: { maxRows?: number },
): Promise<EarningsActualByPeriod> {
  const hub = parseEarningsDocumentHubFromFundamentalsRoot(root);
  const cik10 = normalizeSecCik(hub.cik);
  if (!cik10) return actuals;

  const body = await secFetchText(`https://data.sec.gov/submissions/CIK${cik10}.json`);
  if (!body) return actuals;
  let submissions: unknown;
  try {
    submissions = JSON.parse(body) as unknown;
  } catch {
    return actuals;
  }
  const recent = parseSubmissionsRecent(submissions);
  if (!recent) return actuals;

  const cikNum = cikToNumericPathSegment(cik10);
  const maxRows = options?.maxRows ?? 2;
  const next = new Map(actuals);
  let enriched = 0;

  const candidates = [...next.values()]
    .filter((e) => e.eps != null && e.revenueUsd == null && e.reportDateYmd)
    .sort((a, b) => (b.reportDateYmd ?? "").localeCompare(a.reportDateYmd ?? ""));

  for (const entry of candidates) {
    if (enriched >= maxRows) break;
    const reportYmd = entry.reportDateYmd!;
    const hit = findBestIssuer8kNearReportDate(recent, cik10, reportYmd);
    if (!hit) continue;

    const flat = accessionToFlat(hit.accessionNumber);
    const indexHtml = await secFetchText(filingIndexHtmUrl(cikNum, hit.accessionNumber));
    await sleep(120);
    if (!indexHtml) continue;

    const exhibitUrl = pickExhibit99PressReleaseHtmlUrl(indexHtml, cikNum, flat);
    if (!exhibitUrl) continue;

    const exHtml = await secFetchText(exhibitUrl);
    await sleep(120);
    const rev = exHtml ? extractTotalRevenueUsdFromPressReleaseHtml(exHtml) : null;
    if (rev == null) continue;

    next.set(entry.fiscalPeriodEndYmd, { ...entry, revenueUsd: rev });
    enriched += 1;
  }

  void listingTicker;
  return next;
}

export async function resolveReportedEarningsActuals(
  root: Record<string, unknown>,
  listingTicker: string,
  options?: { secBackfill?: boolean },
): Promise<EarningsActualByPeriod> {
  if (options?.secBackfill === false) {
    return collectReportedEarningsActualsSync(root);
  }
  return resolveReportedEarningsActualsWithSecBackfill(listingTicker);
}

/** One fundamentals + SEC backfill per ticker per SSR request (key stats + charting share this). */
const resolveReportedEarningsActualsWithSecBackfill = cache(
  async (listingTicker: string): Promise<EarningsActualByPeriod> => {
    const root = await fetchFundamentalsRootForMetrics(listingTicker);
    if (!root) return new Map();
    let actuals = collectReportedEarningsActualsSync(root);
    actuals = await backfillEarningsRevenueGapsFromSec(actuals, root, listingTicker);
    return actuals;
  },
);

export async function fetchFundamentalsRootForMetrics(ticker: string): Promise<Record<string, unknown> | null> {
  let root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return fetchEodhdFundamentalsJsonFresh(ticker);
  if (fundamentalsNeedsFreshForRevenueGap(root)) {
    const fresh = await fetchEodhdFundamentalsJsonFresh(ticker);
    if (fresh) root = fresh;
  }
  return root;
}

/** Apply reported earnings onto charting points (quarterly) when income statements lag. */
export function overlayReportedEarningsOnChartingPoints<T extends { periodEnd: string; revenue: number | null; eps: number | null }>(
  points: T[],
  actuals: EarningsActualByPeriod,
  mode: "annual" | "quarterly",
  recomputeGrowth: (pts: T[], mode: "annual" | "quarterly") => void,
  limitHistory: (pts: T[], mode: "annual" | "quarterly") => T[],
): T[] {
  if (actuals.size === 0 || mode !== "quarterly") return points;

  const todayYmd = toYmdUtc(new Date());
  const byPeriod = new Map<string, T>();

  for (const p of points) {
    const ymd = normalizePeriodEndYmd(p.periodEnd);
    if (ymd) byPeriod.set(ymd, { ...p });
  }

  for (const entry of actuals.values()) {
    const fiscalYmd = entry.fiscalPeriodEndYmd;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fiscalYmd)) continue;
    if (fiscalYmd > todayYmd && entry.eps == null && entry.revenueUsd == null) continue;

    const existing = byPeriod.get(fiscalYmd);
    const pt = existing
      ? { ...existing }
      : ({ periodEnd: fiscalYmd, revenue: null, eps: null } as T);

    if (entry.revenueUsd != null) pt.revenue = entry.revenueUsd;
    if (entry.eps != null) pt.eps = entry.eps;

    if (entry.revenueUsd != null || entry.eps != null || existing) {
      byPeriod.set(fiscalYmd, pt);
    }
  }

  const merged = [...byPeriod.values()].sort((a, b) =>
    comparePeriodKeys(a.periodEnd, b.periodEnd),
  );
  recomputeGrowth(merged, mode);
  return limitHistory(merged, mode);
}
