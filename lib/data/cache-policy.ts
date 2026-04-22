/**
 * Data layer v1 — revalidation windows (seconds) for `unstable_cache` and route handlers.
 *
 * Provider usage: EODHD outbound HTTP is capped per Node instance with a rolling 60m window
 * (`FINSEPA_EODHD_MAX_REQUESTS_PER_HOUR`, default 4000) — see `lib/market/eodhd-hourly-budget.ts`.
 * Logo.dev: browsers load **`/api/media/logo`**; the server fetches Logo.dev once per symbol per ~30d cache window
 * (`LOGO_PROXY_CACHE_MAX_AGE_SEC` in `lib/media/logo-proxy-upstream.ts`). Upstream fetches also use a rolling 30d cap
 * (`FINSEPA_LOGO_DEV_MAX_REQUESTS_PER_30D`, default 500_000) — `lib/market/logo-dev-upstream-budget.ts`.
 *
 * **Semantic tiers** — prefer {@link REVALIDATE_TIER_HOT} / {@link REVALIDATE_TIER_WARM} / … in new code; the
 * `REVALIDATE_*` primitives below remain the source of truth for numeric seconds (Phase 1–3 as in
 * `docs/eodhd-phase-0-cache-inventory.md`; Phase 4: corporate actions + insider `unstable_cache`, {@link CACHE_CONTROL_PRIVATE_NO_STORE};
 * Phase 5: {@link REVALIDATE_IDENTITY} for stock header display fields split from earnings-line slice).
 *
 * | Tier (alias) | Seconds | Typical EODHD-backed use (see `docs/eodhd-phase-0-cache-inventory.md`) |
 * |--------------|--------:|-----------------------------------------------------------------------------|
 * | `TIER_HOT_FAST` | 30 | Very fresh UI slices (reserved / rare). |
 * | `TIER_HOT` | 60 | Stock/crypto chart points, performance, news first page, crypto asset, indices top10. |
 * | `TIER_SEARCH` | 90 | Global asset search dedupe. |
 * | `TIER_WARM` | 300 | Charting series, peers table, shares-outstanding helper, macro dashboard bundle, inner `fetch` hints for EOD list bars. |
 * | `TIER_SCREENER_MARKET` | 300 | Screener Markets tab realtime+EOD batches (`simple-market-layer` tab exports). |
 * | `TIER_WARM_LONG` | 900 | **Full** stock fundamentals JSON (`eodhd-fundamentals`), header **earnings date** slice, earnings week, crypto fundamentals meta. |
 * | `TIER_IDENTITY` | 43200 (~12h) | Stock header **name / sector / industry / logo** (Phase 5 — decoupled from earnings-line warm-long). |
 * | `TIER_STATIC` | 43200 (~12h) | Screener universe by market cap, exchange symbol lists, `fetch` hint on screener HTTP. |
 * | `TIER_STATIC_DAY` | 86400 (~24h) | Macro indicator JSON rows (`eodhd-macro` inner fetch). |
 * | `TIER_SCREENER_COMBINED` | 180 | `getSimpleMarketData` combined bundle (`simple-market-layer`). |
 * | `TIER_SCREENER_DERIVED` | 1800 | Screener derived aggregates (`getSimpleScreenerDerived*`, crypto/indices derived in `simple-market-layer`). |
 * | `TIER_SCREENER_FILTERED` | 3600 (~1h) | Filtered screener (`fetchEodhdScreenerCandidates`) — `unstable_cache` + matching `fetch` hint. |
 *
 * **Identity vs calendar line (Phase 5):** stock header uses {@link REVALIDATE_IDENTITY} for display fields and
 * {@link REVALIDATE_WARM_LONG} for the next-earnings string; both still read the same fundamentals JSON (single provider
 * blob). **Live spot price** remains chart + `/api/.../live-price`, not fundamentals Highlights.
 *
 * Screener scale (bounded hot path, chunked realtime): `lib/screener/screener-scale-config.ts`.
 *
 * **Phase 3 — HTTP `Cache-Control`:** {@link CACHE_CONTROL_PRIVATE_NEWS} and the other `CACHE_CONTROL_*` exports below;
 * tier-aligned `app/api/**` routes import these (see inventory doc). Not the same mechanism as `unstable_cache`.
 *
 * **Phase 4:** `unstable_cache` on dividends / splits / insider (10-credit) EODHD reads; {@link CACHE_CONTROL_PRIVATE_NO_STORE}
 * and related literals for live quotes + key-stats refresh paths.
 *
 * **Phase 5:** Stock header meta — split `unstable_cache` for identity ({@link REVALIDATE_IDENTITY}) vs earnings line
 * ({@link REVALIDATE_WARM_LONG}); see `stock-header-meta-server.ts`.
 *
 * **Phase 6:** {@link CACHE_CONTROL_PUBLIC_WARM_CHART} / {@link CACHE_CONTROL_PUBLIC_WARM} — `public` CDN hints for
 * GET JSON whose payload is identical for all users (same seconds as the matching private preset).
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

/**
 * ~12h — stock detail header **identity** (company name, sector, industry, logo path) — same seconds as {@link REVALIDATE_STATIC}.
 * Phase 5: decouples display fields from the earnings-date slice so identity is not recomputed on the 15m cadence.
 */
