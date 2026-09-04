import { EODHD_REALTIME_SYMBOLS_PER_REQUEST } from "@/lib/market/eodhd-realtime";

export { EODHD_REALTIME_SYMBOLS_PER_REQUEST };

/**
 * Screener scaling — tune here when growing company/crypto universes.
 *
 * **Quotes:** `simple-market-layer` batches EODHD realtime using `EODHD_REALTIME_SYMBOLS_PER_REQUEST`
 * (~ceil(totalSymbols/batch) HTTP calls per refresh).
 *
 * **Page-2 stocks (hot quote batch):** First `SCREENER_PAGE2_STOCK_QUOTE_COUNT` names after the
 * TOP10 hot seed join the shared realtime snapshot. Companies **display ranks** use the full
 * top-by-mcap universe with per-page quote slices (snapshot-first) — not a fixed TOP10 band.
 *
 * **Crypto EOD bars:** Derived metrics use concurrent daily-bar fetches; raising crypto concurrency
 * reduces wall time when the screener crypto list grows (still N upstream calls per refresh).
 */

/**
 * Non–page-1 US tickers merged into the shared realtime + page-2 row builder (bounded hot path).
 * With TOP10 fixed, 490 here yields 500 total list rows (full top-cap universe pagination).
 */
export const SCREENER_PAGE2_STOCK_QUOTE_COUNT = 490;

export const SCREENER_EOD_DERIVED_STOCK_CONCURRENCY = 10;
/** Raise as screener crypto list grows (bars are still one HTTP per asset). */
export const SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY = 12;
export const SCREENER_EOD_DERIVED_INDEX_CONCURRENCY = 8;
