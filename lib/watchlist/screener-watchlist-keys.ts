import "server-only";

import { CRYPTO_TOP10 } from "@/lib/market/eodhd-crypto";
import { cryptoWatchlistKey, indexWatchlistKey } from "@/lib/watchlist/constants";
import { SCREENER_INDICES_10 } from "@/lib/screener/screener-indices-universe";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/** Normalized storage keys allowed for watchlist + `/api/watchlist/enrich` (10 + 10 + 10). */
export function buildScreenerWatchlistKeySet(): Set<string> {
  const s = new Set<string>();
  for (const t of TOP10_TICKERS) s.add(t);
  for (const c of CRYPTO_TOP10) s.add(cryptoWatchlistKey(c.symbol));
  for (const { symbol } of SCREENER_INDICES_10) s.add(indexWatchlistKey(symbol));
  return s;
}

export const SCREENER_WATCHLIST_KEY_SET = buildScreenerWatchlistKeySet();
