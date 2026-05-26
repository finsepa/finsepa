/**
 * Client-safe screener market-tab payload types (no `server-only` imports).
 * Server builders live in `screener-page-payload.ts`.
 */

import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import type { ScreenerIndustryDrill } from "@/lib/screener/screener-industry-url";

export type ScreenerMarketTab = "stocks" | "crypto" | "indices" | "etfs";

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
  | { market: "etfs"; etfsRows: EtfTableRow[]; marketCacheSegment: string };

export function marketCacheSegmentFromPayload(payload: ScreenerPagePayload): string {
  if (payload.market === "stocks") return payload.companiesMarketCacheSegment;
  return payload.marketCacheSegment;
}
