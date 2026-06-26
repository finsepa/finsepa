"use client";

import {
  applyWatchlistScreenerIdentity,
  persistWatchlistStockIdentities,
} from "@/lib/watchlist/apply-watchlist-identity";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import {
  readWatchlistEnrichedSessionCache,
  writeWatchlistEnrichedSessionCache,
} from "@/lib/watchlist/watchlist-enriched-cache";
import { watchlistApiFetch } from "@/lib/watchlist/watchlist-api-fetch";

export type WatchlistEnrichedResponse = {
  stocks: WatchlistEnrichedItem[];
  crypto: WatchlistEnrichedItem[];
  indices: WatchlistEnrichedItem[];
  marketCacheSegment: string;
};

const inflight = new Map<string, Promise<WatchlistEnrichedResponse>>();

function mergeGroups(data: {
  stocks?: WatchlistEnrichedItem[];
  crypto?: WatchlistEnrichedItem[];
  indices?: WatchlistEnrichedItem[];
}): WatchlistEnrichedItem[] {
  const s = Array.isArray(data.stocks) ? data.stocks : [];
  const c = Array.isArray(data.crypto) ? data.crypto : [];
  const i = Array.isArray(data.indices) ? data.indices : [];
  return [...s, ...c, ...i];
}

async function fetchUsMarketCacheSegment(): Promise<string> {
  const res = await fetch("/api/market/us-cache-epoch", { credentials: "include" });
  if (!res.ok) return "";
  const body = (await res.json()) as { segment?: unknown };
  return typeof body.segment === "string" ? body.segment : "";
}

export async function fetchWatchlistEnriched(
  watchedKey: string,
  tickers: string[],
): Promise<WatchlistEnrichedResponse> {
  const marketCacheSegment = await fetchUsMarketCacheSegment();
  const cacheKey = `${marketCacheSegment}|${watchedKey}`;

  const cached = marketCacheSegment
    ? readWatchlistEnrichedSessionCache(marketCacheSegment, watchedKey)
    : null;
  if (cached) {
    const withIdentity = applyWatchlistScreenerIdentity(cached);
    const stocks = withIdentity.filter((r) => r.kind === "stock");
    const crypto = withIdentity.filter((r) => r.kind === "crypto");
    const indices = withIdentity.filter((r) => r.kind === "index");
    return { stocks, crypto, indices, marketCacheSegment };
  }

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const res = await watchlistApiFetch("/api/watchlist/enrich", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
    });
    if (!res.ok) throw new Error("Watchlist enrich failed");
    const data = (await res.json()) as {
      stocks?: WatchlistEnrichedItem[];
      crypto?: WatchlistEnrichedItem[];
      indices?: WatchlistEnrichedItem[];
      marketCacheSegment?: string;
    };
    const segment =
      typeof data.marketCacheSegment === "string" && data.marketCacheSegment
        ? data.marketCacheSegment
        : marketCacheSegment;
    const merged = mergeGroups(data);
    const withIdentity = applyWatchlistScreenerIdentity(merged);
    persistWatchlistStockIdentities(withIdentity);
    if (segment) {
      writeWatchlistEnrichedSessionCache(segment, watchedKey, withIdentity);
    }
    return {
      stocks: withIdentity.filter((r) => r.kind === "stock"),
      crypto: withIdentity.filter((r) => r.kind === "crypto"),
      indices: withIdentity.filter((r) => r.kind === "index"),
      marketCacheSegment: segment,
    };
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}
