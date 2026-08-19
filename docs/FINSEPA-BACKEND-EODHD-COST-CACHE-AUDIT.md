# Finsepa Backend EODHD Cost & Cache Architecture Audit

## Purpose
Our goal is **NOT** to optimize yet.

Our goal is to fully understand how **EODHD provider requests** scale as the product grows, with emphasis on:
- which flows are already architected correctly,
- which flows reuse provider requests across users,
- which flows continue generating EODHD requests for every user,
- which flows require runtime measurement before decisions can be made.

This document is an **evidence-based technical audit** only.
- **No implementation ideas**
- **No optimizations**
- **No estimated provider request counts**
- If something cannot be proven statically from code, it is marked **UNKNOWN** with an explicit reason.

## Scope / “Proven vs Unknown” policy
We use two categories throughout:

1. **Proven**: directly supported by specific code paths or explicit caching configuration (e.g., `unstable_cache` revalidate values, uncached `fetch(..., cache: "no-store")`, React `cache()` bucket keys, or snapshot-first flow routing).
2. **UNKNOWN**: cannot be derived statically because it depends on runtime inputs or runtime branching, such as:
   - ticker set sizes (e.g., holdings count, watchlist membership count),
   - intraday range selection (1D vs 5D vs 1M vs hourly, etc.),
   - cache-state (whether an entry exists already),
   - eligibility gates (session regular vs pre/post/closed),
   - branch selection via allowlists (ticker/session dependent).

## Executive Summary

### Overall architecture assessment
Finsepa’s backend uses a layered architecture that generally supports **cross-user reuse**:
- `unstable_cache` tiers (explicit TTL windows) for hot and warm datasets
- React `cache()` memoization in request/server execution contexts
- durable snapshot families (`market_snapshot`) for snapshot-like reads
- session-epoch shared caches for Screener “Markets” style payloads

However, there is at least one **architecturally risky pattern**:
- **Extended Hours** includes an **uncached** EODHD delayed-quote fetch (`cache: "no-store"`), meaning provider burn can scale with per-user polling and per-invocation frequency.

### Overall EODHD cache health
Cache health is **good** in:
- Live Quotes: cached with `unstable_cache` revalidate windows
- Markets (Screener): shared epoch caching with a 15-minute segment and frozen mode
- Screener Key-Stat: long revalidate caching around `(metricId, tickersKey)`

Cache health is **riskier** in:
- Extended Hours delayed quote path: uncached delayed quote fetch per invocation

### Overall provider efficiency
Provider efficiency is **excellent** where:
- provider calls are wrapped in `unstable_cache` with short TTL and shared keys, and
- provider work is batched (e.g., Screener realtime batch by symbol list).

Provider efficiency is **not guaranteed** where:
- uncached delayed provider calls exist, or
- chart endpoints choose between cached and uncached branches based on runtime/session/ticker allowlists.

### Overall confidence
**High confidence** in the identified proven caching behaviors:
- Markets epoch caching (15m buckets, frozen mode)
- Stock Live spot caching tier (15s revalidate)
- Extended Hours delayed quote uncached behavior
- Notifications path is EODHD-free
- Screener key-stat route is cached for long durations

**Medium confidence** for flows where EODHD fan-out depends on:
- dynamic ticker sets (holdings/watchlist),
- intraday ranges,
- branch selection within chart logic, and
- cache-state of the underlying data slices.

### Top findings (proven)
1. **Extended Hours delayed quote** is uncached per invocation (`fetchEodhdUsQuoteDelayed` uses `cache: "no-store"`).
2. **Stock Live spot** is protected by `unstable_cache` with `REVALIDATE_STOCK_1D_LIVE_SPOT = 15s`.
3. **Screener Markets** uses shared epoch caching with a **15-minute live refresh window** and frozen mode outside regular hours.
4. **Notifications** use Supabase-only routes; no EODHD path in that request.
5. **Screener key-stat cells** are cached in `unstable_cache` with long revalidate (~12h) keyed by `(metricId, tickersKey)`.

