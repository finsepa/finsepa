import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STOCK_1D_LIVE_SPOT } from "@/lib/data/cache-policy";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";
import { fetchEodhd } from "@/lib/market/eodhd-fetch";

export type EodhdUsQuoteDelayedRow = {
  lastTradePrice?: number;
  /** Unix milliseconds */
  lastTradeTime?: number;
  bidPrice?: number;
  /** Unix milliseconds */
  bidTime?: number;
  askPrice?: number;
  /** Unix milliseconds */
  askTime?: number;
  previousClosePrice?: number;
  change?: number;
  changePercent?: number;
  ethPrice?: number;
  /** Unix milliseconds */
  ethTime?: number;
  /** Snapshot time — Unix seconds */
  timestamp?: number;
};

function parseRow(raw: unknown): EodhdUsQuoteDelayedRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (k: string) => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };
  return {
    lastTradePrice: num("lastTradePrice"),
    lastTradeTime: num("lastTradeTime"),
    bidPrice: num("bidPrice"),
    bidTime: num("bidTime"),
    askPrice: num("askPrice"),
    askTime: num("askTime"),
    previousClosePrice: num("previousClosePrice"),
    change: num("change"),
    changePercent: num("changePercent"),
    ethPrice: num("ethPrice"),
    ethTime: num("ethTime"),
    timestamp: num("timestamp"),
  };
}

/**
 * US extended-hours quote (Live v2) — `ethPrice` / `ethTime` for pre- and post-market.
 * @see https://eodhd.com/financial-apis/live-realtime-stocks-api
 */
async function fetchEodhdUsQuoteDelayedUncached(ticker: string): Promise<EodhdUsQuoteDelayedRow | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const symbol = toEodhdUsSymbol(ticker.trim().toUpperCase());
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    s: symbol,
  });
  const url = `https://eodhd.com/api/us-quote-delayed?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdUsQuoteDelayed", { symbol })) return null;
    const res = await fetchEodhd(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Record<string, unknown> };
    const data = json?.data;
    if (!data || typeof data !== "object") return null;
    const row = data[symbol] ?? data[symbol.toUpperCase()];
    return parseRow(row);
  } catch {
    return null;
  }
}

const getCachedUsQuoteDelayed = unstable_cache(
  async (_cacheKey: string, ticker: string) => fetchEodhdUsQuoteDelayedUncached(ticker),
  ["eodhd-us-quote-delayed-v1"],
  { revalidate: REVALIDATE_STOCK_1D_LIVE_SPOT },
);

/** In-flight coalesce for identical tickers in one isolate (parallel SSR + poll bursts). */
const inflight = new Map<string, Promise<EodhdUsQuoteDelayedRow | null>>();

/**
 * Cached US delayed quote — pre/post extended hours and regular-session fallback.
 * {@link REVALIDATE_STOCK_1D_LIVE_SPOT} (15s) aligns with client extended-hours poll interval.
 */
export async function fetchEodhdUsQuoteDelayed(ticker: string): Promise<EodhdUsQuoteDelayedRow | null> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return null;

  const cacheKey = `eodhd-us-quote-delayed-v1|${sym}`;
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const p = getCachedUsQuoteDelayed(cacheKey, sym).finally(() => {
    inflight.delete(cacheKey);
  });
  inflight.set(cacheKey, p);
  return p;
}
