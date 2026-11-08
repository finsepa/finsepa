import "server-only";

import {
  normalizeCryptoBaseSymbol,
  toBinanceUsdtBase,
  usesBinanceLiveSpot,
} from "@/lib/market/crypto-live-1d-tickers";

export { usesBinanceLiveSpot as usesBinanceHeaderSpot };

type CacheEntry = { price: number; quotedAtSec: number; expiresAtMs: number };

const cache = new Map<string, CacheEntry>();
/** Keep header snappy without hammering Binance on every parallel poll. */
const CACHE_TTL_MS = 1_500;
const FETCH_TIMEOUT_MS = 2_500;

/**
 * Binance USDT last price for header-only live quotes (CMC-style).
 * Allowlist: {@link usesBinanceLiveSpot}. Returns null on miss/error so callers fall through.
 */
export async function fetchBinanceUsdtLastPrice(
  symbol: string,
): Promise<{ price: number; quotedAtSec: number } | null> {
  const base = normalizeCryptoBaseSymbol(symbol);
  if (!base || !usesBinanceLiveSpot(base)) return null;

  const nowMs = Date.now();
  const hit = cache.get(base);
  if (hit && hit.expiresAtMs > nowMs) {
    return { price: hit.price, quotedAtSec: hit.quotedAtSec };
  }

  const pairBase = toBinanceUsdtBase(base);
  const pair = `${pairBase}USDT`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { price?: unknown };
    const price = typeof json.price === "string" || typeof json.price === "number" ? Number(json.price) : NaN;
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
