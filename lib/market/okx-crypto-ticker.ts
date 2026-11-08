import "server-only";

import {
  normalizeCryptoBaseSymbol,
  toOkxInstId,
  usesOkxLiveSpot,
} from "@/lib/market/crypto-live-1d-tickers";

export { usesOkxLiveSpot as usesOkxHeaderSpot };

type CacheEntry = { price: number; quotedAtSec: number; expiresAtMs: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1_500;
const FETCH_TIMEOUT_MS = 2_500;

/**
 * OKX USDT last price for header-only live quotes (LEO and any future OKX-only allowlist).
 * Allowlist: {@link usesOkxLiveSpot}. Returns null on miss/error so callers fall through.
 */
export async function fetchOkxUsdtLastPrice(
  symbol: string,
): Promise<{ price: number; quotedAtSec: number } | null> {
  const base = normalizeCryptoBaseSymbol(symbol);
  if (!base || !usesOkxLiveSpot(base)) return null;

  const nowMs = Date.now();
  const hit = cache.get(base);
  if (hit && hit.expiresAtMs > nowMs) {
    return { price: hit.price, quotedAtSec: hit.quotedAtSec };
  }

  const instId = toOkxInstId(base);
  if (!instId) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`,
      {
        signal: ac.signal,
        cache: "no-store",
        headers: { "User-Agent": "Finsepa/1.0" },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      data?: Array<{ last?: unknown; ts?: unknown }>;
    };
    if (json.code != null && json.code !== "0") return null;
    const row = json.data?.[0];
    const price =
      typeof row?.last === "string" || typeof row?.last === "number" ? Number(row.last) : NaN;
    if (!Number.isFinite(price) || price <= 0) return null;
    let quotedAtSec = Math.floor(nowMs / 1000);
    const ts = typeof row?.ts === "string" || typeof row?.ts === "number" ? Number(row.ts) : NaN;
    if (Number.isFinite(ts) && ts > 0) {
      quotedAtSec = ts > 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);
    }
    cache.set(base, { price, quotedAtSec, expiresAtMs: nowMs + CACHE_TTL_MS });
    return { price, quotedAtSec };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