## Architecture Overview

### Data flow diagram (Layered)

```text
Client (Web / iOS)
   |
   v
Finsepa internal /api/* (Next.js Route Handlers)
   |
   v
Internal loaders / services
   |-- caching layers:
   |      - unstable_cache (server data cache with explicit TTL)
   |      - React cache() (memoization / request-scoped or server-scoped caching)
   |      - durable snapshots (market_snapshot / snapshot blobs)
   |      - session epoch caches (Screener epoch)
   |
   v
Supabase snapshot reads (market_snapshot, minute stores)
   |
   v
External providers
   - EODHD (realtime, daily, delayed quote endpoints)
   - FRED / BLS / Shiller (macro, risk-free, etc. where applicable)
   - logo.dev (branding)
```

### Cache layers and how they affect EODHD scaling

#### `unstable_cache`
- Used widely for hot/warm tiers and for stable derived datasets.
- When keyed appropriately, **provider calls amortize across users**.

#### React `cache()`
- Memoizes function results based on arguments.
- Where bucket keys (e.g., “minute buckets”) are explicit, cross-user amortization is strong.

#### Durable snapshots (`market_snapshot`)
- When a flow reads from `market_snapshot`, it often avoids live provider calls at request time.

#### Uncached EODHD fetches (`fetch(..., cache: "no-store")`)
- These are the highest risk for EODHD scaling with active users because they can execute per invocation.

### In-flight dedupe and batching
Batching is explicit in several paths, notably Screener realtime batch symbol lists.
In-flight dedupe and concurrency limits exist in the market layer, but exact cross-user amortization depends on the specific loader and cache key.

## Flow-by-flow assessment (major flows)

For each flow:
- **Cold**: first user in a cache-miss / cache-epoch window
- **Warm**: subsequent user opens within the same cache window and cache entries exist

### Shared “cold/warm” interpretation caveat
“Warm” assumes:
- cache entries exist (for caches),
- eligibility gates are satisfied consistently (regular vs pre/post),
- and the user action triggers the same branch.

### 1) Markets (Screener Markets tab: stocks / crypto / indices / ETFs)

#### Overview
- Purpose: shared Screener market payload (top10 + page2 + crypto + indices, derived % metrics)

#### Architecture
- Request handlers for market-tab/companies/crypto-rows/indices call into `buildScreener*` payload builders
- Builders use `simple-market-layer.ts` and the shared `screener-us-market-cache.ts` epoch caching.

#### Internal API endpoints (representative)
- `GET /api/screener/market-tab`
- `GET /api/screener/companies`
- `GET /api/screener/crypto-rows`
- `GET /api/screener/indices`

#### External providers used
- **EODHD** (realtime symbols batch and daily screener bar fetches)

#### Cache layers
- Shared Screener US market epoch cache:
  - `lib/screener/screener-us-market-cache.ts`
  - live mode uses a 15-minute segment (`revalidateSec = REVALIDATE_SCREENER_MARKET_LIVE`)
  - frozen mode sets `revalidateSec: false`
- Provider batching:
  - `lib/market/simple-market-layer.ts` uses a batched realtime fetch: `fetchEodhdRealtimeSymbolsRaw(symbolList)`

#### Cache TTLs
- Live mode: 15-minute epoch bucket
- Frozen mode: revalidate disabled until next regular session

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**: exact EODHD call count depends on:
  - dynamic ticker list sizes (page-2 tickers come from `pickScreenerPage2Tickers(universe)`)
  - which slices are included for the requested Markets sub-tab state
  - per-symbol daily bar fetch fan-out in `simple-market-layer.ts`

#### Warm provider behavior
- **Warm EODHD requests**: **~0 additional** (provider calls should be amortized within the same epoch segment)
- **Reason (proven)**: epoch cache keys and revalidation windows are explicitly shared across users.

#### Does cost scale with users?
- **NO** (shared epoch caching reduces per-user provider burn)

#### Confidence
- **High** for warm “provider amortization”
- **Medium** for exact cold request count

