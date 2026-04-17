import { EODHD_REALTIME_SYMBOLS_PER_REQUEST } from "@/lib/market/eodhd-realtime";

export { EODHD_REALTIME_SYMBOLS_PER_REQUEST };

/**
 * Screener scaling — tune here when growing company/crypto universes.
 *
 * **Quotes:** `simple-market-layer` batches EODHD realtime using `EODHD_REALTIME_SYMBOLS_PER_REQUEST`
 * (~ceil(totalSymbols/batch) HTTP calls per refresh).
 *
 * **Page-2 stocks:** Only the first `SCREENER_PAGE2_STOCK_QUOTE_COUNT` names after TOP10 join the hot
 * cached path. A large static universe does not imply that many quote fetches — raise carefully
 * (EODHD hourly budget). Prefer paginated/on-demand quote slices over one giant batch.
 *
 * **Crypto EOD bars:** Derived metrics use concurrent daily-bar fetches; raising crypto concurrency
 * reduces wall time when the screener crypto list grows (still N upstream calls per refresh).
 */

/** Non–page-1 US tickers merged into the shared realtime + page-2 row builder (bounded hot path). 90 → 100 names with TOP10. */
export const SCREENER_PAGE2_STOCK_QUOTE_COUNT = 90;

export const SCREENER_EOD_DERIVED_STOCK_CONCURRENCY = 10;
/** Raise as screener crypto list grows (bars are still one HTTP per asset). */
export const SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY = 12;
export const SCREENER_EOD_DERIVED_INDEX_CONCURRENCY = 8;
