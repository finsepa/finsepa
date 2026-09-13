import {
  marketCacheSegmentFromPayload,
  type ScreenerPagePayload,
} from "@/lib/screener/screener-page-payload-types";
import type { ScreenerMarketTabParam } from "@/lib/screener/screener-market-url";

/**
 * Segment hint for LRU lookup without waiting on `/api/market/us-cache-epoch`.
 * Hot-tier markets share the US live/frozen segment; currencies use the slow FX day key.
 */
export function screenerMarketTabSegmentHint(
  market: ScreenerMarketTabParam,
  payload: ScreenerPagePayload | null | undefined,
): string {
  if (!payload) return "";
  if (market === "currencies") {
    return payload.market === "currencies" ? payload.marketCacheSegment.trim() : "";
  }
  if (payload.market === "currencies") return "";
  return marketCacheSegmentFromPayload(payload).trim();
}
