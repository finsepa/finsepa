import "server-only";

import { formatEarningsDateEnUS, parseUnknownDateToUtcMs } from "@/lib/market/eodhd-fundamentals";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";

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
  if (!trend || typeof trend !== "object") return [];
  return Object.values(trend).filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
}

function fiscalPeriodEndYmdFromRow(r: Record<string, unknown>): string | null {
  return toYmdUtcFromRow(
    r.date ?? r.Date ?? r.periodEnd ?? r.PeriodEnd ?? r.endDate ?? r.EndDate ?? r.fiscalDate ?? r.FiscalDate,
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

function trendEstimatesForFiscalPeriod(
  root: Record<string, unknown>,
  fiscalPeriodEndYmd: string | null,
): { revenue: number | null; eps: number | null } {
  if (!fiscalPeriodEndYmd) return { revenue: null, eps: null };
  for (const r of trendRows(root)) {
    if (fiscalPeriodEndYmdFromRow(r) !== fiscalPeriodEndYmd) continue;
    const revenue =
      numFromRow(r, [
        "revenueEstimateAvg",
        "revenueEstimate",
        "revenueEstimated",
        "estimatedRevenue",
        "RevenueEstimateAvg",
      ]) ?? revenueEstimateFromLooseKeys(r);
    const eps = numFromRow(r, [
      "earningsEstimateAvg",
      "epsEstimate",
      "epsEstimated",
      "estimatedEps",
      "estimatedEPS",
      "EPSEstimate",
    ]);
    return { revenue, eps };
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
  const row = pickEarningsHistoryRow(root, calendarReportYmd.trim());
  const fiscalPeriodEndYmd = row ? fiscalPeriodEndYmdFromRow(row) : null;
  const trendEst = trendEstimatesForFiscalPeriod(root, fiscalPeriodEndYmd);

  let estRevenue: number | null = null;
  let estEps: number | null = null;

  if (row) {
    estRevenue = numFromRow(row, [
      "revenueEstimate",
      "estimatedRevenue",
      "estimatedAverageRevenue",
      "RevenueEstimate",
      "revenueEstimated",
    ]);
    estEps = numFromRow(row, [
      "epsEstimate",
      "epsEstimated",
      "estimatedEps",
      "estimatedEPS",
      "EPSEstimate",
      "epsAverage",
      "epsAvg",
    ]);
  }

  if (estRevenue == null) estRevenue = trendEst.revenue;
  if (estEps == null) estEps = trendEst.eps;

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
