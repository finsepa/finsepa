"use client";

import {
  readSegmentLruEntry,
  resetSegmentLruIfStale,
  writeSegmentLruEntry,
} from "@/lib/cache/client-segment-lru";
import { SCREENER_INDEX_CARDS_LRU_MAX } from "@/lib/cache/screener-client-cache-limits";
import type { IndexCardData } from "@/lib/screener/indices-today";

const STORAGE_KEY = "finsepa:screener:index-cards:v2-lru";
const CARDS_KEY = "cards";

const inflight = new Map<string, Promise<IndexCardData[]>>();

export function resetScreenerIndexCardsCacheIfStale(marketSegment: string): void {
  resetSegmentLruIfStale(STORAGE_KEY, marketSegment);
}

export function readScreenerIndexCardsCache(marketSegment: string): IndexCardData[] | null {
  const cards = readSegmentLruEntry<IndexCardData[]>(STORAGE_KEY, marketSegment, CARDS_KEY);
  return cards?.length ? cards : null;
}

export function writeScreenerIndexCardsCache(marketSegment: string, cards: IndexCardData[]): void {
  if (!marketSegment || cards.length === 0) return;
  writeSegmentLruEntry(STORAGE_KEY, marketSegment, CARDS_KEY, cards, SCREENER_INDEX_CARDS_LRU_MAX);
}

export async function fetchScreenerIndexCardsCached(
  marketSegment: string,
  cacheKey: string,
): Promise<IndexCardData[]> {
  const cached = readScreenerIndexCardsCache(marketSegment);
  if (cached) return cached;

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch("/api/screener/indices", { credentials: "include" });
    if (!res.ok) throw new Error("Index cards request failed");
    const json = (await res.json()) as { cards?: IndexCardData[]; marketCacheSegment?: string };
    const cards = Array.isArray(json.cards) ? json.cards : [];
    const segment =
      typeof json.marketCacheSegment === "string" && json.marketCacheSegment
        ? json.marketCacheSegment
        : marketSegment;
    if (segment && cards.length > 0) {
      writeScreenerIndexCardsCache(segment, cards);
    }
    return cards;
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}
