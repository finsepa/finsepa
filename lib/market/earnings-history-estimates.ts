import "server-only";

import { formatEarningsDateEnUS, parseUnknownDateToUtcMs } from "@/lib/market/eodhd-fundamentals";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";

const HISTORY_REVENUE_KEYS = [
  "revenueEstimate",
  "revenueEstimateAvg",
  "estimatedRevenue",
  "estimatedAverageRevenue",
  "RevenueEstimate",
  "RevenueEstimateAvg",
  "revenueEstimated",
];

const HISTORY_EPS_KEYS = [
  "epsEstimate",
  "epsEstimated",
  "estimatedEps",
  "estimatedEPS",
  "EPSEstimate",
  "epsAverage",
  "epsAvg",
  "earningsEstimateAvg",
  "earningsEstimateAverage",
  "EarningsEstimateAvg",
];

const TREND_REVENUE_KEYS = [
  "revenueEstimateAvg",
  "revenueEstimateAverage",
  "revenueEstimate",
  "revenueEstimated",
  "estimatedRevenue",
  "RevenueEstimateAvg",
];

const TREND_EPS_KEYS = [
  "earningsEstimateAvg",
  "earningsEstimateAverage",
  "epsEstimate",
  "epsEstimated",
  "estimatedEps",
  "estimatedEPS",
  "EPSEstimate",
  "epsAverage",
  "epsAvg",
  "EarningsEstimateAvg",
];

const MS_120_DAYS = 120 * 24 * 60 * 60 * 1000;

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

