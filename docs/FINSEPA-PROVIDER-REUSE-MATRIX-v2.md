# Finsepa Backend Provider Reuse Matrix (Architecture Audit) - v2

## Purpose
This document maps how external provider requests (primarily EODHD) flow through the backend, how they are cached/reused across users, and which flows generate new provider work per active user.

This is NOT an optimization audit.
This is NOT a performance audit.
This is NOT an implementation task.

### Core question
If Finsepa grows from 1 user to 100,000 users, which backend flows continue sharing the same provider requests, and which flows generate new provider requests per user?

---

## Extremely Important Rules
- Do NOT estimate provider request counts.
- Do NOT invent numbers.
- Do NOT use probabilistic or approximation wording.
- If something cannot be proven from static code analysis, write **UNKNOWN** and explain exactly why.
- Never convert provider function calls into provider HTTP request counts.
- Only state facts that can be directly supported by the codebase.

---

## Flow-by-flow assessment

---

## 1) Flow: Markets (Screener Markets tab)

### 1. Flow Overview
- Purpose: Provide Screener Markets tab payload derived from market snapshot + provider-derived slices.
- Entry API routes:
  - `GET /api/screener/market-tab`
- Main backend services/loaders:
  - `lib/screener/screener-page-payload.ts` (invoked by route)
  - `lib/market/simple-market-layer.ts` (tab exports and shared market-layer loaders)
  - `lib/screener/screener-us-market-cache.ts` (epoch-based shared server cache wrapper)
- External providers used:
  - EODHD realtime (via `fetchEodhdRealtimeSymbolsRaw` in `simple-market-layer.ts`)
  - EODHD daily bars (via `fetchEodhdEodDailyScreener` in `simple-market-layer.ts`)

### 2. Provider Request Entry Points (call graph)
`GET /api/screener/market-tab`
↓ `buildScreenerMarketTabApiResponse(...)` (payload builder)
↓ `withScreenerUsMarketCache(...)`
↓ `loadSimpleMarketDataBatch(...)` (in `lib/market/simple-market-layer.ts`)
↓ `fetchEodhdRealtimeSymbolsRaw(symbolList)` (EODHD realtime request)

`loadSimpleMarketDataBatch(...)`
↓ (when `epoch.mode === "frozen"` and eligible)
↓ `loadUsStockDatumsFromEodDaily(...)`
↓ `getCachedScreenerEodBarsForTickers(...)`
↓ `fetchEodhdEodDailyScreener(sym, window.from, window.to)` (EODHD daily bars request)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES
Explain why:
- The route computes an epoch via `getScreenerUsMarketCacheEpoch()` and the market-layer loaders are wrapped with `withScreenerUsMarketCache(...)`, which builds a shared cache key segment (`epoch.segment`) and uses `unstable_cache` with `revalidate: epoch.revalidateSec`.

**Which cache layers protect provider requests?**
- `unstable_cache` (inside `withScreenerUsMarketCache`)
- `in-memory session map` (`screenerUsSessionMem` inside `withScreenerUsMarketCache`)
- `market_snapshot` reads (via `readMarketSnapshot` and `readMarketSnapshotSlow` used inside `simple-market-layer.ts`)
- `unstable_cache` (inside market-layer unstable caches, e.g. `getSimpleMarketData`)

**Is provider work shared across users?**
- YES
Explain why:
- Shared epoch segment (`epoch.segment`) is part of the shared cache key, and the cache revalidate window is driven by `REVALIDATE_SCREENER_MARKET_LIVE` or frozen mode (`epoch.revalidateSec`).

**What invalidates provider cache?**
- TTL/revalidate window: `epoch.revalidateSec` from `getScreenerUsMarketCacheEpoch()`
- Cache key changes:
  - epoch segment: `live-{ymd}-s{slot}` in regular session
  - frozen segment: `frozen-{lastRegularSessionYmd}`
- Snapshot fallback logic: if `readMarketSnapshot(...)` returns no snapshot, `rebuildMarketSnapshotBlobSingleFlight(...)` is used.

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
Explain exactly why:
- This document pass does not enumerate client behavior for the Markets tab (mount frequency, polling, navigation). The backend caches exist, but whether the UI repeatedly calls the entry API fast enough to trigger new provider work is not proven here.

**Does this architecture scale with DAU?**
- Good
Justify (architecture only):
- Shared server caches are epoch-scoped and key the provider fan-out behind `withScreenerUsMarketCache(...)` plus market snapshot reads that avoid repeated provider calls for the same segment.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Whether the Markets tab client keeps re-triggering the provider paths faster than the shared cache revalidate window across real navigation/polling patterns.

---

## 2) Flow: Screener (Companies / metric selection: key-stat cells)

### 1. Flow Overview
- Purpose: Provide screener company cell values for a selected metric and ticker set.
- Entry API routes:
  - `POST /api/screener/companies-key-stat`
- Main backend services/loaders:
  - `lib/screener/fetch-screener-key-stat-cell.ts`
  - `lib/screener/screener-key-stat-snapshot.ts`
  - `lib/screener/screener-us-market-cache.ts` (not used by this route directly; key-stat route uses snapshot store instead)
  - `lib/market/eodhd-fundamentals.ts` (fundamentals JSON provider source)
- External providers used:
  - EODHD fundamentals and key-stats JSON (via `fetchEodhdFundamentalsJson` and key-stat fetchers in `fetch-screener-key-stat-cell.ts`)

### 2. Provider Request Entry Points (call graph)
`POST /api/screener/companies-key-stat`
↓ `getCachedKeyStatCells(metricId, tickersKey)` (wrapped by `unstable_cache`)
↓ loop per `ticker`
↓ `readScreenerKeyStatCellSnapshot(metricId, ticker)`
↓ if snapshot missing:
  - `fetchKeyStatCellForTicker(ticker, metric.section, metric.label)`
  ↓ `fetchEodhdFundamentalsJson(ticker)`
  ↓ key-stat function based on `section` (e.g. `fetchEodhdKeyStatsBasic`, etc.)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES
Explain why:
- The route uses `unstable_cache` (`getCachedKeyStatCells`) with a revalidate window and keys based on `(metricId, tickersKey)`.

**Which cache layers protect provider requests?**
- `unstable_cache` (route-level cached key-stat cells)
- `market_snapshot` reads/writes for each `(metricId, ticker)` cell (`readScreenerKeyStatCellSnapshot`, `upsertScreenerKeyStatCellSnapshot`)