export const REVALIDATE_IDENTITY = REVALIDATE_STATIC;

/**
 * ~1h — filtered EODHD screener queries (sector/industry/ticker slice), e.g. peers route candidates.
 * Matches historical `next.revalidate: 3600` on that HTTP path before Phase 2.
 */
export const REVALIDATE_SCREENER_FILTERED = 3600;

/** ~24h — macro raw indicator slices (slow-changing) */
export const REVALIDATE_STATIC_DAY = 86400;

// ---------------------------------------------------------------------------
// Semantic tier aliases (same seconds as above — use in new modules for clarity)
// ---------------------------------------------------------------------------

/** Live / near-live coalescing: charts, performance, short news windows. */
export const REVALIDATE_TIER_HOT = REVALIDATE_HOT;

/** Tighter hot window when a feature needs faster rotation than {@link REVALIDATE_TIER_HOT}. */
export const REVALIDATE_TIER_HOT_FAST = REVALIDATE_HOT_FAST;

/** Search / typeahead: brief shared dedupe across users for identical normalized queries. */
export const REVALIDATE_TIER_SEARCH = REVALIDATE_SEARCH;

/** Warm: fundamentals-derived series, aggregates, five-minute macro dashboard recompute. */
export const REVALIDATE_TIER_WARM = REVALIDATE_WARM;

/** Screener Markets tab batches (explicit alias of same numeric value as {@link REVALIDATE_WARM}). */
export const REVALIDATE_TIER_SCREENER_MARKET = REVALIDATE_SCREENER_MARKET;

/** Warm-long: one HTTP fundamentals blob per ticker, heavy calendars, crypto meta JSON. */
export const REVALIDATE_TIER_WARM_LONG = REVALIDATE_WARM_LONG;

/** Stock header display identity — same seconds as {@link REVALIDATE_IDENTITY}. */
export const REVALIDATE_TIER_IDENTITY = REVALIDATE_IDENTITY;

/** Static-ish: universe snapshots, exchange lists, provider screeners. */
export const REVALIDATE_TIER_STATIC = REVALIDATE_STATIC;

/** Filtered screener (per-query sector/industry/code) — same seconds as {@link REVALIDATE_SCREENER_FILTERED}. */
export const REVALIDATE_TIER_SCREENER_FILTERED = REVALIDATE_SCREENER_FILTERED;

/** Daily-scale provider slices (macro indicators). */
export const REVALIDATE_TIER_STATIC_DAY = REVALIDATE_STATIC_DAY;

/**
 * Screener first-paint **combined** bundle (`getSimpleMarketData` in `simple-market-layer.ts`).
 * Numeric value **180** — single source of truth for this window.
 */
export const REVALIDATE_TIER_SCREENER_COMBINED = 180;

/**
 * Screener **derived** aggregates (30m) — `getSimpleScreenerDerived*`, crypto/indices derived in `simple-market-layer.ts`.
 * Numeric value **1800**.
 */
