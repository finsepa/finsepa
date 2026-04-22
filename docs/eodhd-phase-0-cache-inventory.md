# Phase 0 — EODHD outbound inventory & caching map

**Scope:** Direct `https://eodhd.com/api/...` HTTP usage under `lib/` (and `app/` has none).  
**Budget:** All traced calls go through `traceEodhdHttp` → `tryConsumeEodhdRequestSlot` (`lib/market/eodhd-hourly-budget.ts`) — per Node / serverless instance, rolling 60m.

**`lib/data/cache-policy.ts` constants (seconds):**

| Constant | Seconds |
|----------|--------:|
| `REVALIDATE_HOT_FAST` | 30 |
| `REVALIDATE_HOT` | 60 |
| `REVALIDATE_SEARCH` | 90 |
| `REVALIDATE_WARM` | 300 |
| `REVALIDATE_SCREENER_MARKET` | 300 |
| `REVALIDATE_WARM_LONG` | 900 |
| `REVALIDATE_STATIC` | 43_200 (~12h) |
| `REVALIDATE_IDENTITY` | 43_200 (~12h), same as `REVALIDATE_STATIC` |
| `REVALIDATE_SCREENER_FILTERED` | 3_600 (~1h) |
| `REVALIDATE_STATIC_DAY` | 86_400 (~24h) |

**HTTP `Cache-Control` presets (Phases 3–4, 6):** all in `lib/data/cache-policy.ts` — Phase 3 list (`CACHE_CONTROL_PRIVATE_NEWS`, … `CACHE_CONTROL_PRIVATE_OVERVIEW_MARKET`) plus Phase 4: `CACHE_CONTROL_PRIVATE_WARM_LONG`, `CACHE_CONTROL_PRIVATE_NO_STORE`, `CACHE_CONTROL_PRIVATE_NO_STORE_MUST_REVALIDATE`, `CACHE_CONTROL_PRIVATE_MAX_0_MUST_REVALIDATE`; Phase 6: `CACHE_CONTROL_PUBLIC_WARM_CHART`, `CACHE_CONTROL_PUBLIC_WARM` (public CDN hints where JSON is not user-specific). **Excluded by design:** logo proxy (`LOGO_PROXY_CACHE_CONTROL`).

**Legend:**

- **Fetch `next` / `cache`:** `fetch(..., { next: { revalidate: N } })` or `cache: "no-store"`.
- **`unstable_cache`:** Next Data Cache wrapper; `revalidate` is seconds until stale (shared across users for same key, host-dependent).
- **Outer `unstable_cache` only:** Inner `fetch` may still set `next.revalidate` or `no-store`; upstream dedupe is dominated by the outer cache when present.

---

## A. Stock / equity — core APIs