**Is provider work shared across users?**
- YES
Explain why:
- Cache keys use normalized `tickersKey` (sorted, unique) and `metricId`; these are independent of user identity.

**What invalidates provider cache?**
- TTL/revalidate: `revalidate: 12 * 60 * 60` in `unstable_cache` wrapping `getCachedKeyStatCells`
- Cache key changes: `metricId` and `tickersKey`
- Snapshot store read gate: snapshot presence/segment gating via `SEGMENT = "screener_key_stat_v1"` and `marketSnapshotReadEnabled()`

**Can one active user continuously trigger NEW provider work?**
- PARTIALLY
Explain why:
- New provider work for missing cells only occurs when either:
  - the route cache key `(metricId, tickersKey)` changes, or
  - the 12-hour cached cell map expires, or
  - `market_snapshot` is empty for the cell segment.

**Does this architecture scale with DAU?**
- Good
Justify (architecture only):
- Cell values are cached for a long window and persisted per cell into `market_snapshot`.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Whether user-driven `tickersKey` diversity is high enough that the `(metricId, tickersKey)` cache is frequently unique.

---

## 3) Flow: Stock Page (SSR initial load orchestration)

### 1. Flow Overview
- Purpose: Render stock detail page initial payload (chart points, header data, performance, key stats, news, profile, and related data).
- Entry API routes: N/A (server-side loader)
  - Backend entry point: `loadStockPageInitialData(...)` and its snapshot-backed orchestration
- Main backend services/loaders:
  - `lib/market/stock-page-initial-data.ts` (orchestration)
  - `lib/market/asset-snapshot-store.ts` and `lib/market/asset-snapshot-keys.ts` (Supabase snapshot persistence)
  - `lib/market/simple-market-layer.ts` (via referenced quote/chart loaders)
  - `lib/market/stock-chart-data.ts` (for chart and live spot)
  - `lib/market/stock-extended-hours-header.ts` (extended-hours header provider fetch when requested by client)
- External providers used (from this loader’s call graph):
  - EODHD:
    - `fetchEodhdEodDaily` (SSR uncached daily bars in `loadStockPageInitialDataUncached`)
    - `getStockChartPointsForApi(...)` (which calls intraday/daily EODHD depending on range/branch)
    - `getStockSpotQuoteForApi(...)` (which calls EODHD realtime/delayed quote on cache-miss paths)
    - key stats / fundamentals via `buildStockKeyStatsBundle(...)`

### 2. Provider Request Entry Points (call graph)
`loadStockPageInitialData(routeTicker)`
↓ `readAssetSnapshotForPage(ticker, epoch.segment, { allowStale: true })` (snapshot-first)
↓ if snapshot hit and eligible:
  - `loadStockPageHotFields(...)`
  - `getStockChartPointsForApi(ticker, range, "price")` (server cached)
  - `getStockSpotQuoteForApi(ticker)` (server cached)
↓ if snapshot miss:
  - `runAssetColdMissSingleFlight(...)`
  ↓ `loadStockPageInitialDataUncached(ticker)`
  ↓ `fetchEodhdEodDaily(ticker, from, to)` (daily bars fetch)
  ↓ `getStockChartPointsForApi(ticker, range, "price")` (branch-dependent EODHD intraday/daily)
  ↓ `buildStockKeyStatsBundle(ticker)` (fundamentals/key-stat provider fetches)
  ↓ `getStockSpotQuoteForApi(ticker)`

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES
Explain why:
- Snapshot-first logic persists per-ticker/per-segment payload into Supabase (`assetSnapshot`), and uses shared epoch segments from `getScreenerUsMarketCacheEpoch()`.

**Which cache layers protect provider requests?**
- `market_snapshot` (asset snapshots via `asset-snapshot-store.ts`)
- `single-flight` coordination: `runAssetColdMissSingleFlight(...)` (prevents duplicate uncached rebuilds per isolate)
- `unstable_cache` inside downstream loaders (`stock-chart-data.ts`, `stock-performance.ts`, `eodhd-fundamentals.ts`, etc.)
- `HTTP Cache-Control` from downstream APIs (not used directly by this SSR loader)

**Is provider work shared across users?**
- YES
Explain why:
- Snapshot persistence plus epoch-scoped segments make repeated requests for the same ticker/segment share the same stored payload.

**What invalidates provider cache?**
- TTL/revalidate: driven by epoch segment (`epoch.revalidateSec`) from `getScreenerUsMarketCacheEpoch()`
- Snapshot segment mismatch: `readAssetSnapshotForPage` depends on the epoch `segment`
- Cache-key changes: ticker and segment
- Cold-miss rebuild lease: `tryAcquireAssetRebuildLease(...)` + `ASSET_REBUILD_LEASE_TTL_SEC` (lease lifetime)

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
Explain exactly why:
- Continuous triggering depends on UI refresh/reload behavior and on whether the asset snapshot rebuild lease and segment expiration are reached without other users already populating the cache. That client behavior is not enumerated in this pass.

**Does this architecture scale with DAU?**
- Excellent
Justify (architecture only):
- Snapshot-first reduces cold provider fan-out to a controlled rebuild path with single-flight and persistent storage for subsequent requests.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Snapshot hit rate by ticker/segment over time and whether cold-miss rebuilds occur under realistic traffic.

---

## 4) Flow: Stock Live Quotes (regular-session spot header)

### 1. Flow Overview
- Purpose: Provide live spot price and prior-close anchor used by stock page header and the live-spot client poll.
- Entry API routes:
  - `GET /api/stocks/[ticker]/live-price`
- Main backend services/loaders:
  - `lib/market/stock-chart-data.ts`
    - `getStockSpotQuoteForApi(...)`
    - `getStockSpotQuoteLiveSessionCached(...)` (`unstable_cache`)
    - `fetchStockSpotQuoteUncached(...)` (provider fetch path)
    - `enhanceLiveSpotQuoteWithMinuteStore(...)` (DB/memory minute-store)
- External providers used:
  - EODHD realtime (via `fetchEodhdUsRealtime`)
  - EODHD delayed quote (via `fetchEodhdUsQuoteDelayed`)

### 2. Provider Request Entry Points (call graph)
`GET /api/stocks/[ticker]/live-price`
↓ `getStockSpotQuoteForApi(routeTicker)`
↓ if regular session:
  ↓ `getStockSpotQuoteLiveSessionCached(ticker)` (`unstable_cache`)
  ↓ (on cache miss) `fetchStockSpotQuoteUncached(ticker)`
  ↓ `fetchEodhdUsRealtime(sym)`
  ↓ (if needed) `fetchEodhdUsQuoteDelayed(sym)`
