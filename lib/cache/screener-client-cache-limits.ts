/** Max paginated company slices kept per market segment (LRU across list filters). */
export const SCREENER_COMPANIES_PAGES_LRU_MAX = 12;

/** Max market-tab payloads (stocks variants + crypto + indices + etfs). */
export const SCREENER_MARKET_TABS_LRU_MAX = 8;

/** Max stocks sub-tab responses per segment (gainers/losers, sectors, industries). */
export const SCREENER_STOCKS_SUBTABS_LRU_MAX = 3;

/** Index strip — one blob per segment. */
export const SCREENER_INDEX_CARDS_LRU_MAX = 1;

/** Watchlist enrich payloads per segment (different ticker sets). */
export const WATCHLIST_ENRICHED_LRU_MAX = 4;
