import "server-only";

import { CRYPTO_SCREENER_PAGE2, CRYPTO_TOP10 } from "@/lib/market/eodhd-crypto";
import { cryptoWatchlistKey, indexWatchlistKey } from "@/lib/watchlist/constants";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { pickScreenerPage2Tickers } from "@/lib/screener/pick-screener-page2-tickers";
import { SCREENER_INDICES_10 } from "@/lib/screener/screener-indices-universe";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/** Sync slice: page-1 stocks + crypto + indices (used where async isn’t available). */
export function buildScreenerWatchlistKeySetSync(): Set<string> {
  const s = new Set<string>();
  for (const t of TOP10_TICKERS) s.add(t);
  for (const c of CRYPTO_TOP10) s.add(cryptoWatchlistKey(c.symbol));
  for (const c of CRYPTO_SCREENER_PAGE2) s.add(cryptoWatchlistKey(c.symbol));
  for (const { symbol } of SCREENER_INDICES_10) s.add(indexWatchlistKey(symbol));
  return s;
}

/**
 * Keys allowed for `/api/watchlist/enrich`: screener page 1 + page 2 stocks, crypto, indices.
 */
export async function getScreenerWatchlistKeySet(): Promise<Set<string>> {
  const s = buildScreenerWatchlistKeySetSync();
  const { universe } = await getScreenerCompaniesStaticLayer();
  for (const t of pickScreenerPage2Tickers(universe)) {
    s.add(t.toUpperCase());
  }
  return s;
}