↓ if not regular session:
  ↓ `getStockSpotQuoteCached(ticker)` (`unstable_cache`)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES
Explain why:
- The regular-session path uses `getStockSpotQuoteLiveSessionCached` which is wrapped in `unstable_cache` keyed by ticker and revalidated by `REVALIDATE_STOCK_1D_LIVE_SPOT` (= 15 seconds).

**Which cache layers protect provider requests?**
- `unstable_cache` (`getStockSpotQuoteLiveSessionCached`, `getStockSpotQuoteCached`)
- `HTTP Cache-Control` on the API route:
  - regular session uses `CACHE_CONTROL_PRIVATE_NO_STORE` (no shared HTTP cache)
  - non-regular session uses `CACHE_CONTROL_PRIVATE_HOT`
- Minute-store augmentation (DB + server in-memory minute bars):
  - `fetchLatestStockSessionMinuteBarFromDb`
  - `getStockSessionMinuteBars` (minute-bar store in memory)

**Is provider work shared across users?**
- YES
Explain why:
- The EODHD realtime/delayed provider fetch is executed inside the `unstable_cache` miss path, which is keyed by ticker and shared across users for the TTL window.

**What invalidates provider cache?**
- TTL/revalidate:
  - `REVALIDATE_STOCK_1D_LIVE_SPOT` (= 15 seconds) for the regular-session cached path
  - `REVALIDATE_HOT` (= 60 seconds) for the non-regular cached path
- Cache-key changes: ticker
- Regular-session eligibility changes by market session (`getUsEquityMarketSession(now)`)

**Can one active user continuously trigger NEW provider work?**
- YES
Explain why:
- The stock page client sets `setInterval(..., STOCK_1D_LIVE_PRICE_POLL_MS)` where `STOCK_1D_LIVE_PRICE_POLL_MS = 15000`.
- The backend cache revalidates every 15 seconds, so repeated polling drives repeated cache refresh cycles.

**Does this architecture scale with DAU?**
- Excellent
Justify (architecture only):
- Provider work is behind a ticker-keyed `unstable_cache` with a short TTL, and the client poll cadence aligns to the same cache window.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Deployment topology effects: whether multiple Node instances reduce shared cache reuse enough to increase cache-miss frequency.

---

## 5) Flow: Stock Charts (stock chart points endpoint)

### 1. Flow Overview
- Purpose: Provide stock chart points for selected range/series.
- Entry API routes:
  - `GET /api/stocks/[ticker]/chart`
- Main backend services/loaders:
  - `lib/market/stock-chart-data.ts`
    - `getStockChartPointsForApi(...)`
    - `getStockChartPoints(...)` (`unstable_cache`)
    - `getStockChartPoints1DPriorSession` (`unstable_cache`)
    - `loadStockChartPointsUncached(...)` (branch-dependent provider fetch paths)
- External providers used:
  - EODHD daily (`fetchEodhdEodDaily`)
  - EODHD intraday (`fetchEodhdIntraday`)
  - EODHD realtime (`fetchEodhdUsRealtime`) for live chart branches (e.g. WS-tailed anchors)

### 2. Provider Request Entry Points (call graph)
`GET /api/stocks/[ticker]/chart?range=...&series=...`
↓ `getStockChartPointsForApi(ticker, range, series)`
↓ if `range === "1D"` and branch is cached:
  - `getStockChartPoints1DPriorSession(ticker, series, completedSessionYmd)` (`unstable_cache`)
↓ if `range === "1D"` and branch is live minute pipeline:
  - `loadStockChartPointsUncached(ticker, "1D", series)` (uncached loader path)
  - `loadStockPriceChartPointsUncached(...)` → `load1DChartPoints(...)` → `loadStock1DLiveWsMinuteChartPoints(ticker, now)` (provider calls not enumerated in this pass)
↓ else:
  - `getStockChartPoints(ticker, range, series)` (`unstable_cache`)
  - `loadStockChartPointsUncached(...)` → `fetchEodhdIntraday(...)` and/or `fetchEodhdEodDaily(...)`

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- PARTIALLY
Explain why:
- Some chart ranges/series use `unstable_cache` (`getStockChartPoints` and `getStockChartPoints1DPriorSession`), but some `1D` live chart branches call `loadStockChartPointsUncached` and may bypass those cached paths.

**Which cache layers protect provider requests?**
- `unstable_cache`:
  - `getStockChartPoints` (`revalidate: REVALIDATE_HOT` = 60)
  - `getStockChartPoints1DPriorSession` (`revalidate: REVALIDATE_STATIC_DAY` = 86400)
- Branch-dependent uncached loaders: `loadStockChartPointsUncached(...)` for live minute branches

**Is provider work shared across users?**
- PARTIALLY

**What invalidates provider cache?**
- TTL/revalidate on `unstable_cache` branches
- Cache-key changes: ticker, range, series, and `completedSessionYmd` for the prior-session 1D cache
- Branch selection changes based on:
  - `getUsEquityMarketSession(now)`
  - `usesStock1DLiveWsMinutePipeline(ticker, now)`
  - `usesStock1DLiveWsPostMarketChart(ticker, now)`

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
Explain exactly why:
- Continuous chart polling and branch selection frequency are determined by client chart components (e.g. `PriceChart`) and live WS pipelines. This pass did not enumerate those client-side triggers for the chart endpoint.

**Does this architecture scale with DAU?**
- Needs Improvement
Justify (architecture only):
- A subset of chart calls can bypass cached providers on live `1D` branches, which increases the potential for per-request provider work depending on UI behavior.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Cache hit rate across cached vs uncached branches for chart requests under real user behavior.

---

## 6) Flow: Extended Hours (extended-hours header quote)

### 1. Flow Overview
- Purpose: Provide extended-hours dual-column header quote data.
- Entry API routes:
  - `GET /api/stocks/[ticker]/extended-hours`
- Main backend services/loaders:
  - `lib/market/stock-extended-hours-header.ts`
    - `getStockExtendedHoursQuoteForApi(...)`
    - `resolveUsEquityLiveRegularSessionActive(...)` (React cache memoization)
    - `getStockPerformance(...)` (`unstable_cache`)
    - `buildStockExtendedHoursHeaderQuote(...)`
    - `fetchEodhdUsQuoteDelayed(...)` (uncached provider fetch path)
- External providers used:
  - EODHD realtime (used inside `resolveUsEquityLiveRegularSessionActive` via `fetchEodhdUsRealtime`)
  - EODHD daily bars (inside `getStockPerformance` via `fetchEodhdEodDaily`)
  - EODHD delayed quote endpoint (inside `fetchEodhdUsQuoteDelayed` via `fetchEodhd(url, { cache: "no-store" })`)

