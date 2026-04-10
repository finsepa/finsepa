import "server-only";

import { fetchEodhdFundamentalsJson, formatEarningsDateEnUS, parseUnknownDateToUtcMs } from "@/lib/market/eodhd-fundamentals";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { logoUrlFromFundamentalsRoot } from "@/lib/market/stock-logo-url";

export type EarningsPreviewPayload = {
  ticker: string;
  companyName: string;
  logoUrl: string;
  /** Display for the announcement / report date tile */
  earningsDateDisplay: string | null;
  estRevenueDisplay: string | null;
  estEpsDisplay: string | null;
};

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

function companyNameFromRoot(root: Record<string, unknown>, fallback: string): string {
  const general = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const nameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName;
  if (typeof nameRaw === "string" && nameRaw.trim()) return nameRaw.trim();
  return fallback;
}

/**
 * Pick the Earnings.History row for this preview: prefer period whose report date matches the calendar column.
 * Otherwise use the nearest upcoming announcement (UTC day >= today).
 */
function pickEarningsHistoryRow(
  root: Record<string, unknown>,
  calendarReportYmd: string,
): { row: Record<string, unknown> | null; earningsDateDisplay: string | null } {
  const earn = root.Earnings;
  if (!earn || typeof earn !== "object") return { row: null, earningsDateDisplay: null };
  const e = earn as Record<string, unknown>;
  const history = e.History;
  if (!history || typeof history !== "object") return { row: null, earningsDateDisplay: null };
  const h = history as Record<string, unknown>;

  const rows: Record<string, unknown>[] = [];
  for (const row of Object.values(h)) {
    if (row && typeof row === "object") rows.push(row as Record<string, unknown>);
  }
  if (!rows.length) return { row: null, earningsDateDisplay: null };

  for (const r of rows) {
    const ymd =
      toYmdUtcFromRow(r.reportDate ?? r.ReportDate ?? r.report_date) ??
      toYmdUtcFromRow(r.date ?? r.Date);
    if (ymd === calendarReportYmd) {
      const disp =
        formatEarningsDateEnUS(r.reportDate ?? r.ReportDate ?? r.report_date) ??
        formatEarningsDateEnUS(r.date ?? r.Date) ??
        formatEarningsDateEnUS(calendarReportYmd);
      return { row: r, earningsDateDisplay: disp };
    }
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
  const pick = best?.r ?? rows[rows.length - 1]!;
  const disp =
    formatEarningsDateEnUS(pick.reportDate ?? pick.ReportDate ?? pick.report_date) ??
    formatEarningsDateEnUS(pick.date ?? pick.Date);
  return { row: pick, earningsDateDisplay: disp };
}

function formatEpsEst(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * One fundamentals fetch (cached per ticker) + parse Earnings.History for estimates.
 */
export async function getEarningsPreviewPayload(args: {
  ticker: string;
  /** Calendar column date YYYY-MM-DD (announcement day from earnings calendar). */
  reportDateYmd: string;
  fallbackCompanyName: string;
  fallbackLogoUrl: string;
}): Promise<EarningsPreviewPayload> {
  const root = await fetchEodhdFundamentalsJson(args.ticker);
  if (!root) {
    return {
      ticker: args.ticker,
      companyName: args.fallbackCompanyName,
      logoUrl: args.fallbackLogoUrl,
      earningsDateDisplay: formatEarningsDateEnUS(args.reportDateYmd),
      estRevenueDisplay: null,
      estEpsDisplay: null,
    };
  }

  const { row, earningsDateDisplay } = pickEarningsHistoryRow(root, args.reportDateYmd.trim());

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

  const logo = logoUrlFromFundamentalsRoot(root, args.ticker);
  const name = companyNameFromRoot(root, args.fallbackCompanyName);

  return {
    ticker: args.ticker,
    companyName: name,
    logoUrl: logo || args.fallbackLogoUrl,
    earningsDateDisplay: earningsDateDisplay ?? formatEarningsDateEnUS(args.reportDateYmd),
    estRevenueDisplay: estRevenue != null ? formatUsdCompact(estRevenue) : null,
    estEpsDisplay: estEps != null ? formatEpsEst(estEps) : null,
  };
}