#### Engineering verdict
**Excellent**

#### Why
Evidence-based reasons:
- shared epoch cache with 15-minute buckets and frozen mode
- batched realtime provider call structure exists in `simple-market-layer.ts`

#### Could this be responsible for a significant portion of EODHD calls?
**NO** (architecturally bounded by epoch cache)

---

### 2) Stock — Live Quotes (US equities spot, regular session)

#### Overview
- Purpose: header live spot price (and prior close) during regular session

#### Architecture
- `GET /api/stocks/[ticker]/live-price` calls `getStockSpotQuoteForApi(ticker)`
- For regular session, it uses:
  - `getStockSpotQuoteLiveSessionCached` (`unstable_cache` with 15s revalidate)
  - uncached fallback path fetches realtime and may fall back to delayed quote

#### Internal API endpoints
- `GET /api/stocks/[ticker]/live-price`

#### External providers used
- EODHD realtime
- EODHD delayed quote (conditional)

#### Cache layers
- `unstable_cache` with `REVALIDATE_STOCK_1D_LIVE_SPOT = 15s`
- optional minute-store enhancement reads from Supabase/WS minute store (provider calls are conditional)

#### Cache TTLs
- **15 seconds** for live spot unstable cache

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**:
  - the uncached path can call either:
    - realtime only, or
    - realtime + delayed quote (depends on runtime freshness checks like `isEodhdUsRealtimeFresh` and `isEodhdUsQuoteDelayedFresh`)
  - if both are unusable, it can fall back into chart points loaders which can trigger additional provider calls depending on ticker/session.

#### Warm provider behavior
- **Warm EODHD requests**: `~0 additional` per ticker within the 15s unstable_cache window

#### Does cost scale with users?
- **NO (mostly)** for warm opens within TTL

#### Confidence
- **High** for warm “0 additional provider” property
- **Medium** for cold exact count

#### Engineering verdict
**Good**

#### Why
- live spot is protected by `unstable_cache` revalidate windows

#### Could this be responsible for significant EODHD calls?
**UNKNOWN** (depends on how often users view distinct tickers and cache-miss boundaries)

---

### 3) Stock — Extended Hours (pre/post header quote)

#### Overview
- Purpose: dual extended-hours quote and move vs regular close

#### Architecture
- `GET /api/stocks/[ticker]/extended-hours` calls:
  - `getStockExtendedHoursQuoteForApi(...)`
  - which calls:
    - `resolveUsEquityLiveRegularSessionActive(...)` (realtime probe)
    - `getStockPerformance(sym)` (daily performance anchor)
    - `fetchEodhdUsQuoteDelayed(ticker)` inside `buildStockExtendedHoursHeaderQuote(...)`

#### Internal API endpoints
- `GET /api/stocks/[ticker]/extended-hours`

#### External providers used (provable)
- EODHD realtime (probe)
- EODHD daily bars (performance)
- EODHD delayed quote (extended hours)

#### Cache layers
- Realtime probe:
  - cached by React `cache()` bucketing per minute
- Daily performance:
  - cached via `unstable_cache` (revalidate **~60s**)
- Delayed quote:
  - **explicitly uncached**: `fetch(..., cache: "no-store")`

#### Cache TTLs
- Delayed quote: none (no-store)
- Realtime probe: minute-bucket cached
- Performance anchor: ~60s unstable_cache tier

#### Cold provider behavior
- **Cold EODHD requests**: **exact = 3 per eligible invocation**
  - proof: realtime probe fetch, performance daily fetch, delayed quote fetch all execute in the eligibility path.

#### Warm provider behavior
- **Warm EODHD requests**: **exact = 1 additional per eligible invocation**
  - proof: delayed quote is uncached, so it always executes
  - realtime + performance are cached in their respective TTL windows

#### Does cost scale with users?
- **YES**, because delayed quote is uncached and executed per invocation

#### Confidence
- **High**

#### Engineering verdict
**Critical**

