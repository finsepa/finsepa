/** Stored in `watchlist.ticker` alongside plain stock tickers (e.g. AAPL). */
export const WATCHLIST_CRYPTO_PREFIX = "CRYPTO:" as const;

/** EODHD-style index symbol (e.g. GSPC.INDX), prefixed for watchlist storage. */
export const WATCHLIST_INDEX_PREFIX = "INDEX:" as const;

export function cryptoWatchlistKey(symbol: string): string {
  return `${WATCHLIST_CRYPTO_PREFIX}${symbol.trim().toUpperCase()}`;
}

export function indexWatchlistKey(eodSymbol: string): string {
  return `${WATCHLIST_INDEX_PREFIX}${eodSymbol.trim().toUpperCase()}`;
}