### 2. Provider Request Entry Points (call graph)
`GET /api/stocks/[ticker]/extended-hours`
↓ `getStockExtendedHoursQuoteForApi(ticker, meta, sessionCloseUsd)`
↓ `resolveUsEquityLiveRegularSessionActive(sym, now)`
  ↓ (React cache memoized)
  ↓ `fetchEodhdUsRealtime(ticker)` (realtime probe)
↓ `getStockPerformance(sym)` (`unstable_cache`)
  ↓ (on cache miss) `fetchEodhdEodDaily(sym, from, to)`
↓ `buildStockExtendedHoursHeaderQuote(...)`
  ↓ `fetchEodhdUsQuoteDelayed(ticker)` (`cache: "no-store"`)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- PARTIALLY
Explain why:
- Provider work is split:
  - `getStockPerformance` is `unstable_cache` keyed by ticker with revalidate `REVALIDATE_HOT` (= 60).
  - `fetchEodhdUsQuoteDelayed` explicitly uses `fetch(..., { cache: "no-store" })`, so it is not protected by server-side caching in this path.

**Which cache layers protect provider requests?**
- React `cache()` for `resolveUsEquityLiveRegularSessionActive` memoized by minute bucket (`bucketMs = floor(now/60000)*60000`)
- `unstable_cache` for `getStockPerformance` (`revalidate: REVALIDATE_HOT` = 60)
- No cache / no-store:
  - `fetchEodhdUsQuoteDelayed` uses `fetchEodhd(..., { cache: "no-store" })`
- HTTP Cache-Control on route:
  - route handler returns `CACHE_CONTROL_PRIVATE_HOT` (not shared across users by code proof because it is `private`)

**Is provider work shared across users?**
- PARTIALLY

**What invalidates provider cache?**
- React memoization invalidation:
  - minute bucket key (`bucketMs`)
- `unstable_cache` invalidation:
  - TTL: `REVALIDATE_HOT` (= 60 seconds)
  - cache-key: ticker
- No invalidation for delayed quote cache, because delayed quote is fetched with `cache:"no-store"`.
- Eligibility gates:
  - `isUsEquityExtendedHoursHeaderEligible(now, liveRegularSessionActive)` determines whether provider work runs.

**Can one active user continuously trigger NEW provider work?**
- YES
Explain why:
- Stock page client polls extended-hours via `setInterval(() => void load(), STOCK_1D_LIVE_PRICE_POLL_MS)` and `STOCK_1D_LIVE_PRICE_POLL_MS = 15000`.
- The delayed quote provider fetch path is uncached (`fetchEodhdUsQuoteDelayed` uses `cache:"no-store"`), so each polled call can execute the delayed quote provider fetch.

**Does this architecture scale with DAU?**
- Critical
Justify (architecture only):
- A core external provider path (`fetchEodhdUsQuoteDelayed`) is explicitly uncached (`no-store`) and is triggered by client polling.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Actual provider fetch frequency per active user under varying tab mount state and client polling continuation.
- Effect of React cache and `unstable_cache` hit rates across deployment instances.

---

## 7) Flow: Portfolio Overview (market + yield + inception open)

### 1. Flow Overview
- Purpose: Provide portfolio overview market payload (SPY + performance-by-symbol + yield-by-symbol + inception open prices).
- Entry API routes:
  - `POST /api/portfolio/overview-market`
- Main backend services/loaders:
  - `lib/portfolio/portfolio-overview-market-server.ts`
  - `lib/portfolio/portfolio-overview-slow-snapshot.ts` (portfolio snapshot reads/writes)
  - `lib/market/stock-performance.ts` (`getStockPerformance`, `unstable_cache`)
  - `lib/market/eodhd-fundamentals.ts` (fundamentals JSON caching)
- External providers used:
  - EODHD:
    - fundamentals JSON (`fetchEodhdFundamentalsJson`)
    - dividend yield / valuation derived from fundamentals
    - performance providers via `getStockPerformance` (daily bars)
    - inception open prices via `fetchEodhdOpenPriceOnOrBefore` and `fetchEodhdCryptoOpenPriceOnOrBefore`

### 2. Provider Request Entry Points (call graph)
`POST /api/portfolio/overview-market`
↓ `getPortfolioOverviewMarketPayload(symbols, inceptionYmd, inceptionPriceTickers)`
↓ `unstable_cache getCachedOverviewFast(...)`
  ↓ `buildOverviewFastUncached(...)`
  ↓ `getStockPerformance(t)` (`unstable_cache`)
    ↓ (on miss) `fetchEodhdEodDaily(...)`
  ↓ `getCryptoPerformance(routeKey)` (provider path not enumerated here)
↓ `unstable_cache getCachedOverviewSlow(...)`
  ↓ `buildOverviewSlowUncached(...)`
  - `getCachedYieldPctForStockSymbol(ticker)`:
    ↓ `readPortfolioYieldPctSnapshot(ticker)` (market snapshot)
    ↓ `fetchEodhdFundamentalsJson(ticker)`
  - `getCachedInceptionOpenPrice(ticker, inceptionYmd)`:
    ↓ `readPortfolioInceptionOpenSnapshot(...)`
    ↓ `fetchEodhdOpenPriceOnOrBefore(ticker, inceptionYmd)` (or crypto open price)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- PARTIALLY
Explain why:
- Provider reads are behind shared `unstable_cache` layers, but the cache keys include `symbolsJson` and `inceptionPriceTickers`, which are derived from user-provided holdings-derived inputs.

**Which cache layers protect provider requests?**
- `unstable_cache`:
  - `portfolio-overview-market-fast-v1` (`revalidate: REVALIDATE_HOT` = 60)
  - `portfolio-overview-market-slow-v1` (`revalidate: REVALIDATE_IDENTITY` = 43200)
  - `portfolio-overview-yield-v1` (`revalidate: REVALIDATE_IDENTITY`)
  - `portfolio-overview-inception-open-v1` (`revalidate: REVALIDATE_IDENTITY`)
- React cache memoization for EODHD fundamentals inflight dedupe:
  - `fetchEodhdFundamentalsJsonPerRequest = cache(...)` inside `eodhd-fundamentals.ts`
- `market_snapshot` reads/writes:
  - `readPortfolioYieldPctSnapshot`, `upsertPortfolioYieldPctSnapshot`
  - `readPortfolioInceptionOpenSnapshot`, `upsertPortfolioInceptionOpenSnapshot`

