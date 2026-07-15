import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SCREENER_MARKET_LIVE } from "@/lib/data/cache-policy";
import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshot } from "@/lib/market/market-snapshot-store";
import { listTop500EquityTickersOrdered } from "@/lib/screener/screener-earnings-universe";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";
import { filterScreenerTop500ExcludedTickers } from "@/lib/screener/top500-companies";

function normalizeTickerKey(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/** Rank (1 = largest market cap) within the Top-500 screener universe. */
export function screenerRankFromOrderedTickers(
  ticker: string,
  ordered: readonly string[],
): number | null {
  const key = normalizeTickerKey(ticker);
  const idx = ordered.findIndex((t) => normalizeTickerKey(t) === key);
  return idx >= 0 ? idx + 1 : null;
}

const getTop500OrderedTickers = unstable_cache(
  async () => {
    const snapshot = await readMarketSnapshot<TopCompanyUniverseRow[]>(MARKET_SNAPSHOT_KEY.top500Market);
    return listTop500EquityTickersOrdered(filterScreenerTop500ExcludedTickers(snapshot ?? []));
  },
  ["screener-top500-rank-order-v2-exclude-skhy"],
  { revalidate: REVALIDATE_SCREENER_MARKET_LIVE },
);

export async function getScreenerRankForTicker(ticker: string): Promise<number | null> {
  const ordered = await getTop500OrderedTickers();
  return screenerRankFromOrderedTickers(ticker, ordered);
}
