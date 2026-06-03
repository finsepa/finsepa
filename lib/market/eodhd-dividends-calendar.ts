import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type EodhdDividendCalendarRow = {
  /** Ex-dividend or calendar date from provider */
  date: string;
  symbol: string;
};

function parseCalendarRow(raw: unknown): EodhdDividendCalendarRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date = typeof o.date === "string" ? o.date : undefined;
  const symbol = typeof o.symbol === "string" ? o.symbol : undefined;
  if (!date || !YMD.test(date) || !symbol?.trim()) return null;
  return { date, symbol: symbol.trim().toUpperCase() };
}

async function fetchEodhdDividendsCalendarUncached(
  eodhdSymbol: string,
  fromYmd: string,
  toYmd: string,
): Promise<EodhdDividendCalendarRow[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const sym = toEodhdSymbol(eodhdSymbol);
  if (!sym) return [];

  const params = new URLSearchParams({
    "filter[symbol]": sym,
    "filter[date_from]": fromYmd,
    "filter[date_to]": toYmd,
    "page[limit]": "1000",
    api_token: key,
    fmt: "json",
  });
  const url = `https://eodhd.com/api/calendar/dividends?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdDividendsCalendar", { symbol: sym, from: fromYmd, to: toYmd })) {
      return [];
    }
    const res = await fetch(url, { next: { revalidate: REVALIDATE_WARM } });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: unknown };
    const rows = json?.data;
    if (!Array.isArray(rows)) return [];
    return rows.map(parseCalendarRow).filter(Boolean) as EodhdDividendCalendarRow[];
  } catch {
    return [];
  }
}

const fetchEodhdDividendsCalendarCached = unstable_cache(
  fetchEodhdDividendsCalendarUncached,
  ["eodhd-dividends-calendar-v1"],
  { revalidate: REVALIDATE_WARM },
);

export async function fetchEodhdDividendsCalendar(
  symbolOrTicker: string,
  fromYmd: string,
  toYmd: string,
): Promise<EodhdDividendCalendarRow[]> {
  if (!YMD.test(fromYmd) || !YMD.test(toYmd)) return [];
  return fetchEodhdDividendsCalendarCached(symbolOrTicker, fromYmd, toYmd);
}
