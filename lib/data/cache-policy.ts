/**
 * Data layer v1 — revalidation windows (seconds) for `unstable_cache` and route handlers.
 *
 * A. Hot — quotes, live-ish screener rows, index cards, charts, crypto top
 * B. Warm — fundamentals, key stats, profile, peers aggregates, macro bundles
 * C. Static-ish — universes, exchange lists, normalized symbol metadata
 */

/** ~30s — index strip, very fresh quotes context */
export const REVALIDATE_HOT_FAST = 30;

/** ~60s — stock/crypto chart points, news tickers, performance */
export const REVALIDATE_HOT = 60;

/** ~45s — screener company pages, global search (merged local + remote) */
export const REVALIDATE_SEARCH = 45;

/** ~5m — fundamentals JSON, header meta, charting series, macro dashboard */
export const REVALIDATE_WARM = 300;

/** ~15m — earnings week grid, heavy weekly aggregates */
export const REVALIDATE_WARM_LONG = 900;

/** ~12h — screener provider screeners, top-500 universe snapshot */
export const REVALIDATE_STATIC = 43200;

/** ~24h — macro raw indicator slices (slow-changing) */
export const REVALIDATE_STATIC_DAY = 86400;

/** ~7d — derived favicon/logo URL per ticker (website changes rarely) */
export const REVALIDATE_LOGO_METADATA = 604800;
