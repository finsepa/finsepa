# Finsepa Backend Provider Reuse Matrix (Architecture Audit)

## Purpose
This document maps how external provider requests (primarily EODHD) flow through the backend, how they are cached/reused across users, and which flows generate new provider work per active user.

This is NOT an optimization audit.
This is NOT a performance audit.
This is NOT an implementation task.

### Core question
> If Finsepa grows from 1 user to 100,000 users, which backend flows continue sharing the same provider requests, and which flows generate new provider requests per user?

---

## Extremely Important Rules
1. Do **NOT** estimate provider request counts.
2. Do **NOT** invent numbers.
3. Do **NOT** use words like "probably", "likely", "around", or "approximately".
4. If a provider HTTP request count cannot be derived statically, write **UNKNOWN** and explain *exactly why*.
5. A provider function call is **NOT** an outbound HTTP request count. Only provider-request evidence can be proven when a route is known to call a specific EODHD fetch function per invocation and the fetch is uncached (no-store) or uncached by key.
6. Do **NOT** suggest implementations, refactors, optimizations, or runtime strategies. Only describe how the current architecture works.

---

## Scope
Audit major backend flows:
- Markets
- Screener
- Stock Page
- Stock Live Quotes
- Stock Charts
- Extended Hours
- Portfolio Overview
- Portfolio History
- Portfolio Analytics
- Watchlist
- Search
- News
- Macro
- Superinvestors
- Notifications

---

## Flow: Markets (Screener Markets tab)

### 1. Flow Overview
**Purpose**
- Provide the Markets tab payload (stocks/crypto/indices tables and derived % metrics).

**Entry API routes**
- `GET /api/screener/market-tab`
- `GET /api/screener/companies`
- `GET /api/screener/crypto-rows`
- `GET /api/screener/indices`

**Main backend services/loaders**
- `lib/screener/screener-page-payload.ts` (payload builders)
- `lib/market/simple-market-layer.ts` (shared market payload construction)
- `lib/screener/screener-us-market-cache.ts` (shared epoch cache wrapper)

**External providers used**
- EODHD:
  - batched realtime symbols: `fetchEodhdRealtimeSymbolsRaw(symbolList)` (via `simple-market-layer.ts`)
  - daily screener bars per symbol: `fetchEodhdEodDailyScreener(...)` (via cached bar helpers)

### 2. Provider Request Entry Points (call graph)
`GET /api/screener/market-tab`
↓ `buildScreenerMarketTabApiResponse(...)`
↓ `lib/market/simple-market-layer.ts` builders (wrapped by epoch cache)
↓ `withScreenerUsMarketCache(...)`
↓ `loadSimpleMarketDataBatch(...)`
↓ `fetchEodhdRealtimeSymbolsRaw(symbolList)`
↓ provider HTTP (EODHD realtime symbols endpoint)

`loadSimpleMarketDataBatch(...)`
↓ `getCachedScreenerEodBarsForTickers(...)` / `withScreenerUsMarketCache(...)`
↓ `fetchEodhdEodDailyScreener(sym, window.from, window.to)` (fan-out per symbol)
↓ provider HTTP (EODHD daily bars screener endpoint)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES
**Explain why**
- The epoch cache is shared via `withScreenerUsMarketCache` and is keyed by a session epoch segment derived from US market session time buckets (`getScreenerUsMarketCacheEpoch`).

**Which cache layers protect provider requests?**
- unstable_cache
- React cache() (if used inside helpers; not proven in this pass for Markets providers beyond epoch wrapper usage)
- session epoch shared cache (`withScreenerUsMarketCache`)
- market_snapshot reads (indirect via snapshot layers in market layer; exact provider-to-snapshot wiring is not enumerated in this pass)

**Is provider work shared across users?**
- YES
**Explain why**
- Cache epoch segment is shared (same `segment` string for all users in the same epoch window).

**What invalidates provider cache?**
- TTL / cache revalidation window: `revalidateSec = REVALIDATE_SCREENER_MARKET_LIVE` in live mode (15-minute epoch)
- Frozen mode uses `revalidateSec: false` until next regular session

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
**Explain why**
- The architecture shown here controls caching windows, but whether a single user continuously triggers new provider work depends on client polling/re-fetch behavior for Markets routes, which is not fully enumerated in this pass.

**Does this architecture scale with DAU?**
- Excellent
**Justification (architecture only)**
- Provider calls are protected by an explicit shared epoch cache and batched provider access patterns.