function toYmdUtcFromRow(raw: unknown): string | null {
  const ms = parseUnknownDateToUtcMs(raw);
  if (ms == null) return null;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatEpsEst(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function trendRows(root: Record<string, unknown>): Record<string, unknown>[] {
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return [];
  const trend = (earn as Record<string, unknown>).Trend;
  if (!trend) return [];
  if (Array.isArray(trend)) {
    return trend.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  }
  if (typeof trend === "object") {
    return Object.values(trend).filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  }
  return [];
}

function fiscalPeriodEndYmdFromRow(r: Record<string, unknown>): string | null {
  return toYmdUtcFromRow(
    r.date ?? r.Date ?? r.periodEnd ?? r.PeriodEnd ?? r.endDate ?? r.EndDate ?? r.fiscalDate ?? r.FiscalDate,
  );
}

function trendRowAnchorYmd(r: Record<string, unknown>): string | null {
  return (
    toYmdUtcFromRow(r.reportDate ?? r.ReportDate ?? r.report_date) ?? fiscalPeriodEndYmdFromRow(r)
  );
}

function revenueEstimateFromLooseKeys(row: Record<string, unknown>): number | null {
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase();
    const looksRev = kl.includes("revenue") || kl.includes("sales") || kl.includes("turnover");
    const looksEst =
      kl.includes("est") ||
      kl.includes("avg") ||
      kl.includes("mean") ||
      kl.includes("consensus") ||
      kl.includes("forecast");
    if (!looksRev || !looksEst) continue;
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

function epsEstimateFromLooseKeys(row: Record<string, unknown>): number | null {
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase();
    const looksEps = kl.includes("eps") || kl.includes("earnings");
    const looksEst =
      kl.includes("est") ||
      kl.includes("avg") ||
      kl.includes("mean") ||
      kl.includes("consensus") ||
      kl.includes("forecast");
    if (!looksEps || !looksEst) continue;
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

function readTrendEstimates(r: Record<string, unknown>): { revenue: number | null; eps: number | null } {
  const revenue = numFromRow(r, TREND_REVENUE_KEYS) ?? revenueEstimateFromLooseKeys(r);
  const eps = numFromRow(r, TREND_EPS_KEYS) ?? epsEstimateFromLooseKeys(r);
  return { revenue, eps };
}

function trendPeriodBonus(r: Record<string, unknown>): number {
  const period = String(r.period ?? r.Period ?? "")
    .trim()
    .toLowerCase();
  if (period === "0q" || period === "+0q") return MS_120_DAYS * 0.35;
  if (period === "+1q") return MS_120_DAYS * 0.2;
  if (/^[+-]?\d*q$/.test(period)) return MS_120_DAYS * 0.1;
  return 0;
}

function trendEstimatesForFiscalPeriod(
  root: Record<string, unknown>,
  fiscalPeriodEndYmd: string | null,
): { revenue: number | null; eps: number | null } {
  if (!fiscalPeriodEndYmd) return { revenue: null, eps: null };

  let nearest: { revenue: number | null; eps: number | null; dist: number } | null = null;
  const targetMs = parseUnknownDateToUtcMs(fiscalPeriodEndYmd);
  if (targetMs == null) return { revenue: null, eps: null };

  for (const r of trendRows(root)) {
    const anchor = trendRowAnchorYmd(r);
    if (!anchor) continue;
    if (anchor === fiscalPeriodEndYmd) {
      return readTrendEstimates(r);
    }
    const anchorMs = parseUnknownDateToUtcMs(anchor);
    if (anchorMs == null) continue;
    const dist = Math.abs(anchorMs - targetMs);
    if (dist > MS_120_DAYS) continue;
    const { revenue, eps } = readTrendEstimates(r);
    if (revenue == null && eps == null) continue;
    if (nearest == null || dist < nearest.dist) {
      nearest = { revenue, eps, dist };
    }
  }

  return nearest ?? { revenue: null, eps: null };
}

function trendEstimatesNearestToReportDate(
  root: Record<string, unknown>,
  calendarReportYmd: string,
): { revenue: number | null; eps: number | null } {
  const targetMs = parseUnknownDateToUtcMs(calendarReportYmd);
  if (targetMs == null) return { revenue: null, eps: null };

  let best: { revenue: number | null; eps: number | null; score: number } | null = null;

  for (const r of trendRows(root)) {
    const anchor = trendRowAnchorYmd(r);
    if (!anchor) continue;
    const anchorMs = parseUnknownDateToUtcMs(anchor);
    if (anchorMs == null) continue;
    const dist = Math.abs(anchorMs - targetMs);
    if (dist > MS_120_DAYS) continue;
    const { revenue, eps } = readTrendEstimates(r);
    if (revenue == null && eps == null) continue;
    const score = dist - trendPeriodBonus(r);
    if (best == null || score < best.score) {
      best = { revenue, eps, score };
    }
  }

  return best ?? { revenue: null, eps: null };
}

function trendEstimatesFromQuarterPeriod(
  root: Record<string, unknown>,
): { revenue: number | null; eps: number | null } {
  const preferred = ["0q", "+0q", "+1q"];
  for (const period of preferred) {
    for (const r of trendRows(root)) {
      const raw = String(r.period ?? r.Period ?? "")
        .trim()
        .toLowerCase();
      if (raw !== period) continue;
      const { revenue, eps } = readTrendEstimates(r);
      if (revenue != null || eps != null) return { revenue, eps };
    }
  }
  return { revenue: null, eps: null };
}

function pickEarningsHistoryRow(
  root: Record<string, unknown>,
  calendarReportYmd: string,
): Record<string, unknown> | null {
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return null;
  const e = earn as Record<string, unknown>;
  const history = e.History;
  if (!history || typeof history !== "object") return null;
  const h = history as Record<string, unknown>;

  const rows: Record<string, unknown>[] = [];
  for (const row of Object.values(h)) {
    if (row && typeof row === "object") rows.push(row as Record<string, unknown>);
  }
  if (!rows.length) return null;

  for (const r of rows) {
    const ymd =
      toYmdUtcFromRow(r.reportDate ?? r.ReportDate ?? r.report_date) ??
      toYmdUtcFromRow(r.date ?? r.Date);
    if (ymd === calendarReportYmd) return r;
  }

  const targetMs = parseUnknownDateToUtcMs(calendarReportYmd);
  if (targetMs != null) {
    let nearest: { r: Record<string, unknown>; dist: number } | null = null;
    for (const r of rows) {
      const raw = r.reportDate ?? r.ReportDate ?? r.report_date ?? r.date ?? r.Date;
      const ms = parseUnknownDateToUtcMs(raw);
      if (ms == null) continue;
      const dist = Math.abs(ms - targetMs);
      if (dist > MS_120_DAYS) continue;
      if (nearest == null || dist < nearest.dist) nearest = { r, dist };
    }
    if (nearest) return nearest.r;
  }

  const today = new Date();
  const startOfTodayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0);
  let best: { r: Record<string, unknown>; ms: number } | null = null;
  for (const r of rows) {
    const raw = r.reportDate ?? r.ReportDate ?? r.report_date ?? r.date ?? r.Date;
    const ms = parseUnknownDateToUtcMs(raw);
    if (ms == null) continue;
    const day = new Date(ms);
    const dayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0, 0);
    if (dayStart >= startOfTodayUtc) {
      if (best == null || dayStart < best.ms) best = { r, ms: dayStart };
    }
  }
  return best?.r ?? rows[rows.length - 1] ?? null;
}

export type EarningsEstimateDisplay = {
  estRevenueDisplay: string | null;
  estEpsDisplay: string | null;
};

export function estimatesDisplayFromFundamentalsRoot(
  root: Record<string, unknown>,
  calendarReportYmd: string,
): EarningsEstimateDisplay {
  const reportYmd = calendarReportYmd.trim();
  const row = pickEarningsHistoryRow(root, reportYmd);
  const fiscalPeriodEndYmd = row ? fiscalPeriodEndYmdFromRow(row) : null;
  const trendEst = trendEstimatesForFiscalPeriod(root, fiscalPeriodEndYmd);
  const nearestTrend = trendEstimatesNearestToReportDate(root, reportYmd);
  const quarterTrend = trendEstimatesFromQuarterPeriod(root);

  let estRevenue: number | null = null;
  let estEps: number | null = null;

  if (row) {
    estRevenue = numFromRow(row, HISTORY_REVENUE_KEYS);
    estEps = numFromRow(row, HISTORY_EPS_KEYS);
  }

  if (estRevenue == null) estRevenue = trendEst.revenue ?? nearestTrend.revenue ?? quarterTrend.revenue;
  if (estEps == null) estEps = trendEst.eps ?? nearestTrend.eps ?? quarterTrend.eps;

  return {
    estRevenueDisplay: estRevenue != null ? formatUsdCompact(estRevenue) : null,
    estEpsDisplay: estEps != null ? formatEpsEst(estEps) : null,
  };
}

export function earningsDateDisplayFromFundamentalsRoot(
  root: Record<string, unknown>,
  calendarReportYmd: string,
): string | null {
  const row = pickEarningsHistoryRow(root, calendarReportYmd.trim());
  if (!row) return formatEarningsDateEnUS(calendarReportYmd);
  return (
    formatEarningsDateEnUS(row.reportDate ?? row.ReportDate ?? row.report_date) ??
    formatEarningsDateEnUS(row.date ?? row.Date) ??
    formatEarningsDateEnUS(calendarReportYmd)
  );
}
