/**
 * Client-safe screener market-tab payload types (no `server-only` imports).
 * Server builders live in `screener-page-payload.ts`.
 */

import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerIndustryDrill } from "@/lib/screener/screener-industry-url";
import type { CurrencyTableRow } from "@/lib/screener/screener-currencies-universe";

export type ScreenerMarketTab = "stocks" | "crypto" | "indices" | "etfs" | "currencies";

export type IndexCardData = {
  name: string;
  price: number | null;
  changePercent1D: number | null;
  sparklineToday: number[] | null;
};

export type CryptoTop10Row = {
  symbol: string;
  name: string;
  price: number | null;
  changePercent1D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  marketCap: string;
  sparkline5d: number[];
  logoUrl: string;
};

export type CryptoFearGreedIndex = {
  value: number;
  classification: string;
  timestamp: number;
  timeUntilUpdateSec: number | null;
  source: "alternative.me";
};

export type IndexTableRow = {
  name: string;
  symbol: string;
  value: number;
  change1D: number;
  change1M: number | null;
  changeYTD: number | null;
};

export type EtfTableRow = {
  name: string;
  symbol: string;
  value: number;
  change1D: number;
  change1M: number | null;
  changeYTD: number | null;
};

export type ScreenerPagePayload =
  | {
      market: "stocks";
      stockRows: ScreenerTableRow[];
      stocksTotalCount: number;
      stocksSectorFilter: ScreenerCanonicalSector | null;
      stocksIndustryFilter: ScreenerIndustryDrill | null;
      indexCards: IndexCardData[];
      companiesMarketCacheSegment: string;
    }
  | {
      market: "crypto";
      cryptoRows: CryptoTop10Row[];
      cryptoTotalCount: number;
      fearGreed: CryptoFearGreedIndex | null;
      marketCacheSegment: string;
    }
  | { market: "indices"; indicesRows: IndexTableRow[]; marketCacheSegment: string }
  | { market: "etfs"; etfsRows: EtfTableRow[]; marketCacheSegment: string }
  | { market: "currencies"; currenciesRows: CurrencyTableRow[]; marketCacheSegment: string };

export function marketCacheSegmentFromPayload(payload: ScreenerPagePayload): string {
  if (payload.market === "stocks") return payload.companiesMarketCacheSegment;
  return payload.marketCacheSegment;
}

/** True when SSR returned an empty deadline shell (client must refetch). */
export function isEmptyScreenerMarketTabPayload(payload: ScreenerPagePayload): boolean {
  switch (payload.market) {
    case "stocks":
      return payload.stockRows.length === 0 && payload.indexCards.length === 0;
    case "crypto":
      // Sparse rows (symbols present, prices/returns null) must not count as filled —
      // weekend client LRU otherwise sticks on poisoned hubs forever under frozen segments.
      return payload.cryptoRows.length === 0 || !isUsableCryptoScreenerRows(payload.cryptoRows);
    case "indices":
      return payload.indicesRows.length === 0;
    case "etfs":
      return payload.etfsRows.length === 0;
    case "currencies":
      return payload.currenciesRows.length === 0;
    default:
      return true;
  }
}

/**
 * Client-safe: crypto tab is usable when a majority of rows have a real price.
 * Matches server `isUsableCryptoTabMarketData` intent for TOP10-sized page-1 payloads.
 */
export function isUsableCryptoScreenerRows(rows: readonly CryptoTop10Row[] | null | undefined): boolean {
  if (!rows?.length) return false;
  let ok = 0;
  for (const r of rows) {
    if (typeof r.price === "number" && Number.isFinite(r.price) && r.price > 0) ok += 1;
  }
  return ok >= Math.ceil(rows.length * 0.5);
}

/** Reject client-cached crypto payloads that would paint Price/1D/1M/YTD as dashes. */
export function isUsableScreenerMarketTabPayload(payload: ScreenerPagePayload | null | undefined): boolean {
  if (!payload) return false;
  if (payload.market === "crypto") return isUsableCryptoScreenerRows(payload.cryptoRows);
  return !isEmptyScreenerMarketTabPayload(payload);
}