**Is provider work shared across users?**
- PARTIALLY

**What invalidates provider cache?**
- TTL/revalidate windows from `REVALIDATE_HOT` and `REVALIDATE_IDENTITY`
- Cache-key changes:
  - symbol sets and inception inputs (cache key built by `overviewCacheKey`)
  - ticker and inceptionYmd for per-symbol caches
- Snapshot gating: portfolio snapshot reads determine whether provider fetch runs

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
Explain exactly why:
- Continuous triggering depends on whether the portfolio overview client repeatedly re-submits unique symbol sets/inception inputs and on whether it refreshes after revalidate windows.

**Does this architecture scale with DAU?**
- Acceptable
Justify (architecture only):
- Provider fan-out is cached at multiple layers, but cache keys are user-derived and can fragment.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Cache fragmentation rate by symbol-set inputs and effectiveness of per-ticker snapshots.

---

## 8) Flow: Portfolio History (value history)

### 1. Flow Overview
- Purpose: Provide portfolio value history chart points over selected ranges.
- Entry API routes:
  - `POST /api/portfolio/value-history`
- Main backend services/loaders:
  - `lib/portfolio/portfolio-value-history.server.ts`
  - `lib/portfolio/data/load-portfolio-eod-bars.ts` (canonical daily EOD loader with caching)
  - `lib/market/stock-chart-data.ts` (intraday sampling helpers)
- External providers used:
  - EODHD daily bars (via `loadPortfolioEodBars` → `fetchEodhdEodDaily` / `fetchEodhdCryptoDailyBars`)
  - EODHD intraday bars (via `fetchEodhdIntraday` in the value history compute path)

### 2. Provider Request Entry Points (call graph)
`POST /api/portfolio/value-history`
↓ `computePortfolioValueHistory(range, transactions)` (no route-level `unstable_cache`)
↓ `loadPortfolioEodBars(symbols, barFromYmd, toYmd)` (in `load-portfolio-eod-bars.ts`)
  ↓ `unstable_cache` per providerSymbol/fromYmd/toYmd
  ↓ provider fetch via `fetchEodhdEodDaily` / crypto daily bars
↓ if range requires intraday:
  ↓ `fetchSymbolIntraday1d(...)` / `fetchSymbolIntraday7d(...)` / `fetchSymbolIntraday1m(...)`
  ↓ `fetchEodhdIntraday(...)` (provider intraday fetch)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- PARTIALLY
Explain why:
- Daily bars are behind `unstable_cache` keyed by providerSymbol and the computed from/to YMD window.
- Intraday fetches in this module are not wrapped in a `unstable_cache` layer in the code shown in this pass (intraday fetch functions are called directly in compute).

**Which cache layers protect provider requests?**
- `unstable_cache` and in-flight coalesce:
  - inside `loadPortfolioSymbolEodBars`:
    - `unstable_cache` for equity/crypto daily bars
    - `in-flight Promise coalesce` (`inflight` Map)
- `HTTP Cache-Control`:
  - route returns `CACHE_CONTROL_PRIVATE_WARM` (private HTTP cache only; cross-user sharing not proven)

**Is provider work shared across users?**
- PARTIALLY

**What invalidates provider cache?**
- TTL: `REVALIDATE_HOT` (= 60 seconds) for portfolio daily bars cache
- Cache-key changes: providerSymbol/fromYmd/toYmd and retry flag
- Computed window changes:
  - `fromYmd` depends on portfolio range and `firstTxYmd` derived from user transactions

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
Explain exactly why:
- Whether the client triggers repeated history computations fast enough to exceed the daily-bar cache TTL and whether it recomputes unique intraday windows continuously are client-behavior dependent.

**Does this architecture scale with DAU?**
- Needs Improvement
Justify (architecture only):
- Provider intraday fetches are executed directly in the compute path (not shown as cached in this pass), and the window depends on user transactions.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Intraday fetch frequency and whether daily-bar caching absorbs most repeated calls for overlapping windows across users.

---

## 9) Flow: Portfolio Analytics (risk/return metrics)

### 1. Flow Overview
- Purpose: Compute portfolio risk/return metrics snapshot (Sharpe, Sortino, volatility, beta, PE/GM/OM/ROCE, etc.).
- Entry API routes:
  - `POST /api/portfolio/analytics`
- Main backend services/loaders:
  - `lib/portfolio/analytics/portfolio-analytics.server.ts`
  - `lib/portfolio/data/load-portfolio-eod-bars.ts`
  - `lib/market/eodhd-fundamentals.ts`
  - `lib/market/eodhd-fed-funds-macro` and `lib/market/shiller-ie-macro` (macro providers)
- External providers used:
  - EODHD daily bars (via `loadPortfolioEodBars` and `loadPortfolioBenchmarkEodBars`)
  - EODHD fundamentals JSON (via `fetchEodhdFundamentalsJson` per holding and benchmark)
  - FRED / Fed funds macro:
    - `fetchFedFundsTargetSeriesCached` (provider source not enumerated in this pass)
  - Shiller PE series:
    - `fetchShillerIeMacroSeriesCached` (provider source not enumerated in this pass)

### 2. Provider Request Entry Points (call graph)
`POST /api/portfolio/analytics`
↓ `computePortfolioAnalyticsSnapshot({ holdings, transactions, benchmarkTicker })`
↓ Promise.all includes:
  - `loadPortfolioEodBars(symbols, fromYmd, asOf)` → daily bars (unstable_cache + inflight coalesce)
  - `loadPortfolioBenchmarkEodBars(benchTicker, fromYmd, asOf, { retry: true })` → daily bars (same cache namespace)
  - `resolveDailyRiskFreeRate()` → `fetchFedFundsTargetSeriesCached()`
  - per holding:
    - crypto holdings: no EODHD fundamentals call in shown branch
    - equity holdings:
      - `fetchEodhdFundamentalsJson(sym)` (with caching in `eodhd-fundamentals.ts`)
  - `fetchEodhdFundamentalsJson(benchTicker)`
  - `fetchShillerIeMacroSeriesCached("sp500_pe")`

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- PARTIALLY
Explain why:
- Daily bars and fundamentals JSON are cached in shared `unstable_cache` layers keyed by providerSymbol and revalidate windows.
- Portfolio analytics computation is user-specific (holdings/transactions), so even when caches exist, the set of tickers and the computed snapshot window depends on user input.

