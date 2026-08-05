import "server-only";

import { format, parse, subDays } from "date-fns";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { readScreenerEodBarsSnapshot, upsertScreenerEodBarsSnapshot } from "@/lib/screener/screener-eod-bars-snapshot";
import { fetchEodhd } from "@/lib/market/eodhd-fetch";

export type EodhdDailyBar = {
  date: string;
  close: number;
};

/** Prefer adjusted close (continuous series for charts / performance). */
function barCloseAdjusted(row: Record<string, unknown>): number | null {
  const adj = row.adjusted_close;
  const cl = row.close;
  if (typeof adj === "number" && Number.isFinite(adj) && adj > 0) return adj;
  if (typeof cl === "number" && Number.isFinite(cl) && cl > 0) return cl;
  return null;
}

/** Raw session close (as-traded) — for portfolio trade fills across stock splits. */
function barCloseUnadjusted(row: Record<string, unknown>): number | null {
  const cl = row.close;
  if (typeof cl === "number" && Number.isFinite(cl) && cl > 0) return cl;
  const adj = row.adjusted_close;
  if (typeof adj === "number" && Number.isFinite(adj) && adj > 0) return adj;
  return null;
}

function barOpen(row: Record<string, unknown>): number | null {
  const o = row.open;
  if (typeof o === "number" && Number.isFinite(o) && o > 0) return o;
  return null;
}

export type EodhdEodCloseMode = "adjusted" | "unadjusted";

export type EodhdDailyBarWithBothCloses = {
  date: string;
  /** Unadjusted session close. */
  close: number;
  /** Split-adjusted close when present; else same as {@link close}. */
  adjustedClose: number;
};


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
    const res = await fetchEodhd(url, { cache: "no-store" });
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
      const c = barCloseAdjusted(row);
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
 *
 * Default {@link closeMode} `"adjusted"` keeps charts continuous across splits.
 * Use `"unadjusted"` for portfolio/as-traded fill (pairs with Split ledger rows).
 */
export async function fetchEodhdEodDaily(
  symbolOrTicker: string,
  from: string,
  to: string,
  closeMode: EodhdEodCloseMode = "adjusted",
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
    if (!traceEodhdHttp("fetchEodhdEodDaily", { symbol: sym, closeMode })) return null;
    const res = await fetchEodhd(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    const pickClose = closeMode === "unadjusted" ? barCloseUnadjusted : barCloseAdjusted;
    const out: EodhdDailyBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const close = pickClose(row);
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
 * Daily bars with both raw and adjusted closes (for detecting adjusted-vs-as-traded trade prices).
 */
export async function fetchEodhdEodDailyBothCloses(
  symbolOrTicker: string,
  from: string,
  to: string,
): Promise<EodhdDailyBarWithBothCloses[] | null> {
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
    if (!traceEodhdHttp("fetchEodhdEodDailyBothCloses", { symbol: sym })) return null;
    const res = await fetchEodhd(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    const out: EodhdDailyBarWithBothCloses[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const close = barCloseUnadjusted(row);
      if (close == null) continue;
      const adjusted = barCloseAdjusted(row) ?? close;
      out.push({ date, close, adjustedClose: adjusted });
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

  const snap = await readScreenerEodBarsSnapshot(sym);
  if (snap !== undefined) return snap;

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
    const res = await fetchEodhd(url, { next: { revalidate: REVALIDATE_WARM } });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;

    const out: EodhdDailyBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const close = barCloseAdjusted(row);
      if (close == null) continue;
      out.push({ date, close });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    const result = out.length ? out : null;
    void upsertScreenerEodBarsSnapshot(sym, result);
    return result;
  } catch {
    return null;
  }
}