export const REVALIDATE_TIER_SCREENER_DERIVED = 1800;

// ---------------------------------------------------------------------------
// HTTP Cache-Control hints (App Router `Response` headers — seconds only)
// ---------------------------------------------------------------------------

function cacheControlPrivateSMaxageSwr(sMaxAgeSec: number, swrSec: number): string {
  return `private, s-maxage=${sMaxAgeSec}, stale-while-revalidate=${swrSec}`;
}

function cacheControlPublicSMaxageSwr(sMaxAgeSec: number, swrSec: number): string {
  return `public, s-maxage=${sMaxAgeSec}, stale-while-revalidate=${swrSec}`;
}

/**
 * Stock / crypto news JSON routes — `s-maxage` = {@link REVALIDATE_SEARCH}, SWR = 2× (historical 90 / 180).
 */
export const CACHE_CONTROL_PRIVATE_NEWS = cacheControlPrivateSMaxageSwr(REVALIDATE_SEARCH, REVALIDATE_SEARCH * 2);

/**
 * Macro dashboard bundle — `s-maxage` = {@link REVALIDATE_WARM}, SWR = {@link REVALIDATE_TIER_SCREENER_DERIVED} (300 / 1800).
 */
export const CACHE_CONTROL_PUBLIC_MACRO_DASHBOARD = cacheControlPublicSMaxageSwr(
  REVALIDATE_WARM,
  REVALIDATE_TIER_SCREENER_DERIVED,
);

/** Minimal public cache for empty macro placeholder responses. */
export const CACHE_CONTROL_PUBLIC_HOT_FAST = `public, s-maxage=${REVALIDATE_HOT_FAST}`;

/** Stock/crypto performance JSON — {@link REVALIDATE_HOT} / 2×. */
export const CACHE_CONTROL_PRIVATE_HOT = cacheControlPrivateSMaxageSwr(REVALIDATE_HOT, REVALIDATE_HOT * 2);

/** Profile, peers route, ticker earnings, target-price — {@link REVALIDATE_WARM} / 2×. */
export const CACHE_CONTROL_PRIVATE_WARM = cacheControlPrivateSMaxageSwr(REVALIDATE_WARM, REVALIDATE_WARM * 2);

/**
 * Same `s-maxage` / SWR as {@link CACHE_CONTROL_PRIVATE_WARM} — **`public`** for shared CDN caches.
 * Use only when the response has no user-specific fields (Phase 6).
 */
export const CACHE_CONTROL_PUBLIC_WARM = cacheControlPublicSMaxageSwr(REVALIDATE_WARM, REVALIDATE_WARM * 2);

/** Chart JSON, header meta, fundamentals series, key-stats (cached branch) — 2× {@link REVALIDATE_HOT} / {@link REVALIDATE_WARM}. */
export const CACHE_CONTROL_PRIVATE_WARM_CHART = cacheControlPrivateSMaxageSwr(REVALIDATE_HOT * 2, REVALIDATE_WARM);

/**
 * Same `s-maxage` / SWR as {@link CACHE_CONTROL_PRIVATE_WARM_CHART} — **`public`** for shared CDN caches.
 * Use only when the response has no user-specific fields (Phase 6).
 */
export const CACHE_CONTROL_PUBLIC_WARM_CHART = cacheControlPublicSMaxageSwr(REVALIDATE_HOT * 2, REVALIDATE_WARM);

/**
 * Screener list row polling (companies / crypto-rows) — `s-maxage` between hot-fast and hot; SWR = 2× hot.
 * Numeric **45** is centralized here (was duplicated on screener HTTP routes).
 */
export const SCREENER_HTTP_ROW_S_MAXAGE_SEC = 45;

function cacheControlPrivateMax0SMaxageSwr(sMaxAgeSec: number, swrSec: number): string {
  return `private, max-age=0, s-maxage=${sMaxAgeSec}, stale-while-revalidate=${swrSec}`;
}

function cacheControlPrivateSMaxage0Swr(swrSec: number): string {
  return `private, s-maxage=0, stale-while-revalidate=${swrSec}`;
}