**Which cache layers protect provider requests?**
- Daily bars caches:
  - `unstable_cache` inside `load-portfolio-eod-bars.ts` for equity/crypto daily bars
  - in-flight coalesce Map inside `load-portfolio-eod-bars.ts`
- Fundamentals cache:
  - `unstable_cache` for `fetchEodhdFundamentalsJson` and React `cache()` inflight dedupe

**Is provider work shared across users?**
- PARTIALLY

**What invalidates provider cache?**
- Daily bars TTL/revalidate:
  - `REVALIDATE_HOT` (= 60 seconds)
- Fundamentals TTL/revalidate:
  - `REVALIDATE_WARM_LONG` (= 900 seconds)
- Cache key changes:
  - symbols set affects which per-symbol caches are touched
  - analytics snapshot “asOf” changes by date

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
Explain exactly why:
- Requires client behavior about submitting repeated analytics computations with varying holdings/transactions and whether submissions occur after relevant cache TTL expiry.

**Does this architecture scale with DAU?**
- Needs Improvement
Justify (architecture only):
- It triggers multiple cached provider reads, but fan-out depends on `holdings` cardinality and on user-specific ticker sets.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Holdings/ticker diversity per submission and the resulting cache-miss ratio for daily bars and fundamentals.

---

## 10) Flow: Watchlist (enrich POST)

### 1. Flow Overview
- Purpose: Enrich watchlist rows into display rows including prices and derived metrics.
- Entry API routes:
  - `POST /api/watchlist/enrich`
- Main backend services/loaders:
  - `lib/market/watchlist-enrichment.ts`
  - `lib/market/simple-market-layer.ts` (market slice loaders used by watchlist enrich)
  - `lib/screener/screener-us-market-cache.ts` (epoch-based shared cache wrapper)
  - `lib/market/eodhd-fundamentals.ts` (off-universe meta for missing tickers)
- External providers used:
  - EODHD realtime and daily bars via `simple-market-layer.ts` (market slice quotes)
  - EODHD fundamentals JSON via `fetchEodhdFundamentalsJson` (off-universe meta)

### 2. Provider Request Entry Points (call graph)
`POST /api/watchlist/enrich`
↓ `buildWatchlistEnrichedGroups(rows)` (in `lib/market/watchlist-enrichment.ts`, wrapped by `withScreenerUsMarketCache(...)`)
↓ `getSimpleMarketDataForWatchlistStocks(stockTickers)` (in `simple-market-layer.ts`)
↓ (snapshot hit path) slices from `readMarketSnapshot(MARKET_SNAPSHOT_KEY.stocksAllPages)`
↓ (snapshot miss path) `rebuildMarketSnapshotBlobSingleFlight(...)` which calls provider-backed loaders
↓ `withScreenerUsMarketCache(...)` for missing tickers
↓ `loadSimpleMarketDataBatch(...)`
↓ `fetchEodhdRealtimeSymbolsRaw(symbolList)`
↓ `fetchEodhdEodDailyScreener(sym, from, to)` (for derived fields / snapshot rebuild)

Off-universe meta:
↓ `fetchWatchlistOffUniverseMetaByTicker(...)`
↓ `fetchEodhdFundamentalsJson(tk)`

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- PARTIALLY
Explain why:
- Epoch-based shared caches and market snapshot reads enable cross-user reuse for covered tickers and segments.
- Off-universe ticker sets depend on watchlist contents and trigger per-ticker fundamentals fetches, though fundamentals fetches are cached.

**Which cache layers protect provider requests?**
- `withScreenerUsMarketCache(...)`:
  - `unstable_cache`
  - `in-memory session map`
- `market_snapshot` reads (`readMarketSnapshot` / `readMarketSnapshotSlow`)
- `fetchEodhdFundamentalsJson`:
  - React `cache()` inflight memoization
  - `unstable_cache` with revalidate `REVALIDATE_WARM_LONG`
- `simple-market-layer.ts` also uses internal `unstable_cache` for some combined bundles

**Is provider work shared across users?**
- PARTIALLY

**What invalidates provider cache?**
- Epoch-scoped revalidate window from `getScreenerUsMarketCacheEpoch()` (`epoch.revalidateSec`)
- TTL/revalidate for fundamentals JSON: `REVALIDATE_WARM_LONG`
- Cache key changes:
  - tickers sets and derived universe selection
  - epoch `segment`

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
Explain exactly why:
- Continuous triggering depends on whether the watchlist enrich UI re-requests enrichment repeatedly with changing ticker sets during a session.

**Does this architecture scale with DAU?**
- Good
Justify (architecture only):
- Shared epoch caching and fundamentals caching bound provider work by segment and ticker.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Enrichment submission frequency and watchlist diversity distribution that determines how many unique ticker sets reach cache misses.

---

## 11) Flow: Search (global asset search)

### 1. Flow Overview
- Purpose: Provide global search results for stocks/crypto/indices/superinvestors.
- Entry API routes:
  - `GET /api/search?q=...&scope=...`
- Main backend services/loaders:
  - `lib/search/global-asset-search.ts`
  - `fetchEodhdSearch(...)` inside `global-asset-search.ts`
- External providers used:
  - EODHD search (via `fetchEodhdSearch`)

### 2. Provider Request Entry Points (call graph)
`GET /api/search`
↓ `globalAssetSearch(q, scope)`
↓ `unstable_cache getCachedGlobalAssetSearch(qNorm, scope)`
↓ if query length triggers remote:
  - `fetchEodhdSearch(qNorm, limit)`
  - (remote provider fetch happens inside `runGlobalAssetSearch`)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES
Explain why:
- Results are cached per `(qNorm, scope)` in `unstable_cache` for `REVALIDATE_SEARCH` (= 90 seconds).

**Which cache layers protect provider requests?**
- `unstable_cache` for `getCachedGlobalAssetSearch`
- HTTP Cache-Control:
  - route sets `CACHE_CONTROL_PUBLIC_SEARCH` (public)

**Is provider work shared across users?**
- YES

**What invalidates provider cache?**
- TTL/revalidate: `REVALIDATE_SEARCH` (= 90 seconds)
- Cache-key changes: normalized query and scope
- Branch selection: remote search is only called when query length `n.length >= SEARCH_MIN_QUERY_LENGTH`

**Can one active user continuously trigger NEW provider work?**
- YES
Explain why:
- With repeated submissions of unique normalized queries, the cache key changes, forcing provider work.
- Additionally, when the same query cache entry expires, remote provider work can re-run.

**Does this architecture scale with DAU?**
- Good
Justify (architecture only):
- Search provider calls are coalesced and cached per normalized query and scope for a short TTL.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Distribution of unique normalized queries across active users.