#### Why
Direct code evidence:
- delayed quote uses uncached `fetch(..., cache:"no-store")` in `fetchEodhdUsQuoteDelayed`

#### Could this be responsible for significant portion of EODHD calls?
**YES**

---

### 4) Stock — Stock Charts (1D live and prior-session)

#### Overview
- Purpose: chart points for stock ranges / series

#### Architecture
- `GET /api/stocks/[ticker]/chart` chooses branches based on:
  - range/series
  - live minute allowlists and session
  - prior-session vs live tail selection
- Branches include:
  - `getStockChartPoints1DPriorSession` (`unstable_cache`)
  - `getStockChartPoints` (`unstable_cache`)
  - `loadStockChartPointsUncached` in live branches

#### Internal API endpoints
- `GET /api/stocks/[ticker]/chart?range=...&series=...`

#### External providers used
- EODHD daily bars and/or intraday bars depending on branch

#### Cache layers
- `unstable_cache` for some chart paths
- live branches may use uncached loaders depending on ticker/session

#### Cache TTLs
- Prior-session: STATIC_DAY-like tier (~24h class) via unstable_cache
- Hot chart caches: REVALIDATE_HOT (~60s class) via unstable_cache
- Live uncached branches: NO route-level caching guarantee (branch dependent)

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**: provider fan-out depends on runtime branch selection and on whether live minute pipelines use WS-minute store vs REST intraday/daily fallbacks.

#### Warm provider behavior
- **Warm EODHD requests**: `UNKNOWN`

#### Does cost scale with users?
- **UNKNOWN** (branch dependent; may amortize across shared caches for some branches, and not for live uncached branches)

#### Confidence
- **Low–Medium**

#### Engineering verdict
**Needs Improvement**

#### Why
- Branch complexity + uncached live loaders can prevent reliable provider amortization.

#### Could this be responsible for significant EODHD calls?
**UNKNOWN**

---

### 5) Portfolio Overview

#### Overview
- Purpose: portfolio overview cards + key metrics

#### Architecture (high level)
- Uses portfolio overview market payload builder and shared portfolio EOD bar loader
- Bar loader is designed for dedupe and caching; computed series may still recompute

#### Internal API endpoints
- `POST /api/portfolio/overview-market`
- `POST /api/portfolio/analytics`
- `GET /api/portfolio/workspace` (bootstrap)
- `POST /api/portfolio/benchmark-compare` (overview compare)

#### External providers used
- EODHD (daily bars + fundamentals aggregation)
- FRED / Shiller (risk/benchmark components) where used

#### Cache TTLs
- UNKNOWN exact TTL coverage for all portfolio sub-fields without further code deep-dive

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**:
  - depends on holdings ticker set size
  - depends on whether bar cache entries exist for those tickers
  - depends on which computed analytics steps require fresh provider reads vs cached daily bars

#### Warm provider behavior
- **Warm EODHD requests**: `UNKNOWN`

#### Does cost scale with users?
- Likely **PARTIALLY** (underlying daily bars amortize; computed layers may recompute)

#### Confidence
- **Medium–Low**

#### Engineering verdict
**Needs Improvement** (due to computed-series recomputation risk, not because underlying daily bars are uncached)

#### Could this be responsible for significant EODHD calls?
**UNKNOWN**

---

### 6) Portfolio History

#### Overview
- Purpose: value history and chart series (range-dependent)

#### Internal API endpoints
- `POST /api/portfolio/value-history`
- `GET /api/portfolio/benchmark-history`
- `POST /api/portfolio/period-returns`

#### External providers
- EODHD daily bars
- EODHD intraday bars (range dependent)
- Benchmark compare likely uses EODHD daily bars for indices/benchmarks

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**: intraday helper behavior depends on selected range and data availability for the requested windows.

#### Warm provider behavior
- **Warm EODHD requests**: `UNKNOWN`

#### Does cost scale with users?
- **UNKNOWN**

#### Confidence
- **Low–Medium**

#### Engineering verdict
**Needs Improvement**

---

