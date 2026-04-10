import "server-only";

import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

export type EodhdRealtimePayload = {
  code?: string;
  timestamp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  previousClose?: number;
  change?: number;
  change_p?: number;
};

/** EODHD multi-ticker realtime `s=` param — provider recommends ~15–20 symbols per request. */
export const EODHD_REALTIME_SYMBOLS_PER_REQUEST = 15;

/**
 * US exchange real-time quote. One HTTP request per symbol (batched at call site).
 * @see https://eodhd.com/financial-apis/live-realtime-stocks-api/
 */
export async function fetchEodhdUsRealtime(ticker: string): Promise<EodhdRealtimePayload | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const symbol = toEodhdUsSymbol(ticker);
  const url = `https://eodhd.com/api/real-time/${encodeURIComponent(symbol)}?api_token=${encodeURIComponent(key)}&fmt=json`;

  try {
    if (!traceEodhdHttp("fetchEodhdUsRealtime", { symbol })) return null;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as EodhdRealtimePayload & { error?: string };
    if (data && typeof data === "object" && "error" in data && data.error) return null;
    return data;
  } catch {
    return null;
  }
}

function parseRealtimeMultiJson(raw: unknown): Map<string, EodhdRealtimePayload> {
  const map = new Map<string, EodhdRealtimePayload>();
  const add = (row: unknown) => {
    if (!row || typeof row !== "object") return;
    const o = row as EodhdRealtimePayload & { error?: string };
    if ("error" in o && o.error) return;
    const code = typeof o.code === "string" ? o.code.trim().toUpperCase() : "";
    if (!code) return;
    map.set(code, o);
  };
  if (Array.isArray(raw)) {
    for (const item of raw) add(item);
  } else {
    add(raw);
  }
  return map;
}

/**
 * Multi-symbol realtime quotes — chunked `s=` requests (US, crypto `.CC`, indices, etc.).
 * Use this instead of one oversized URL when mixing many symbols.
 */
export async function fetchEodhdRealtimeSymbolsRaw(symbols: string[]): Promise<Map<string, EodhdRealtimePayload>> {
  const key = getEodhdApiKey();
  const out = new Map<string, EodhdRealtimePayload>();
  if (!key || symbols.length === 0) return out;

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const s of symbols) {
    const t = s.trim();
    if (!t) continue;
    const u = t.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    deduped.push(t);
  }
  if (!deduped.length) return out;

  const batch = EODHD_REALTIME_SYMBOLS_PER_REQUEST;

  for (let i = 0; i < deduped.length; i += batch) {
    const chunk = deduped.slice(i, i + batch);
    const first = chunk[0]!;
    const rest = chunk.slice(1);
    const sParam = rest.length ? `&s=${rest.map((s) => encodeURIComponent(s)).join(",")}` : "";
    const url = `https://eodhd.com/api/real-time/${encodeURIComponent(first)}?api_token=${encodeURIComponent(key)}&fmt=json${sParam}`;

    try {
      if (!traceEodhdHttp("fetchEodhdRealtimeSymbolsRaw", { symbolsInRequest: chunk.length })) continue;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      const batchMap = parseRealtimeMultiJson(json);
      for (const [code, payload] of batchMap) out.set(code, payload);
    } catch {
      // continue other chunks
    }
  }

  return out;
}

/**
 * Multiple US symbols in fewer HTTP round-trips (EODHD `s=` param).
 * @see https://eodhd.com/financial-apis/live-ohlcv-stocks-api (Multiple Tickers with One Request)
 */
export async function fetchEodhdUsRealtimeBatch(tickers: string[]): Promise<Map<string, EodhdRealtimePayload>> {
  const symbols = tickers.map((t) => toEodhdUsSymbol(t.trim().toUpperCase())).filter(Boolean);
  return fetchEodhdRealtimeSymbolsRaw(symbols);
}