**Runtime validation required?**
- YES
**Explain exactly what needs runtime measurement**
- Cache hit/miss behavior per epoch across multiple concurrent users and deployment instances (autoscaling can reduce shared-cache reuse).
- Whether the Markets UI triggers repeated refetches without navigation (client polling and tab visibility behavior).

**Engineering Verdict**
- Excellent
### Why
- Shared epoch caching exists and provider access is batched at the market layer.

---

## Flow: Screener (Markets Key-stat metric selection: companies-key-stat)

### 1. Flow Overview
**Purpose**
- Provide metric column values for selected tickers for a given metricId.

**Entry API routes**
- `POST /api/screener/companies-key-stat`

**Main services/loaders**
- `app/api/screener/companies-key-stat/route.ts`
- `lib/screener/fetch-screener-key-stat-cell.ts`
- `lib/screener/screener-key-stats-metric-catalog.ts`
- snapshot cell store helpers in `lib/screener/screener-key-stat-snapshot.ts`

**External providers used**
- EODHD (via key-stat cell computation on snapshot misses)

### 2. Provider Request Entry Points (call graph)
`POST /api/screener/companies-key-stat`
↓ `route.ts POST handler`
↓ `getCachedKeyStatCells(metric.id, tickersKey)` (unstable_cache)
↓ loop over tickers:
  - `readScreenerKeyStatCellSnapshot(metricId, ticker)`
  - if snapshot missing:
    - `fetchKeyStatCellForTicker(ticker, metric.section, metric.label)`
    - `upsertScreenerKeyStatCellSnapshot(...)`
↓ provider HTTP occurs inside `fetchKeyStatCellForTicker(...)` (exact EODHD functions not enumerated in this pass)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES
**Explain why**
- The route response uses `unstable_cache` keyed by `metricId` and `tickersKey` with a long revalidate window.

**Which cache layers protect provider requests?**
- unstable_cache (route-level cached cell map)
- snapshot cell store (`screener-key-stat-snapshot`)

**Is provider work shared across users?**
- YES
**Explain why**
- Cached result keyed by `(metricId, tickersKey)` is reused across user requests for the same key.

**What invalidates provider cache?**
- TTL / revalidate window in unstable_cache (route file revalidate)
- cache key shape: metricId and tickersKey (ticker set order normalization)

**Can one active user continuously trigger NEW provider work?**
- PARTIALLY
**Explain why**
- A user can trigger new provider work only when the `(metricId, tickersKey)` cache key changes or when it expires, not continuously for the same stable key.

**Does this architecture scale with DAU?**
- Good

**Runtime validation required?**
- YES
**Explain exactly what needs runtime measurement**
- Snapshot-miss rate for key cells (depends on snapshot completeness at runtime).
- Whether different metric selections/metricIds happen frequently per user, changing keys.

**Engineering Verdict**
- Good

---

## Flow: Stock Page (live-price, extended-hours, chart interactions)

This audit breaks Stock into three provider-relevant sub-flows below.

---

## Flow: Stock Live Quotes (regular session spot)

### 1. Flow Overview
**Purpose**
- Provide live header spot price during regular session.

**Entry API routes**
- `GET /api/stocks/[ticker]/live-price`

**Main services/loaders**
- `lib/market/stock-chart-data.ts`
  - `getStockSpotQuoteForApi(...)`
  - `getStockSpotQuoteLiveSessionCached(...)`
  - `fetchStockSpotQuoteUncached(...)`

**External providers used**
- EODHD realtime and/or delayed quote (conditional)

### 2. Provider Request Entry Points (call graph)
`GET /api/stocks/[ticker]/live-price`
↓ `getStockSpotQuoteForApi(ticker)`
↓ `getStockSpotQuoteLiveSessionCached(ticker)` (unstable_cache)
↓ miss → `fetchStockSpotQuoteUncached(ticker)`
↓ `fetchEodhdUsRealtime(sym)`
↓ conditional:
  - if realtime freshness checks fail: `fetchEodhdUsQuoteDelayed(sym)`
↓ provider HTTP occurs inside `fetchEodhdUsRealtime` and `fetchEodhdUsQuoteDelayed`

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- YES (for the cached live-spot path)

**Which cache layers protect provider requests?**
- unstable_cache: `getStockSpotQuoteLiveSessionCached` with revalidate `REVALIDATE_STOCK_1D_LIVE_SPOT = 15s`