### 7) Portfolio Analytics

#### Overview
- Purpose: portfolio risk/return analytics computations

#### Internal API endpoints
- `POST /api/portfolio/analytics`

#### External providers
- EODHD (daily bars + fundamentals-derived aggregates)
- FRED and Shiller likely for risk-free and valuation benchmarks

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**: depends on portfolio holdings universe size and which risk series require computations not fully memoized.

#### Warm provider behavior
- **Warm EODHD requests**: `UNKNOWN`

#### Does cost scale with users?
- **UNKNOWN**

#### Confidence
- **Low–Medium**

#### Engineering verdict
**Needs Improvement**

---

### 8) Watchlist

#### Overview
- Purpose: watchlist base + enriched rows for display

#### Internal API endpoints
- `GET /api/watchlist`
- `POST /api/watchlist/enrich`
- Snapshot CRUD and sync routes (mutations)

#### External providers
- EODHD (via enrichment stack where missing ticker data is required)

#### Cache layers
- Durable snapshot layer (`market_snapshot`) and shared market enrichment cache exists
- Client in-flight dedupe exists (prevents duplicate concurrent client fetch)

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**: depends on watchlist membership size and which tickers are missing from snapshot coverage for enrichment.

#### Warm provider behavior
- **Warm EODHD requests**: `UNKNOWN`

#### Does cost scale with users?
- **PARTIALLY / UNKNOWN**: base snapshot reuse likely amortizes, enrichment misses can still scale with unique tickers.

#### Confidence
- **Low–Medium**

#### Engineering verdict
**Needs Improvement**

---

### 9) Search

#### Overview
- Purpose: global asset search + recent search sync

#### Internal API endpoints
- `GET /api/search`
- `GET /api/search/recent`

#### External providers
- EODHD search endpoints (remote) for parts that cannot be satisfied by local registries

#### Cache layers
- `unstable_cache` exists around normalized search results
- TTL tier driven by cache-policy

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**: depends on query normalization, scope thresholds, and cache hit state.

#### Warm provider behavior
- **Warm EODHD requests**: likely reduced, but exact count depends on cache keys.

#### Does cost scale with users?
- **NO / PARTIALLY** depending on query uniqueness distribution.

#### Confidence
- **Low–Medium**

#### Engineering verdict
**Good** (structure exists for provider amortization)

---

### 10) News

#### Overview
- Purpose: news feeds/cards and richer news variants

#### Internal API endpoints
- `GET /api/stocks/[ticker]/news` (and related news routes)

#### External providers
- EODHD news endpoints

#### Cache layers
- Cache-control tiering exists in cache-policy for news
- Exact TTL/unstable_cache usage differs by route variant

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**: depends on variant richness (images vs no images, paging), and cache hit state.

#### Warm provider behavior
- **Warm EODHD requests**: `UNKNOWN`

#### Does cost scale with users?
- **UNKNOWN**

#### Confidence
- **Low**

#### Engineering verdict
**Needs Improvement**

---

### 11) Macro

#### Overview
- Purpose: macro dashboard series

#### Internal API endpoints
- `GET /api/macro`

#### External providers
- EODHD macro series
- FRED / BLS / Shiller and others for macro indicators