| Resource | File / entry | EODHD path | `fetch` cache | `unstable_cache` | Effective shared TTL notes |
|----------|----------------|------------|-----------------|------------------|------------------------------|
| Fundamentals JSON | `fetchEodhdFundamentalsJsonUncached` → `fetchEodhdFundamentalsJson` | `/api/fundamentals/{sym}` | `next.revalidate: REVALIDATE_WARM_LONG` | Yes — key `eodhd-fundamentals-json-v6-reval-900`, `revalidate: REVALIDATE_WARM_LONG` (900s) | Single blob per ticker; powers highlights, statements, many key-stats paths. **`fetchEodhdFundamentalsJsonFresh`** skips `unstable_cache` (explicit refresh). |
| EOD daily bars | `fetchEodhdEodDaily` | `/api/eod/{sym}` | **`no-store`** | No | Used inside `getStockPerformance` (cached 60s) and other loaders — each miss hits EODHD. |
| EOD daily (screener) | `fetchEodhdEodDailyScreener` | `/api/eod/{sym}` | `next.revalidate: REVALIDATE_WARM` (300s) | No | Softer CDN hint for list views. |
| Intraday | `fetchEodhdIntraday` | `/api/intraday/{sym}` | **`no-store`** | No | Used by stock/crypto chart loaders wrapped in `unstable_cache` (60s). |
| Open price on date | `fetchEodhdOpenPriceOnOrBefore` | `/api/eod/{sym}` | **`no-store`** | No | Narrow date window. |
| Realtime single | `fetchEodhdUsRealtime` | `/api/real-time/{sym}` | **`no-store`** | No | Live quotes. |
| Realtime batch | `fetchEodhdRealtimeSymbolsRaw` | `/api/real-time/...` + `s=` | **`no-store`** | No | Screener / simple-market-layer batching. |
| Stock news page | `loadStockNewsPage` | `/api/news` | **`no-store`** | Via `getStockNews` only for `(ticker, offset=0, limit=5)` — `stock-news-v6-page5`, **`revalidate: REVALIDATE_HOT` (60s)** | Other offsets uncached unless separately wrapped. |
| Search | `fetchEodhdSearch` | `/api/search/{q}` | `next.revalidate: REVALIDATE_SEARCH` (90s) | Via `global-asset-search` — `REVALIDATE_SEARCH` (90s) | Inner fetch hint aligned with outer `unstable_cache` (Phase 2). |
| Screener (market cap sort) | `fetchEodhdScreenerUncached` | `/api/screener` | `next.revalidate: REVALIDATE_STATIC` | Yes — `eodhd-screener-v8-skip-etfs`, **`revalidate: REVALIDATE_STATIC`** | `fetchEodhdTopByMarketCap` → `getTop500Universe` etc. |
| Screener (filtered) | `fetchEodhdScreenerCandidates` | `/api/screener` | `next.revalidate: REVALIDATE_SCREENER_FILTERED` (3600s) | Yes — `eodhd-screener-candidates-v1`, **same** | Phase 2: cross-request dedupe per `(q, limit)`; fetch hint matches outer. |
| Exchange symbol list | `fetchEodhdExchangeSymbolListUncached` | `/api/exchange-symbol-list/{ex}` | `next.revalidate: REVALIDATE_STATIC` | Yes — `eodhd-exchange-symbol-list-v1`, **`REVALIDATE_STATIC`** | Inner fetch hint matches outer `unstable_cache`. |
| Earnings calendar range | `fetchEodhdEarningsCalendar` | `/api/calendar/earnings` | `next.revalidate: REVALIDATE_WARM_LONG` | Yes — `eodhd-earnings-calendar-v1`, **same** | Phase 3: cross-request dedupe per `(from, to)`; used by earnings week + stock earnings tab. |
| Dividends | `fetchEodhdDividendsHistory` | `/api/div/{sym}` | `next.revalidate: REVALIDATE_WARM` | Yes — `eodhd-dividends-history-v1`, **same** | Phase 4: cross-request dedupe per `(symbol, range)`; API route `Cache-Control`: `CACHE_CONTROL_PRIVATE_WARM`. |
| Splits | `fetchEodhdSplitsHistory` | `/api/splits/{sym}` | `next.revalidate: REVALIDATE_WARM` | Yes — `eodhd-splits-history-v1`, **same** | Phase 4; API route `CACHE_CONTROL_PRIVATE_WARM`. |
| Insider transactions | `fetchEodhdInsiderTransactions` | `/api/insider-transactions` | `next.revalidate: REVALIDATE_WARM_LONG` | Yes — `eodhd-insider-transactions-v1`, **same** | Phase 4: **10 credits** / HTTP — shared cache cuts duplicate windows; API `CACHE_CONTROL_PRIVATE_WARM_LONG`. |

---

## B. Higher-level loaders (compose A + fundamentals)

| Loader | File | Upstream depends on | `unstable_cache` key (prefix) | `revalidate` |
|--------|------|---------------------|-------------------------------|---------------|
| Chart points | `getStockChartPoints` | `fetchEodhdEodDaily` / `fetchEodhdIntraday`, `getCachedSharesOutstanding` | `stock-chart-points-v4-series` | `REVALIDATE_HOT` (60s) |
| Shares outstanding | `getCachedSharesOutstanding` | `fetchEodhdFundamentalsJson` | `stock-shares-outstanding-v1` | `REVALIDATE_WARM` (300s) |
| Stock performance | `getStockPerformance` | `fetchEodhdEodDaily` | `stock-performance-v4` | `REVALIDATE_HOT` (60s) |
| Charting series | `fetchChartingSeries` | `fetchEodhdFundamentalsJson` + merge | `eodhd-charting-series-v4` | `REVALIDATE_WARM` (300s) |
| Header meta (split Phase 5) | `getCachedStockHeaderIdentity` / `getCachedStockHeaderEarningsLine` | `fetchEodhdFundamentalsJson` | `stock-header-identity-v1-phase5` (**12h**), `stock-header-earnings-line-v1-phase5` (**900s**) | Identity: `REVALIDATE_IDENTITY`; earnings line: `REVALIDATE_WARM_LONG` |
| Peers compare rows | `getPeersCompareRowsCached` | fundamentals + charting per peer | `peers-compare-payload-v3-eps-yoy-fallbacks` | `REVALIDATE_WARM` (300s) |
| Earnings week payload | `getEarningsWeekPayloadCached` | calendar + universe + fundamentals filters | `earnings-week-v20-screener-100-stocks` | `REVALIDATE_WARM_LONG` (900s) |
| Global asset search | `getCachedGlobalAssetSearch` | local universe + `fetchEodhdSearch` | `global-asset-search-v12-otc-dedupe-remote` | `REVALIDATE_SEARCH` (90s) |
| Top 500 universe | `getTop500UniverseData` | `fetchEodhdTopByMarketCap` pages | `screener-top500-universe-v11-preferred-suffix` | `REVALIDATE_STATIC` (~12h) |

