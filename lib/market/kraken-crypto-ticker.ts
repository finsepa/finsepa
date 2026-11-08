import "server-only";

import {
  normalizeCryptoBaseSymbol,
  toKrakenPairMeta,
  usesKrakenLiveSpot,
} from "@/lib/market/crypto-live-1d-tickers";

export { usesKrakenLiveSpot as usesKrakenHeaderSpot };

type CacheEntry = { price: number; quotedAtSec: number; expiresAtMs: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1_500;
const FETCH_TIMEOUT_MS = 2_500;

/**
 * Kraken USD last price for header-only live quotes (same role as Binance USDT).
 * Allowlist: {@link usesKrakenLiveSpot}. Returns null on miss/error so callers fall through.
 */
export async function fetchKrakenUsdLastPrice(
  symbol: string,
): Promise<{ price: number; quotedAtSec: number } | null> {
  const base = normalizeCryptoBaseSymbol(symbol);
  if (!base || !usesKrakenLiveSpot(base)) return null;

  const nowMs = Date.now();
  const hit = cache.get(base);
  if (hit && hit.expiresAtMs > nowMs) {
    return { price: hit.price, quotedAtSec: hit.quotedAtSec };
  }

  const meta = toKrakenPairMeta(base);
  if (!meta) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(meta.restPair)}`,
      { signal: ac.signal, cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      error?: unknown[];
      result?: Record<string, { c?: unknown[] }>;
    };
    if (Array.isArray(json.error) && json.error.length) return null;
    const rows = json.result ?? {};
    const row = rows[meta.restPair] ?? Object.values(rows)[0];
    const last = row?.c?.[0];
    const price = typeof last === "string" || typeof last === "number" ? Number(last) : NaN;
    if (!Number.isFinite(price) || price <= 0) return null;
    const quotedAtSec = Math.floor(nowMs / 1000);
    cache.set(base, { price, quotedAtSec, expiresAtMs: nowMs + CACHE_TTL_MS });
    return { price, quotedAtSec };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