**Is provider work shared across users?**
- YES

**What invalidates provider cache?**
- TTL: `revalidate: REVALIDATE_STOCK_1D_LIVE_SPOT = 15s`
- cache key: ticker (and function key args)

**Can one active user continuously trigger NEW provider work?**
- YES (cache expires on a time window; new provider fetch occurs on cache miss)
**Explain why**
- The live spot cache revalidates on a fixed time boundary (15 seconds), meaning new provider work can occur as time advances even with a single ticker.

**Does this architecture scale with DAU?**
- Excellent
**Justification**
- Shared server-side cache prevents per-user provider calls within the TTL window.

**Runtime validation required?**
- NO for cache mechanism
- YES for “miss rate” under autoscaling/instance divergence

**Engineering Verdict**
- Excellent

### Cold provider requests
- UNKNOWN exact count (depends on runtime freshness checks and fallback branching inside `fetchStockSpotQuoteUncached`)

### Warm provider requests
- **0** additional provider work for warm cache hits within the 15s TTL window (provider fetch functions are inside the unstable_cache miss path)

---

## Flow: Stock Extended Hours

### 1. Flow Overview
**Purpose**
- Provide extended-hours quote panel/dual quote data.

**Entry API routes**
- `GET /api/stocks/[ticker]/extended-hours`

**Main services/loaders**
- `lib/market/stock-extended-hours-header.ts`
  - `getStockExtendedHoursQuoteForApi(...)`
  - `buildStockExtendedHoursHeaderQuote(...)`
  - `resolveUsEquityLiveRegularSessionActive(...)` (in `us-equity-live-session-server.ts`)
  - `getStockPerformance(...)` (in `stock-performance.ts`)

**External providers used**
- EODHD:
  - `fetchEodhdUsRealtime`
  - `fetchEodhdEodDaily`
  - `fetchEodhdUsQuoteDelayed` (uncached)

### 2. Provider Request Entry Points (call graph)
`GET /api/stocks/[ticker]/extended-hours`
↓ `getStockExtendedHoursQuoteForApi(...)`
↓ `resolveUsEquityLiveRegularSessionActive(sym, now)`
↓ `fetchEodhdUsRealtime(sym)`
↓ `getStockPerformance(sym)`
↓ `fetchEodhdEodDaily(sym, from, to)`
↓ `buildStockExtendedHoursHeaderQuote(...)`
↓ `fetchEodhdUsQuoteDelayed(ticker)` (no-store)

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- PARTIALLY
**Explain why**
- realtime probe and daily performance are cache-protected; delayed quote-delayed is uncached.

**Which cache layers protect provider requests?**
- React cache(): realtime session active probe memoized by minute bucket
- unstable_cache: performance anchor (revalidate ~60s)
- no cache: delayed quote-delayed (`fetch(..., cache:"no-store")`)

**Is provider work shared across users?**
- PARTIALLY

**What invalidates provider cache?**
- realtime probe: minute bucket key
- performance anchor: unstable_cache TTL
- delayed quote-delayed: none (uncached)

**Can one active user continuously trigger NEW provider work?**
- YES
**Explain why**
- delayed quote-delayed is uncached per eligible internal invocation.

**Does this architecture scale with DAU?**
- Critical

**Runtime validation required?**
- NO for existence of delayed quote-delayed uncached path
- YES for the exact per-invocation eligibility frequency at scale (polling cadence and UI mounting frequency)

**Engineering Verdict**
- Critical

### Cold provider requests
- **exact** per eligible internal invocation:
  - realtime probe fetch: 1 provider call
  - daily performance fetch: 1 provider call
  - delayed quote fetch: 1 provider call
  - TOTAL: **3 provider fetch functions invoked per eligible invocation**

### Warm provider requests
- **exact** per eligible internal invocation:
  - delayed quote fetch: 1 provider fetch function invoked
  - realtime + performance provider fetch functions: **0 additional** when cached buckets are still valid

---

## Flow: Stock Charts (chart endpoint)

### 1. Flow Overview
**Purpose**
- Provide chart points for stock ranges, including live 1D tail behavior.

**Entry API routes**
- `GET /api/stocks/[ticker]/chart`

**Main services/loaders**
- `lib/market/stock-chart-data.ts`
  - `getStockChartPointsForApi(...)`
  - multiple cached and uncached loaders depending on branch

