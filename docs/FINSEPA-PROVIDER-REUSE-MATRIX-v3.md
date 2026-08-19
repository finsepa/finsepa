# Finsepa Backend Provider Architecture Audit v3

## Purpose

This document maps **provider-backed datasets** — not product flows or API routes — showing how external provider work (primarily EODHD, plus FRED, BLS, Shiller, SEC, Logo.dev) is fetched, cached, shared across users, and whether provider cost scales with DAU.

This is NOT an optimization audit.
This is NOT a performance audit.
This is NOT an implementation task.

### Core question

> If Finsepa grows from 1 user to 100,000 users, which provider-backed datasets are already architected correctly, and which datasets still create new provider work as DAU grows?

---

## Extremely Important Rules

- Do NOT estimate provider request counts.
- Do NOT invent numbers.
- Do NOT use probabilistic or approximation wording.
- If something cannot be proven from static code analysis, write **UNKNOWN** and explain exactly why.
- Never convert provider function calls into provider HTTP request counts.
- Never guess runtime behavior.
- Never recommend optimizations.
- Never write TODO items.
- This document is evidence only.

---

## Dataset Index

1. [Live Quotes](#1-live-quotes)
2. [Extended Hours](#2-extended-hours)
3. [Daily Bars](#3-daily-bars)
4. [Intraday Bars](#4-intraday-bars)
5. [Fundamentals](#5-fundamentals)
6. [Key Statistics](#6-key-statistics)
7. [Company Profile](#7-company-profile)
8. [Search](#8-search)
9. [News](#9-news)
10. [Macro Dashboard](#10-macro-dashboard)
11. [Superinvestor Data](#11-superinvestor-data)
12. [Portfolio Benchmark EOD Bars](#12-portfolio-benchmark-eod-bars)
13. [Risk-Free Rate (FRED)](#13-risk-free-rate-fred)
14. [Watchlist Enrichment](#14-watchlist-enrichment)
15. [Earnings Notifications (Ingest)](#15-earnings-notifications-ingest)
16. [Market Snapshots (Screener / Markets)](#16-market-snapshots-screener--markets)
17. [Asset Snapshots (Stock Page)](#17-asset-snapshots-stock-page)
18. [Dividends](#18-dividends)
19. [Stock Splits](#19-stock-splits)
20. [Insider Transactions](#20-insider-transactions)
21. [Economic Events](#21-economic-events)
22. [Earnings Calendar (UI)](#22-earnings-calendar-ui)
23. [Logos (Logo.dev)](#23-logos-logodev)
24. [Portfolio Overview Market](#24-portfolio-overview-market)
25. [User Notifications (Read Path)](#25-user-notifications-read-path)

---

## 1. Live Quotes

### Dataset Overview

**Purpose:** Spot USD price, optional previous close, and quote timestamp for stock headers, live-price polling, crypto headers, and portfolio live quote paths.

**Provider(s):** EODHD — `real-time/{symbol}`, `us-quote-delayed`; Supabase `stock_session_minute_bar` / `crypto_session_minute_bar` (WS-derived, not EODHD).

**Entry points:**
- `GET /api/stocks/[ticker]/live-price` → `getStockSpotQuoteForApi`
- `GET /api/crypto/[symbol]/live-price` → `getCryptoLiveSpotForHeader` or `getCryptoLiveSpotPriceUsd`
- SSR: `loadStockPageInitialData` → `getStockSpotQuoteForApi`
- SSR: `loadCryptoPageHotFields`

**Main loaders:**
- `lib/market/stock-chart-data.ts` — `getStockSpotQuoteForApi`, `fetchStockSpotQuoteUncached`
- `lib/market/eodhd-realtime.ts` — `fetchEodhdUsRealtime`, `fetchEodhdRealtimeSymbolsRaw`
- `lib/market/eodhd-us-quote-delayed.ts` — `fetchEodhdUsQuoteDelayed`
- `lib/market/crypto-live-spot-fresh.ts` — `getCryptoLiveSpotForHeader`
- `lib/market/crypto-live-price.ts` — `getCryptoLiveSpotPriceUsd`

**Main API routes:** `/api/stocks/[ticker]/live-price`, `/api/crypto/[symbol]/live-price`

---

### Call Graph

**US equities — regular session:**

```
GET /api/stocks/[ticker]/live-price
  → getStockSpotQuoteForApi(ticker)
    → getStockSpotQuoteLiveSessionCached(ticker)          [unstable_cache, 15s]
      → fetchStockSpotQuoteUncached(ticker)
        → fetchEodhdUsRealtime(sym)                         [React cache() per request]
          → traceEodhdHttp → fetchEodhd → GET eodhd.com/api/real-time/{symbol}
        → [if not fresh] fetchEodhdUsQuoteDelayed(sym)
            → GET eodhd.com/api/us-quote-delayed
    → [if base.price null] enhanceLiveSpotQuoteWithMinuteStore
        → Supabase stock_session_minute_bar + in-process memory
```

**US equities — non-regular session:**

```
getStockSpotQuoteForApi
  → getStockSpotQuoteCached(ticker)                       [unstable_cache, 60s]
    → fetchStockSpotQuoteUncached
      → load1DChartPoints → [intraday / EOD / WS paths]
```

**Crypto BTC live-1D:**

```
GET /api/crypto/[symbol]/live-price
  → getCryptoLiveSpotForHeader
    → fetchLatestCryptoMinuteBarFromDb                      [Supabase]
    → fetchEodhdRealtimeSymbolsRaw                          [no-store HTTP]
    → fetchEodhdIntraday (1m, 5m)
    → getCryptoPerformance                                  [unstable_cache, 60s]
```

---

### Provider Reuse

**YES** (US regular-session spot per ticker via `unstable_cache` 15s)
**PARTIALLY** (crypto BTC live header has no server `unstable_cache` on the fresh path)
**PARTIALLY** (US non-regular spot per ticker via `unstable_cache` 60s)

Explanation: `getStockSpotQuoteLiveSessionCached` uses cross-user `unstable_cache` keyed by ticker with `REVALIDATE_STOCK_1D_LIVE_SPOT` (15s). `cache-policy.ts` documents coalescing EODHD realtime across users on the same ticker. `getCryptoLiveSpotForHeader` has no `unstable_cache` wrapper on its fresh provider path; `getCryptoPerformance` (60s) is shared.

---

### Shared Cache Layers

- `unstable_cache` — `getStockSpotQuoteLiveSessionCached` (15s), `getStockSpotQuoteCached` (60s)
- React `cache()` — `fetchEodhdUsRealtimePerRequest` (per RSC request dedupe)
- In-process memory — `globalThis.__finsepaStockSessionMinuteBars`
- Supabase — `stock_session_minute_bar`, `crypto_session_minute_bar`
- `unstable_cache` — `getCryptoPerformance` (60s)
- EODHD hourly budget gate — `traceEodhdHttp` → `tryConsumeEodhdRequestSlot()` (`lib/market/eodhd-hourly-budget.ts`)
- HTTP `Cache-Control` — `CACHE_CONTROL_PRIVATE_NO_STORE` (regular session), `CACHE_CONTROL_PRIVATE_HOT` (non-regular, 60s s-maxage)

---

### Cache Keys

| Layer | Exact key / tag | TTL |
|-------|-----------------|-----|
| `unstable_cache` (US regular) | `["stock-spot-quote-1d-live-v11-minute-store"]` + `ticker` arg | `REVALIDATE_STOCK_1D_LIVE_SPOT` = **15s** |
| `unstable_cache` (US non-regular) | `["stock-spot-quote-v1"]` + `ticker` arg | `REVALIDATE_HOT` = **60s** |
| `unstable_cache` (crypto performance) | `["crypto-performance-v4-annual-returns"]` + symbol | **60s** |
| React `cache()` | per-symbol, per RSC request | request lifetime |
| Provider HTTP | `fetchEodhd` | `cache: "no-store"` at provider layer |

Freshness constants (not TTL caches): `EODHD_LIVE_QUOTE_MAX_AGE_SEC = 180`, `EODHD_LIVE_QUOTE_DISPLAY_MAX_AGE_SEC = 1800`, `MINUTE_STORE_SPOT_MAX_AGE_SEC = 90`, crypto WS `WS_FRESHNESS_SEC = 300`.

---

### Cache Invalidation

- TTL expiry on `unstable_cache` windows (15s / 60s)
- Ticker change → new cache key
- US market session change → branch switch between live-session cache (15s) and standard cache (60s)
- Minute-store enhancement reads current DB rows (no TTL on DB; freshness gated by `MINUTE_STORE_SPOT_MAX_AGE_SEC`)
- EODHD hourly budget rejection → provider call skipped (not a cache invalidation; gate only)

---

### Cross-user Sharing

| Sub-path | Value | Why |
|----------|-------|-----|
| US spot (regular) | **YES** | `unstable_cache` keyed by ticker, 15s, documented cross-user coalescing |
| US spot (non-regular) | **YES** | `unstable_cache` keyed by ticker, 60s |
| US minute-store tail | **PARTIALLY** | Supabase WS bars shared; enhancement applied per request |
| Crypto BTC live header | **NO** | No `unstable_cache` on fresh provider path |
| Crypto non-BTC | **PARTIALLY** | `getCryptoPerformance` shared 60s; realtime/intraday uncached per request |

---

### Runtime Dependency

**YES**

Runtime variables preventing static proof:
- Client polling interval for `/api/stocks/[ticker]/live-price` (not enumerated in backend code)
- US market session state (`regular` vs `pre`/`post`/`closed`) determines cache branch
- EODHD realtime freshness acceptance (`isEodhdUsRealtimeAcceptableForDisplay`) depends on provider response timestamps
- Whether minute-store enhancement activates depends on base quote null vs non-null at request time
- EODHD hourly budget slot availability at request time

---

### DAU Scaling

| Sub-path | Value | Why |
|----------|-------|-----|
| US regular spot | **PARTIALLY** | Per-ticker 15s coalescing; each unique ticker still triggers provider on cache miss |
| US non-regular | **PARTIALLY** | 60s coalescing per ticker |
| Crypto BTC live | **YES** | No server cache on fresh path; provider work per API request |
| Crypto portfolio path | **PARTIALLY** | Performance layer 60s shared; realtime/intraday per request |

---

### Architecture Rating

**Good**

Justification: US regular-session spot uses explicit cross-user `unstable_cache` (15s) with request-scoped React dedupe and hourly budget gate. Crypto BTC live header bypasses server cache on the fresh provider path. Architecture is layered but not uniform across asset classes.

---

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | PARTIALLY |
| Runtime dependent | YES |
| Requires provider every request | PARTIALLY (crypto BTC live: YES; US regular spot: NO within 15s window) |
| Snapshot backed | NO |
| Cached | YES (US spot); PARTIALLY (crypto) |
| Confidence | High (US spot cache paths); Medium (crypto live path; client poll frequency UNKNOWN) |
| Architecture Rating | Good |

---

## 2. Extended Hours

### Dataset Overview

**Purpose:** Dual-column stock header outside US regular session: prior/regular close plus live extended-hours price for pre/post market.

**Provider(s):** EODHD `us-quote-delayed`; EODHD daily EOD (via `getStockPerformance`); EODHD realtime + intraday 1m (holiday detection only).

**Entry points:**
- `GET /api/stocks/[ticker]/extended-hours` → `getStockExtendedHoursQuoteForApi`
- Client poll: `components/stock/stock-page-content.tsx` (~60s per loader comment)

**Main loaders:**
- `lib/market/stock-extended-hours-header.ts`
- `lib/market/eodhd-us-quote-delayed.ts`
- `lib/market/stock-performance.ts`
- `lib/market/us-equity-live-session-server.ts`

**Main API routes:** `/api/stocks/[ticker]/extended-hours`

---

### Call Graph

```
GET /api/stocks/[ticker]/extended-hours
  → getStockExtendedHoursQuoteForApi(ticker, meta, sessionCloseUsd?)
    → resolveUsEquityLiveRegularSessionActive(sym, now)    [React cache(), 1-min bucket]
      → fetchEodhdUsRealtime(ticker)
      → isTodayUsSessionIntradayAbsent → fetchEodhdIntraday(ticker, ..., "1m")
    → getStockPerformance(sym)                             [unstable_cache, 60s]
      → fetchEodhdEodDaily(sym, from, to)
    → buildStockExtendedHoursHeaderQuote
      → fetchEodhdUsQuoteDelayed(ticker)                   [no-store, no unstable_cache]
        → GET eodhd.com/api/us-quote-delayed
```

Loader comment (`stock-extended-hours-header.ts` L389): "~60s client poll — always fetch a fresh provider row (no cross-user quote cache)."

---

### Provider Reuse

**PARTIALLY**

Explanation: Extended-hours delayed quote fetch is intentionally uncached per request. Close anchor (`getStockPerformance`, 60s) and live-session-active check (React `cache()` with 1-minute bucket) are shared/deduped.

---

### Shared Cache Layers

- None on `fetchEodhdUsQuoteDelayed` (explicit no-cache design)
- `unstable_cache` — `getStockPerformance` tag `["stock-performance-v8-annual-year-fallback"]` + ticker, **60s**
- React `cache()` — `resolveUsEquityLiveRegularSessionActiveCached` (1-minute time bucket)
- React `cache()` — `fetchEodhdUsRealtimePerRequest`
- HTTP `Cache-Control` — `CACHE_CONTROL_PRIVATE_HOT` (60s s-maxage, 120s SWR)

---

### Cache Keys

| Layer | Key | TTL |
|-------|-----|-----|
| `unstable_cache` (performance) | `["stock-performance-v8-annual-year-fallback"]` + ticker | **60s** |
| React `cache()` (session active) | `(ticker, bucketMs)` where `bucketMs = floor(now/60000)*60000` | 1-minute bucket |
| Delayed quote | none | per-request |

---

### Cache Invalidation

- Delayed quote: every API request (no cache)
- Performance anchor: 60s TTL expiry or ticker change
- Session-active check: 1-minute bucket rollover
- Returns `null` during regular session (`buildStockExtendedHoursHeaderQuote`)

---

### Cross-user Sharing

**PARTIALLY**

Explanation: `fetchEodhdUsQuoteDelayed` is uncached per request. `getStockPerformance` (60s) and session-active React cache are cross-user within their windows.

---

### Runtime Dependency

**YES**

Runtime variables:
- US market session (`regular` → returns null)
- Client poll interval (~60s documented in loader comment; exact restart behavior UNKNOWN)
- EODHD delayed quote row freshness at request time
- Whether ticker is US-equity extended-hours eligible

---

### DAU Scaling

**YES**

Explanation: Each client poll triggers a fresh `us-quote-delayed` HTTP call per ticker per user request. Performance anchor is shared at 60s per ticker globally; delayed quote path scales with concurrent poll requests.

---

### Architecture Rating

**Needs Improvement**

Justification: Extended-hours provider row is intentionally uncached while client polls at ~60s. Close anchor is cached. Architecture separates freshness (delayed quote) from anchor (EOD performance) but delayed-quote path creates per-request provider work.

---

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | PARTIALLY |
| Runtime dependent | YES |
| Requires provider every request | YES (delayed quote); NO (performance anchor within 60s) |
| Snapshot backed | NO |
| Cached | PARTIALLY (anchor only) |
| Confidence | High |
---

## 3. Daily Bars

### Dataset Overview

**Purpose:** Daily EOD adjusted closes for stock charts (5D fallback through ALL), performance tables, portfolio analytics/history/benchmarks, superinvestor performance, SSR stock page overview, screener frozen-session quotes, extended-hours close anchors.

**Provider(s):** EODHD `GET /api/eod/{symbol}?period=d` (`fetchEodhdEodDaily`, `fetchEodhdEodDailyScreener`, `fetchEodhdEodDailyRetry`); EODHD crypto daily (`fetchEodhdCryptoDailyBars`).

**Entry points:**
- `loadPortfolioSymbolEodBars` / `loadPortfolioEodBars` — portfolio routes
- `getStockPerformance` — stock header, watchlist, portfolio overview
- `getStockChartPoints` — chart routes
- `loadStockPageInitialDataUncached` — SSR cold miss
- `fetchEodhdEodDailyScreener` — screener frozen session
- `GET /api/stocks/[ticker]/price-on-date` — direct uncached fetch

**Main loaders:**
- `lib/market/eodhd-eod.ts`
- `lib/portfolio/data/load-portfolio-eod-bars.ts`
- `lib/market/stock-chart-data.ts`
- `lib/market/stock-performance.ts`

**Main API routes:** `/api/stocks/[ticker]/chart`, `/api/portfolio/*`, `/api/stocks/[ticker]/price-on-date`

---

### Call Graph

**Portfolio (canonical path):**

```
loadPortfolioSymbolEodBars(sym, fromYmd, toYmd, opts?)
  → portfolioEodBarsCacheKey({route, providerSymbol, fromYmd, toYmd, retry})
  → withInflight(cacheKey)                              [in-process Map]
    → getCachedEquityBars / getCachedCryptoBars         [unstable_cache, 60s]
      → fetchEodhdEodDaily / fetchEodhdEodDailyRetry / fetchEodhdCryptoDailyBars
        → traceEodhdHttp → fetchEodhd (no-store) → GET eodhd.com/api/eod/{symbol}
```

**Stock chart (e.g. 5Y):**

```
GET /api/stocks/[ticker]/chart
  → getStockChartPointsForApi → getStockChartPoints     [unstable_cache, 60s]
    → load5YChartPoints → fetchEodhdEodDaily
```

**Screener frozen session:**

```
fetchEodhdEodDailyScreener
  → readScreenerEodBarsSnapshot(sym)                    [Supabase market_snapshot]
  → fetchEodhd(url, { next: { revalidate: 300 } })
  → upsertScreenerEodBarsSnapshot
```

---

### Provider Reuse

**YES**

Explanation: `load-portfolio-eod-bars.ts` documents identical `(symbol, from, to, retry)` requests sharing one EODHD fetch via `unstable_cache` + in-flight dedupe. `getStockPerformance` and `getStockChartPoints` wrap raw fetches in 60s `unstable_cache`. Screener EOD uses Supabase `market_snapshot` keyed by symbol + epoch segment.

---

### Shared Cache Layers

- `unstable_cache` — portfolio equity `["portfolio-eod-equity-bars-v1"]`, crypto `["portfolio-eod-crypto-bars-v1"]`, **60s**
- In-flight dedupe — `Map<string, Promise>` in `load-portfolio-eod-bars.ts`
- `unstable_cache` — `["stock-performance-v8-annual-year-fallback"]` + ticker, **60s**
- `unstable_cache` — `["stock-chart-points-v34-ws-minute-only"]` + `(ticker, range, series)`, **60s**
- `unstable_cache` — `["stock-chart-superinvestor-holding-daily-v1"]`, **86400s**
- `unstable_cache` — `["stock-chart-1d-prior-session-v10-session-ymd"]`, **86400s**
- Supabase `market_snapshot` — screener EOD bars key `screener_eod_bars_{SYMBOL}`, segment `screener_eod_bars_v1:{epoch.segment}`
- Next.js fetch hint — `fetchEodhdEodDailyScreener` → `next: { revalidate: 300 }`
- Supabase `asset_snapshot` — stores performance derived from daily bars (segment from screener epoch)

---

### Cache Keys

| Layer | Key | TTL |
|-------|-----|-----|
| Portfolio equity | tag `["portfolio-eod-equity-bars-v1"]` + args `(cacheKey, providerSymbol, fromYmd, toYmd, retryFlag)` | **60s** |
| Portfolio crypto | tag `["portfolio-eod-crypto-bars-v1"]` + same arg shape | **60s** |
| Explicit cache key string | `portfolio-eod-bars-v1\|{equity\|crypto}\|{providerSymbol}\|{fromYmd}\|{toYmd}\|{r0\|r1}\|d` | part of unstable_cache args |
| Stock performance | `["stock-performance-v8-annual-year-fallback"]` + ticker | **60s** |
| Stock chart | `["stock-chart-points-v34-ws-minute-only"]` + `(ticker, range, series)` | **60s** |
| Screener EOD snapshot | `screener_eod_bars_{SYMBOL}`, segment `screener_eod_bars_v1:{epoch.segment}` | segment tied to `getScreenerUsMarketCacheEpoch()` |
| Provider HTTP | `fetchEodhdEodDaily` | `cache: "no-store"` |

Retry paths cached separately: `retry: true` → `r1` key vs `r0`.

---

### Cache Invalidation

- TTL expiry (60s portfolio/chart/performance; 86400s superinvestor holding charts)
- Cache key change: `(providerSymbol, fromYmd, toYmd, retryFlag)` or `(ticker, range, series)`
- Screener epoch segment rollover (`live-{ymd}-s{n}` or `frozen-{lastRegularSessionYmd}`)
- Direct uncached paths: SSR `loadStockPageInitialDataUncached`, `price-on-date` route bypass portfolio cache

---

### Cross-user Sharing

| Path | Value | Why |
|------|-------|-----|
| Portfolio loader | **YES** | `unstable_cache` + in-flight keyed by symbol + date window |
| Stock performance / chart | **YES** | 60s per ticker/range |
| Screener EOD snapshot | **YES** | One Supabase row per symbol per epoch segment |
| SSR uncached / price-on-date | **NO** | Direct `fetchEodhdEodDaily` without portfolio wrapper |
| Asset snapshot | **PARTIALLY** | Shared per ticker/segment; stale reads up to 6h (`ASSET_SNAPSHOT_STALE_MAX_MS`) |

---

### Runtime Dependency

**YES**

Runtime variables:
- Portfolio holdings count determines number of distinct symbol windows per request (UNKNOWN exact count without user data)
- Date window `(fromYmd, toYmd)` varies by route (analytics vs benchmark vs chart range)
- Cache hit vs miss state at request time
- Screener epoch mode (`live` vs `frozen`) determines EOD vs realtime path upstream

---

### DAU Scaling

**PARTIALLY**

Explanation: Identical `(providerSymbol, from, to, retry)` windows collapse to one EODHD fetch per 60s globally. Unique tickers × date windows produce distinct cache keys. SSR cold miss and `price-on-date` bypass shared cache.

---

### Architecture Rating

**Good**

Justification: Canonical portfolio loader with explicit cache key string, in-flight dedupe, and retry isolation. Stock chart/performance use shared `unstable_cache`. Screener uses durable Supabase snapshot. Uncached escape paths exist for SSR cold miss and price-on-date.

---

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES (cached paths); PARTIALLY (uncached paths) |
| Runtime dependent | YES |
| Requires provider every request | NO (within cache windows) |
| Snapshot backed | PARTIALLY (screener EOD, asset snapshot) |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 4. Intraday Bars

### Dataset Overview

**Purpose:** Intraday OHLC for stock 1D charts (live WS + REST base, completed sessions, gap fill), multi-day chart ranges (5D/1M/6M/YTD/1Y), extended-hours holiday detection, crypto 1D live charts, portfolio value history (1D/7D/1M ranges).

**Provider(s):** EODHD `GET /api/intraday/{symbol}?from=&to=&interval=` (`fetchEodhdIntraday`); Supabase `stock_session_minute_bar` (WS tail, not EODHD).

**Entry points:**
- `GET /api/stocks/[ticker]/chart` → `getStockChartPointsForApi`
- `GET /api/crypto/[symbol]/chart`
- `resolveUsEquityLiveRegularSessionActive` (holiday probe)
- `lib/portfolio/portfolio-value-history.server.ts` (1D/7D/1M)

**Main loaders:**
- `lib/market/eodhd-intraday.ts`
- `lib/market/stock-chart-data.ts`
- `lib/market/stock-1d-ws-minute-chart.ts`
- `lib/market/crypto-1d-live-minute-chart.ts`

**Main API routes:** `/api/stocks/[ticker]/chart`, `/api/crypto/[symbol]/chart`

---

### Call Graph

**1D allowlist, regular session (uncached API branch):**

```
GET /api/stocks/[ticker]/chart?range=1D
  → getStockChartPointsForApi
    → loadStockChartPointsUncached                          [NO unstable_cache]
      → loadStock1DLiveWsMinuteChartPoints
        → getStock1DRestBaseCached(ticker, sessionYmd)      [unstable_cache, 60s]
          → fetchEodhdIntraday (1m + 5m, optional 1h)
        → fetchStockSessionMinuteBarsFromDb                 [Supabase, fresh each load]
```

**Completed session (prior session cache):**

```
getStockChartPoints1DPriorSession(ticker, series, completedSessionYmd)  [86400s]
  → getHistoricalSessionIntradayBars(ticker, sessionYmd, interval)      [86400s]
    → fetchEodhdIntraday
```

**5D–ALL (inside 60s chart cache):**

```
getStockChartPoints(ticker, range, series)                  [60s]
  → load5DChartPoints / load6MChartPoints / ...
    → fetchEodhdIntraday(..., interval)
    → [fallback] fetchEodhdEodDaily
```

---

### Provider Reuse

**PARTIALLY**

Explanation: Completed session intraday cached 86400s per `(ticker, sessionYmd, interval)`. Live 1D REST base cached 60s per `(ticker, sessionYmd)`. Multi-day ranges wrapped in 60s `getStockChartPoints`. Live allowlist 1D API branch bypasses chart cache and reads fresh WS DB tail each request.

---

### Shared Cache Layers

- Provider HTTP — `fetchEodhdIntraday`, `cache: "no-store"`
- `unstable_cache` — `["eodhd-historical-session-intraday-v4"]` + `(ticker, sessionYmd, interval)`, **86400s**
- `unstable_cache` — `["stock-1d-rest-base-v2"]` + `(ticker, sessionYmd)`, **60s**
- `unstable_cache` — `["stock-chart-points-v34-ws-minute-only"]` + `(ticker, range, series)`, **60s**
- `unstable_cache` — `["stock-chart-1d-prior-session-v10-session-ymd"]`, **86400s**
- `unstable_cache` — `["crypto-live-1d-rest-base-v1"]` + `baseSymbol`, **300s**
- Supabase — `stock_session_minute_bar` (WS bars; read uncached on live path)
- In-process memory — `__finsepaStockSessionMinuteBars`
- HTTP — live WS 1D: `CACHE_CONTROL_PRIVATE_NO_STORE`; prior-session 1D: **86400s**; other: **45s** s-maxage

---

### Cache Keys

| Layer | Key | TTL |
|-------|-----|-----|
| Historical session | `["eodhd-historical-session-intraday-v4"]` + `(ticker, sessionYmd, interval)` | **86400s** |
| Live REST base | `["stock-1d-rest-base-v2"]` + `(ticker, sessionYmd)` | **60s** |
| Chart points | `["stock-chart-points-v34-ws-minute-only"]` + `(ticker, range, series)` | **60s** |
| Prior session 1D | `["stock-chart-1d-prior-session-v10-session-ymd"]` + `(ticker, series, completedSessionYmd)` | **86400s** |
| Crypto REST base | `["crypto-live-1d-rest-base-v1"]` + `baseSymbol` | **300s** |

---

### Cache Invalidation

- TTL expiry per layer above
- Session YMD change → new REST base / prior-session keys
- Live allowlist 1D: intentional cache bypass during regular/post session
- Gap-fill paths (`fillTodaySessionChartGaps`) use uncached intraday + realtime within live 1D uncached branch
- Range / series change → new chart cache key

---

### Cross-user Sharing

| Path | Value | Why |
|------|-------|-----|
| Completed session intraday | **YES** | 86400s per `(ticker, sessionYmd, interval)` |
| Live REST base | **YES** | 60s per `(ticker, sessionYmd)` |
| Live WS minute tail | **PARTIALLY** | Supabase WS data shared; merged uncached each live request |
| 5D–ALL ranges | **YES** | 60s `getStockChartPoints` |
| Live allowlist 1D API | **NO** | `loadStockChartPointsUncached` during WS regular/post |

---

### Runtime Dependency

**YES**

Runtime variables:
- US market session determines live vs prior-session vs frozen paths
- Allowlist membership (AAPL/NVDA/QQQ/SPY) determines WS live pipeline
- Chart range parameter
- WS minute bar freshness in Supabase at request time
- Gap-fill triggers depend on minute bar gaps detected at runtime

---

### DAU Scaling

**PARTIALLY**

Explanation: Cached paths (historical 86400s, REST base 60s, multi-day 60s) scale sub-linearly for repeated ticker/range access. Live allowlist 1D performs uncached server compute + fresh WS DB read per request.

---

### Architecture Rating

**Good**

Justification: Multi-tier design — 86400s frozen completed sessions, 60s REST base, uncached WS tail for live allowlist. Non-allowlist 1D uses historical cache. Gap-fill adds uncached intraday during live session.

---

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | PARTIALLY |
| Runtime dependent | YES |
| Requires provider every request | PARTIALLY (live allowlist 1D: YES for WS path compute) |
| Snapshot backed | NO (asset snapshot stores chart points in page bundle, not intraday source) |
| Cached | PARTIALLY |
| Confidence | High |
| Architecture Rating | Good |

---

## 5. Fundamentals

### Dataset Overview

**Purpose:** Raw EODHD fundamentals JSON per US ticker — shared blob for highlights, profile, key stats, header meta, earnings resolution, charting series, screener rows, watchlist off-universe meta.

**Provider(s):** EODHD `GET /api/fundamentals/{symbol}.US?fmt=json`

**Entry points:** `fetchEodhdFundamentalsJson`; `GET /api/stocks/[ticker]/profile`; `buildStockKeyStatsBundle`; screener cells; watchlist off-universe meta.

**Main loaders:** `lib/market/eodhd-fundamentals.ts`, `lib/market/stock-header-meta-server.ts`, `lib/market/eodhd-stock-profile.ts`

**Main API routes:** `/api/stocks/[ticker]/profile`, `/api/stocks/[ticker]/key-stats-bundle`, `/api/screener/companies-key-stat`

### Call Graph

```
GET /api/stocks/[ticker]/profile → fetchEodhdStockProfile → fetchEodhdFundamentalsJson
  → unstable_cache(["eodhd-fundamentals-json-v9-inflight-dedupe"], ticker)
    → cache(fetchEodhdFundamentalsJsonUncached) → traceEodhdHttp → fetchEodhd → GET /api/fundamentals/{sym}
```

Refresh: `fetchEodhdFundamentalsJsonFresh` bypasses `unstable_cache`.

### Provider Reuse

**YES** — Single shared `unstable_cache` export; React `cache()` dedupes within one RSC request.

### Shared Cache Layers

React `cache()`; `unstable_cache` fundamentals **900s**; header identity **43200s**; earnings line **900s**; Supabase header identity snapshot; EODHD hourly budget gate.

### Cache Keys

Fundamentals: `["eodhd-fundamentals-json-v9-inflight-dedupe"]` + ticker, **900s**. Header identity: `["stock-header-identity-v3-country"]` + ticker, **43200s**.

### Cache Invalidation

900s TTL; ticker change; refresh path bypass; revenue gap conditional fresh-fetch branch.

### Cross-user Sharing

**YES**

### Runtime Dependency

**YES** — Cache state, refresh flag, revenue gap branch, budget gate.

### DAU Scaling

**PARTIALLY** — Per unique ticker per 900s window.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | YES |
| Requires provider every request | NO (within 900s; YES on refresh) |
| Snapshot backed | PARTIALLY |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 6. Key Statistics

### Dataset Overview

**Purpose:** Parsed metric cells from fundamentals — stock key-stats bundle (9 sections) and screener per-metric per-ticker cells.

**Provider(s):** EODHD fundamentals JSON; SEC backfill for reported earnings actuals in bundle path.

**Entry points:** `GET /api/stocks/[ticker]/key-stats-bundle`; `POST /api/screener/companies-key-stat`; SSR / comparison routes.

**Main loaders:** `lib/market/stock-key-stats-bundle.ts`, `lib/screener/fetch-screener-key-stat-cell.ts`, `lib/screener/screener-key-stat-snapshot.ts`

**Main API routes:** `/api/stocks/[ticker]/key-stats-bundle`, `/api/screener/companies-key-stat`

### Call Graph

```
POST /api/screener/companies-key-stat
  → getCachedKeyStatCells(metricId, tickersKey) [43200s]
    → readScreenerKeyStatCellSnapshot → [miss] fetchKeyStatCellForTicker → fetchEodhdFundamentalsJson
    → upsertScreenerKeyStatCellSnapshot

GET /api/stocks/[ticker]/key-stats-bundle
  → getCachedKeyStatsBundle OR buildStockKeyStatsBundle(refresh) → fetchFundamentalsRootForMetrics
```

### Provider Reuse

**YES** — Fundamentals shared cache (900s); Supabase cells (`screener_key_stat_v1`); route batch cache 43200s.

### Shared Cache Layers

Fundamentals §5; bundle `["stock-key-stats-bundle-v4-insiders-short"]` **43200s**; screener `["screener-companies-key-stat-v2-supabase"]` **43200s**; Supabase key `screener_key_stat_{metricId}_{TICKER}`.

### Cache Keys

Screener batch: `(metricId, tickersKey)` **43200s**. Supabase segment: `screener_key_stat_v1`. Route caps: `MAX_TICKERS=20`, `CHUNK_SIZE=6`.

### Cache Invalidation

43200s TTL; `(metricId, tickersKey)` change; Supabase cell miss; bundle refresh bypass.

### Cross-user Sharing

**YES**

### Runtime Dependency

**YES** — Metric/ticker selection diversity; Supabase cell presence; refresh flag.

### DAU Scaling

**PARTIALLY** — Unique `(metricId, ticker)` cells; shared fundamentals per ticker.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | YES |
| Requires provider every request | NO |
| Snapshot backed | YES |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 7. Company Profile

### Dataset Overview

**Purpose:** Company description, HQ, sector, employees, earnings dates from fundamentals General/Highlights.

**Provider(s):** EODHD fundamentals JSON (via `fetchEodhdFundamentalsJson`)

**Entry points:** `GET /api/stocks/[ticker]/profile`; SSR stock page.

**Main loaders:** `lib/market/eodhd-stock-profile.ts`

**Main API routes:** `/api/stocks/[ticker]/profile`

### Call Graph

```
GET /api/stocks/[ticker]/profile → fetchEodhdStockProfile → fetchEodhdFundamentalsJson → EODHD /api/fundamentals/{sym}
```

### Provider Reuse

**YES** — Pure transform of §5 Fundamentals cache.

### Shared Cache Layers

All §5 layers. HTTP: `CACHE_CONTROL_PRIVATE_WARM` (s-maxage **300s**).

### Cache Keys

Same as §5 Fundamentals.

### Cache Invalidation

Same as §5 Fundamentals.

### Cross-user Sharing

**YES**

### Runtime Dependency

**YES** — Fundamentals cache hit vs miss.

### DAU Scaling

**PARTIALLY** — Per unique ticker per 900s.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | YES |
| Requires provider every request | NO |
| Snapshot backed | PARTIALLY |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 8. Search

### Dataset Overview

**Purpose:** Merged local universe + remote EODHD search for global asset typeahead.

**Provider(s):** EODHD `/api/search/{q}`; local universes (no remote HTTP).

**Entry points:** `GET /api/search?q=&scope=`

**Main loaders:** `lib/search/global-asset-search.ts`, `lib/market/eodhd-search.ts`

**Main API routes:** `/api/search` (public)

### Call Graph

```
GET /api/search → globalAssetSearch → unstable_cache(["global-asset-search-v16-superinvestors"], qNorm, scope)
  → runGlobalAssetSearch → [local universes] → fetchEodhdSearch [if len(q) >= 2]
```

### Provider Reuse

**YES** — Query-keyed `unstable_cache` **90s**; public CDN **30s**.

### Shared Cache Layers

`unstable_cache` **90s**; EODHD fetch hint **90s**; `CACHE_CONTROL_PUBLIC_SEARCH` s-maxage **30s**.

### Cache Keys

`["global-asset-search-v16-superinvestors"]` + `(qNorm, scope)`. EODHD only when `q.length >= 2`. Limits: **120** or **50**.

### Cache Invalidation

90s TTL; query/scope change; sub-2-char queries: local-only.

### Cross-user Sharing

**YES**

### Runtime Dependency

**YES** — Query string diversity UNKNOWN statically.

### DAU Scaling

**PARTIALLY** — Per unique query per 90s.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | YES |
| Requires provider every request | NO (identical query within 90s) |
| Snapshot backed | NO |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 9. News

### Dataset Overview

**Purpose:** Aggregated news feed per tab (stocks/crypto/indices), paginated 25 items/page, max 250.

**Provider(s):** EODHD News `/api/news?s={symbol}` — **ingest only**. User read path: Supabase hub snapshot only.

**Entry points:** `GET /api/news?tab=&page=`; cron `ingestHubSnapshots`.

**Main loaders:** `lib/news/news-feed.ts`, `lib/market/hub-snapshot-ingest.ts`

**Main API routes:** `/api/news` (auth required)

### Call Graph

```
GET /api/news → getNewsPage → getNewsFeed [React cache()]
  → readHubSnapshot("hub_news_{tab}", "news-{tab}-{NY-date}", allowStale)
  → Supabase market_snapshot — never EODHD on user path

cron ingestHubSnapshots → buildNewsFeedForHubIngest → fetchEodhdNewsForSymbol × N → upsertHubSnapshot
```

### Provider Reuse

**YES** — Single Supabase row per tab per day segment; all users read same snapshot.

### Shared Cache Layers

Supabase hub keys: `hub_news_stocks`, `hub_news_crypto`, `hub_news_indices`. Segment: `news-{tab}-{NY-ymd}`. Stale fallback: `HUB_SNAPSHOT_STALE_MAX_MS` = **7 days**. Cron skip: `NEWS_HUB_CRON_MAX_AGE_MS` = **900000ms**. HTTP: `CACHE_CONTROL_PUBLIC_NEWS_HUB` s-maxage **60s**.

### Cache Keys

Hub key + daily NY segment. Ingest: up to **60** symbols (stocks tab), `PER_SYMBOL_LIMIT=6` each.

### Cache Invalidation

Daily segment rollover; cron re-ingest after 15 min freshness window; stale read up to 7 days.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO** — User read path is snapshot-only; architecture provable statically.

### DAU Scaling

**NO** — User requests do not fan out to EODHD (`news-feed.ts` comment). Ingest scales with universe size per cron cycle, not DAU.

### Architecture Rating

**Excellent**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | YES |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Excellent |

---

## 10. Macro Dashboard

### Dataset Overview

**Purpose:** Macro dashboard cards for `/macro` — 16 series in `MACRO_SERIES` (`eodhd-macro.ts`).

**Provider(s):** FRED, BLS, Shiller Yale, EODHD UST yields, Alternative.me (fear/greed), Farside (BTC ETF flows).

**Entry points:** `GET /api/macro`; cron `ingestHubSnapshots`.

**Main loaders:** `lib/market/macro-dashboard-payload.ts`, per-series modules (`fred-*.ts`, `bls-cpi-macro.ts`, `shiller-ie-macro.ts`, etc.)

**Main API routes:** `/api/macro` (auth)

### Call Graph

```
GET /api/macro → getMacroDashboardPayloadCached
  → readHubSnapshot("hub_macro_dashboard", "macro-day-v20-{NY-date}")
    → [if usable] maybeRefreshBtcEtfCard [conditional live fetch if < 30 points]
  → else unstable_cache(["macro-dashboard-payload-v48-btc-etf-skip-zero-tip"], 300s)
    → buildMacroDashboardPayloadUncached → fetchMacroSeriesAll × 16 series

cron → buildMacroDashboardPayloadForIngest → upsertHubSnapshot
```

### Provider Reuse

**YES** — Hub snapshot cross-user; per-series `unstable_cache` **86400s** (Shiller bundle **300s**).

### Shared Cache Layers

Supabase `hub_macro_dashboard`; fallback `unstable_cache` **300s**; per-series caches **86400s**; HTTP `CACHE_CONTROL_PUBLIC_MACRO_DASHBOARD` s-maxage **86400s**.

### Cache Keys

Hub segment: `macro-day-v20-{NY-ymd}`. Per-series tags include `fred-gdp-nominal-v1`, `bls-cpi-u-raw-v1`, `shiller-ie-macro-pairs-v10-cpi`, `eodhd-ust-gbond-10y-v2`, etc.

### Cache Invalidation

Daily segment; hub usability checks reject stale Shiller/treasury/CPI data; BTC ETF exception on user path when sparse.

### Cross-user Sharing

**YES**

### Runtime Dependency

**PARTIALLY** — BTC ETF live refresh exception depends on point count in hub snapshot at request time.

### DAU Scaling

**NO** — Primary user path reads one Supabase row. Fallback rebuild (300s) and BTC exception are not per-user.

### Architecture Rating

**Excellent**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | PARTIALLY |
| Requires provider every request | NO |
| Snapshot backed | YES |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Excellent |

---


## 11. Superinvestor Data

### Dataset Overview

**Purpose:** 13F profile/holdings/transactions, performance series (book vs SPY), aggregate fund list — all from SEC filings + EOD prices at rebuild time.

**Provider(s):** SEC EDGAR (13F filings); EODHD (ticker enrichment, EOD bars for performance via `loadPortfolioEodBars`).

**Entry points:** `GET /api/superinvestors/[slug]/performance`; `GET /api/superinvestors/[slug]/transactions`; SSR `loadSuperinvestorProfilePageData`; cron rebuild paths.

**Main loaders:** `lib/superinvestors/load-superinvestor-profile-data.ts`, `lib/superinvestors/superinvestor-performance-series.ts`, `lib/superinvestors/superinvestor-13f-full-transactions.ts`

**Main API routes:** `/api/superinvestors/[slug]/performance`, `/api/superinvestors/[slug]/transactions`

### Call Graph

```
GET /api/superinvestors/[slug]/performance
  → loadSuperinvestorPerformanceSeries → readSuperinvestorPerformanceSnapshot(slug)
    → Supabase key: superinvestor_perf_{slug}_v1

GET /api/superinvestors/[slug]/transactions
  → item.loadTransactions → readSuperinvestorFullTransactionsSnapshotLatestSlim
    → Supabase key: superinvestor_13f_transactions_full_v4_{cik}

SSR loadSuperinvestorProfilePageData
  → readSuperinvestor13fProfileSnapshotLatest(cik) — code: user SSR never calls SEC
```

Rebuild (cron/ops only): SEC fetch + EODHD enrichment + upsert snapshots.

### Provider Reuse

**YES** — User paths are snapshot-only. Rebuild gated by `isSuperinvestorSecRebuildAllowed()`.

### Shared Cache Layers

Supabase keys: `superinvestor_13f_profile_v4_{cik}`, `superinvestor_13f_transactions_full_v4_{cik}`, `superinvestor_perf_{slug}_v1`, `superinvestor_list_v1`. Performance rebuild `unstable_cache` `["superinvestor-performance-v8-durable"]` **900s**. Stale serve: `PERF_STALE_MS` = **24h**. HTTP: performance **300s**; transactions s-maxage **21600s**.

### Cache Keys

Per-manager CIK/slug keys in `market_snapshot`. Performance segment: calendar `YYYY-MM-DD`.

### Cache Invalidation

Accession-based segments for 13F data; performance daily segment; cron rebuild under SEC rebuild gate.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO** — User paths documented as snapshot-only; architecture provable statically.

### DAU Scaling

**NO** — User traffic reads O(1) Supabase rows per manager. SEC/EOD rebuild bounded to cron/ops.

### Architecture Rating

**Excellent**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | YES |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Excellent |

---

## 12. Portfolio Benchmark EOD Bars

### Dataset Overview

**Purpose:** Daily benchmark closes (default SPY) for Dietz compare, chart overlays, analytics beta/volatility.

**Provider(s):** EODHD via `loadPortfolioBenchmarkEodBars` → `loadPortfolioSymbolEodBars` (same as §3 Daily Bars).

**Entry points:** `/api/portfolio/benchmark-history`, `/api/portfolio/benchmark-compare`, `/api/portfolio/analytics`, `/api/portfolio/value-history`, `/api/portfolio/period-returns`

**Main loaders:** `lib/portfolio/data/load-portfolio-eod-bars.ts`, `lib/portfolio/benchmark/benchmark-compare.server.ts`

**Main API routes:** `/api/portfolio/benchmark-history`, `/api/portfolio/analytics`

### Call Graph

```
API route → loadPortfolioBenchmarkEodBars(ticker, from, to, { retry: true })
  → loadPortfolioSymbolEodBars → withInflight → getCachedEquityBars [60s] → fetchEodhdEodDailyRetry
```

### Provider Reuse

**YES** — Identical §3 Daily Bars cache. SPY windows highly shared across users.

### Shared Cache Layers

Same as §3 Daily Bars portfolio loader.

### Cache Keys

`portfolio-eod-bars-v1|equity|{providerSymbol}|{from}|{to}|r1|d` — **60s**.

### Cache Invalidation

Same as §3 Daily Bars.

### Cross-user Sharing

**YES**

### Runtime Dependency

**YES** — Date window varies by route; cache hit state.

### DAU Scaling

**NO** — SPY benchmark windows shared globally per 60s.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | YES |
| Requires provider every request | NO |
| Snapshot backed | NO |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 13. Risk-Free Rate (FRED)

### Dataset Overview

**Purpose:** Daily risk-free return for Sharpe/Sortino: `dailyRf = annualPct / 100 / 252`.

**Provider(s):** FRED FEDFUNDS CSV (`FRED_FEDFUNDS_CSV_URL`) — not EODHD. Code comment: temporary policy when 3M T-bill series is not wired.

**Entry points:** `/api/portfolio/analytics` → `computePortfolioAnalyticsSnapshot`

**Main loaders:** `lib/portfolio/analytics/portfolio-analytics.server.ts` → `lib/market/eodhd-fed-funds-macro.ts`

**Main API routes:** `/api/portfolio/analytics`

### Call Graph

```
computePortfolioAnalyticsSnapshot → resolveDailyRiskFreeRate
  → fetchFedFundsTargetSeriesCached [unstable_cache, 86400s] → fetch(FRED CSV)
```

### Provider Reuse

**YES** — Single global FRED series cache.

### Shared Cache Layers

`unstable_cache` tag `["fred-fedfunds-monthly-v1"]`, **86400s**.

### Cache Keys

`["fred-fedfunds-monthly-v1"]` — global, no user/ticker dimension.

### Cache Invalidation

86400s TTL.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO**

### DAU Scaling

**NO** — O(1) FRED fetch per 24h window.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | NO |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 14. Watchlist Enrichment

### Dataset Overview

**Purpose:** Enrich saved watchlist rows with price, 1D/1M/YTD, mcap, P/E, earnings display.

**Provider(s):** EODHD realtime, EOD bars (via `simple-market-layer`), fundamentals (off-universe stocks); crypto via `getCryptoAsset`; forex via screener currencies.

**Entry points:** `POST /api/watchlist/enrich`

**Main loaders:** `lib/market/watchlist-enrichment.ts`

**Main API routes:** `/api/watchlist/enrich`

### Call Graph

```
buildWatchlistEnrichedGroups
  → withScreenerUsMarketCache("watchlist-enriched-groups-v5", ..., [sorted tickersKey])
    → buildWatchlistStockBatch
      → getScreenerCompaniesStaticLayer / getSimpleMarketDataForWatchlistStocks
      → fetchWatchlistOffUniverseMetaByTicker → fetchEodhdFundamentalsJson [concurrency 8]
```

### Provider Reuse

**PARTIALLY** — Session cache keyed by `(epoch.segment + sorted tickersKey)`. Underlying market data cross-user via §16 Market Snapshots.

### Shared Cache Layers

`withScreenerUsMarketCache` **900s** live / frozen **false**; underlying `market_snapshot` reads; fundamentals **900s**; HTTP live **900s** / frozen **86400s**.

### Cache Keys

`watchlist-enriched-groups-v5` + epoch segment + `tickersKey` (sorted unique tickers).

### Cache Invalidation

Epoch segment rollover; watchlist ticker set change; fundamentals 900s TTL.

### Cross-user Sharing

**PARTIALLY** — Same ticker-set + session segment shares result; different watchlists → different keys.

### Runtime Dependency

**YES** — User watchlist composition UNKNOWN statically.

### DAU Scaling

**PARTIALLY** — Scales with distinct `(tickersKey × session segment)` combinations.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | PARTIALLY |
| Runtime dependent | YES |
| Requires provider every request | NO (session cache hit) |
| Snapshot backed | PARTIALLY |
| Cached | YES |
| Confidence | Medium |
| Architecture Rating | Good |

---

## 15. Earnings Notifications (Ingest)

### Dataset Overview

**Purpose:** Cron detects new earnings actuals for tickers in users' watchlists + portfolio holdings; creates notifications.

**Provider(s):** EODHD `calendar/earnings` (`fetchEarningsCalendarBatch`); fundamentals for logo enrichment.

**Entry points:** `app/api/cron/earnings-notifications/route.ts` (cron); user read via `/api/notifications` (Supabase only).

**Main loaders:** `lib/notifications/earnings-notify-ingest.ts`, `lib/notifications/earnings-calendar-batch.ts`

**Main API routes:** `/api/cron/earnings-notifications`, `/api/notifications` (read: no provider)

### Call Graph

```
cron (CRON_SECRET) → buildEarningsNotifyInterestMap (Supabase watchlist + portfolio)
  → chunkTickers(size 80) → fetchEarningsCalendarBatch (cache: "no-store")
  → enrichEarningsReleaseNotifications → insertEarningsReleaseNotifications
```

### Provider Reuse

**YES** — One calendar batch per unique ticker chunk; interest map merges all users per ticker.

### Shared Cache Layers

EODHD fetch: `cache: "no-store"`. State: Supabase `earnings_release_snapshots`, `user_notifications`. Batch size: **80**.

### Cache Keys

No HTTP cache. Snapshot dedupe in Supabase per ticker/release.

### Cache Invalidation

Cron schedule; new actuals detection logic.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO** — Ingest architecture provable statically.

### DAU Scaling

**NO** — Provider requests scale with `ceil(unique_tickers / 80)` per cron run, not per user.

### Architecture Rating

**Excellent**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO (user read); YES (cron ingest) |
| Snapshot backed | YES |
| Cached | NO (EODHD no-store on ingest) |
| Confidence | High |
| Architecture Rating | Excellent |

---


## 16. Market Snapshots (Screener / Markets)

### Dataset Overview

**Purpose:** Shared quote + derived metric bundles for screener tabs, heatmap, watchlist quotes, ETFs/indices/crypto — durable Supabase blobs plus session-scoped Next caches.

**Provider(s):** EODHD realtime (`fetchEodhdRealtimeSymbolsRaw`); EOD daily (`fetchEodhdEodDailyScreener`); crypto fundamentals for mcap.

**Entry points:** Screener pages; `GET /api/screener/market-tab`; watchlist enrichment; heatmap.

**Main loaders:** `lib/market/simple-market-layer.ts`, `lib/market/market-snapshot-rebuild.ts`, `lib/screener/screener-us-market-cache.ts`

**Main API routes:** `/api/screener/market-tab`, screener row routes

### Call Graph

```
GET /api/screener/market-tab → buildScreenerMarketTabApiResponse
  → withScreenerUsMarketCache → loadSimpleMarketDataBatch
    → fetchEodhdRealtimeSymbolsRaw(symbolList)
    → [frozen mode] loadUsStockDatumsFromEodDaily → fetchEodhdEodDailyScreener

Cold miss: readMarketSnapshot miss → rebuildMarketSnapshotBlobSingleFlight
  → tryAcquireAssetRebuildLease(180s) → loadUncached → upsertMarketSnapshot
```

### Provider Reuse

**YES** — Epoch-scoped shared cache (`live-{ymd}-s{n}` or `frozen-{lastRegularSessionYmd}`); durable Supabase one row per `(key, segment)`.

### Shared Cache Layers

`withScreenerUsMarketCache` **900s** live / `revalidate: false` frozen; in-process `screenerUsSessionMem`; Supabase `market_snapshot` keys (`stocks_all_pages`, `crypto_tab`, etc.); `getSimpleMarketData` **180s**; derived **1800s**. Stale: hot **14 min**, slow **20 h**. Rebuild lease **180s**.

### Cache Keys

Epoch segment from `getScreenerUsMarketCacheEpoch()`. Snapshot keys in `market-snapshot-keys.ts`. Screener EOD: `screener_eod_bars_{SYMBOL}`.

### Cache Invalidation

15m live slot rollover; frozen segment keyed by last regular close day; snapshot absence triggers single-flight rebuild; `FINSEPA_MARKET_SNAPSHOT_READ=0` disables reads.

### Cross-user Sharing

**YES**

### Runtime Dependency

**YES** — US market session mode; snapshot presence at request time; client poll frequency for Markets tab UNKNOWN.

### DAU Scaling

**NO** — Hot blobs refreshed per 15m session segment; provider cost bounded by cron + single-flight cold misses.

### Architecture Rating

**Excellent**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | YES |
| Requires provider every request | NO |
| Snapshot backed | YES |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Excellent |

---

## 17. Asset Snapshots (Stock Page)

### Dataset Overview

**Purpose:** Per-ticker stock detail SSR bundle — header, chart, performance, key stats, news, profile, fundamentals series, peers.

**Provider(s):** EODHD: EOD daily, intraday chart, realtime spot, fundamentals, profile, news, charting series, peers — on cold miss only for durable fields; hot fields refreshed per hit.

**Entry points:** `app/stock/[ticker]/page.tsx` → `loadStockPageInitialData`; `/api/stocks/[ticker]/page-initial`

**Main loaders:** `lib/market/stock-page-initial-data.ts`, `lib/market/asset-snapshot-store.ts`, `lib/market/asset-rebuild-lease.ts`

**Main API routes:** SSR page; `/api/stocks/[ticker]/page-initial`

### Call Graph

```
loadStockPageInitialData(ticker)
  → readAssetSnapshotForPage(ticker, epoch.segment, { allowStale: true })
  → [hit] loadStockPageHotFields (chart + spot) + loadKeyIndicatorsForPage
  → [miss] runAssetColdMissSingleFlight
      → tryAcquireAssetRebuildLease(60s) → loadStockPageInitialDataUncached → persistAssetSnapshot
```

### Provider Reuse

**YES** — One Supabase row per ticker per segment; cold miss single-flight per `(asset_{TICKER}, segment)`.

### Shared Cache Layers

Supabase key `asset_{TICKER}`; lease **60s**; stale prior segment **6h** (`ASSET_SNAPSHOT_STALE_MAX_MS`); hot fields stripped from snapshot (`stripAssetSnapshotHotFields`).

### Cache Keys

`asset_{TICKER}` + epoch segment from `getScreenerUsMarketCacheEpoch()`.

### Cache Invalidation

15m live slot / frozen segment rollover; snapshot miss; lease expiry; stale read up to 6h.

### Cross-user Sharing

**YES**

### Runtime Dependency

**YES** — Ticker popularity affects cold-miss frequency UNKNOWN statically; cache hit vs miss.

### DAU Scaling

**PARTIALLY** — Cold rebuild per ticker per segment; popular tickers amortize; long-tail tickers cold-miss independently.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | YES |
| Requires provider every request | NO (snapshot hit); YES (cold miss) |
| Snapshot backed | YES |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 18. Dividends

### Dataset Overview

**Purpose:** Dividend history per symbol; calendar bulk fetch; portfolio dividends schedule.

**Provider(s):** EODHD `/div/{sym}` and `/calendar/dividends`.

**Entry points:** `/api/stocks/[ticker]/dividends`; `/api/portfolio/dividends-schedule`

**Main loaders:** `lib/market/eodhd-splits-dividends.ts`, `lib/market/eodhd-dividends-calendar.ts`, `lib/portfolio/portfolio-dividends-schedule-server.ts`

### Call Graph

```
GET /api/stocks/[ticker]/dividends → fetchEodhdDividendsHistory [unstable_cache, 300s]
GET /api/portfolio/dividends-schedule → buildPortfolioDividendsSchedule [60s] + calendar fetch [300s]
```

### Provider Reuse

**YES** — Per-symbol history/calendar cached globally **300s**. Portfolio schedule keyed by `(holdingsJson, windowKey)` **60s**.

### Shared Cache Layers

`["eodhd-dividends-history-v1"]` **300s**; `["eodhd-dividends-calendar-v1"]` **300s**; `["portfolio-dividends-schedule-v1"]` **60s**.

### Cache Invalidation

TTL expiry; ticker/holdings change.

### Cross-user Sharing

**YES** (per-symbol); **PARTIALLY** (portfolio schedule per holdings hash)

### Runtime Dependency

**YES** — Portfolio holdings composition.

### DAU Scaling

**PARTIALLY**

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | YES |
| Requires provider every request | NO |
| Snapshot backed | NO |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 19. Stock Splits

### Dataset Overview

**Purpose:** Split history per symbol.

**Provider(s):** EODHD splits endpoint.

**Entry points:** `/api/stocks/[ticker]/splits`

**Main loaders:** `lib/market/eodhd-splits-dividends.ts` — `fetchEodhdSplitsHistory`

### Call Graph

```
GET /api/stocks/[ticker]/splits → fetchEodhdSplitsHistory [unstable_cache, 300s]
```

### Provider Reuse

**YES** — `["eodhd-splits-history-v1"]` **300s** per symbol.

### Shared Cache Layers

`unstable_cache` **300s**.

### Cache Invalidation

300s TTL; ticker change.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO**

### DAU Scaling

**NO** — Per symbol per 300s.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | NO |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 20. Insider Transactions

### Dataset Overview

**Purpose:** Insider transaction history per ticker.

**Provider(s):** EODHD insider endpoint (10 credits per request per code comment).

**Entry points:** `/api/stocks/[ticker]/insider-transactions`

**Main loaders:** `lib/market/eodhd-insider-transactions.ts`

### Call Graph

```
GET /api/stocks/[ticker]/insider-transactions
  → unstable_cache inner **900s**; route wrapper **43200s**
```

### Provider Reuse

**YES** — Long TTL appropriate for 10-credit endpoint.

### Shared Cache Layers

Inner: `["eodhd-insider-transactions-v1"]` **900s**. Route wrapper **43200s**. HTTP: `CACHE_CONTROL_PRIVATE_WARM_LONG` **900s** s-maxage.

### Cache Invalidation

900s / 43200s TTL tiers.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO**

### DAU Scaling

**NO**

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | NO |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 21. Economic Events

### Dataset Overview

**Purpose:** Economic calendar events for economy week UI.

**Provider(s):** EODHD economic events API (paginated up to 10×1000).

**Entry points:** `lib/market/economy-week-data.ts`; `/api/economy/history/route.ts`

**Main loaders:** `lib/market/eodhd-economic-events.ts`

### Call Graph

```
fetchEodhdEconomicEventsAll → unstable_cache ["eodhd-economic-events-page-v1"] **86400s**
```

### Provider Reuse

**YES** — Daily cache.

### Shared Cache Layers

`unstable_cache` **86400s**.

### Cache Invalidation

86400s TTL.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO**

### DAU Scaling

**NO**

### Architecture Rating

**Acceptable**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | NO |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Acceptable |

---

## 22. Earnings Calendar (UI)

### Dataset Overview

**Purpose:** Bulk earnings calendar for `/earnings` week grid UI.

**Provider(s):** EODHD `calendar/earnings`.

**Entry points:** Earnings week UI via `lib/market/earnings-week-data.ts`; hub snapshot ingest.

**Main loaders:** `lib/market/eodhd-earnings-calendar.ts`

### Call Graph

```
fetchEodhdEarningsCalendar — range ≤8 days: unstable_cache **86400s**; wide range: cache "no-store"
Per-symbol: fetchEodhdEarningsCalendarForSymbol **86400s**
Week UI: hub snapshot via hub-snapshot-store
```

### Provider Reuse

**YES** — Size-aware caching; hub snapshot for week UI.

### Shared Cache Layers

Range cache **86400s**; per-symbol **86400s**; hub snapshot daily segment.

### Cache Invalidation

86400s TTL; date range parameter.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO**

### DAU Scaling

**NO**

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | PARTIALLY |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Good |

---

## 23. Logos (Logo.dev)

### Dataset Overview

**Purpose:** Company/crypto/logo images via Logo.dev upstream proxy.

**Provider(s):** Logo.dev (`img.logo.dev`); Google favicon fallback.

**Entry points:** `/api/media/logo`; fundamentals-derived logo URL strings in screener identity.

**Main loaders:** `lib/media/logo-proxy-upstream.ts`, `app/api/media/logo/route.ts`

### Call Graph

```
GET /api/media/logo → getCachedLogoFromUpstream
  → unstable_cache tag finsepa-logo-proxy-upstream-v4 **30d**
  → Logo.dev HTTP; budget cap FINSEPA_LOGO_DEV_MAX_REQUESTS_PER_30D default 500_000
```

### Provider Reuse

**YES** — One upstream fetch per `(kind, id, theme)` per 30d.

### Shared Cache Layers

`unstable_cache` **30d**; HTTP `public, max-age=2592000` (30d); upstream budget rolling 30d cap.

### Cache Invalidation

30d revalidate window.

### Cross-user Sharing

**YES**

### Runtime Dependency

**NO**

### DAU Scaling

**NO**

### Architecture Rating

**Excellent**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | YES |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | NO |
| Cached | YES |
| Confidence | High |
| Architecture Rating | Excellent |

---

## 24. Portfolio Overview Market

### Dataset Overview

**Purpose:** Portfolio overview strip — performance, inception open, yield from holdings.

**Provider(s):** EODHD via `getStockPerformance` / `getCryptoPerformance`, fundamentals yield.

**Entry points:** `/api/portfolio/overview-market`

**Main loaders:** `lib/portfolio/portfolio-overview-market-server.ts`

### Call Graph

```
GET /api/portfolio/overview-market
  → unstable_cache fast **60s** / slow **43200s**
  → getStockPerformance / getCryptoPerformance / fundamentals yield
  → Supabase portfolio_yield_pct_{T}, portfolio_inception_open_{T}_{ymd}
```

### Provider Reuse

**PARTIALLY** — Performance caches shared per ticker; portfolio-specific Supabase keys per user holdings hash.

### Shared Cache Layers

Fast: `["portfolio-overview-market-fast-v1"]` **60s**. Slow: `["portfolio-overview-market-slow-v1"]` **43200s**. HTTP: **30s/60s**.

### Cache Invalidation

60s / 43200s TTL; holdings change.

### Cross-user Sharing

**PARTIALLY**

### Runtime Dependency

**YES** — User holdings composition.

### DAU Scaling

**PARTIALLY** — Shared ticker performance; user-specific holdings fan-out.

### Architecture Rating

**Good**

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | PARTIALLY |
| Runtime dependent | YES |
| Requires provider every request | NO |
| Snapshot backed | PARTIALLY |
| Cached | YES |
| Confidence | Medium |
| Architecture Rating | Good |

---

## 25. User Notifications (Read Path)

### Dataset Overview

**Purpose:** In-app notification list for authenticated user.

**Provider(s):** **None** on read path — Supabase `user_notifications` only.

**Entry points:** `/api/notifications`

**Main loaders:** `lib/notifications/user-notifications-store.ts`

**Main API routes:** `/api/notifications`

### Call Graph

```
GET /api/notifications → user-notifications-store → Supabase query
```

### Provider Reuse

**N/A** — No external provider on read path.

### Shared Cache Layers

None for provider data. Supabase per-user rows.

### Cache Invalidation

N/A

### Cross-user Sharing

**NO** — Per-user notification rows.

### Runtime Dependency

**NO**

### DAU Scaling

**NO** — No provider cost.

### Architecture Rating

**Excellent** (for provider cost isolation)

### Dataset Summary

| Property | Value |
|----------|-------|
| Shared across users | NO |
| Runtime dependent | NO |
| Requires provider every request | NO |
| Snapshot backed | NO |
| Cached | N/A |
| Confidence | High |
| Architecture Rating | Excellent |

---


# Dataset Dependency Matrix

Which product flows consume each provider-backed dataset.

---

**Live Quotes**
- Stock Page
- Stock Live Price polling
- Crypto Page
- Portfolio live quotes (`portfolio-live-quotes-server.ts`)

**Extended Hours**
- Stock Page (client poll pre/post market)

**Daily Bars**
- Stock Page
- Stock Charts (fallback ranges)
- Stock Performance / header
- Portfolio Overview, History, Analytics, Benchmark, Period Returns, Dietz
- Watchlist Enrichment
- Markets / Screener (frozen session)
- Superinvestor Performance (rebuild)
- Extended Hours (close anchor)

**Intraday Bars**
- Stock Charts (1D live, 5D–ALL)
- Crypto Charts (1D live)
- Portfolio Value History (1D/7D/1M)
- Extended Hours (holiday detection)

**Fundamentals**
- Stock Page
- Stock Profile
- Key Statistics
- Stock Header Meta
- Watchlist Enrichment (off-universe)
- Portfolio Analytics (yield, sector)
- Screener rows
- Earnings Notifications (logo enrichment)

**Key Statistics**
- Stock Page
- Screener Companies tab
- Comparison slices

**Company Profile**
- Stock Page
- Profile API route

**Search**
- Search screen
- Global typeahead (Web / iOS)

**News**
- News screen
- Stock Page (news section via hub or asset snapshot)

**Macro Dashboard**
- Macro screen

**Superinvestor Data**
- Superinvestors list
- Superinvestor profile SSR
- Performance / transactions API routes

**Portfolio Benchmark EOD Bars**
- Portfolio Benchmark History
- Portfolio Benchmark Compare
- Portfolio Analytics

**Risk-Free Rate (FRED)**
- Portfolio Analytics (Sharpe/Sortino)

**Watchlist Enrichment**
- Watchlist screen

**Earnings Notifications (Ingest)**
- Notifications (indirect — cron creates rows; read path is Supabase)

**Market Snapshots**
- Markets / Screener tabs
- Heatmap
- Watchlist Enrichment (quote layer)
- Index cards

**Asset Snapshots**
- Stock Page SSR

**Dividends**
- Stock Dividends tab
- Portfolio Dividends Schedule

**Stock Splits**
- Stock Splits tab

**Insider Transactions**
- Stock Insider tab

**Economic Events**
- Economy week UI

**Earnings Calendar (UI)**
- Earnings week screen

**Logos**
- All screens displaying company logos (via `/api/media/logo` proxy)

**Portfolio Overview Market**
- Portfolio Overview screen

**User Notifications (Read Path)**
- Notifications screen (no provider)

---

# Flow → Dataset Matrix

Which datasets each user-facing flow depends on.

---

**Markets / Screener**
- Market Snapshots
- Live Quotes (realtime batches)
- Daily Bars (frozen session EOD)
- Fundamentals (derived metrics, screener rows)
- Key Statistics (companies tab cells)
- Logos

**Stock Page**
- Asset Snapshots
- Live Quotes
- Extended Hours
- Intraday Bars
- Daily Bars
- Fundamentals
- Key Statistics
- Company Profile
- News
- Dividends
- Stock Splits
- Insider Transactions
- Logos

**Portfolio Overview**
- Daily Bars
- Fundamentals
- Portfolio Overview Market
- Live Quotes
- Portfolio Benchmark EOD Bars

**Portfolio History**
- Daily Bars
- Intraday Bars

**Portfolio Analytics**
- Daily Bars
- Fundamentals
- Portfolio Benchmark EOD Bars
- Risk-Free Rate (FRED)

**Watchlist**
- Watchlist Enrichment
- Market Snapshots
- Live Quotes
- Daily Bars
- Fundamentals

**Search**
- Search

**News**
- News

**Macro**
- Macro Dashboard

**Superinvestors**
- Superinvestor Data
- Daily Bars (performance rebuild only)

**Notifications**
- User Notifications (read)
- Earnings Notifications (ingest, not user read)

**Earnings Week**
- Earnings Calendar (UI)

**Economy Week**
- Economic Events

---

# Provider Cost Surface

| Dataset | Shared Across Users | Snapshot Backed | TTL Cached | Runtime Dependent | Provider Called Directly | Scales With DAU | Confidence | Architecture Rating |
|---------|--------------------:|----------------:|-----------:|:-----------------:|:------------------------:|:---------------:|:----------:|:-------------------:|
| Live Quotes | PARTIALLY | NO | YES | YES | YES | PARTIALLY | Medium | Good |
| Extended Hours | PARTIALLY | NO | PARTIALLY | YES | YES | YES | High | Needs Improvement |
| Daily Bars | YES | PARTIALLY | YES | YES | YES | PARTIALLY | High | Good |
| Intraday Bars | PARTIALLY | NO | PARTIALLY | YES | YES | PARTIALLY | High | Good |
| Fundamentals | YES | PARTIALLY | YES | YES | YES | PARTIALLY | High | Good |
| Key Statistics | YES | YES | YES | YES | YES | PARTIALLY | High | Good |
| Company Profile | YES | PARTIALLY | YES | YES | YES | PARTIALLY | High | Good |
| Search | YES | NO | YES | YES | YES | PARTIALLY | High | Good |
| News | YES | YES | YES | NO | NO (user path) | NO | High | Excellent |
| Macro Dashboard | YES | YES | YES | PARTIALLY | PARTIALLY | NO | High | Excellent |
| Superinvestor Data | YES | YES | YES | NO | NO (user path) | NO | High | Excellent |
| Portfolio Benchmark EOD | YES | NO | YES | YES | YES | NO | High | Good |
| Risk-Free Rate (FRED) | YES | NO | YES | NO | YES | NO | High | Good |
| Watchlist Enrichment | PARTIALLY | PARTIALLY | YES | YES | YES | PARTIALLY | Medium | Good |
| Earnings Notifications | YES | YES | NO (ingest) | NO | YES (cron) | NO | High | Excellent |
| Market Snapshots | YES | YES | YES | YES | YES | NO | High | Excellent |
| Asset Snapshots | YES | YES | YES | YES | YES | PARTIALLY | High | Good |
| Dividends | YES | NO | YES | YES | YES | PARTIALLY | High | Good |
| Stock Splits | YES | NO | YES | NO | YES | NO | High | Good |
| Insider Transactions | YES | NO | YES | NO | YES | NO | High | Good |
| Economic Events | YES | NO | YES | NO | YES | NO | High | Acceptable |
| Earnings Calendar (UI) | YES | PARTIALLY | YES | NO | YES | NO | High | Good |
| Logos | YES | NO | YES | NO | YES | NO | High | Excellent |
| Portfolio Overview Market | PARTIALLY | PARTIALLY | YES | YES | YES | PARTIALLY | Medium | Good |
| User Notifications (read) | NO | NO | N/A | NO | NO | NO | High | Excellent |

---

# Architectural Risk Ranking

Sorted from safest (lowest provider-cost risk as DAU grows) to riskiest.

| Rank | Dataset | Risk | Confidence | Reason | Architecture Rating |
|:----:|---------|:----:|:----------:|--------|:-------------------:|
| 1 | User Notifications (read) | Safest | High | No external provider on read path | Excellent |
| 2 | News | Safest | High | User path snapshot-only; EODHD confined to cron ingest | Excellent |
| 3 | Superinvestor Data | Safest | High | User paths snapshot-only; SEC/EOD rebuild gated to cron/ops | Excellent |
| 4 | Earnings Notifications (ingest) | Safest | High | Ticker-union batching; not per-user fan-out | Excellent |
| 5 | Macro Dashboard | Low | High | Hub snapshot primary; user path reads one Supabase row | Excellent |
| 6 | Market Snapshots | Low | High | Epoch-scoped shared cache + durable Supabase blobs + single-flight rebuild | Excellent |
| 7 | Logos | Low | High | 30d cache + upstream budget cap | Excellent |
| 8 | Risk-Free Rate (FRED) | Low | High | Global 86400s cache | Good |
| 9 | Stock Splits | Low | High | Per-symbol 300s cache | Good |
| 10 | Insider Transactions | Low | High | 900s/43200s cache on 10-credit endpoint | Good |
| 11 | Economic Events | Low | High | 86400s cache | Acceptable |
| 12 | Earnings Calendar (UI) | Low | High | 86400s cache + hub snapshot | Good |
| 13 | Portfolio Benchmark EOD | Low | High | Canonical shared loader; SPY highly amortized | Good |
| 14 | Search | Low | High | Query-keyed 90s cache; local-first for short queries | Good |
| 15 | Company Profile | Low | High | Reuses fundamentals cache | Good |
| 16 | Fundamentals | Low–Medium | High | Shared 900s cache; scales with unique tickers not users directly | Good |
| 17 | Key Statistics | Low–Medium | High | Supabase cells + 43200s batch cache + fundamentals | Good |
| 18 | Daily Bars | Medium | High | Strong shared cache; uncached SSR/price-on-date escape paths | Good |
| 19 | Asset Snapshots | Medium | High | Shared per ticker; cold miss fan-out on long-tail tickers | Good |
| 20 | Intraday Bars | Medium | High | Strong historical caches; live allowlist 1D uncached per request | Good |
| 21 | Dividends | Medium | Medium | Shared per symbol; portfolio schedule per holdings | Good |
| 22 | Portfolio Overview Market | Medium | Medium | Shared ticker performance; user holdings fan-out | Good |
| 23 | Watchlist Enrichment | Medium | Medium | Session cache keyed by ticker-set; off-universe fundamentals | Good |
| 24 | Live Quotes | Medium–High | Medium | US spot well cached (15s); crypto BTC live uncached; client poll frequency UNKNOWN | Good |
| 25 | Extended Hours | Highest | High | Intentionally uncached delayed quote on ~60s client poll; scales with concurrent requests | Needs Improvement |

---

# Executive Summary

## 1. Which datasets are already architected correctly?

**Excellent rating (fully amortized hub/snapshot patterns):**
- News — user read path never calls EODHD; cron ingest writes shared hub snapshot
- Macro Dashboard — hub snapshot primary; per-series 86400s caches
- Superinvestor Data — user paths read Supabase snapshots only; SEC/EOD rebuild gated
- Earnings Notifications — ticker-union cron batching, not per-user
- Market Snapshots — epoch-scoped cross-user cache + durable Supabase + single-flight rebuild
- Logos — 30d shared cache with upstream budget cap
- User Notifications (read) — no provider on read path

**Good rating (shared cache with clear keys):**
- Fundamentals, Key Statistics, Company Profile, Search, Daily Bars, Intraday Bars, Asset Snapshots, Portfolio Benchmark EOD, Watchlist Enrichment, Portfolio Overview Market, Dividends, Splits, Insider Transactions, Earnings Calendar, Live Quotes (US regular session)

---

## 2. Which datasets fully amortize provider cost across users?

Provider work is fully shared regardless of DAU count (within cache/snapshot windows):

- News (user path)
- Macro Dashboard (hub hit path)
- Superinvestor Data (user path)
- Earnings Notifications (ingest batching)
- Market Snapshots
- Logos
- Risk-Free Rate (FRED)
- Stock Splits
- Insider Transactions
- Economic Events
- Earnings Calendar (UI)
- Portfolio Benchmark EOD (SPY window)
- User Notifications (read)

---

## 3. Which datasets are only partially amortized?

- **Live Quotes** — US regular-session spot coalesced 15s per ticker; crypto BTC live header uncached on fresh path
- **Extended Hours** — EOD anchor cached 60s; delayed quote uncached per poll
- **Daily Bars** — portfolio/chart caches shared; SSR cold miss and price-on-date bypass cache
- **Intraday Bars** — historical sessions cached 86400s; live allowlist 1D uncached per request
- **Fundamentals** — 900s shared cache; refresh path and unique tickers create new work
- **Key Statistics** — Supabase cells durable; new `(metricId, tickersKey)` combinations miss cache
- **Search** — 90s per query; unique queries create new work
- **Watchlist Enrichment** — shared for identical ticker-sets; different watchlists → different keys
- **Asset Snapshots** — shared per ticker; long-tail tickers cold-miss independently
- **Portfolio Overview Market** — ticker performance shared; holdings-specific paths vary

---

## 4. Which datasets require runtime validation before conclusions can be made?

| Dataset | What requires runtime measurement |
|---------|-----------------------------------|
| Live Quotes | Client poll interval for `/live-price`; crypto BTC request rate |
| Extended Hours | Client poll interval; concurrent user count on same ticker |
| Market Snapshots | Markets tab client call frequency vs 900s cache window |
| Watchlist Enrichment | Distinct `tickersKey` diversity across users |
| Asset Snapshots | Long-tail ticker cold-miss rate vs popular ticker hit rate |
| Key Statistics | Screener `(metricId, tickersKey)` cache hit ratio |
| Search | Unique query rate vs 90s cache |
| Macro Dashboard | Frequency of BTC ETF live-refresh exception on user path |
| Portfolio routes | Holdings count distribution per user (fan-out to Daily Bars) |

Static analysis proves cache architecture exists; hit ratios and client polling patterns cannot be derived from code alone.

---

## 5. Which datasets represent the highest architectural risk for provider cost as DAU grows?

**Highest risk:**

1. **Extended Hours** — `fetchEodhdUsQuoteDelayed` explicitly has no cross-user cache; loader comment documents fresh provider row on every request with ~60s client poll. Provider cost scales with concurrent poll requests per ticker.

2. **Live Quotes (crypto BTC live path)** — `getCryptoLiveSpotForHeader` has no server `unstable_cache`; route uses `CACHE_CONTROL_PRIVATE_NO_STORE`. Provider cost per API request on cache miss paths.

3. **Live Quotes (US regular session)** — Architecture is sound (15s cross-user cache) but client poll frequency is UNKNOWN; if polling exceeds cache window coalescing benefit, provider cost rises.

**Medium risk:**

4. **Intraday Bars (live allowlist 1D)** — `loadStockChartPointsUncached` bypasses chart cache during WS regular/post session.

5. **Asset Snapshots (long-tail tickers)** — Cold miss triggers full EODHD fan-out per ticker per segment; popular tickers amortize, long-tail does not.

6. **Fundamentals / Key Statistics** — Shared 900s cache; high unique-ticker diversity increases miss rate (UNKNOWN without traffic data).

**Lowest risk (already validated in code):**

News, Superinvestor Data, Earnings Notifications ingest, Market Snapshots, Macro hub path, Logos — user traffic does not directly invoke providers or uses fully shared snapshots.

---

## Cross-cutting findings

- **`unstable_cache` scope:** Per deployment Node instance — not global cross-host (`eodhd-hourly-budget.ts` comment). Multi-instance deployments duplicate cache misses across instances (UNKNOWN exact multiplier without infra topology).

- **EODHD budget gate:** Default `FINSEPA_EODHD_MAX_REQUESTS_PER_HOUR` = **4000** per instance (`lib/market/eodhd-hourly-budget.ts`). Rejects provider calls when budget exhausted — architecture gate, not cache.

- **US session epoch:** `getScreenerUsMarketCacheEpoch()` drives shared segments for Markets, watchlist, asset snapshots — live 15m slots (`REVALIDATE_SCREENER_MARKET_LIVE` = **900s**) or frozen close-day segments (`revalidate: false`).

- **Provider HTTP layer:** All EODHD fetches use `fetchEodhd` with `cache: "no-store"`. Caching is exclusively at Next Data Cache, Supabase snapshots, or in-process memory — never at provider HTTP layer.

---

*Document generated from static codebase analysis. No provider request counts. No optimization recommendations.*