#### Cache layers
- Snapshot-first design with `market_snapshot` hub.
- fallback rebuild uses cached tiers.

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`
- **Why UNKNOWN**: depends on whether the hub snapshot is present/stale, and on how many macro series are rebuilt in fallback.

#### Warm provider behavior
- **Warm EODHD requests**: likely reduced but exact depends on snapshot validity.

#### Does cost scale with users?
- **NO / UNKNOWN**: snapshot-first suggests reuse, but fallback recomputation can still happen.

#### Confidence
- **Low–Medium**

#### Engineering verdict
**Needs Improvement**

---

### 12) Superinvestors

#### Overview
- Purpose: snapshot-backed superinvestors list/profile/activity; performance charts reconstruct from historical series

#### Internal API endpoints
- `GET /api/superinvestors/[slug]/transactions`
- `GET /api/superinvestors/[slug]/performance`
- `GET /api/stocks/[ticker]/superinvestors`

#### External providers
- SEC-derived sources via cron/ops paths
- EODHD for performance reconstruction if not fully snapshot-backed

#### Cache layers
- Snapshot-first design for UI reads

#### Cold provider behavior
- **Cold EODHD requests**: `UNKNOWN`

#### Warm provider behavior
- **Warm EODHD requests**: `UNKNOWN`

#### Does cost scale with users?
- **UNKNOWN**

#### Confidence
- **Low**

#### Engineering verdict
**Good**

---

### 13) Notifications

#### Overview
- Purpose: notifications inbox + unread badge

#### Internal API endpoints
- `GET /api/notifications`
- `GET /api/notifications?count=1`
- mutation routes for read/delete

#### External providers
- EODHD: **none**

#### Cache layers
- Supabase-only reads; caching is not an EODHD topic here.

#### Cold provider behavior
- **Cold EODHD requests**: `0`

#### Warm provider behavior
- **Warm EODHD requests**: `0`

#### Does cost scale with users?
- No EODHD cost.

#### Confidence
- **High**

#### Engineering verdict
**Excellent**

---

## Cross-flow comparison

| Flow | Cold | Warm | Shared Cache | TTL | Scales with Users | Confidence | Verdict |
|---|---|---|---|---|---|---|---|
| Markets (Screener Markets tab) | UNKNOWN | ~0 additional | YES (epoch cache) | 15m live bucket; frozen outside regular | NO | Medium–High | Excellent |
| Stock Live Quotes | UNKNOWN | ~0 additional | YES (`unstable_cache` per ticker) | 15s | NO (mostly) | Medium–High | Good |
| Stock Extended Hours | **3** (per eligible invocation) | **1** (per eligible invocation) | PARTIAL (realtime/performance cached; delayed quote uncached) | delayed: none; realtime: minute bucket; performance: ~60s | YES | High | Critical |
| Stock Charts | UNKNOWN | UNKNOWN | PARTIAL (depends on branch) | branch-dependent | UNKNOWN | Low–Medium | Needs Improvement |
| Screener Key-stat metric cells | UNKNOWN | ~0 additional (cache hits) | YES (`unstable_cache` route) | ~12h | NO (for warm keys) | Medium | Acceptable |
| Notifications | 0 | 0 | N/A | N/A | NO | High | Excellent |
| Portfolio (overview) | UNKNOWN | UNKNOWN | PARTIAL (daily bars cached; computed layers variable) | UNKNOWN | UNKNOWN | Low–Medium | Needs Improvement |
| Portfolio (history) | UNKNOWN | UNKNOWN | PARTIAL | UNKNOWN | UNKNOWN | Low–Medium | Needs Improvement |
| Watchlist | UNKNOWN | UNKNOWN | PARTIAL | UNKNOWN | UNKNOWN | Low–Medium | Needs Improvement |
| Search | UNKNOWN | UNKNOWN | PARTIAL | ~90s tier exists | UNKNOWN | Low–Medium | Good |
| News | UNKNOWN | UNKNOWN | PARTIAL | UNKNOWN | UNKNOWN | Low | Needs Improvement |
| Macro | UNKNOWN | UNKNOWN | PARTIAL (hub snapshot) | UNKNOWN | UNKNOWN | Low–Medium | Needs Improvement |
| Superinvestors | UNKNOWN | UNKNOWN | PARTIAL (snapshot-forward) | UNKNOWN | UNKNOWN | Low | Good |

## Production Readiness (architecture capability only)

### Capability claims
This backend design can support large DAU **only if** the expensive provider burn remains:
- **amortized across users** via `unstable_cache` tiers / shared epoch caches / snapshots
- **bounded** by explicit TTLs and/or snapshot validity windows

### Architectural risk areas
Flows containing **uncached provider fetches executed per eligible invocation** are the largest risk:
- Stock Extended Hours delayed quote path is explicitly uncached and therefore can scale with user concurrency.

### Scaling discussion by tier type
1. Shared-epoch / snapshot-first flows (Markets) are structurally scalable.
2. TTL-cached flows (Stock live spot, key-stat route) are structurally scalable assuming warm cache hit rates remain high.
3. Branchy/uncached chart live paths and computed-series paths require runtime measurements because exact provider fan-out depends on session/ticker/range availability.
4. Snapshot-forward flows (Portfolio/Watchlist/Superinvestors) likely scale well for daily bars, but intraday/range-dependent paths require validation.

## Proven Findings (code-supported only)
1. **Extended-hours delayed quote is uncached**: `fetchEodhdUsQuoteDelayed` uses `fetch(..., cache: "no-store")`.
2. **Extended-hours invokes three EODHD sources on eligible requests**:
   - realtime probe fetch
   - daily performance fetch
   - delayed quote fetch
3. **Stock live spot is server-cached**:
   - `REVALIDATE_STOCK_1D_LIVE_SPOT = 15s`
   - wrapped by `unstable_cache` in `getStockSpotQuoteLiveSessionCached(...)`
4. **Markets uses shared epoch caching**:
   - live mode refresh bucket = 15 minutes
   - frozen mode disables revalidation
5. **Screener key-stat route caches long-term**:
   - `companies-key-stat` route uses `unstable_cache` with a long revalidate window keyed by `(metricId, tickersKey)`
6. **Notifications do not use EODHD**:
   - `app/api/notifications/route.ts` executes Supabase-only functions (count/list/patch/delete routes)

## Unknowns
These items cannot be answered precisely by static analysis alone:
1. **Exact cold provider request counts** for flows whose provider fan-out depends on runtime-selected ticker sets:
   - Screener Markets: `page2Tickers` chosen by universe + selected tab slice state
   - Watchlist enrichment: number of missing/enriched tickers for the user’s membership
   - Portfolio: number of holdings and whether intraday-heavy history computations are selected
2. **Exact EODHD fan-out for Stock Charts**:
   - branch selection depends on ticker allowlists and session state
   - live minute paths can fall back to REST intraday/daily based on data availability
3. **Warm-open exact provider deltas**:
   - depends on whether the relevant cache keys already exist (cache state at time of request)
4. **Cache hit rates under real traffic**:
   - “warm” is not guaranteed without measuring whether multiple deployments and autoscaling nodes reduce cache sharing.

### What runtime measurement is required
To resolve UNKNOWNs, you need runtime instrumentation of:
- outbound EODHD HTTP counts per flow and per cache scope
- top internal endpoints (EODHD can’t be reliably attributed without provider trace)
- cache hit/miss rates for each critical `unstable_cache` key
- branch selection rate (e.g., chart live vs prior-session paths)

The repository already contains EODHD provider tracing scaffolding (see `lib/market/provider-trace.ts`), which should be the basis for runtime measurement.

## Final Verdict

### What is already excellent
- **Markets (Screener Markets tab)**: shared epoch caching is structurally correct for cross-user reuse.
- **Notifications**: EODHD cost is proven to be zero.

### What is acceptable
- **Stock Live Quotes**: provider burn is bounded by a 15-second server cache tier, though cold-fan-out is runtime-dependent.
- **Screener Key-stat**: long-lived route caching is designed to amortize across users for identical metric/ticker keys.

### What is architecturally risky
- **Stock Extended Hours**: delayed quote is explicitly uncached (`cache:"no-store"`), so provider burn can scale with how often extended-hours is built for active users.
- **Stock Charts live branches**: branch complexity and potential uncached loaders mean precise provider fan-out needs runtime validation.

### What requires runtime validation
All flows whose provider fan-out depends on dynamic inputs and runtime branches:
- Portfolio (especially intraday history)
- Watchlist enrichment missing tickers
- Macro rebuild frequency on hub snapshot invalidation
- Superinvestors performance reconstruction paths
- Search/news variants that trigger different feed richness/paging behavior

