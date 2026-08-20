/**
 * Canonical multi-symbol EODHD realtime loader (P1-3).
 *
 * Per-symbol `unstable_cache` + in-flight batching so portfolio, screener, and watchlist
 * share one provider GET for overlapping tickers. TTL matches list/portfolio quotes (~5m),
 * not stock-page 15s live spot (that path stays on `fetchEodhdUsRealtime`).
 */
import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_BATCH_REALTIME_QUOTES } from "@/lib/data/cache-policy";
import {
  fetchEodhdRealtimeSymbolsRaw,
  type EodhdRealtimePayload,
} from "@/lib/market/eodhd-realtime";
import {
  normalizeRealtimeSymbols,
  pickRealtimePayloadFromMap,
} from "@/lib/market/eodhd-realtime-payload";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

type Waiter = {
  symbol: string;
  resolve: (payload: EodhdRealtimePayload | null) => void;
};

let pendingSymbols = new Set<string>();
let waiters: Waiter[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBatchFlush(): void {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushRealtimeBatch();
  }, 0);
}

async function flushRealtimeBatch(): Promise<void> {
  const symbols = [...pendingSymbols];
  const queued = waiters;
  pendingSymbols = new Set();
  waiters = [];
  if (!symbols.length) {
    for (const w of queued) w.resolve(null);
    return;
  }
  const map = await fetchEodhdRealtimeSymbolsRaw(symbols);
  for (const w of queued) {
    w.resolve(pickRealtimePayloadFromMap(map, w.symbol));
  }
}

function fetchSymbolViaSharedBatch(symbol: string): Promise<EodhdRealtimePayload | null> {
  return new Promise((resolve) => {
    pendingSymbols.add(symbol);
    waiters.push({ symbol, resolve });
    scheduleBatchFlush();
  });
}

const getCachedRealtimeQuote = unstable_cache(
  async (symbol: string): Promise<EodhdRealtimePayload | null> => {
    return fetchSymbolViaSharedBatch(symbol);
  },
  ["eodhd-realtime-quote-v1"],
  { revalidate: REVALIDATE_BATCH_REALTIME_QUOTES },
);

const inflight = new Map<string, Promise<EodhdRealtimePayload | null>>();

function withInflight(
  symbol: string,
  run: () => Promise<EodhdRealtimePayload | null>,
): Promise<EodhdRealtimePayload | null> {
  const existing = inflight.get(symbol);
  if (existing) return existing;
  const p = run().finally(() => {
    inflight.delete(symbol);
  });
  inflight.set(symbol, p);
  return p;
}

/**
 * Load realtime payloads keyed by **requested** EODHD symbols (e.g. `AAPL.US`, `BTC-USD.CC`).
 * Missing / failed symbols are omitted (same as raw multi-fetch).
 */
export async function loadEodhdRealtimeQuotes(
  symbols: readonly string[],
): Promise<Map<string, EodhdRealtimePayload>> {
  const unique = normalizeRealtimeSymbols(symbols);
  if (!unique.length) return new Map();

  const pairs = await Promise.all(
    unique.map(async (sym) => {
      const payload = await withInflight(sym, () => getCachedRealtimeQuote(sym));
      return [sym, payload] as const;
    }),
  );

  const out = new Map<string, EodhdRealtimePayload>();
  for (const [sym, payload] of pairs) {
    if (payload) {
      out.set(sym, payload);
      const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (code && !out.has(code)) out.set(code, payload);
    }
  }
  return out;
}

/** US tickers → qualified symbols, then {@link loadEodhdRealtimeQuotes}. */
export async function loadEodhdUsRealtimeQuotes(
  tickers: readonly string[],
): Promise<Map<string, EodhdRealtimePayload>> {
  const symbols = tickers.map((t) => toEodhdUsSymbol(t.trim().toUpperCase())).filter(Boolean);
  return loadEodhdRealtimeQuotes(symbols);
}
