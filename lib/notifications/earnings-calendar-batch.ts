import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import type { EarningsNotifyCalendarRow } from "@/lib/notifications/earnings-notify-types";
import { canonicalNotifyTicker } from "@/lib/notifications/ticker-notify-eligibility";
import { EARNINGS_NOTIFY_LOOKBACK_DAYS } from "@/lib/notifications/earnings-release-detect";
import { fetchEodhd } from "@/lib/market/eodhd-fetch";

function earningsCalendarReportDateWindow(
  lookbackDays = EARNINGS_NOTIFY_LOOKBACK_DAYS,
): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - lookbackDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { from: fmt(from), to: fmt(to) };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function ymd(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Whole-market calendar often emits US listings without `.US` (`TSLA`, `BRK-B`); other exchanges keep a suffix. */
export function usCalendarCode(raw: unknown): string | null {
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (code.endsWith(".US")) return code;
  if (!code || code.includes(".") || !/^[A-Z0-9-]+$/.test(code)) return null;
  return `${code}.US`;
}

function parseCalendarRow(raw: unknown): EarningsNotifyCalendarRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = usCalendarCode(o.code);
  if (!code) return null;
  const ticker = canonicalNotifyTicker(code.replace(/\.US$/i, "").replace(/-/g, "."));
  const epsActual = num(o.actual);
  if (epsActual == null) return null;
  const fiscalPeriodEndYmd = ymd(o.date);
  if (!fiscalPeriodEndYmd) return null;
  const reportDateYmd = ymd(o.report_date ?? o.ReportDate ?? o.reportDate) ?? null;
  const epsEstimate = num(o.estimate);
  let surprisePct = num(o.percent);
  if (surprisePct == null && epsEstimate != null && epsEstimate !== 0 && epsActual != null) {
    surprisePct = ((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100;
  }
  return {
    eodhdCode: code,
    ticker,
    reportDateYmd,
    fiscalPeriodEndYmd,
    epsActual,
    epsEstimate,
    surprisePct,
  };
}

/**
 * Whole-market report-date window, filtered locally. EODHD bills `symbols=` per ticker
 * (79 tickers → 79 credits) but a date-range call without `symbols` as 1 credit.
 */
export async function fetchEarningsCalendarForTickers(
  canonicalTickers: readonly string[],
): Promise<{ rows: EarningsNotifyCalendarRow[]; requests: number }> {
  const key = getEodhdApiKey();
  if (!key || canonicalTickers.length === 0) return { rows: [], requests: 0 };

  const wanted = new Set(canonicalTickers);
  const { from, to } = earningsCalendarReportDateWindow();
  const params = new URLSearchParams({ from, to, api_token: key, fmt: "json" });
  const url = `https://eodhd.com/api/calendar/earnings?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEarningsCalendarForTickers", { count: canonicalTickers.length })) {
      return { rows: [], requests: 0 };
    }
    const res = await fetchEodhd(url, { cache: "no-store" });
    if (!res.ok) return { rows: [], requests: 1 };
    const json = (await res.json()) as { earnings?: unknown };
    const arr = json?.earnings;
    if (!Array.isArray(arr)) return { rows: [], requests: 1 };
    const rows: EarningsNotifyCalendarRow[] = [];
    for (const raw of arr) {
      const row = parseCalendarRow(raw);
      if (row && wanted.has(row.ticker)) rows.push(row);
    }
    return { rows, requests: 1 };
  } catch {
    return { rows: [], requests: 1 };
  }
}