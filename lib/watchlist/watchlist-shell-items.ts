"use client";

import { toSupportedCryptoTicker } from "@/lib/market/crypto-meta";
import { applyWatchlistScreenerIdentity } from "@/lib/watchlist/apply-watchlist-identity";
import { WATCHLIST_CRYPTO_PREFIX, WATCHLIST_INDEX_PREFIX } from "@/lib/watchlist/constants";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import { normalizeWatchlistStorageKey } from "@/lib/watchlist/normalize-storage-key";

function parseStorageKey(key: string): { kind: WatchlistEnrichedItem["kind"]; symbol: string } {
  const t = key.trim().toUpperCase();
  if (t.startsWith(WATCHLIST_CRYPTO_PREFIX)) {
    return { kind: "crypto", symbol: t.slice(WATCHLIST_CRYPTO_PREFIX.length).trim() || "?" };
  }
  if (t.startsWith(WATCHLIST_INDEX_PREFIX)) {
    return { kind: "index", symbol: t.slice(WATCHLIST_INDEX_PREFIX.length).trim() || "?" };
  }
  return { kind: "stock", symbol: t };
}

function shellHref(kind: WatchlistEnrichedItem["kind"], symbol: string): string {
  if (kind === "crypto") {
    const sup = toSupportedCryptoTicker(symbol) ?? symbol;
    return `/crypto/${encodeURIComponent(sup)}`;
  }
  if (kind === "index") {
    return `/index/${encodeURIComponent(symbol)}`;
  }
  return `/stock/${encodeURIComponent(symbol)}`;
}

const EMPTY_METRICS = {
  price: null,
  pct1d: null,
  pct1m: null,
  ytd: null,
  mcapDisplay: "-",
  peDisplay: "-",
  earningsDisplay: "-",
} as const;

/** Instant rail/table rows from ticker keys — logos/names from screener cache when available. */
export function buildWatchlistShellItems(tickers: string[]): WatchlistEnrichedItem[] {
  const items: WatchlistEnrichedItem[] = [];
  for (let i = 0; i < tickers.length; i++) {
    const storageKey = normalizeWatchlistStorageKey(tickers[i]!);
    if (!storageKey) continue;
    const { kind, symbol } = parseStorageKey(storageKey);
    items.push({
      entryId: `shell-${storageKey}-${i}`,
      storageKey,
      symbol,
      name: symbol,
      kind,
      href: shellHref(kind, symbol),
      logoUrl: null,
      ...EMPTY_METRICS,
    });
  }
  return applyWatchlistScreenerIdentity(items);
}
