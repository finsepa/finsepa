import "server-only";

import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

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
export async function fetchEodhdUsQuoteDelayed(ticker: string): Promise<EodhdUsQuoteDelayedRow | null> {
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
    const res = await fetch(url, { cache: "no-store" });
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
