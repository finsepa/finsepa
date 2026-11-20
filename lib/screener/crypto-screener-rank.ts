import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { CRYPTO_SCREENER_ALL } from "@/lib/market/crypto-meta";
import { getSimpleCryptoDerived } from "@/lib/market/simple-market-layer";
import { sortCryptoMetasByMarketCap } from "@/lib/screener/crypto-mcap-sort";
import { screenerRankFromOrderedTickers } from "@/lib/screener/screener-rank";

const getCryptoScreenerOrderedSymbols = unstable_cache(
  async () => {
    const derived = await getSimpleCryptoDerived();
    return sortCryptoMetasByMarketCap(CRYPTO_SCREENER_ALL, derived).map((m) => m.symbol);
  },
  ["crypto-screener-rank-order-v1"],
  { revalidate: REVALIDATE_HOT },
);

/** Rank (1 = largest market cap) within the crypto screener universe. */
export async function getCryptoScreenerRankForSymbol(symbol: string): Promise<number | null> {
  const ordered = await getCryptoScreenerOrderedSymbols();
  return screenerRankFromOrderedTickers(symbol, ordered);
}