/** Screener companies + crypto-rows JSON — `max-age=0` for user-private HTML shells hitting shared CDN. */
export const CACHE_CONTROL_PRIVATE_SCREENER_ROW = cacheControlPrivateMax0SMaxageSwr(
  SCREENER_HTTP_ROW_S_MAXAGE_SEC,
  REVALIDATE_HOT * 2,
);

/** Chart stream / incremental path — row-style `s-maxage` + hot SWR. */
export const CACHE_CONTROL_PRIVATE_CHART_STREAM = cacheControlPrivateSMaxageSwr(
  SCREENER_HTTP_ROW_S_MAXAGE_SEC,
  REVALIDATE_HOT * 2,
);

/**
 * Public `s-maxage` / SWR — {@link REVALIDATE_HOT_FAST} / 2× {@link REVALIDATE_HOT} (30 / 120).
 * Used by `/api/search` and the screener indices cards route (same window).
 */
export const CACHE_CONTROL_PUBLIC_SEARCH = cacheControlPublicSMaxageSwr(REVALIDATE_HOT_FAST, REVALIDATE_HOT * 2);

/** News hub empty (single-asset) — hot-fast / hot. */
export const CACHE_CONTROL_PUBLIC_NEWS_HUB_EMPTY = cacheControlPublicSMaxageSwr(REVALIDATE_HOT_FAST, REVALIDATE_HOT);

/** News hub with items — hot / warm. */
export const CACHE_CONTROL_PUBLIC_NEWS_HUB = cacheControlPublicSMaxageSwr(REVALIDATE_HOT, REVALIDATE_WARM);

/** Earnings preview single-asset stub — hot with matching SWR. */
export const CACHE_CONTROL_PRIVATE_EARNINGS_PREVIEW_SINGLE = cacheControlPrivateMax0SMaxageSwr(
  REVALIDATE_HOT,
  REVALIDATE_HOT,
);

/** Earnings preview full payload — 2× hot / warm. */
export const CACHE_CONTROL_PRIVATE_EARNINGS_PREVIEW = cacheControlPrivateMax0SMaxageSwr(
  REVALIDATE_HOT * 2,
  REVALIDATE_WARM,
);

/** Peers compare empty response — private {@link REVALIDATE_HOT_FAST} only. */
export const CACHE_CONTROL_PRIVATE_S_MAXAGE_HOT_FAST = `private, s-maxage=${REVALIDATE_HOT_FAST}`;

/** Peers compare POST success — private {@link REVALIDATE_WARM} only (no SWR). */
export const CACHE_CONTROL_PRIVATE_S_MAXAGE_WARM = `private, s-maxage=${REVALIDATE_WARM}`;

/** Portfolio history routes — `s-maxage=0` with short SWR. */
export const CACHE_CONTROL_PRIVATE_S_MAXAGE_0_SWR_FAST = cacheControlPrivateSMaxage0Swr(REVALIDATE_HOT_FAST);

/** Portfolio overview market strip — hot-fast / hot. */
export const CACHE_CONTROL_PRIVATE_OVERVIEW_MARKET = cacheControlPrivateSMaxageSwr(REVALIDATE_HOT_FAST, REVALIDATE_HOT);

/**
 * Insider transactions JSON — aligns with {@link REVALIDATE_WARM_LONG} server cache (15m / 30m CDN hint).
 */
export const CACHE_CONTROL_PRIVATE_WARM_LONG = cacheControlPrivateSMaxageSwr(
  REVALIDATE_WARM_LONG,
  REVALIDATE_WARM_LONG * 2,
);

/** Live quotes and other user-private data that must not use shared HTTP caches. */
export const CACHE_CONTROL_PRIVATE_NO_STORE = "private, no-store" as const;

/** Forced fundamentals refresh — bypass edge cache entirely. */
export const CACHE_CONTROL_PRIVATE_NO_STORE_MUST_REVALIDATE = "private, no-store, must-revalidate" as const;

/** Default private revalidation for key-stats when not forcing refresh. */
export const CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE = "private, max-age=0, must-revalidate" as const;
