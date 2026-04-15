import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT, REVALIDATE_STATIC } from "@/lib/data/cache-policy";
import { fetchEodhdUsRealtimeBatch } from "@/lib/market/eodhd-realtime";
import type { EodhdRealtimePayload } from "@/lib/market/eodhd-realtime";
import type { EodhdTopUniverseRow } from "@/lib/market/eodhd-screener";
import { getTop500Universe } from "@/lib/screener/top500-companies";

/**
 * Screener v2 — Layer A: Top-500 universe order + PE/mcap fields from the same snapshot,
 * plus logo URLs resolved once per layer refresh (no per-page logo fan-out).
 * Revalidates with the universe (slow-moving).
 */
export type ScreenerCompaniesStaticLayer = {
  universe: EodhdTopUniverseRow[];
};

async function buildScreenerStaticLayerUncached(): Promise<ScreenerCompaniesStaticLayer> {
  const universe = await getTop500Universe();
  return { universe };
}

export const getScreenerCompaniesStaticLayer = unstable_cache(
  buildScreenerStaticLayerUncached,
  ["screener-v2-companies-static-layer-v2-otc-dedupe"],
  { revalidate: REVALIDATE_STATIC },
);

/**
 * Screener v2 — Layer B: one shared realtime map for all screener tickers (batched HTTP),
 * short TTL so price/1D tracks the market without per-pagination refetch.
 */
export const getScreenerCompaniesMarketSliceLayer = unstable_cache(
  async (tickers: string[]) => {
    if (!tickers.length) return new Map<string, EodhdRealtimePayload>();
    return fetchEodhdUsRealtimeBatch(tickers);
  },
  ["screener-v2-companies-market-slice-layer-v1"],
  { revalidate: REVALIDATE_HOT },
);

/**
 * Full-universe realtime (previous experiments). Kept for possible future use, but
 * not used by the Companies tab payload to avoid cold-start latency.
 */
async function buildScreenerMarketLayerUncached(): Promise<Map<string, EodhdRealtimePayload>> {
  const universe = await getTop500Universe();
  const tickers = universe.map((u) => u.ticker);
  if (!tickers.length) return new Map();
  return fetchEodhdUsRealtimeBatch(tickers);
}

export const getScreenerCompaniesMarketLayer = unstable_cache(
  buildScreenerMarketLayerUncached,
  ["screener-v2-companies-market-layer-v1"],
  { revalidate: REVALIDATE_HOT },
);