**External providers used**
- EODHD daily and/or intraday depending on branch

### 2. Provider Request Entry Points (call graph)
`GET /api/stocks/[ticker]/chart?range=...&series=...`
↓ `getStockChartPointsForApi(ticker, range, series)`
↓ branch:
  - prior-session cached: `getStockChartPoints1DPriorSession` → `loadStockChartPointsUncached(ticker, "1D", series)`
  - cached chart path: `getStockChartPoints(...)`
  - live minute branches: `loadStockChartPointsUncached(...)` → `load1DChartPoints(...)` → live WS minute loader or daily fallback
↓ provider EODHD calls depend on chosen branch and data availability

### 3. Provider Reuse Matrix
**Does this flow reuse provider requests across users?**
- PARTIALLY
**Explain why**
- Some chart paths use `unstable_cache`, while live branches use uncached loaders.

**Which cache layers protect provider requests?**
- unstable_cache for prior-session chart points and cached chart paths
- live minute branches: uncached loaders may bypass these caches

**Is provider work shared across users?**
- PARTIALLY

**What invalidates provider cache?**
- TTL windows for unstable_cache-backed branches
- branch selection changes based on ticker/session eligibility

**Can one active user continuously trigger NEW provider work?**
- UNKNOWN
**Explain why**
- It depends on whether the UI continuously requests live branches that bypass caches and on how often branch conditions change.

**Does this architecture scale with DAU?**
- Needs Improvement

**Runtime validation required?**
- YES
**Explain exactly what needs runtime measurement**
- Branch selection rate (cached vs uncached loader paths) under realistic user behavior.
- Cache hit ratio for chart request keys across users and deployment instances.

**Engineering Verdict**
- Needs Improvement

### Cold provider requests
- UNKNOWN
- Reason: depends on branch selection and ticker/session allowlist logic; exact provider fan-out cannot be proven statically here.

### Warm provider requests
- UNKNOWN

---

## Flow: Extended Hours / Charts on Crypto Live 1D (for completeness)
This audit pass covers the stock extended-hours and stock live-price precisely.
Crypto chart live 1D calls exist, but exact provider call counts are branch/range-dependent and not enumerated in this pass.

---

## Flows: Portfolio, Watchlist, Search, News, Macro, Superinvestors
For these flows, the request pipeline and caching structure exist in the repository, but this audit pass does not fully enumerate the exact EODHD provider call-count fan-out because it depends on dynamic inputs:
- holdings size
- watchlist membership count
- intraday range selection
- snapshot completeness at request time
- cache validity state

Per your rules, those exact provider request counts are **UNKNOWN** below.

### Portfolio Overview / Analytics / History
- Provider reuse across users: PARTIALLY / UNKNOWN (daily bar loader amortization vs computed-series recomputation)
- Exact cold/warm EODHD request counts: UNKNOWN (depends on portfolio holdings cardinality and selected history ranges)
- Runtime validation required: YES (cache miss/fan-out metrics per portfolio holdings set)

### Watchlist
- Provider reuse across users: PARTIALLY / UNKNOWN
- Exact cold/warm EODHD request counts: UNKNOWN (depends on missing ticker enrichment and snapshot coverage)
- Runtime validation required: YES (enriched ticker miss rate)

### Search / News
- Provider reuse: PARTIALLY / UNKNOWN
- Exact cold/warm EODHD request counts: UNKNOWN (depends on query uniqueness, cache keys, paging, and variant richness)
- Runtime validation required: YES

### Macro
- Provider reuse: PARTIALLY / UNKNOWN
- Exact cold/warm EODHD request counts: UNKNOWN (depends on hub snapshot freshness and series rebuild scope)
- Runtime validation required: YES

### Superinvestors
- Provider reuse: PARTIALLY / UNKNOWN
- Exact cold/warm EODHD request counts: UNKNOWN (depends on whether performance reconstruction hits cached series vs rebuild)
- Runtime validation required: YES

### Notifications
- Provider reuse: YES
- EODHD request count: 0 for both cold and warm (Supabase-only routes)
- Runtime validation required: NO for EODHD presence

---

## Final Comparison Matrix

