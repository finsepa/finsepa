import "server-only";

import { format, parse, subDays } from "date-fns";

import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";

export type EodhdDailyBar = {
  date: string;
  close: number;
};

function barClose(row: Record<string, unknown>): number | null {
  const adj = row.adjusted_close;
  const cl = row.close;
  if (typeof adj === "number" && Number.isFinite(adj)) return adj;
  if (typeof cl === "number" && Number.isFinite(cl)) return cl;
  return null;
}

function barOpen(row: Record<string, unknown>): number | null {
  const o = row.open;
  if (typeof o === "number" && Number.isFinite(o)) return o;
  return null;
}

export type EodhdOpenOnDateResult = {
  price: number;
  barDate: string;
  source: "open" | "close";
};

/**
 * Last trading session on or before calendar {@link ymd} (YYYY-MM-DD).
 * Prefers that bar's **open**; falls back to **close** if open is missing.
 */
export async function fetchEodhdOpenPriceOnOrBefore(
  symbolOrTicker: string,
  ymd: string,
): Promise<EodhdOpenOnDateResult | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

  const key = getEodhdApiKey();
  if (!key) return null;

  const day = parse(ymd, "yyyy-MM-dd", new Date());
  const from = format(subDays(day, 28), "yyyy-MM-dd");
  const to = ymd;

  const sym = toEodhdSymbol(symbolOrTicker);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from,
    to,
  });
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(sym)}?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdOpenPriceOnOrBefore", { symbol: sym, from, to })) return null;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    type Row = { date: string; open: number | null; close: number | null };
    const rows: Row[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const o = barOpen(row);
      const c = barClose(row);
      if (o == null && c == null) continue;
      rows.push({ date, open: o, close: c });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));

    const onOrBefore = rows.filter((r) => r.date <= ymd);
    const pick = onOrBefore.length ? onOrBefore[onOrBefore.length - 1]! : null;
    if (!pick) return null;

    const price = pick.open ?? pick.close;
    if (price == null || !Number.isFinite(price)) return null;

    return {
      price,
      barDate: pick.date,
      source: pick.open != null ? "open" : "close",
    };
  } catch {
    return null;
  }
}

/**
 * Daily EOD bars, ascending by date. One API call per symbol.
 * @see https://eodhd.com/financial-apis/api-for-historical-data-and-volumes/
 */
export async function fetchEodhdEodDaily(
  symbolOrTicker: string,
  from: string,
  to: string,
): Promise<EodhdDailyBar[] | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const sym = toEodhdSymbol(symbolOrTicker);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from,
    to,
  });
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(sym)}?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdEodDaily", { symbol: sym })) return null;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    const out: EodhdDailyBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const close = barClose(row);
      if (close == null) continue;
      out.push({ date, close });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/**
 * Same as {@link fetchEodhdEodDaily} but allows short CDN/data-cache reuse for list views (e.g. Screener).
 * Do not use for interactive charts that require always-fresh bars.
 */
export async function fetchEodhdEodDailyScreener(
  symbolOrTicker: string,
  from: string,
  to: string,
): Promise<EodhdDailyBar[] | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const sym = toEodhdSymbol(symbolOrTicker);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from,
    to,
  });
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(sym)}?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdEodDailyScreener", { symbol: sym })) return null;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    const out: EodhdDailyBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const close = barClose(row);
      if (close == null) continue;
      out.push({ date, close });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out.length ? out : null;
  } catch {
    return null;
  }
}
