"use client";

import {
  readSegmentLruEntry,
  resetSegmentLruIfStale,
  writeSegmentLruEntry,
} from "@/lib/cache/client-segment-lru";
import { SCREENER_COMPANIES_PAGES_LRU_MAX } from "@/lib/cache/screener-client-cache-limits";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerIndustryDrill } from "@/lib/screener/screener-industry-url";

const STORAGE_KEY = "finsepa:screener:companies-pages:v2-lru";

const inflight = new Map<string, Promise<ScreenerTableRow[]>>();

export function buildScreenerCompaniesListKey(
  sector: ScreenerCanonicalSector | null,
  industry: ScreenerIndustryDrill | null,
): string {
  if (industry) return `industry:${industry.sector}:${industry.industry}`;
  if (sector) return `sector:${sector}`;
  return "all";
}

function pageCacheKey(listKey: string, page: number): string {
  return `${listKey}|p${page}`;
}

export function buildScreenerCompaniesPageCacheKey(
  marketSegment: string,
  listKey: string,
  page: number,
  pageSize: number,
): string {
  return `${marketSegment}|${listKey}|${page}|${pageSize}`;
}

/** Drop cached pages when list filters or market session segment changes. */
export function resetScreenerCompaniesPageCacheIfStale(marketSegment: string, listKey: string): void {
  resetSegmentLruIfStale(STORAGE_KEY, marketSegment);
  void listKey;
}

export function readScreenerCompaniesPageCache(
  marketSegment: string,
  listKey: string,
  page: number,
): ScreenerTableRow[] | null {
  const rows = readSegmentLruEntry<ScreenerTableRow[]>(
    STORAGE_KEY,
    marketSegment,
    pageCacheKey(listKey, page),
  );
  return rows?.length ? rows : null;
}

export function writeScreenerCompaniesPageCache(
  marketSegment: string,
  listKey: string,
  page: number,
  rows: ScreenerTableRow[],
): void {
  if (!rows.length) return;
  writeSegmentLruEntry(
    STORAGE_KEY,
    marketSegment,
    pageCacheKey(listKey, page),
    rows,
    SCREENER_COMPANIES_PAGES_LRU_MAX,
  );
}

/**
 * Fetch a companies page once per cache key (sessionStorage + in-flight dedupe).
 * Server `unstable_cache` still shares work across users on cache miss.
 */
export function fetchScreenerCompaniesPageCached(
  cacheKey: string,
  marketSegment: string,
  listKey: string,
  page: number,
  url: string,
): Promise<ScreenerTableRow[]> {
  const fromStore = readScreenerCompaniesPageCache(marketSegment, listKey, page);
  if (fromStore) return Promise.resolve(fromStore);

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const promise = fetch(url, { credentials: "include" })
    .then((r) => {
      if (!r.ok) throw new Error("Companies page request failed");
      return r.json() as Promise<{ rows?: ScreenerTableRow[] }>;
    })
    .then((data) => {
      const rows = data.rows ?? [];
      writeScreenerCompaniesPageCache(marketSegment, listKey, page, rows);
      return rows;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, promise);
  return promise;
}