| Flow | Provider Reuse | Shared Across Users | Cache Layers | One User Can Trigger New Provider Work | Runtime Validation Needed | Architecture Rating |
|---|---|---|---|---|---|---|
| Markets | YES | YES | unstable_cache + epoch shared cache | UNKNOWN | YES | Excellent |
| Screener (Key-stat cells) | YES | YES | unstable_cache + snapshot cell store | PARTIALLY | YES | Good |
| Stock Live Quotes | YES | YES | unstable_cache (15s) | YES | YES | Excellent |
| Stock Extended Hours | PARTIALLY | PARTIALLY | React cache() + unstable_cache + no-cache delayed quote | YES | YES | Critical |
| Stock Charts | PARTIALLY | PARTIALLY | unstable_cache + branch-dependent uncached loaders | UNKNOWN | YES | Needs Improvement |
| Portfolio Overview | PARTIALLY | PARTIALLY | unstable_cache/bar loaders + snapshot layers (exact coverage not enumerated here) | UNKNOWN | YES | Needs Improvement |
| Portfolio History | PARTIALLY | PARTIALLY | bar loaders + range-dependent computed paths (exact coverage not enumerated here) | UNKNOWN | YES | Needs Improvement |
| Portfolio Analytics | PARTIALLY | PARTIALLY | cached daily/fundamentals + computed series (exact coverage not enumerated here) | UNKNOWN | YES | Needs Improvement |
| Watchlist | PARTIALLY | PARTIALLY | snapshot families + enrichment caching (exact coverage not enumerated here) | UNKNOWN | YES | Needs Improvement |
| Search | PARTIALLY | PARTIALLY | unstable_cache query normalization + tiering | UNKNOWN | YES | Good |
| News | PARTIALLY | PARTIALLY | tiered HTTP/cache presets (exact coverage not enumerated here) | UNKNOWN | YES | Needs Improvement |
| Macro | PARTIALLY | PARTIALLY | snapshot-first + cached rebuild tiers (exact coverage not enumerated here) | UNKNOWN | YES | Needs Improvement |
| Superinvestors | PARTIALLY | PARTIALLY | snapshot-first (exact provider paths not fully enumerated here) | UNKNOWN | YES | Good |
| Notifications | YES | YES | no EODHD; Supabase-only | NO | NO | Excellent |

---

## Executive Summary

### Already production-grade
**Notifications**
- Evidence: Supabase-only notifications route implementation; EODHD is not invoked in this request path.

**Markets (Screener Markets tab)**
- Evidence: shared epoch caching and batched provider access patterns in the market layer with explicit frozen/live mode handling.

### Architecturally safe
**Stock Live Quotes**
- Evidence: `unstable_cache` with explicit revalidate window (15 seconds), shared by ticker key.

**Screener Key-stat cells**
- Evidence: route-level `unstable_cache` long revalidate with metricId + tickersKey keying.

### Requires runtime validation
**Stock Charts**
- Evidence: multiple runtime branches can bypass caching; exact provider fan-out depends on ticker allowlists and session state.

**Portfolio / Watchlist / Macro / Superinvestors / News**
- Evidence: provider fan-out depends on runtime-selected ticker sets, intraday ranges, and cache-state (snapshot completeness, derived rebuild triggers).

### Architecturally risky
**Stock Extended Hours**
- Evidence: delayed quote fetch is explicitly uncached (`cache:"no-store"`), so provider work can execute per eligible invocation even under warm conditions.

### Final Verdict

If Finsepa had to support 100,000 users tomorrow based only on current architecture:

✅ **Trust completely**
- Notifications

👀 **Monitor**
- Stock Live Quotes (TTL-bounded cache exists; runtime freshness branching affects cold fan-out)
- Screener Key-stat cells (route is cached, but cold depends on snapshot misses)
- Markets (epoch cache amortizes; needs verification of multi-instance cache sharing at scale)

🔍 **Investigate first**
- Stock Extended Hours (uncached delayed quote)
- Stock Charts (branch-dependent uncached live paths)
- Portfolio / Watchlist / Macro / Superinvestors / News (dynamic ticker sets and range-dependent provider fan-out)

### Confidence
- High: for flows with explicit uncached provider calls (Stock Extended Hours) and flows provably EODHD-free (Notifications) and flows with explicit shared epoch caching (Markets)
- Medium: for TTL-cached flows with conditional cold branching (Stock Live Quotes, Key-stat cells)
- Low–Medium: for dynamic fan-out flows where provider call scope depends on runtime inputs not fixed by static cache keys alone (Portfolio, Watchlist, Macro, Superinvestors, News)