---

## 12) Flow: News (user news page)

### 1. Flow Overview
- Purpose: Provide news items for equities/crypto/indices tabs.
- Entry API routes:
  - `GET /api/news?tab=...&page=...`
- Main backend services/loaders:
  - `lib/news/news-feed.ts`:
    - `getNewsFeed(tab)` (React `cache` + hub snapshot)
    - `readHubSnapshot(...)` used inside `getNewsFeed`
- External providers used (for user reads):
  - None in shown user read path.
  - EODHD news fetching occurs in `buildNewsFeedUncached(tab)` but is explicitly marked "Cron / hub ingest" and "Never cold-rebuilds EODHD from request traffic".

### 2. Provider Request Entry Points (call graph)
`GET /api/news`
↓ `getNewsPage(tab, page)`
↓ `getNewsFeed(tab)` (React `cache`)
↓ `readHubSnapshot(hubNewsKey(tab), segment, { allowStale: true })`

EODHD provider fetch exists but is not used on user read path:
`buildNewsFeedUncached(tab)`
↓ `fetchEodhdNewsForSymbol(eodhdSymbol)`
↓ `fetchEodhd(url, { cache:"no-store" })`

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- NO
Explain why:
- User read path is snapshot-only and does not call the EODHD fetcher functions in this pass.

**Which cache layers protect provider requests?**
- `React cache()` for `getNewsFeed(tab)`
- `hub snapshot` read via `readHubSnapshot(...)`
- No user-read provider request cache is exercised because user read path does not invoke provider fetchers.

**Is provider work shared across users?**
- NO

**What invalidates provider cache?**
- Not applicable to user read path in this pass; provider fetchers are not executed.

**Can one active user continuously trigger NEW provider work?**
- NO
Explain why:
- The user read path reads hub snapshots and does not call EODHD functions.

**Does this architecture scale with DAU?**
- Excellent
Justify (architecture only):
- Snapshot-only reads remove dependence on external providers during user traffic.

**Runtime validation required?**
- NO

---

## 13) Flow: Macro (macro dashboard)

### 1. Flow Overview
- Purpose: Provide macro dashboard cards (percent/number/index series).
- Entry API routes:
  - `GET /api/macro`
- Main backend services/loaders:
  - `lib/market/macro-dashboard-payload.ts`
    - `getMacroDashboardPayloadCached()`
    - `getMacroDashboardPayloadCachedInner()` (unstable_cache)
    - hub snapshot gating via `readHubSnapshot(...)`
- External providers used:
  - EODHD macro series via `fetchMacroSeriesAll(...)` inside `buildMacroDashboardPayloadUncached()` (only used when hub snapshot is unusable)

### 2. Provider Request Entry Points (call graph)
`GET /api/macro`
↓ `getMacroDashboardPayloadCached()`
↓ `readHubSnapshot(HUB_SNAPSHOT_KEY.macroDashboard, macroHubSegment())`
↓ if snapshot usable:
  - no provider fetch in shown code path (only `maybeRefreshBtcEtfCard` which calls `fetchMacroSeriesAll` when BTC points are insufficient)
↓ else:
  - `getMacroDashboardPayloadCachedInner()`
    - `unstable_cache` wraps `buildMacroDashboardPayloadUncached`
    - `buildMacroDashboardPayloadUncached()`
      ↓ `fetchMacroSeriesAll(country, def)` per macro series

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES
Explain why:
- Provider-based macro payload generation is wrapped by `unstable_cache` with `revalidate: 300` seconds and is also guarded by hub snapshot usability checks that reduce rebuilds.

**Which cache layers protect provider requests?**
- `hub snapshot` read via `readHubSnapshot(...)` (Supabase)
- `unstable_cache`:
  - `macro-dashboard-payload-v48-btc-etf-skip-zero-tip` with `revalidate: 300`
- conditional refresh for BTC ETF card:
  - `fetchMacroSeriesAll` only when existing BTC card points are below a threshold

**Is provider work shared across users?**
- YES

**What invalidates provider cache?**
- TTL/revalidate: `revalidate: 300` for cached macro payload rebuild
- Hub snapshot usability gating: `hubMacroSnapshotIsUsable(snap)` (freshness checks)
- Cache key changes: hub segment from `macroHubSegment()`

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
Explain exactly why:
- Requires proving how often `hubMacroSnapshotIsUsable` fails and whether per-request conditional refresh (BTC ETF card) is reached due to user actions or only due to snapshot state.

**Does this architecture scale with DAU?**
- Good
Justify (architecture only):
- Snapshot-first plus cached payload generation bounds provider churn.

**Runtime validation required?**
- YES
Explain exactly what needs runtime measurement:
- Frequency of hub snapshot invalidation and BTC ETF conditional refresh triggers under production traffic.

---

## 14) Flow: Superinvestors

### 1. Flow Overview
- Purpose: Provide superinvestor performance series and transaction history.
- Entry API routes:
  - `GET /api/superinvestors/[slug]/performance`
  - `GET /api/superinvestors/[slug]/transactions`
  - `GET /api/superinvestors/resolve-issuer-ticker?issuer=...`
- Main backend services/loaders:
  - `lib/superinvestors/superinvestor-performance-series.ts` (snapshot read path)
  - `lib/superinvestors/superinvestor-13f-full-transactions.ts` (snapshot read path)
  - `lib/superinvestors/resolve-13f-issuer-ticker` (cache path)
- External providers used:
  - EODHD: only in cron/ops rebuild path for performance (not in user read path shown)
  - SEC EDGAR: only in cron/ops rebuild path for performance series or transactions (not in user read path shown)

### 2. Provider Request Entry Points (call graph)
Performance user path:
`GET /api/superinvestors/[slug]/performance`
↓ `loadSuperinvestorPerformanceSeries(slug)`
↓ `readSuperinvestorPerformanceSnapshot(slug)`

Transactions user path:
`GET /api/superinvestors/[slug]/transactions`
↓ `item.loadTransactions()`
↓ `readSuperinvestorFullTransactionsSnapshot...` (snapshot reads in `superinvestor-13f-full-transactions.ts`)

Cron rebuild paths (not used in user path):
`rebuildSuperinvestorPerformanceSeries(slug)`
↓ `buildSuperinvestorPerformanceSeriesUncached(slug)`
↓ `loadPortfolioEodBars(...)` (EODHD daily)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- NO (for user read paths)
Explain why:
- Performance and transactions routes load durable snapshots only in the code shown.

