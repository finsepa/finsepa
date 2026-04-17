/**
 * Data layer v1 — revalidation windows (seconds) for `unstable_cache` and route handlers.
 *
 * Provider usage: EODHD outbound HTTP is capped per Node instance with a rolling 60m window
 * (`FINSEPA_EODHD_MAX_REQUESTS_PER_HOUR`, default 4000) — see `lib/market/eodhd-hourly-budget.ts`.
 * Logo.dev: browsers load **`/api/media/logo`**; the server fetches Logo.dev once per symbol per cache window
 * (`lib/media/logo-proxy-upstream.ts`). Upstream fetches also use a rolling 30d cap
 * (`FINSEPA_LOGO_DEV_MAX_REQUESTS_PER_30D`, default 500_000) — `lib/market/logo-dev-upstream-budget.ts`.
 *
 * A. Hot — quotes, live-ish screener rows, index cards, charts, crypto top
 * B. Warm — fundamentals, key stats, profile, peers aggregates, macro bundles
 * C. Static-ish — universes, exchange lists, normalized symbol metadata
 *
 * Screener scale (bounded hot path, chunked realtime): `lib/screener/screener-scale-config.ts`.
 */

/** ~30s — index strip, very fresh quotes context */
export const REVALIDATE_HOT_FAST = 30;

/** ~60s — stock/crypto chart points, news tickers, performance */
export const REVALIDATE_HOT = 60;

/** ~90s — global search (merged local + remote EODHD); cuts repeat search API use */
export const REVALIDATE_SEARCH = 90;

/** ~5m — fundamentals JSON, header meta, charting series, macro dashboard */
export const REVALIDATE_WARM = 300;

/**
 * ~5m — screener Markets tab quote batches (stocks/crypto/indices slices).
 * Keeps prices fresh enough for a screener while cutting EODHD realtime churn vs 60s-style windows.
 */
export const REVALIDATE_SCREENER_MARKET = 300;

/** ~15m — earnings week grid, heavy weekly aggregates */
export const REVALIDATE_WARM_LONG = 900;

/** ~12h — screener provider screeners, top-500 universe snapshot */
export const REVALIDATE_STATIC = 43200;

/** ~24h — macro raw indicator slices (slow-changing) */
export const REVALIDATE_STATIC_DAY = 86400;
