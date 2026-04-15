import "server-only";

import {
  fetchEodhdFundamentalsJson,
  formatEarningsDateEnUS,
  parseUnknownDateToUtcMs,
} from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdEarningsCalendar, type EodhdRawEarningRow } from "@/lib/market/eodhd-earnings-calendar";
import type {
  StockEarningsEstimatesChart,
  StockEarningsEstimatesPoint,
  StockEarningsHistoryRow,
  StockEarningsReportTiming,
  StockEarningsTabPayload,
  StockEarningsUpcoming,
} from "@/lib/market/stock-earnings-types";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
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
];

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

/** `Earnings.Trend` — EPS estimates keyed by fiscal period end (same shape as revenue trend rows). */
function buildEpsEstimateByFiscalPeriodFromTrend(root: Record<string, unknown>): Map<string, number> {
  const out = new Map<string, number>();
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return out;
  const trend = (earn as Record<string, unknown>).Trend;
  const rows = collectEarningsTrendRows(trend);
  for (const r of rows) {
    const est = numFromRow(r, EARNINGS_EPS_ESTIMATE_KEYS);
    if (est == null) continue;
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
      r.reportDate,
      r.ReportDate,
      r.report_date,
    ]) {
      const y = toYmdUtcFromUnknown(raw);
      if (y) ymds.add(y);
    }
    for (const ymd of ymds) {
      if (!out.has(ymd)) out.set(ymd, est);
    }
  }
  return out;
}

/** `Earnings.Trend` — forward / period revenue estimates keyed by fiscal period end. */
function buildRevenueEstimateByFiscalPeriodFromTrend(root: Record<string, unknown>): Map<string, number> {
  const out = new Map<string, number>();
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return out;
  const trend = (earn as Record<string, unknown>).Trend;
  const rows = collectEarningsTrendRows(trend);
  for (const r of rows) {
    let est = numFromRow(r, EARNINGS_REVENUE_ESTIMATE_KEYS);
    if (est == null) est = revenueEstimateFromLooseKeys(r);
    if (est == null) est = revenueEstimateFromRevenueNamedFields(r);
    if (est == null) continue;

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
      r.reportDate,
      r.ReportDate,
      r.report_date,
    ]) {
      const y = toYmdUtcFromUnknown(raw);
      if (y) ymds.add(y);
    }
    for (const ymd of ymds) {
      if (!out.has(ymd)) out.set(ymd, est);
    }
  }
  return out;
}

function toYmdUtcFromUnknown(raw: unknown): string | null {
  const ms = parseUnknownDateToUtcMs(raw);
  if (ms == null) return null;
  return toYmdUtc(new Date(ms));
}

function quarterLabelFromPeriodEndYmd(ymd: string | null): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [ys, ms] = ymd.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  const q = Math.ceil(m / 3);
  return `Q${q} ${y}`;
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

