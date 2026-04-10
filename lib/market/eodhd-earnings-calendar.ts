import "server-only";

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
export async function fetchEodhdEarningsCalendar(fromYmd: string, toYmd: string): Promise<EodhdRawEarningRow[]> {
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
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { earnings?: unknown };
    const rows = json?.earnings;
    if (!Array.isArray(rows)) return [];
    return rows.map(parseRawRow).filter(Boolean) as EodhdRawEarningRow[];
  } catch {
    return [];
  }
}