**Which cache layers protect provider requests?**
- `market_snapshot` reads for performance/transactions snapshots (durable snapshots)
- React/unstable_cache is present for cron rebuild caches but not invoked by user read routes in this pass.

**Is provider work shared across users?**
- NO (for user read paths)

**What invalidates provider cache?**
- Not applicable to user read path in this pass (providers are not invoked on user reads).

**Can one active user continuously trigger NEW provider work?**
- NO
Explain why:
- User read routes read snapshots; rebuild logic is not invoked in this request path.

**Does this architecture scale with DAU?**
- Excellent
Justify (architecture only):
- Snapshot-only reads avoid external provider churn.

**Runtime validation required?**
- NO

---

## 15) Flow: Notifications

### 1. Flow Overview
- Purpose: Provide user notifications list and unread count, plus mark-read operations.
- Entry API routes:
  - `GET /api/notifications?count=...`
  - `PATCH /api/notifications`
  - `DELETE /api/notifications`
- Main backend services/loaders:
  - `lib/notifications/user-notifications-store.ts`
- External providers used:
  - None in user request handlers shown.
  - EODHD may exist in background insertion jobs, but those are not part of this user read path in this pass.

### 2. Provider Request Entry Points (call graph)
`GET /api/notifications`
↓ `requireAuthUserFromRequest(...)`
↓ `getSupabaseClientForRequest(request)`
↓ `listUserNotifications(supabase, user.id)` (Supabase only)
↓ `countUnreadNotifications(supabase, user.id)` (Supabase only)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- NO
Explain why:
- User notification read paths operate only on Supabase tables (`user_notifications`); no EODHD provider calls are invoked here.

**Which cache layers protect provider requests?**
- None for provider requests in this pass (provider fetchers are not used).
- Supabase query results are not cached in code shown.

**Is provider work shared across users?**
- NO

**What invalidates provider cache?**
- Not applicable in this request path in this pass.

**Can one active user continuously trigger NEW provider work?**
- NO

**Does this architecture scale with DAU?**
- Excellent
Justify (architecture only):
- No external provider dependence for user notification reads.

**Runtime validation required?**
- NO

---

## Final Comparison Matrix

| Flow | Provider Reuse | Shared Across Users | Cache Layers | One User Can Trigger New Provider Work | Runtime Validation Needed | Architecture Rating |
|------|----------------|---------------------|--------------|----------------------------------------|---------------------------|--------------------|
| Markets | YES | YES | unstable_cache + in-memory epoch map + market_snapshot reads | UNKNOWN | YES | Good |
| Screener (key-stat cells) | YES | YES | unstable_cache + market_snapshot cell store | PARTIALLY | YES | Good |
| Stock Page | YES | YES | market_snapshot asset snapshots + single-flight rebuild + unstable_cache in downstream loaders | UNKNOWN | YES | Excellent |
| Stock Live Quotes | YES | YES | unstable_cache + HTTP cache-control (private/no-store) + minute-store augmentation | YES | YES | Excellent |
| Stock Charts | PARTIALLY | PARTIALLY | unstable_cache (some branches) + branch-dependent uncached loaders | UNKNOWN | YES | Needs Improvement |
| Extended Hours | PARTIALLY | PARTIALLY | React cache() + unstable_cache (performance) + no-store delayed quote fetch | YES | YES | Critical |
| Portfolio Overview | PARTIALLY | PARTIALLY | unstable_cache + portfolio snapshot reads/writes + fundamentals unstable_cache | UNKNOWN | YES | Acceptable |
| Portfolio History | PARTIALLY | PARTIALLY | unstable_cache + inflight coalesce for daily bars; uncached intraday compute calls | UNKNOWN | YES | Needs Improvement |
| Portfolio Analytics | PARTIALLY | PARTIALLY | unstable_cache daily bars + inflight coalesce + fundamentals unstable_cache + macro caches (via fetch*Cached helpers) | UNKNOWN | YES | Needs Improvement |
| Watchlist | PARTIALLY | PARTIALLY | epoch unstable_cache + in-memory epoch map + market_snapshot reads + fundamentals unstable_cache | UNKNOWN | YES | Good |
| Search | YES | YES | unstable_cache per (qNorm, scope) + public HTTP cache | YES | YES | Good |
| News | NO | NO | React cache + hub snapshot reads | NO | NO | Excellent |
| Macro | YES | YES | hub snapshot reads + unstable_cache (macro payload) | UNKNOWN | YES | Good |
| Superinvestors | NO (user reads) | NO | market_snapshot durable snapshots | NO | NO | Excellent |
| Notifications | NO | NO | none for provider work in user path | NO | NO | Excellent |

---

## Executive Summary

### Already production-grade
- Notifications
- News
- Superinvestors
Explain why:
- These user-facing routes read from durable Supabase snapshots only and do not execute EODHD provider fetchers in the user request path shown.

### Architecturally safe
- Stock Page
- Stock Live Quotes
- Search
- Screener (key-stat cells)
Explain why:
- Provider fetchers are gated behind shared caches keyed by stable identifiers (ticker, metricId/tickersKey, normalized query) and/or persisted snapshot blobs.

### Requires runtime validation
- Markets
- Stock Charts
- Extended Hours (despite code evidence of uncached delayed quote fetch)
- Portfolio Overview
- Portfolio History
- Portfolio Analytics
- Watchlist
- Macro
Explain why:
- The cache reuse depends on dynamic keys (ticker sets, epoch segments, user holdings) and on client polling/mount behavior that is not fully enumerated for every flow in this pass.

### Architecturally risky
- Extended Hours
- Stock Charts
- Portfolio History
- Portfolio Analytics
Explain why:
- These flows include uncached provider paths or user-driven computations where provider work depends on dynamic window/range and could expand with user behavior.

### Final Verdict
If Finsepa had to support 100,000 users tomorrow (based only on current backend architecture):

✅ Trust completely
- Notifications
- News
- Superinvestors (user read paths)

👀 Monitor
- Stock Live Quotes
- Screener (key-stat cells)
- Stock Page
- Search
- Markets
- Watchlist
- Macro

🔍 Investigate first
- Extended Hours
- Stock Charts
- Portfolio History
- Portfolio Analytics
- Portfolio Overview

### Confidence
- High: Notifications, News, Superinvestors (user read paths), Stock Live Quotes, Screener key-stat cells, Macro snapshot gating
- Medium: Stock Charts, Markets, Watchlist, Portfolio Overview/History/Analytics, Extended Hours (requires runtime measurement of polling and cache hit rates under real traffic)
- Low: NONE

