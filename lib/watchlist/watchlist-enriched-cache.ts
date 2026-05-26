"use client";

import {
  readSegmentLruEntry,
  resetSegmentLruIfStale,
  writeSegmentLruEntry,
} from "@/lib/cache/client-segment-lru";
import { WATCHLIST_ENRICHED_LRU_MAX } from "@/lib/cache/screener-client-cache-limits";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";

const STORAGE_KEY = "finsepa:watchlist:enriched:v2-lru";

/** In-memory fallback when sessionStorage is unavailable. */
let memoryFallback: { marketSegment: string; watchedKey: string; items: WatchlistEnrichedItem[] } | null =
  null;

export function resetWatchlistEnrichedCacheIfStale(marketSegment: string, watchedKey: string): void {
  resetSegmentLruIfStale(STORAGE_KEY, marketSegment);
  if (
    memoryFallback &&
    memoryFallback.marketSegment === marketSegment &&
    memoryFallback.watchedKey === watchedKey
  ) {
    return;
  }
  memoryFallback = null;
}

export function readWatchlistEnrichedSessionCache(
  marketSegment: string,
  watchedKey: string,
): WatchlistEnrichedItem[] | null {
  const fromMem =
    memoryFallback?.marketSegment === marketSegment && memoryFallback.watchedKey === watchedKey
      ? memoryFallback.items
      : null;
  if (fromMem?.length) return fromMem;

  const items = readSegmentLruEntry<WatchlistEnrichedItem[]>(STORAGE_KEY, marketSegment, watchedKey);
  return items?.length ? items : null;
}

export function writeWatchlistEnrichedSessionCache(
  marketSegment: string,
  watchedKey: string,
  items: WatchlistEnrichedItem[],
): void {
  if (!watchedKey || items.length === 0) {
    memoryFallback = null;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    return;
  }
  memoryFallback = { marketSegment, watchedKey, items };
  writeSegmentLruEntry(STORAGE_KEY, marketSegment, watchedKey, items, WATCHLIST_ENRICHED_LRU_MAX);
}

export function clearWatchlistEnrichedCache(): void {
  memoryFallback = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Use {@link readWatchlistEnrichedSessionCache}. */
export function readWatchlistEnrichedCache(watchedKey: string): WatchlistEnrichedItem[] | null {
  if (memoryFallback?.watchedKey === watchedKey && memoryFallback.items.length > 0) {
    return memoryFallback.items;
  }
  return null;
}

/** @deprecated Use {@link writeWatchlistEnrichedSessionCache}. */
export function writeWatchlistEnrichedCache(watchedKey: string, items: WatchlistEnrichedItem[]): void {
  writeWatchlistEnrichedSessionCache(memoryFallback?.marketSegment ?? "", watchedKey, items);
}
