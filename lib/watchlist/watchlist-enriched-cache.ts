import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";

/** Survives watchlist rail remounts when route-group layouts reload the shell. */
let cache: { watchedKey: string; items: WatchlistEnrichedItem[] } | null = null;

export function readWatchlistEnrichedCache(watchedKey: string): WatchlistEnrichedItem[] | null {
  if (!watchedKey || cache?.watchedKey !== watchedKey || cache.items.length === 0) return null;
  return cache.items;
}

export function writeWatchlistEnrichedCache(watchedKey: string, items: WatchlistEnrichedItem[]) {
  if (!watchedKey || items.length === 0) {
    cache = null;
    return;
  }
  cache = { watchedKey, items };
}

export function clearWatchlistEnrichedCache() {
  cache = null;
}
