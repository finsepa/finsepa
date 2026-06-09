import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { tryConsumeEodhdRequestSlot } from "@/lib/market/eodhd-hourly-budget";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import type { EarningsNotifyCalendarRow } from "@/lib/notifications/earnings-notify-types";
import {
  canonicalNotifyTicker,
  eodhdCalendarCodeFromTicker,
} from "@/lib/notifications/ticker-notify-eligibility";

export const EARNINGS_NOTIFY_CALENDAR_BATCH_SIZE = 80;

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

function parseCalendarRow(raw: unknown): EarningsNotifyCalendarRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code.trim().toUpperCase() : "";
  if (!code.endsWith(".US")) return null;
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

export async function fetchEarningsCalendarBatch(
  canonicalTickers: readonly string[],
): Promise<{ rows: EarningsNotifyCalendarRow[]; requests: number }> {
  const key = getEodhdApiKey();
  if (!key || canonicalTickers.length === 0) return { rows: [], requests: 0 };

  const symbols = canonicalTickers.map(eodhdCalendarCodeFromTicker).join(",");
  if (!tryConsumeEodhdRequestSlot()) {
    return { rows: [], requests: 0 };
  }

  const params = new URLSearchParams({
    symbols,
    api_token: key,
    fmt: "json",
  });
  const url = `https://eodhd.com/api/calendar/earnings?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEarningsCalendarBatch", { count: canonicalTickers.length })) {
      return { rows: [], requests: 0 };
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { rows: [], requests: 1 };
    const json = (await res.json()) as { earnings?: unknown };
    const arr = json?.earnings;
    if (!Array.isArray(arr)) return { rows: [], requests: 1 };
    const rows = arr.map(parseCalendarRow).filter(Boolean) as EarningsNotifyCalendarRow[];
    return { rows, requests: 1 };
  } catch {
    return { rows: [], requests: 1 };
  }
}

export function chunkTickers(tickers: readonly string[], size = EARNINGS_NOTIFY_CALENDAR_BATCH_SIZE): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < tickers.length; i += size) {
    out.push(tickers.slice(i, i + size));
  }
  return out;
}
