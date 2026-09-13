"use client";

import {
  readSegmentLruEntry,
  resetSegmentLruIfStale,
  writeSegmentLruEntry,
} from "@/lib/cache/client-segment-lru";
import { SCREENER_MARKET_TABS_LRU_MAX } from "@/lib/cache/screener-client-cache-limits";
import {
  marketCacheSegmentFromPayload,
  isUsableScreenerMarketTabPayload,
  type ScreenerPagePayload,
} from "@/lib/screener/screener-page-payload-types";
import type { ScreenerMarketTabParam } from "@/lib/screener/screener-market-url";
import { buildScreenerCompaniesListKey } from "@/lib/screener/screener-companies-page-cache";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerIndustryDrill } from "@/lib/screener/screener-industry-url";
import { screenerMarketTabSegmentHint } from "@/lib/screener/screener-market-tab-segment-hint";

export { screenerMarketTabSegmentHint } from "@/lib/screener/screener-market-tab-segment-hint";

/** v7: crypto market-tab embeds mover rows (drop client pageSize=100 fetch). */
const STORAGE_KEY = "finsepa:screener:market-tabs:v7-lru";

const inflight = new Map<string, Promise<ScreenerPagePayload>>();

export function buildScreenerMarketTabCacheKey(
  market: ScreenerMarketTabParam,
  stocksSector: ScreenerCanonicalSector | null,
  stocksIndustry: ScreenerIndustryDrill | null,
): string {
  if (market !== "stocks") return market;
  return `stocks|${buildScreenerCompaniesListKey(stocksSector, stocksIndustry)}`;
}

export function resetScreenerMarketTabCacheIfStale(marketSegment: string): void {
  resetSegmentLruIfStale(STORAGE_KEY, marketSegment);
}

export function readScreenerMarketTabCache(
  marketSegment: string,
  cacheKey: string,
): ScreenerPagePayload | null {
  return readSegmentLruEntry<ScreenerPagePayload>(STORAGE_KEY, marketSegment, cacheKey);
}

export function writeScreenerMarketTabCache(
  marketSegment: string,
  cacheKey: string,
  payload: ScreenerPagePayload,
): void {
  writeSegmentLruEntry(STORAGE_KEY, marketSegment, cacheKey, payload, SCREENER_MARKET_TABS_LRU_MAX);
}

async function fetchUsMarketCacheSegment(): Promise<string> {
  try {
    const res = await fetch("/api/market/us-cache-epoch", { credentials: "include" });
    if (!res.ok) return "";
    const body = (await res.json()) as { segment?: unknown };
    return typeof body.segment === "string" ? body.segment : "";
  } catch {
    return "";
  }
}

export async function fetchScreenerMarketTabPayload(
  market: ScreenerMarketTabParam,
  url: string,
  cacheKey: string,
  opts?: { knownSegment?: string | null },
): Promise<ScreenerPagePayload> {
  const known = typeof opts?.knownSegment === "string" ? opts.knownSegment.trim() : "";
  // Prefer SSR/prior payload segment so tab switches can hit LRU without an epoch round-trip.
  // Only call us-cache-epoch when we have no segment hint.
  const marketSegment = known || (await fetchUsMarketCacheSegment());
  const segmentKey = marketSegment || "unknown";
  const inflightKey = `${segmentKey}|${cacheKey}`;

  const cached = marketSegment ? readScreenerMarketTabCache(marketSegment, cacheKey) : null;
  if (cached && isUsableScreenerMarketTabPayload(cached)) return cached;

  const existing = inflight.get(inflightKey);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Market tab request failed");
    const json = (await res.json()) as {
      payload?: ScreenerPagePayload;
      marketCacheSegment?: string;
    };
    const payload = json.payload;
    if (!payload || payload.market !== market) throw new Error("Invalid market tab payload");
    const segment =
      typeof json.marketCacheSegment === "string" && json.marketCacheSegment
        ? json.marketCacheSegment
        : marketCacheSegmentFromPayload(payload);
    if (segment && isUsableScreenerMarketTabPayload(payload)) {
      writeScreenerMarketTabCache(segment, cacheKey, payload);
    }
    return payload;
  })();

  inflight.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(inflightKey);
  }
}