function rowIsReported(r: Record<string, unknown>): boolean {
  if (isEarningsReportDateStrictlyFuture(r)) return false;
  return rowHasEpsActualField(r);
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
  revenueEstimateByFiscalPeriodFromTrend: Map<string, number>,
  epsEstimateByFiscalPeriodFromTrend: Map<string, number>,
): StockEarningsHistoryRow {
  const fiscalPeriodEndYmd = toYmdUtcFromUnknown(r.date ?? r.Date ?? r.periodEnd ?? r.PeriodEnd);

  const reportDateDisplay =
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
  if (epsEst == null && fiscalPeriodEndYmd) {
    epsEst = epsEstimateByFiscalPeriodFromTrend.get(fiscalPeriodEndYmd) ?? null;
  }
  if (epsEst == null) {
    const reportYmd = toYmdUtcFromUnknown(r.reportDate ?? r.ReportDate ?? r.report_date);
    if (reportYmd) epsEst = epsEstimateByFiscalPeriodFromTrend.get(reportYmd) ?? null;
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
    revEst = revenueEstimateByFiscalPeriodFromTrend.get(fiscalPeriodEndYmd) ?? null;
  }
  if (revEst == null) {
    const reportYmd = toYmdUtcFromUnknown(r.reportDate ?? r.ReportDate ?? r.report_date);
    if (reportYmd) revEst = revenueEstimateByFiscalPeriodFromTrend.get(reportYmd) ?? null;
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
    revEst = coerceRevenueEstimateToUsd(revEst, revAct);
  }

  const reported = rowIsReported(r);
  const surprisePct = reported ? surprisePctFromRow(r, epsEst, epsAct) : null;

  return {
    fiscalPeriodEndYmd,
    fiscalPeriodLabel: quarterLabelFromPeriodEndYmd(fiscalPeriodEndYmd),
    reportDateDisplay,
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

function buildQuarterlyEstimatesFromHistory(history: StockEarningsHistoryRow[]): StockEarningsEstimatesPoint[] {
  const ordered = [...history].reverse();
  const out: StockEarningsEstimatesPoint[] = [];
  for (const r of ordered) {
    if (!r.fiscalPeriodEndYmd && !r.fiscalPeriodLabel) continue;
    out.push({
      sortKey: r.fiscalPeriodEndYmd ?? r.fiscalPeriodLabel ?? "",
      label: r.fiscalPeriodLabel ?? "—",
      revenueEstimateUsd: r.revenueEstimateUsd,
      revenueActualUsd: r.reported ? r.revenueActualUsd : null,
      epsEstimate: r.epsEstimateRaw,
      epsActual: r.reported ? r.epsActualRaw : null,
      reported: r.reported,
    });
  }
  return out;
}

function buildAnnualEstimatesSeries(
  root: Record<string, unknown>,
  revenueEstimateByFiscalPeriodFromTrend: Map<string, number>,
  epsEstimateByFiscalPeriodFromTrend: Map<string, number>,
): StockEarningsEstimatesPoint[] {
  const block = getYearlyIncomeBlock(root);
  if (!block) return [];
  const todayYmd = toYmdUtc(new Date());
  const points: StockEarningsEstimatesPoint[] = [];

  for (const [periodKey, rawRow] of Object.entries(block)) {
    if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) continue;
    const row = rawRow as Record<string, unknown>;
    const ymd = toYmdUtcFromUnknown(periodKey);
    if (!ymd) continue;
    const revAct = numFromRow(row, INCOME_STATEMENT_REVENUE_KEYS);
    const epsAct = numFromRow(row, INCOME_STATEMENT_EPS_KEYS);
    let revEst = revenueEstimateByFiscalPeriodFromTrend.get(ymd) ?? null;
    const epsEst =
      epsEstimateByFiscalPeriodFromTrend.get(ymd) ?? nearestEpsTrendForAnnualYmd(ymd, epsEstimateByFiscalPeriodFromTrend);
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
 * When yearly income / trend omit EPS but `Earnings.History` has the same fiscal period-end
 * (typical for Q4 vs fiscal year-end), copy estimate/actual so the Estimates chart matches the table.
 */
function mergeAnnualEpsFromHistory(
  annual: StockEarningsEstimatesPoint[],
  history: StockEarningsHistoryRow[],
): StockEarningsEstimatesPoint[] {
  const byPeriodEnd = new Map<string, StockEarningsHistoryRow>();
  for (const h of history) {
    if (h.fiscalPeriodEndYmd) byPeriodEnd.set(h.fiscalPeriodEndYmd, h);
  }
  return annual.map((p) => {
    const h = byPeriodEnd.get(p.sortKey);
    if (!h) return p;
    const epsEstimate = p.epsEstimate ?? h.epsEstimateRaw;
    const epsActual = p.epsActual ?? (h.reported && h.epsActualRaw != null ? h.epsActualRaw : null);
    if (epsEstimate === p.epsEstimate && epsActual === p.epsActual) return p;
    return { ...p, epsEstimate, epsActual };
  });
}

function buildEstimatesChart(
  root: Record<string, unknown>,
  history: StockEarningsHistoryRow[],
  revenueEstimateByFiscalPeriodFromTrend: Map<string, number>,
  epsEstimateByFiscalPeriodFromTrend: Map<string, number>,
): StockEarningsEstimatesChart | null {
  const quarterly = buildQuarterlyEstimatesFromHistory(history);
  let annual = buildAnnualEstimatesSeries(root, revenueEstimateByFiscalPeriodFromTrend, epsEstimateByFiscalPeriodFromTrend);
  annual = mergeAnnualEpsFromHistory(annual, history);
  if (quarterly.length === 0 && annual.length === 0) return null;
  return { quarterly, annual };
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

function pickUpcomingFromHistory(
  rawRows: Record<string, unknown>[],
  calendarTimingRaw: string | null,
  revenueByFiscalPeriodEnd: Map<string, number>,
  revenueEstimateByFiscalPeriodFromTrend: Map<string, number>,
): StockEarningsUpcoming | null {
  const startToday = startOfTodayUtcMs();
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
    if (best == null || dayStart < best.dayStart) {
      best = { r, dayStart, reportYmd: toYmdUtcFromUnknown(rawReport) ?? toYmdUtcFromUnknown(rawDate) };
    }
  }

  if (!best) return null;

  const r = best.r;
  const periodYmd = toYmdUtcFromUnknown(r.date ?? r.Date ?? r.periodEnd ?? r.PeriodEnd);
  const reportDisp =
    formatEarningsDateEnUS(r.reportDate ?? r.ReportDate ?? r.report_date) ??
    formatEarningsDateEnUS(r.date ?? r.Date);

  const epsEst = numFromRow(r, [
    "epsEstimate",
    "epsEstimated",
    "estimatedEps",
    "estimatedEPS",
    "EPSEstimate",
    "epsAverage",
    "epsAvg",
  ]);
  let revEst = numFromRow(r, EARNINGS_REVENUE_ESTIMATE_KEYS);
  if (revEst == null) revEst = revenueEstimateFromLooseKeys(r);
  if (revEst == null) revEst = revenueEstimateFromRevenueNamedFields(r);
  if (revEst == null && periodYmd) {
    revEst = revenueEstimateByFiscalPeriodFromTrend.get(periodYmd) ?? null;
  }

  let revActRef = numFromRow(r, EARNINGS_REVENUE_ACTUAL_KEYS);
  if (revActRef == null && periodYmd) revActRef = revenueByFiscalPeriodEnd.get(periodYmd) ?? null;
  if (revEst != null) {
    revEst = coerceRevenueEstimateToUsd(revEst, revActRef);
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

/**
 * Earnings tab: `Earnings.History` from fundamentals plus optional calendar timing (BMO/AMC).
 */
export async function fetchStockEarningsTabPayload(listingTicker: string): Promise<StockEarningsTabPayload | null> {
  const ticker = listingTicker.trim().toUpperCase();
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;

  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") {
    return { ticker, upcoming: null, history: [], estimatesChart: null };
  }

  const e = earn as Record<string, unknown>;
  const history = e.History;
  if (!history || typeof history !== "object") {
    return { ticker, upcoming: null, history: [], estimatesChart: null };
  }

  const rawRows: Record<string, unknown>[] = [];
  for (const row of Object.values(history as Record<string, unknown>)) {
    if (row && typeof row === "object") rawRows.push(row as Record<string, unknown>);
  }

  const revenueByFiscalPeriodEnd = buildRevenueByFiscalPeriodEndYmd(root);
  const revenueEstimateByFiscalPeriodFromTrend = buildRevenueEstimateByFiscalPeriodFromTrend(root);
  const epsEstimateByFiscalPeriodFromTrend = buildEpsEstimateByFiscalPeriodFromTrend(root);
  const historyParsed = sortHistoryRows(
    rawRows.map((row) =>
      historyRowFromRaw(row, revenueByFiscalPeriodEnd, revenueEstimateByFiscalPeriodFromTrend, epsEstimateByFiscalPeriodFromTrend),
    ),
  ).slice(0, 24);

  const estimatesChart = buildEstimatesChart(
    root,
    historyParsed,
    revenueEstimateByFiscalPeriodFromTrend,
    epsEstimateByFiscalPeriodFromTrend,
  );

  let upcoming = pickUpcomingFromHistory(rawRows, null, revenueByFiscalPeriodEnd, revenueEstimateByFiscalPeriodFromTrend);
  if (upcoming?.reportDateYmd) {
    const from = toYmdUtc(new Date());
    const to = toYmdUtc(addDaysUtc(new Date(), 75));
    const cal = await fetchEodhdEarningsCalendar(from, to);
    const calendarTiming = pickCalendarTimingForReport(cal, eodhdListingCode(ticker), upcoming.reportDateYmd);
    const t = timingFromCalendar(calendarTiming);
    upcoming = {
      ...upcoming,
      timing: t.timing,
      timingShortLabel: t.timingShortLabel,
      timingPhrase: t.timingPhrase,
    };
  }

  return { ticker, upcoming, history: historyParsed, estimatesChart };
}
