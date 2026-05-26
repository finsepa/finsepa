"use client";

import {
  readSegmentLruEntry,
  resetSegmentLruIfStale,
  writeSegmentLruEntry,
} from "@/lib/cache/client-segment-lru";
import { SCREENER_STOCKS_SUBTABS_LRU_MAX } from "@/lib/cache/screener-client-cache-limits";
import type { ScreenerIndustryRow } from "@/lib/screener/screener-industries-types";
import type { ScreenerSectorRow } from "@/lib/screener/screener-sectors-types";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";

export type ScreenerStocksSubtabView = "gainersLosers" | "sectors" | "industries";

const STORAGE_KEY = "finsepa:screener:stocks-subtabs:v2-lru";

type GainersLosersPayload = { gainers: ScreenerTableRow[]; losers: ScreenerTableRow[] };

const LRU_KEY = {
  gainersLosers: "gainersLosers",
  sectors: "sectors",
  industries: "industries",
} as const;

const inflight = new Map<string, Promise<unknown>>();

export function resetScreenerStocksSubtabCacheIfStale(marketSegment: string): void {
  resetSegmentLruIfStale(STORAGE_KEY, marketSegment);
}

export function readScreenerGainersLosersCache(marketSegment: string): GainersLosersPayload | null {
  const data = readSegmentLruEntry<GainersLosersPayload>(STORAGE_KEY, marketSegment, LRU_KEY.gainersLosers);
  if (!data) return null;
  const { gainers, losers } = data;
  if (!Array.isArray(gainers) || !Array.isArray(losers)) return null;
  return { gainers, losers };
}

export function writeScreenerGainersLosersCache(marketSegment: string, data: GainersLosersPayload): void {
  writeSegmentLruEntry(STORAGE_KEY, marketSegment, LRU_KEY.gainersLosers, data, SCREENER_STOCKS_SUBTABS_LRU_MAX);
}

export function readScreenerSectorsCache(marketSegment: string): ScreenerSectorRow[] | null {
  const sectors = readSegmentLruEntry<ScreenerSectorRow[]>(STORAGE_KEY, marketSegment, LRU_KEY.sectors);
  return sectors?.length ? sectors : null;
}

export function writeScreenerSectorsCache(marketSegment: string, sectors: ScreenerSectorRow[]): void {
  writeSegmentLruEntry(STORAGE_KEY, marketSegment, LRU_KEY.sectors, sectors, SCREENER_STOCKS_SUBTABS_LRU_MAX);
}

export function readScreenerIndustriesCache(marketSegment: string): ScreenerIndustryRow[] | null {
  const industries = readSegmentLruEntry<ScreenerIndustryRow[]>(STORAGE_KEY, marketSegment, LRU_KEY.industries);
  return industries?.length ? industries : null;
}

export function writeScreenerIndustriesCache(marketSegment: string, industries: ScreenerIndustryRow[]): void {
  writeSegmentLruEntry(STORAGE_KEY, marketSegment, LRU_KEY.industries, industries, SCREENER_STOCKS_SUBTABS_LRU_MAX);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Screener subtab request failed");
  return res.json() as Promise<T>;
}

export function fetchScreenerGainersLosersCached(
  marketSegment: string,
  cacheKey: string,
): Promise<GainersLosersPayload> {
  const cached = readScreenerGainersLosersCache(marketSegment);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(cacheKey);
  if (pending) return pending as Promise<GainersLosersPayload>;

  const promise = fetchJson<GainersLosersPayload>("/api/screener/companies?gainersLosers=1")
    .then((data) => {
      writeScreenerGainersLosersCache(marketSegment, data);
      return data;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });
  inflight.set(cacheKey, promise);
  return promise;
}

export function fetchScreenerSectorsCached(
  marketSegment: string,
  cacheKey: string,
): Promise<ScreenerSectorRow[]> {
  const cached = readScreenerSectorsCache(marketSegment);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(cacheKey);
  if (pending) return pending as Promise<ScreenerSectorRow[]>;

  const promise = fetchJson<{ sectors: ScreenerSectorRow[] }>("/api/screener/companies?view=sectors")
    .then((data) => {
      const sectors = data.sectors ?? [];
      writeScreenerSectorsCache(marketSegment, sectors);
      return sectors;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });
  inflight.set(cacheKey, promise);
  return promise;
}

export function fetchScreenerIndustriesCached(
  marketSegment: string,
  cacheKey: string,
): Promise<ScreenerIndustryRow[]> {
  const cached = readScreenerIndustriesCache(marketSegment);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(cacheKey);
  if (pending) return pending as Promise<ScreenerIndustryRow[]>;

  const promise = fetchJson<{ industries: ScreenerIndustryRow[] }>("/api/screener/companies?view=industries")
    .then((data) => {
      const industries = data.industries ?? [];
      writeScreenerIndustriesCache(marketSegment, industries);
      return industries;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });
  inflight.set(cacheKey, promise);
  return promise;
}