---

## C. Crypto

| Resource | File | EODHD path | `fetch` | `unstable_cache` |
|----------|------|------------|---------|------------------|
| Crypto daily bars | `fetchEodhdCryptoDailyBars` | `/api/eod/{pair}.CC` | **`no-store`** | No (callers wrap, e.g. `getCryptoChartPoints`, `getCryptoPerformance`) |
| Crypto fundamentals meta | `fetchEodhdCryptoFundamentalsMetaHttp` | `/api/fundamentals/{cc}` | **`no-store`** | Yes — `eodhd-crypto-fundamentals-cc-by-symbol-v1`, **`REVALIDATE_WARM_LONG`** (900s) |
| Crypto news | `loadCryptoNewsUncached` | `/api/news` | **`no-store`** | Yes — `crypto-news-v1`, **`REVALIDATE_HOT`** (60s) |
| Crypto chart points | `getCryptoChartPoints` | intraday / crypto EOD | — | `REVALIDATE_HOT` |
| Crypto asset row | `getCryptoAsset` | fundamentals meta + crypto daily + derived | — | `REVALIDATE_HOT` |
| Crypto performance | `getCryptoPerformance` | `fetchEodhdCryptoDailyBars` | — | `REVALIDATE_HOT` |

---

## D. Macro

| Resource | File | EODHD path | `fetch` | `unstable_cache` |
|----------|------|------------|---------|------------------|
| Macro indicator series | `fetchMacroIndicatorUncached` | `/api/macro-indicator/{country}` | `next.revalidate: REVALIDATE_STATIC_DAY` | Yes — `eodhd-macro-indicator-v2`, **`REVALIDATE_STATIC_DAY`** |
| Macro dashboard bundle | `getMacroDashboardPayloadCached` | N × `fetchMacroSeries5y` | — | `macro-dashboard-payload-v2`, **`REVALIDATE_WARM`** (300s) |

---

## E. News feed (multi-symbol)

| Resource | File | EODHD path | `fetch` | `unstable_cache` |
|----------|------|------------|---------|------------------|
| Per-symbol news rows | `fetchEodhdNewsForSymbol` | `/api/news` | **`no-store`** | No |
| Tab feed | `getNewsFeedData` | many `fetchEodhdNewsForSymbol` | — | `news-feed-v2`, **`REVALIDATE_HOT`** (60s) |

---

## F. Screener “simple market” layer

| Export | File | Notes |
|--------|------|------|
| `getSimpleMarketData` | `simple-market-layer.ts` | **`REVALIDATE_TIER_SCREENER_COMBINED`** (180s) |
| `getSimpleMarketDataSlim`, screener tabs, all-pages | same | **`REVALIDATE_SCREENER_MARKET`** (300s) |
| `getSimpleScreenerDerived`, Top10, crypto derived, indices derived | same | **`REVALIDATE_TIER_SCREENER_DERIVED`** (1800s) |

These functions compose **realtime batches** + **EOD** + **fundamentals** paths from A/C.

---

## G. Indices / misc

| Resource | File | `unstable_cache` | `revalidate` |
|----------|------|------------------|---------------|
| Indices top 10 payload | `getIndicesTop10` | `indices-top10-v3-no-spark5d` | `REVALIDATE_HOT` (60s) |

---

## H. `screener-sectors`

`buildScreenerSectorsRows` — **no direct HTTP**; aggregates in-memory from `TopCompanyUniverseRow` (EODHD-backed via top500 → screener).

---

## Summary for later phases

