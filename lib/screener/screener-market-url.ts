/** Query key for Screener market tab (Stocks / Crypto / Indices). */
export const SCREENER_MARKET_QUERY = "market" as const;

/** Deep link: Screener with Crypto tab active. */
export const SCREENER_CRYPTO_HREF = `/screener?${SCREENER_MARKET_QUERY}=crypto` as const;

/** Deep link: Screener with Indices tab active. */
export const SCREENER_INDICES_HREF = `/screener?${SCREENER_MARKET_QUERY}=indices` as const;
