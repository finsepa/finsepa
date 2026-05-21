import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_EARNINGS_CALENDAR } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

export type EodhdRawEarningRow = {
  code?: string;
  report_date?: string;
  date?: string;
  before_after_market?: string | null;
  /** Some responses may include a name field — use when present. */
  name?: string;
  company_name?: string;
  CompanyName?: string;
};

function strField(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

function parseRawRow(raw: unknown): EodhdRawEarningRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    code: typeof o.code === "string" ? o.code : undefined,
    /** Announcement / report calendar date — use for column placement only (not `date`, which is fiscal period end). */
    report_date: strField(o, "report_date", "ReportDate", "reportDate"),
    /** Fiscal period end — do not use for day columns. */
    date: typeof o.date === "string" ? o.date : undefined,
    before_after_market:
      o.before_after_market === null || o.before_after_market === undefined
        ? null
        : String(o.before_after_market),
    name: typeof o.name === "string" ? o.name : undefined,
    company_name: typeof o.company_name === "string" ? o.company_name : undefined,
    CompanyName: typeof o.CompanyName === "string" ? o.CompanyName : undefined,
  };
}

/**
 * EODHD calendar/earnings for a date range (inclusive).
 * @see https://eodhd.com/financial-apis/calendar-upcoming-earnings-ipos-and-splits
 */
async function fetchEodhdEarningsCalendarUncached(fromYmd: string, toYmd: string): Promise<EodhdRawEarningRow[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const params = new URLSearchParams({
    from: fromYmd,
    to: toYmd,
    api_token: key,
    fmt: "json",
  });
  const url = `https://eodhd.com/api/calendar/earnings?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdEarningsCalendar", { from: fromYmd, to: toYmd })) return [];
    /** Wide ranges exceed Next.js 2MB data-cache — do not persist this response in the fetch cache. */
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { earnings?: unknown };
    const rows = json?.earnings;
    if (!Array.isArray(rows)) return [];
    return rows.map(parseRawRow).filter(Boolean) as EodhdRawEarningRow[];
  } catch {
    return [];
  }
}

/** Earnings week uses Mon–Fri (~5d); longer windows can exceed Next.js 2MB `unstable_cache` limit. */
const EARNINGS_CALENDAR_MAX_CACHED_RANGE_DAYS = 8;

function calendarRangeDayCount(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00.000Z`);
  const b = Date.parse(`${toYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.floor(Math.abs(b - a) / 86_400_000) + 1;
}

const fetchEodhdEarningsCalendarRangeCached = unstable_cache(
  fetchEodhdEarningsCalendarUncached,
  ["eodhd-earnings-calendar-range-v1"],
  { revalidate: REVALIDATE_EARNINGS_CALENDAR },
);

/**
 * Bulk date-range calendar (earnings week). Narrow ranges are `unstable_cache`d for cross-user
 * reuse; wide ranges use `cache: "no-store"` only (no 2MB data-cache write).
 */
export async function fetchEodhdEarningsCalendar(fromYmd: string, toYmd: string): Promise<EodhdRawEarningRow[]> {
  if (calendarRangeDayCount(fromYmd, toYmd) > EARNINGS_CALENDAR_MAX_CACHED_RANGE_DAYS) {
    return fetchEodhdEarningsCalendarUncached(fromYmd, toYmd);
  }
  return fetchEodhdEarningsCalendarRangeCached(fromYmd, toYmd);
}

/**
 * EODHD calendar/earnings for one listing (e.g. `PYPL.US`).
 * Uses `symbols` so the payload stays small enough for `unstable_cache` (bulk date ranges can exceed 2MB).
 */
async function fetchEodhdEarningsCalendarForSymbolUncached(eodhdSymbol: string): Promise<EodhdRawEarningRow[]> {
  const symbol = eodhdSymbol.trim().toUpperCase();
  if (!symbol) return [];

  const key = getEodhdApiKey();
  if (!key) return [];

  const params = new URLSearchParams({
    symbols: symbol,
    api_token: key,
    fmt: "json",
  });
  const url = `https://eodhd.com/api/calendar/earnings?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdEarningsCalendarForSymbol", { symbols: symbol })) return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_EARNINGS_CALENDAR } });
    if (!res.ok) return [];
    const json = (await res.json()) as { earnings?: unknown };
    const rows = json?.earnings;
    if (!Array.isArray(rows)) return [];
    return rows.map(parseRawRow).filter(Boolean) as EodhdRawEarningRow[];
  } catch {
    return [];
  }
}

const fetchEodhdEarningsCalendarForSymbolCached = unstable_cache(
  fetchEodhdEarningsCalendarForSymbolUncached,
  ["eodhd-earnings-calendar-symbol-v2"],
  { revalidate: REVALIDATE_EARNINGS_CALENDAR },
);

export async function fetchEodhdEarningsCalendarForSymbol(eodhdSymbol: string): Promise<EodhdRawEarningRow[]> {
  return fetchEodhdEarningsCalendarForSymbolCached(eodhdSymbol);
}