1. **Already shared well:** Fundamentals JSON, charting series, top500/screener universe, macro indicators, many “page payload” builders use `unstable_cache` with named or literal TTLs.
2. **Hot / live by design:** Realtime (`no-store`), much EOD/intraday `no-store` with **short** outer caches on chart/performance.
3. **Phase 2 (done):** `fetchEodhdScreenerCandidates` wrapped in `unstable_cache`; `REVALIDATE_SCREENER_FILTERED`; aligned literals (search inner 90s, fundamentals + earnings calendar `REVALIDATE_WARM_LONG`, exchange list + cap screener `REVALIDATE_STATIC`, macro indicator `REVALIDATE_STATIC_DAY`).
4. **Phase 3 (done):** `fetchEodhdEarningsCalendar` wrapped in `unstable_cache`; HTTP `Cache-Control` for tier-aligned `app/api/**` handlers centralized as `CACHE_CONTROL_*` (Phase 4 extends to `no-store` / must-revalidate strings and corporate-action routes — see preset list).
5. **Phase 4 (done):** `unstable_cache` on dividends, splits, insider transactions; named `CACHE_CONTROL_*` for live-price `no-store`, key-stats refresh branches, insider/dividends/splits route headers.
6. **Phase 5 (done):** Stock detail header: separate `unstable_cache` for **identity** (name / sector / industry / logo, `REVALIDATE_IDENTITY` ~12h) vs **earnings date line** (`REVALIDATE_WARM_LONG`); same fundamentals HTTP, fewer identity recomputes on the hot cadence.
7. **Phase 6 (done):** Public HTTP cache on two unauthenticated ticker JSON routes (`fundamentals-series`, `earnings`) — shared CDN `s-maxage` + SWR aligned with warm / warm-chart private tiers.
8. **Phase 7 (done):** Stock + crypto asset headers: SSR `headerLiveSpotUsd` (intraday-aligned spot) + optional client refresh via authenticated `live-price` JSON; `mergeSessionHeaderWithPerformanceSpot` prefers that spot over EOD `performance.price` when the hidden 1D chart has not published a display price yet, with today’s move recomputed vs prior close implied by the EOD table.
9. **No `app/` EODHD URLs:** All server usage is under `lib/` (`app/api/...` sets response headers only).

*Generated for Finsepa Phase 0 — EODHD cache planning.*

**Phase 1:** Semantic tier aliases (`REVALIDATE_TIER_*`) and the tier table live in `lib/data/cache-policy.ts` (same numeric values as `REVALIDATE_*` primitives).

**Phase 2:** `REVALIDATE_SCREENER_FILTERED` / `REVALIDATE_TIER_SCREENER_FILTERED`; filtered screener `unstable_cache`; EODHD `fetch` `next.revalidate` alignment to `cache-policy` (search 120→90, 12h/900/24h literals → named constants).

**Phase 3:** `fetchEodhdEarningsCalendar` → `unstable_cache` (`eodhd-earnings-calendar-v1`); `CACHE_CONTROL_*` presets for stock/crypto news, macro, performance, chart, profile, peers, earnings, fundamentals series, key-stats (cached branches), screener rows/top10, search, news hub, earnings preview, portfolio overview/history, peers compare, screener indices — same numeric windows as the prior literals.

**Phase 4:** Corporate actions + insider `unstable_cache` (`eodhd-dividends-history-v1`, `eodhd-splits-history-v1`, `eodhd-insider-transactions-v1`); `CACHE_CONTROL_PRIVATE_NO_STORE` (+ must-revalidate / max-age variants), `CACHE_CONTROL_PRIVATE_WARM_LONG`; dividends/splits/insider JSON routes emit warm-tier `Cache-Control`.

**Phase 5:** `REVALIDATE_IDENTITY` / `REVALIDATE_TIER_IDENTITY`; stock header `unstable_cache` split (`stock-header-identity-v1-phase5` vs `stock-header-earnings-line-v1-phase5`); live spot price remains chart + live-price API, not fundamentals.

**Phase 6:** `GET /api/stocks/[ticker]/fundamentals-series` and `GET /api/stocks/[ticker]/earnings` emit **`public`** `Cache-Control` (`CACHE_CONTROL_PUBLIC_WARM_CHART` / `CACHE_CONTROL_PUBLIC_WARM`) — same `s-maxage` + SWR numerics as the prior private presets; safe because responses are ticker-only (no auth, no per-user fields).

**Phase 7:** `StockPageInitialData` / `CryptoPageInitialData` include `headerLiveSpotUsd`; detail pages poll `live-price` (~90s); `lib/chart/merge-session-header-with-performance-spot.ts` layers live spot over stale EOD mini-table spot for the headline fallback path only (`price` series, no range selection).
