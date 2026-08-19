# Finsepa API Call Reduction Audit v1

## Purpose

This audit identifies where Finsepa performs duplicate, redundant, or unnecessary provider work.

The goal is **NOT** to optimize code.
The goal is **NOT** to improve performance.
The goal is **NOT** to redesign architecture.

The only goal is to identify where external provider work (EODHD, FRED, BLS, SEC, Logo.dev, etc.) can occur more than necessary because identical data is fetched, computed, or transferred multiple times.

---

## Core Question

If every external provider request had a real monetary cost, where does Finsepa currently perform redundant provider work?

---

## Extremely Important Rules

- Do NOT estimate provider request counts.
- Do NOT estimate savings.
- Do NOT invent runtime behavior.
- Do NOT use probabilistic language.
- Do NOT recommend optimizations.
- Do NOT write TODO items.
- Do NOT redesign architecture.
- Never assume cache hit rates.
- Never assume client behavior.
- Never infer polling frequency unless directly present in the code.
- Only use evidence from static code analysis.
- If something cannot be proven statically, write **UNKNOWN** and explain exactly why.
- Never convert provider function calls into provider HTTP request counts.
- Every finding must be supported by direct code evidence.

---

## Finding 1

### Finding Summary

On stock page cold SSR load, daily EOD bars for the same ticker and date window are fetched through both a direct `fetchEodhdEodDaily` call and `getStockPerformance` inside `loadKeyIndicatorsForPage`.

### Provider

EODHD — `GET /api/eod/{symbol}` via `fetchEodhdEodDaily`.

### Dataset

Daily Bars (adjusted EOD closes, ~10-year lookback matching `STOCK_CHART_ALL_LOOKBACK_YEARS`).

### Duplicate Paths

```
Stock Page SSR (cold uncached)
  loadStockPageInitialDataUncached(ticker)
    → fetchEodhdEodDaily(ticker, from, to)          [direct, no unstable_cache]

AND (same Promise.allSettled batch)

  loadStockPageInitialDataUncached(ticker)
    → loadKeyIndicatorsForPage(ticker)
      → computeHotTier / computeSlowTier
        → getStockPerformance(ticker)
          → loadStockPerformanceUncached(ticker)
            → fetchEodhdEodDaily(sym, from, to)     [via getStockPerformance unstable_cache miss path]
```

Code: `lib/market/stock-page-initial-data.ts` L306, L334–335, L329–341; `lib/market/stock-key-indicators-service.ts` L48–50, L69; `lib/market/stock-performance.ts` L108–117.

### Why this is redundant

Both paths call `fetchEodhdEodDaily` with the same ticker and the same lookback window (`STOCK_CHART_ALL_LOOKBACK_YEARS` in `loadStockPerformanceUncached` and `loadStockPageInitialDataUncached`). The direct call bypasses `getStockPerformance`'s `unstable_cache`. They execute concurrently in `Promise.allSettled` — no in-flight deduplication exists at the `fetchEodhdEodDaily` layer.

### Existing Shared Layers

- `unstable_cache` on `getStockPerformance` — tag `["stock-performance-v8-annual-year-fallback"]`, **60s** (`lib/market/stock-performance.ts` L123–127)
- `loadPortfolioEodBars` canonical loader — **not used** by stock page uncached path
- No shared in-flight dedupe on raw `fetchEodhdEodDaily`

### Is duplicate provider work actually proven?

**YES** — Both call sites are in the same function (`loadStockPageInitialDataUncached`) invoked in parallel. The direct path does not reuse bars already fetched for performance computation.

### Is duplicate work already amortized?

**NO** — Within a single cold SSR uncached load, both paths independently reach `fetchEodhdEodDaily`. Cross-request amortization via `getStockPerformance` `unstable_cache` applies only when that cache is warm from a prior request.

### Runtime Dependency

**PARTIALLY** — Duplicate execution on cold uncached SSR is proven statically. Whether `loadStockPageInitialData` (snapshot hit path) avoids the direct `fetchEodhdEodDaily` depends on snapshot presence at request time (**UNKNOWN** without runtime state).

### Architecture Impact

**Moderate**

### Confidence

**High**

---

## Finding 2

### Finding Summary

The same EODHD daily-bar provider dataset is stored and fetched through four independent loader/cache namespaces with no shared key.

### Provider

EODHD — `GET /api/eod/{symbol}`.

### Dataset

Daily Bars.

### Duplicate Paths

```
Path A: fetchEodhdEodDaily(symbol, from, to)
  → fetchEodhd (cache: "no-store")
  Used by: stock-page uncached SSR, stock-chart-data fallbacks, stock-performance, price-on-date route

Path B: loadPortfolioSymbolEodBars → getCachedEquityBars
  → fetchEodhdEodDaily / fetchEodhdEodDailyRetry
  Cache tag: ["portfolio-eod-equity-bars-v1"], key portfolio-eod-bars-v1|equity|..., **60s**

Path C: getStockPerformance → loadStockPerformanceUncached → fetchEodhdEodDaily
  Cache tag: ["stock-performance-v8-annual-year-fallback"], **60s**

Path D: fetchEodhdEodDailyScreener(symbol, from, to)
  → readScreenerEodBarsSnapshot(sym) OR fetchEodhd + upsertScreenerEodBarsSnapshot
  Supabase key screener_eod_bars_{SYMBOL}; fetch hint revalidate **300s**
```

Code: `lib/market/eodhd-eod.ts` L131–174, L227–274; `lib/portfolio/data/load-portfolio-eod-bars.ts` L60–72; `lib/market/stock-performance.ts` L123–127.

### Why this is redundant

All four paths request the same EODHD EOD endpoint for the same `(symbol, from, to)` tuples. Each path maintains its own cache namespace. A warm entry in one namespace does not populate another.

### Existing Shared Layers

Four separate layers listed above. No cross-namespace invalidation or shared key links them.

### Is duplicate provider work actually proven?

**PARTIALLY** — Independent loader trees are proven. Whether two namespaces miss simultaneously for the same tuple depends on cache state at request time (**UNKNOWN**).

### Is duplicate work already amortized?

**PARTIALLY** — Each namespace amortizes within its own key. Cross-namespace reuse does not occur.

### Runtime Dependency

**YES** — Cache hit state per namespace at request time determines whether duplicate provider HTTP occurs.

### Architecture Impact

**Moderate**

### Confidence

**High**

---

## Finding 3

### Finding Summary

Stock page SSR independently transforms the same EODHD fundamentals JSON into header meta, company profile, key-stats bundle, and key-indicators through separate loader trees.

### Provider

EODHD — `GET /api/fundamentals/{symbol}.US`.

### Dataset

Fundamentals JSON.

### Duplicate Paths

```
loadStockPageInitialDataUncached → Promise.allSettled:
  getStockDetailHeaderMetaForPage(ticker)
    → getCachedStockHeaderIdentity → buildHeaderIdentityUncached → fetchEodhdFundamentalsJson
    → getCachedStockHeaderEarningsLine → buildHeaderEarningsLineUncached → fetchEodhdFundamentalsJson

  buildStockKeyStatsBundle(ticker)
    → fetchFundamentalsRootForMetrics → fetchEodhdFundamentalsJson
    → fetchEodhdKeyStats* × 9 (in-process parse of same root)

  fetchEodhdStockProfile(ticker)
    → fetchEodhdFundamentalsJson → parse General/Highlights

  loadKeyIndicatorsForPage(ticker)
    → computeSlowTier → fetchEodhdFundamentalsJson
```

Code: `lib/market/stock-page-initial-data.ts` L329–336; `lib/market/stock-header-meta-server.ts` L32–36, L68–71; `lib/market/stock-key-stats-bundle.ts` L35–37; `lib/market/eodhd-stock-profile.ts` L115–116; `lib/market/stock-key-indicators-service.ts` L64.

### Why this is redundant

Multiple independent code paths each call `fetchEodhdFundamentalsJson` and independently parse/transform the same provider payload into different response shapes (header identity, earnings line, profile, nine key-stat sections, key indicators).

### Existing Shared Layers

- React `cache()` — `fetchEodhdFundamentalsJsonPerRequest` coalesces parallel calls within one RSC request (`lib/market/eodhd-fundamentals.ts` L417–418)
- `unstable_cache` — `["eodhd-fundamentals-json-v9-inflight-dedupe"]`, **900s**
- Separate derived caches: `["stock-header-identity-v3-country"]` **43200s**, `["stock-header-earnings-line-v2-fiscal-quarter"]` **900s**, `["stock-key-stats-bundle-v4-insiders-short"]` **43200s**

Provider fetch may coalesce within one request via React `cache()`. Transformation/parsing into separate derived objects occurs independently in each loader regardless.

### Is duplicate provider work actually proven?

**PARTIALLY** — Duplicate transformation paths are proven. Duplicate provider HTTP within one SSR request is prevented by React `cache()` when all calls occur in the same request context. Duplicate provider HTTP across separate API requests is **UNKNOWN**.

### Is duplicate work already amortized?

**PARTIALLY** — Provider JSON fetch amortized within request (React `cache()`) and across requests (`unstable_cache` **900s**). Derived-object construction is not shared.

### Runtime Dependency

**YES** — Whether calls share one RSC request context vs separate HTTP API requests determines provider coalescing.

### Architecture Impact

**Low** (provider fetch); **Moderate** (duplicate transformation compute)

### Confidence

**High**

---

## Finding 4

### Finding Summary

Stock page SSR loads live spot and 1D chart data, then the client independently calls the same API routes for identical datasets.

### Provider

EODHD — realtime, delayed quote, intraday (via chart/spot loaders).

### Dataset

Live Quotes; Intraday Bars (1D chart).

### Duplicate Paths

```
SSR (snapshot hit, live session):
  loadStockPageInitialData → loadStockPageHotFields
    → getStockChartPointsForApi(ticker, range, "price")
    → getStockSpotQuoteForApi(ticker)

Client (stock-page-content.tsx):
  useEffect [liveRegularSessionActive]:
    setInterval(tick, STOCK_1D_LIVE_PRICE_POLL_MS)     → GET /api/stocks/{ticker}/live-price

  useEffect [liveRegularSessionActive] (mount prime):
    fetch /api/stocks/{ticker}/live-price
    fetch /api/stocks/{ticker}/chart?range=1D&series=price
```

Code: `lib/market/stock-page-initial-data.ts` L239–241; `components/stock/stock-page-content.tsx` L551, L607–608, L648, L655–666; `lib/chart/stock-1d-live-session-chart.ts` L696 (`STOCK_1D_LIVE_PRICE_POLL_MS = 15_000`).

Client comment L551: "client poll refines SSR `headerLiveSpotUsd`".

### Why this is redundant

Identical provider-backed datasets (spot quote, 1D chart points) are loaded server-side during SSR hot-field refresh, then loaded again via client HTTP to the same API routes that invoke the same loaders (`getStockSpotQuoteForApi`, `getStockChartPointsForApi`).

### Existing Shared Layers

- `unstable_cache` spot: `["stock-spot-quote-1d-live-v11-minute-store"]` **15s** (regular session)
- `unstable_cache` chart: varies by range; live 1D allowlist bypasses cache in `getStockChartPointsForApi`
- HTTP `Cache-Control: no-store` on live-price route

### Is duplicate provider work actually proven?

**PARTIALLY** — Duplicate endpoint traversal (SSR loader → client API → same loader) is proven. Duplicate provider HTTP depends on whether `unstable_cache` is warm when the client request arrives (**UNKNOWN**).

### Is duplicate work already amortized?

**PARTIALLY** — Spot quote has **15s** cross-user `unstable_cache` matching client poll interval constant. Live 1D chart allowlist path bypasses chart cache on API branch.

### Runtime Dependency

**YES** — Time elapsed between SSR hot-field load and first client poll; cache TTL state; US market session branch.

### Architecture Impact

**Moderate**

### Confidence

**High**

---

## Finding 5

### Finding Summary

Extended-hours header polling calls an uncached EODHD delayed-quote fetch on every API request while also loading daily bars through `getStockPerformance` for the close anchor.

### Provider

EODHD — `us-quote-delayed`; EOD daily bars via `getStockPerformance`.

### Dataset

Extended Hours quote; Daily Bars (close anchor).

### Duplicate Paths

```
Client poll (stock-page-content.tsx):
  setInterval(load, STOCK_1D_LIVE_PRICE_POLL_MS)       [15_000 ms]
    → GET /api/stocks/{ticker}/extended-hours
      → getStockExtendedHoursQuoteForApi
        → fetchEodhdUsQuoteDelayed(ticker)              [no cache — comment L389]
        → getStockPerformance(sym)                      [unstable_cache 60s]
          → fetchEodhdEodDaily
```

Code: `lib/market/stock-extended-hours-header.ts` L335, L389–390, L400; `components/stock/stock-page-content.tsx` L963.

Loader comment: "~60s client poll — always fetch a fresh provider row (no cross-user quote cache)." Client code uses `STOCK_1D_LIVE_PRICE_POLL_MS` (**15s**), not 60s.

### Why this is redundant

Each poll triggers `fetchEodhdUsQuoteDelayed` without any server cache. The close anchor reuses `getStockPerformance` (**60s** cache) but the delayed-quote row is fetched fresh every request. If multiple users poll the same ticker, each request independently calls the provider for the delayed quote.

### Existing Shared Layers

- None on `fetchEodhdUsQuoteDelayed`
- `getStockPerformance` `unstable_cache` **60s** for EOD anchor only
- React `cache()` on `fetchEodhdUsRealtime` for session-active check (separate provider call)

### Is duplicate provider work actually proven?

**YES** — Code explicitly documents no cache on delayed quote. Polling interval is defined in client code (**15s**).

### Is duplicate work already amortized?

**NO** — Delayed quote path has no cross-user or TTL cache. EOD anchor amortized at **60s** only.

### Runtime Dependency

**YES** — Number of concurrent polling clients per ticker (**UNKNOWN**). Whether extended-hours header is shown depends on session eligibility checks at runtime.

### Architecture Impact

**High**

### Confidence

**High**

---

## Finding 6

### Finding Summary

`fetchEodhdUsQuoteDelayed` is reached through two independent loader trees with no shared cache.

### Provider

EODHD — `GET /api/us-quote-delayed`.

### Dataset

US delayed quote row.

### Duplicate Paths

```
Path A — Live spot fallback:
  getStockSpotQuoteForApi → fetchStockSpotQuoteUncached
    → fetchEodhdUsQuoteDelayed(sym)
  File: lib/market/stock-chart-data.ts L1387

Path B — Extended hours header:
  getStockExtendedHoursQuoteForApi → buildStockExtendedHoursHeaderQuote
    → fetchEodhdUsQuoteDelayed(ticker)
  File: lib/market/stock-extended-hours-header.ts L335
```

Both call `lib/market/eodhd-us-quote-delayed.ts` with `fetchEodhd` `cache: "no-store"`.

### Why this is redundant

Two independent code paths fetch the same provider dataset for the same ticker without a shared cache layer between them.

### Existing Shared Layers

None on delayed quote. Spot path may be gated by `unstable_cache` on the outer `getStockSpotQuoteForApi` wrapper; extended-hours path has no wrapper cache.

### Is duplicate provider work actually proven?

**PARTIALLY** — Duplicate loader trees proven. Both paths executing for the same ticker in the same time window depends on session state and which endpoints the client calls (**UNKNOWN**).

### Is duplicate work already amortized?

**NO** — No shared cache on the delayed-quote fetch itself.

### Runtime Dependency

**YES** — US market session; whether spot fallback activates vs extended-hours poll runs.

### Architecture Impact

**Moderate**

### Confidence

**High**

---

## Finding 7

### Finding Summary

Nine individual key-stats section API routes and one bundle route independently reach `fetchEodhdFundamentalsJson` when called without a pre-fetched fundamentals root.

### Provider

EODHD — fundamentals JSON.

### Dataset

Fundamentals; Key Statistics (derived).

### Duplicate Paths

```
GET /api/stocks/[ticker]/key-stats-bundle
  → buildStockKeyStatsBundle → fetchFundamentalsRootForMetrics → fetchEodhdFundamentalsJson
  → passes root to all 9 fetchEodhdKeyStats* parsers

GET /api/stocks/[ticker]/key-stats-basic
  → fetchEodhdKeyStatsBasic(routeTicker)               [no root passed]
    → fetchEodhdFundamentalsJson(ticker)                 [L28 when fundamentalsRoot omitted]

[Same pattern for key-stats-valuation, -margins, -growth, -returns, -dividends, -risk, -revenue-profit, -assets-liabilities]
```

Code: `app/api/stocks/[ticker]/key-stats-basic/route.ts` L21; `lib/market/eodhd-key-stats-basic.ts` L24–28; `app/api/stocks/[ticker]/key-stats-bundle/route.ts` L17–18; nine section routes exist under `app/api/stocks/[ticker]/key-stats-*/route.ts`.

SSR also loads bundle: `loadStockPageInitialDataUncached` L333 → `buildStockKeyStatsBundle`. Client may reload: `components/stock/key-stats.tsx` L726 → `/key-stats-bundle`.

### Why this is redundant

The bundle route fetches fundamentals once and fans out to nine parsers. Each section route independently calls its parser without passing `fundamentalsRoot`, causing a separate `fetchEodhdFundamentalsJson` invocation per section route call.

### Existing Shared Layers

- `unstable_cache` on bundle route: `["stock-key-stats-bundle-v4-insiders-short"]`, **43200s**
- `unstable_cache` on fundamentals: **900s**
- React `cache()` within request

### Is duplicate provider work actually proven?

**PARTIALLY** — Duplicate API exposure and independent fetch paths proven. Whether a client calls section routes vs bundle in practice is **UNKNOWN**.

### Is duplicate work already amortized?

**PARTIALLY** — Fundamentals `unstable_cache` **900s** may serve section routes if called within TTL after bundle load. Section routes have no dedicated cache wrapper.

### Runtime Dependency

**YES** — Which API routes the client invokes; cache state at call time.

### Architecture Impact

**Moderate**

### Confidence

**High**

---

## Finding 8

### Finding Summary

Fundamentals charting series are computed on SSR via an uncached loader and exposed again through a separate cached API route using a different cache entry.

### Provider

EODHD — fundamentals JSON (via `fetchFundamentalsRootForMetrics` inside charting series loader).

### Dataset

Fundamentals-derived charting series (annual/quarterly).

### Duplicate Paths

```
SSR:
  loadStockPageInitialDataUncached
    → fetchChartingSeriesWithDailyBars(ticker, "annual", sorted)
    → fetchChartingSeriesUncached(ticker, mode, sortedDailyBars)    [no unstable_cache wrapper]

Client (financials / multicharts tabs):
  GET /api/stocks/{ticker}/fundamentals-series?period={annual|quarterly}
    → fetchChartingSeries(ticker, mode)
      → unstable_cache(["eodhd-charting-series-v27-ttm-rollup"], **300s**)
        → fetchChartingSeriesUncached(ticker, mode)                   [no daily bars passed]
```

Code: `lib/market/stock-page-initial-data.ts` L310–315; `lib/market/eodhd-charting-series.ts` L1925–1956; `app/api/stocks/[ticker]/fundamentals-series/route.ts` L49; `components/stock/stock-financials-tab.tsx` L113.

SSR comment L1958: "reuse 100y EOD bars already fetched for performance/chart." API route does not receive pre-fetched daily bars.

### Why this is redundant

The same `fetchChartingSeriesUncached` transformation runs through two entry points. SSR result is stored in page payload (`fundamentalsSeriesAnnual`, `fundamentalsSeriesQuarterly`). Client tabs fetch `/fundamentals-series` which re-enters the loader tree independently.

### Existing Shared Layers

- `unstable_cache` on `fetchChartingSeries` — **300s**
- Fundamentals `unstable_cache` **900s** (shared upstream)
- SSR page payload (not a cache layer for API route)

### Is duplicate provider work actually proven?

**PARTIALLY** — Duplicate loader exposure proven. Client tab fetch after SSR may hit `fetchChartingSeries` `unstable_cache` if populated (**UNKNOWN** — SSR path bypasses that wrapper).

### Is duplicate work already amortized?

**PARTIALLY** — Fundamentals upstream cache may amortize provider JSON fetch. Charting series computation may run twice (SSR uncached + API cached miss).

### Runtime Dependency

**YES** — Whether client tab mounts and calls API; cache warm state.

### Architecture Impact

**Moderate**

### Confidence

**High**

---

## Finding 9

### Finding Summary

Stock news is loaded on SSR and independently exposed through a paginated API route called by the client news component.

### Provider

EODHD — `GET /api/news?s={symbol}` via `loadStockNewsPage`.

### Dataset

Stock News (per-ticker).

### Duplicate Paths

```
SSR:
  loadStockPageInitialDataUncached → getStockNews(ticker)
    → unstable_cache(["stock-news-v8-overview-no-og"], **60s**)
      → loadStockNewsPage(ticker, 0, STOCK_NEWS_PAGE_SIZE)

Client:
  components/stock/latest-news.tsx
    → GET /api/stocks/{sym}/news?offset=0&limit={PAGE_SIZE}&images=1
      → getStockNews / loadStockNewsPage
```

Code: `lib/market/stock-page-initial-data.ts` L335; `lib/market/stock-news.ts` L156–160; `components/stock/latest-news.tsx` L282, L310; `app/api/stocks/[ticker]/news/route.ts`.

### Why this is redundant

Same provider-backed news page is loaded during SSR initial payload and again via client HTTP to `/api/stocks/{ticker}/news` for the same ticker and offset 0.

### Existing Shared Layers

- `unstable_cache` — `["stock-news-v8-overview-no-og"]`, **60s**
- Client requests add `images=1` parameter — may differ from SSR `{ resolveOgImages: false }` path

### Is duplicate provider work actually proven?

**PARTIALLY** — Duplicate endpoint/loader exposure proven. SSR uses `resolveOgImages: false`; client API may take a different code branch for image resolution (**UNKNOWN** whether that triggers additional provider work).

### Is duplicate work already amortized?

**PARTIALLY** — **60s** `unstable_cache` on `getStockNews` may serve client request if key matches.

### Runtime Dependency

**YES** — Whether news tab mounts and refetches; `images=1` branch behavior.

### Architecture Impact

**Low**

### Confidence

**Medium**

---

## Finding 10

### Finding Summary

Live EODHD realtime quotes for overlapping ticker sets are fetched through independent batch loader trees in markets/screener, portfolio, and watchlist enrichment.

### Provider

EODHD — realtime multi-symbol (`fetchEodhdRealtimeSymbolsRaw`).

### Dataset

Live Quotes (batch realtime).

### Duplicate Paths

```
Markets / Screener:
  simple-market-layer.ts → loadSimpleMarketDataBatch
    → fetchEodhdRealtimeSymbolsRaw(symbolList)         [L273, L310]

Portfolio:
  portfolio-live-quotes-server.ts → fetchPortfolioLivePricesUsd
    → fetchEodhdRealtimeSymbolsRaw(stockEodhd)        [L46]

Watchlist:
  watchlist-enrichment.ts → buildWatchlistStockBatch
    → getSimpleMarketDataForWatchlistStocks → (via simple-market-layer)
    → fetchEodhdRealtimeSymbolsRaw
```

Code: `lib/market/simple-market-layer.ts`; `lib/portfolio/portfolio-live-quotes-server.ts` L29–46; `lib/market/watchlist-enrichment.ts`.

All use `fetchEodhd` `cache: "no-store"` at provider layer. Session cache via `withScreenerUsMarketCache` wraps watchlist and screener paths with epoch segment keys.

### Why this is redundant

The same provider realtime batch endpoint is independently invoked by separate loader trees. Tickers appearing in a user's portfolio holdings and watchlist and screener views may be fetched through separate batch requests within the same session segment.

### Existing Shared Layers

- `withScreenerUsMarketCache` — screener/watchlist (**900s** live segment)
- `market_snapshot` durable blobs — screener paths read before live fan-out
- No shared cache between portfolio-live-quotes and screener session cache

### Is duplicate provider work actually proven?

**PARTIALLY** — Independent loader trees proven. Overlap of ticker sets across concurrent flows is **UNKNOWN**.

### Is duplicate work already amortized?

**PARTIALLY** — Screener/watchlist share epoch-scoped session cache. Portfolio live quotes use a separate path without proven sharing with screener cache.

### Runtime Dependency

**YES** — User holdings composition; watchlist contents; which screens are active concurrently.

### Architecture Impact

**Moderate**

### Confidence

**Medium**

---

## Finding 11

### Finding Summary

Asset snapshot hits still reload live chart and spot through `loadStockPageHotFields` on every page request during live session, duplicating the hot-field loader tree used by client polling endpoints.

### Provider

EODHD — intraday/realtime (chart + spot loaders).

### Dataset

Live Quotes; Intraday Bars (1D).

### Duplicate Paths

```
loadStockPageInitialData (snapshot hit, live session):
  readAssetSnapshotForPage → assetSnapshotPayloadToPageData
    → loadStockPageHotFields(ticker, range, [], now)
      → getStockChartPointsForApi
      → getStockSpotQuoteForApi

Comment L394–395: "refresh 1D chart + live spot only (live session)"

AND client polling (Finding 4) to same API routes
```

Code: `lib/market/stock-page-initial-data.ts` L410–423, L392–395.

Snapshot stores stripped hot fields (`stripAssetSnapshotHotFields`) — chart points empty in live mode per v3 audit evidence.

### Why this is redundant

Durable snapshot exists for cold fields, but hot fields are intentionally re-fetched on every snapshot hit during live session through the same loaders the client API routes also invoke.

### Existing Shared Layers

- Asset snapshot Supabase row — cold fields only
- Spot `unstable_cache` **15s**; chart cache varies
- Client poll **15s** (`STOCK_1D_LIVE_PRICE_POLL_MS`)

### Is duplicate provider work actually proven?

**PARTIALLY** — Server-side hot-field reload on every snapshot hit is proven. Overlap with client poll timing is **UNKNOWN**.

### Is duplicate work already amortized?

**PARTIALLY** — **15s** spot cache may coalesce server hit + client poll within window.

### Runtime Dependency

**YES** — Snapshot hit vs miss; live vs frozen session mode.

### Architecture Impact

**Moderate**

### Confidence

**High**

---

## Finding 12

### Finding Summary

The iOS/native `page-initial` API route invokes the same aggregated loader as stock page SSR, exposing identical provider-backed datasets through a second HTTP entry point.

### Provider

All providers reached by `loadStockPageInitialData` (EODHD fundamentals, EOD, intraday, realtime, news, etc.).

### Dataset

Full stock page initial payload (composite).

### Duplicate Paths

```
Web SSR:
  app/stock/[ticker]/page.tsx → loadStockPageInitialData(ticker)

iOS / native:
  GET /api/stocks/[ticker]/page-initial → loadStockPageInitialData(routeTicker)
```

Code: `app/api/stocks/[ticker]/page-initial/route.ts` L12–14, L32; comment L11–12: "Reuses SSR `loadStockPageInitialData`".

### Why this is redundant

Identical loader orchestration serves two HTTP entry points. A native client requesting `page-initial` and a web SSR render for the same ticker both traverse the full provider loader tree independently.

### Existing Shared Layers

- Asset snapshot (`asset_{TICKER}`) — shared across entry points
- All underlying dataset caches (fundamentals, performance, etc.)

### Is duplicate provider work actually proven?

**PARTIALLY** — Duplicate entry points proven. Concurrent web + iOS requests for same ticker depend on client usage (**UNKNOWN**).

### Is duplicate work already amortized?

**PARTIALLY** — Asset snapshot and per-dataset caches may amortize if warm.

### Runtime Dependency

**YES** — Which clients request simultaneously; snapshot/cache state.

### Architecture Impact

**Low**

### Confidence

**High**

---

## Finding 13

### Finding Summary

Stock page uncached SSR fetches daily EOD bars directly and simultaneously requests 1D chart points through a separate loader that may independently reach EODHD intraday or daily endpoints for the same ticker.

### Provider

EODHD — EOD daily (`fetchEodhdEodDaily`); intraday (`fetchEodhdIntraday`) inside chart loader.

### Dataset

Daily Bars; Intraday Bars.

### Duplicate Paths

```
loadStockPageInitialDataUncached:
  fetchEodhdEodDaily(ticker, from, to)                  [barsPromise, L306]

AND (parallel):

  getStockChartPointsForApi(ticker, "1D", "price")      [L332]
    → loadStockChartPointsUncached / getStockChartPoints
      → load1DChartPoints → fetchEodhdIntraday and/or fetchEodhdEodDaily fallbacks
```

Code: `lib/market/stock-page-initial-data.ts` L306, L332; `lib/market/stock-chart-data.ts` (intraday/EOD fallback branches).

Comment L261: "One EOD daily fetch powers overview chart + mini-table together" — applies to bars used in `computeStockPerformanceFromSortedDailyBars`, not to chart loader's independent provider calls.

### Why this is redundant

Daily bars are fetched once for performance computation, but chart loader independently traverses provider paths for overlapping price history rather than exclusively reusing the pre-fetched sorted bars for chart point resolution (chart uses `resolveOverviewChartPoints` with sorted fallback only after chart loader returns).

### Existing Shared Layers

- `unstable_cache` on `getStockChartPoints` — **60s**
- Sorted daily bars available in same function scope but chart loader invoked before merge in parallel batch

### Is duplicate provider work actually proven?

**PARTIALLY** — Parallel independent provider loader invocations proven. Whether chart loader hits intraday vs reuses EOD fallback depends on ticker/session branch (**UNKNOWN** statically for all tickers).

### Is duplicate work already amortized?

**PARTIALLY** — Chart `unstable_cache` may serve repeat requests. Within single uncached SSR load, both run concurrently.

### Runtime Dependency

**YES** — Chart range branch; allowlist membership; session mode.

### Architecture Impact

**Moderate**

### Confidence

**Medium**

---

## Finding 14

### Finding Summary

`fetchEodhdUsRealtime` is invoked from multiple independent loader trees (spot quote, chart gap-fill, live-session detection) with per-request dedupe only.

### Provider

EODHD — `GET /api/real-time/{symbol}`.

### Dataset

Live Quotes (realtime).

### Duplicate Paths

```
stock-chart-data.ts:
  fetchStockSpotQuoteUncached → fetchEodhdUsRealtime          [L1378]
  build1DSessionOhlcAnchorChart → fetchEodhdUsRealtime       [L518, L635, L678]
  fillTodaySessionChartGaps → (intraday + realtime anchors)

us-equity-live-session-server.ts:
  resolveUsEquityLiveRegularSessionActive → fetchEodhdUsRealtime [L67]

stock-extended-hours-header.ts:
  resolveUsEquityLiveRegularSessionActive (via import chain)
```

Code: `lib/market/eodhd-realtime.ts` L54–60 — React `cache()` per request only.

### Why this is redundant

Multiple loader trees independently call the same realtime provider function. Coalescing exists only within a single RSC/API request via React `cache()`. Across separate API requests (live-price poll, chart poll, extended-hours poll), no shared TTL cache wraps realtime fetch.

### Existing Shared Layers

- React `cache()` — `fetchEodhdUsRealtimePerRequest` (request-scoped)
- Spot outer `unstable_cache` **15s** (wraps full spot quote, not realtime alone)
- No standalone realtime `unstable_cache`

### Is duplicate provider work actually proven?

**PARTIALLY** — Multiple independent call sites proven. Concurrent separate HTTP requests each potentially reaching realtime provider is **UNKNOWN**.

### Is duplicate work already amortized?

**PARTIALLY** — Within one API request, React `cache()` dedupes. Across requests, no dedicated realtime cache.

### Runtime Dependency

**YES** — Which endpoints are called concurrently; request isolation boundaries.

### Architecture Impact

**Moderate**

### Confidence

**High**

---

## Finding 15

### Finding Summary

Key-stats bundle is loaded on SSR and the client independently fetches the same bundle API route even when SSR already provided content.

### Provider

EODHD — fundamentals JSON (via `buildStockKeyStatsBundle`).

### Dataset

Key Statistics bundle.

### Duplicate Paths

```
SSR:
  loadStockPageInitialDataUncached → buildStockKeyStatsBundle(ticker)

Client (key-stats.tsx):
  if (initialHasContent) { setBundle(initialBundle); ... if (initialHasLatestRows) return; }
  fetch /api/stocks/{ticker}/key-stats-bundle
```

Code: `components/stock/key-stats.tsx` L710–726; comment L713: "Stale SSR/API cache can omit newly added rows — soft-refresh once."

### Why this is redundant

Client may call `/key-stats-bundle` after SSR already included `keyStatsBundle` in page payload. Soft-refresh occurs when `initialHasLatestRows` is false.

### Existing Shared Layers

- SSR page payload
- Route `unstable_cache` `["stock-key-stats-bundle-v4-insiders-short"]`, **43200s**
- Fundamentals cache **900s**

### Is duplicate provider work actually proven?

**PARTIALLY** — Client fetch path after SSR content exists is proven in code (conditional on `initialHasLatestRows`). Whether soft-refresh triggers provider fetch depends on route cache state (**UNKNOWN**).

### Is duplicate work already amortized?

**PARTIALLY** — Route-level **43200s** cache may prevent provider fetch on client soft-refresh.

### Runtime Dependency

**YES** — `initialHasLatestRows` evaluation; cache warm state.

### Architecture Impact

**Low**

### Confidence

**High**

---

# Final Summary

## Duplicate Provider Dataset Matrix

| Dataset | Duplicate Paths | Proven | Already Shared | Confidence |
|---------|-----------------|--------|----------------|------------|
| Daily Bars | Stock SSR direct + getStockPerformance; 4 cache namespaces; chart loader parallel | YES / PARTIALLY | PARTIALLY | High |
| Fundamentals JSON | Stock SSR multi-loader transform; section routes vs bundle; charting series | PARTIALLY | PARTIALLY (900s cache + React cache) | High |
| Live Quotes (spot) | SSR hot fields + client /live-price poll; realtime multi-tree | PARTIALLY | PARTIALLY (15s spot cache) | High |
| Live Quotes (batch realtime) | simple-market-layer + portfolio-live-quotes + watchlist | PARTIALLY | PARTIALLY (session cache screener only) | Medium |
| Extended Hours delayed quote | Uncached per poll; spot fallback tree | YES | NO | High |
| Intraday Bars (1D) | SSR hot fields + client /chart fetch; chart uncached allowlist | PARTIALLY | PARTIALLY | High |
| Key Statistics | 9 section routes + bundle + SSR + client soft-refresh | PARTIALLY | PARTIALLY (43200s bundle cache) | High |
| Charting Series | SSR uncached + /fundamentals-series API | PARTIALLY | PARTIALLY (300s series cache) | High |
| Stock News | SSR getStockNews + client /news API | PARTIALLY | PARTIALLY (60s cache) | Medium |
| Stock Page composite | SSR + /page-initial API | PARTIALLY | PARTIALLY (asset snapshot) | High |

---

## Duplicate Loader Matrix

| Loader | Used By | Duplicate Work Proven | Confidence |
|--------|---------|----------------------|------------|
| `fetchEodhdEodDaily` (raw) | stock-page uncached SSR, stock-chart fallbacks, stock-performance, price-on-date | YES (parallel within uncached SSR) | High |
| `loadPortfolioSymbolEodBars` | portfolio routes, superinvestor performance rebuild | PARTIALLY (separate namespace from raw EOD) | High |
| `fetchEodhdEodDailyScreener` | simple-market-layer, screener currencies, sector ETF YTD | PARTIALLY (separate snapshot namespace) | High |
| `fetchEodhdFundamentalsJson` | 30+ call sites (header, profile, key stats, screener, portfolio, watchlist, etc.) | PARTIALLY (React cache within request) | High |
| `getStockPerformance` | extended-hours, key-indicators, portfolio overview, performance API, comparison | PARTIALLY | High |
| `getStockSpotQuoteForApi` | SSR hot fields, /live-price API, stock-page-content poll | PARTIALLY | High |
| `getStockChartPointsForApi` | SSR hot fields, /chart API, PriceChart, stock-page-content | PARTIALLY | High |
| `fetchEodhdUsQuoteDelayed` | spot fallback, extended-hours header | PARTIALLY | High |
| `fetchEodhdUsRealtime` | spot, chart gap-fill, session-active check | PARTIALLY (React cache per request) | High |
| `fetchEodhdRealtimeSymbolsRaw` | simple-market-layer, portfolio-live-quotes | PARTIALLY | Medium |
| `fetchChartingSeriesUncached` | SSR stock page, /fundamentals-series API | PARTIALLY | High |
| `buildStockKeyStatsBundle` | SSR, /key-stats-bundle API, comparison route | PARTIALLY | High |
| `loadStockPageInitialData` | Web SSR, /page-initial API | PARTIALLY | High |

---

## Duplicate Endpoint Matrix

| Provider Dataset | Endpoint A | Endpoint B | Shared Loader | Proven |
|------------------|-----------|-----------|---------------|--------|
| Live spot quote | SSR `loadStockPageHotFields` | `GET /api/stocks/[ticker]/live-price` | `getStockSpotQuoteForApi` | YES |
| 1D chart points | SSR `loadStockPageHotFields` | `GET /api/stocks/[ticker]/chart?range=1D` | `getStockChartPointsForApi` | YES |
| Extended hours quote | — | `GET /api/stocks/[ticker]/extended-hours` | `getStockExtendedHoursQuoteForApi` | YES (client-only; polls) |
| Key stats bundle | SSR page payload | `GET /api/stocks/[ticker]/key-stats-bundle` | `buildStockKeyStatsBundle` | YES |
| Key stats sections | `GET .../key-stats-bundle` | `GET .../key-stats-{section}` × 9 | separate parsers, same fundamentals | YES |
| Fundamentals charting series | SSR page payload | `GET .../fundamentals-series` | `fetchChartingSeriesUncached` | YES |
| Stock news page 0 | SSR `getStockNews` | `GET /api/stocks/[ticker]/news?offset=0` | `getStockNews` / `loadStockNewsPage` | YES |
| Company profile | SSR `fetchEodhdStockProfile` | `GET /api/stocks/[ticker]/profile` | `fetchEodhdStockProfile` | YES |
| Header meta | SSR `getStockDetailHeaderMetaForPage` | `GET /api/stocks/[ticker]/header-meta` | same loader | YES |
| Stock performance | SSR `computeStockPerformanceFromSortedDailyBars` | `GET /api/stocks/[ticker]/performance` | different compute path vs `getStockPerformance` | PARTIALLY |
| Full page payload | Web SSR | `GET /api/stocks/[ticker]/page-initial` | `loadStockPageInitialData` | YES |

---

## Duplicate Snapshot Matrix

| Dataset | Storage A | Storage B | Storage C | State |
|---------|-----------|-----------|-----------|-------|
| Daily Bars | `unstable_cache` portfolio-eod-equity-bars-v1 | `unstable_cache` stock-performance-v8 | Supabase screener_eod_bars_{SYMBOL} | Proven unavoidable (different consumers, no shared key) |
| Daily Bars | raw `fetchEodhdEodDaily` (no cache) | portfolio / performance caches | — | Proven unavoidable (escape paths bypass canonical loader) |
| Fundamentals JSON | `unstable_cache` eodhd-fundamentals-json-v9 | Supabase stock header identity snapshot | Supabase screener_key_stat cells | PARTIALLY intentional (derived slices persisted separately) |
| Fundamentals JSON | asset snapshot (page bundle) | header identity snapshot | key-stats cell snapshot | Proven intentional (segmented persistence) |
| Live Quotes | Supabase stock_session_minute_bar (WS) | in-process minute memory | unstable_cache spot quote | UNKNOWN (different freshness tiers; WS vs REST) |
| Market quotes | Supabase market_snapshot (stocks_all_pages) | withScreenerUsMarketCache session mem | unstable_cache simple-market-data | Proven intentional (durable + hot tiers) |
| News | Supabase hub_news_{tab} (ingest) | unstable_cache stock-news-v8 (per-ticker SSR) | — | Proven unavoidable (hub vs per-ticker paths serve different scopes) |

---

## Duplicate Transformation Matrix

| Provider Payload | Transform A | Transform B | Transform C | Proven |
|------------------|------------|------------|------------|--------|
| Fundamentals JSON | `buildHeaderIdentityUncached` | `fetchEodhdStockProfile` | `buildStockKeyStatsBundle` (×9 parsers) | YES |
| Fundamentals JSON | `fetchChartingSeriesUncached` | key-stats section parsers | `loadKeyIndicators` slow tier | YES |
| Daily Bars sorted | `computeStockPerformanceFromSortedDailyBars` (SSR) | `getStockPerformance` → same compute function | portfolio analytics loaders | YES (multiple entry points to same compute) |
| Fundamentals JSON | `resolveEarningsDateMeta` (header) | earnings tab data loader | earnings week data | PARTIALLY |
| Realtime payload | spot quote builder | chart gap-fill anchor | session-active check | YES (independent transforms of same fetch) |

---

## Duplicate Serialization Matrix

| Dataset | Serialization A | Serialization B | Proven |
|---------|----------------|------------------|--------|
| Stock page initial data | SSR HTML + RSC payload | `GET /page-initial` JSON DTO | YES |
| Key stats | SSR `keyStatsBundle` field | `/key-stats-bundle` JSON | YES |
| Header meta | SSR `headerMeta` field | `/header-meta` JSON | YES |
| Charting series | SSR `fundamentalsSeriesAnnual/Quarterly` | `/fundamentals-series` JSON | YES |
| Performance | SSR `performance` field | `/performance` JSON | YES |
| News | SSR `news` array | `/news` JSON paginated | YES |
| Profile | SSR `profile` field | `/profile` JSON | YES |

---

## Duplicate Cache Namespace Matrix

| Provider Dataset | Namespace 1 | TTL 1 | Namespace 2 | TTL 2 | Namespace 3 | TTL 3 |
|------------------|------------|-------|------------|-------|------------|-------|
| EOD Daily Bars | raw fetch (none) | — | portfolio-eod-equity-bars-v1 | 60s | stock-performance-v8 | 60s |
| EOD Daily Bars | screener_eod_bars snapshot | segment | fetch revalidate hint | 300s | — | — |
| Fundamentals JSON | eodhd-fundamentals-json-v9 | 900s | stock-header-identity-v3 | 43200s | stock-key-stats-bundle-v4 | 43200s |
| Fundamentals JSON | screener_key_stat cell snapshot | persistent | — | — | — | — |
| Spot quote | stock-spot-quote-1d-live-v11 | 15s | stock-spot-quote-v1 | 60s | — | — |
| Charting series | eodhd-charting-series-v27 | 300s | SSR uncached path | — | — | — |
| Stock news | stock-news-v8-overview-no-og | 60s | — | — | — | — |
| Screener key-stat batch | screener-companies-key-stat-v2 | 43200s | screener_key_stat Supabase cell | persistent | fundamentals v9 | 900s |

---

## Duplicate Provider Traversal Matrix

| Provider Function | Independent Tree Count | Call Sites (representative) | Shared Dedupe |
|-------------------|---------------------|----------------------------|---------------|
| `fetchEodhdEodDaily` | 4+ namespaces | stock-page, chart, performance, portfolio, screener, price-on-date | in-flight (portfolio only) |
| `fetchEodhdFundamentalsJson` | 30+ | header, profile, key stats, screener, watchlist, portfolio, peers | React cache() per request + unstable_cache 900s |
| `fetchEodhdUsQuoteDelayed` | 2 | spot fallback, extended-hours | none |
| `fetchEodhdUsRealtime` | 3+ | spot, chart, session-active | React cache() per request |
| `fetchEodhdRealtimeSymbolsRaw` | 3+ | screener, portfolio, watchlist | session cache (screener/watchlist only) |
| `fetchEodhdIntraday` | 2+ | stock-chart-data, portfolio-value-history, crypto charts | range/session caches (partial) |
| `loadStockPageInitialData` | 2 entry points | Web SSR, /page-initial API | asset snapshot |

---

## Provider Reuse Opportunities (Evidence Only)

Places where identical provider-backed information is independently reconstructed (no recommendations):

1. Stock page uncached SSR — parallel `fetchEodhdEodDaily` and `getStockPerformance` for same ticker/window.
2. Four independent EOD daily cache namespaces without cross-key sharing.
3. Stock page SSR — fundamentals JSON parsed independently into header, profile, nine key-stat sections, key indicators, charting series.
4. SSR hot-field loaders and client `/live-price` + `/chart` API routes for same ticker.
5. Extended-hours `/extended-hours` poll — uncached delayed quote every **15s** per client.
6. `fetchEodhdUsQuoteDelayed` — spot fallback tree and extended-hours tree without shared cache.
7. Nine `/key-stats-{section}` routes vs `/key-stats-bundle` — independent fundamentals fetch when root not passed.
8. SSR charting series via uncached loader vs client `/fundamentals-series` cached loader.
9. SSR `getStockNews` vs client `/news` for same ticker page 0.
10. Batch realtime — screener session cache, portfolio live quotes, watchlist enrichment as separate trees.
11. Asset snapshot hit — `loadStockPageHotFields` reloads chart+spot on every live-session page request.
12. `/page-initial` and Web SSR both call `loadStockPageInitialData`.
13. Uncached SSR parallel chart loader and direct EOD fetch for overlapping price history.
14. `fetchEodhdUsRealtime` — multiple trees, request-scoped dedupe only.
15. Client key-stats soft-refresh after SSR bundle already present.

---

# Executive Summary

### 1. Which provider-backed datasets are loaded through multiple independent paths?

**Daily Bars** — raw `fetchEodhdEodDaily`, `loadPortfolioEodBars`, `getStockPerformance`, `fetchEodhdEodDailyScreener` (four namespaces).

**Fundamentals JSON** — 30+ call sites across header meta, profile, key-stats (bundle + 9 section routes), charting series, screener cells, watchlist off-universe, portfolio analytics, peers, target-price, earnings paths.

**Live Quotes** — `getStockSpotQuoteForApi`, `fetchEodhdRealtimeSymbolsRaw` (screener/portfolio/watchlist), `fetchEodhdUsQuoteDelayed` (spot + extended-hours), `fetchEodhdUsRealtime` (spot + chart + session check).

**Intraday Bars** — `getStockChartPointsForApi` (SSR + client API), portfolio value history, crypto chart loaders.

**Key Statistics** — SSR bundle, `/key-stats-bundle` API, nine `/key-stats-{section}` APIs, screener key-stat cells.

**Stock News** — SSR `getStockNews`, `/api/stocks/[ticker]/news`, hub news ingest (separate scope).

**Charting Series** — SSR `fetchChartingSeriesWithDailyBars`, `/fundamentals-series` API.

**Composite stock page** — Web SSR and `/page-initial` API.

---

### 2. Which datasets already have sufficient shared infrastructure?

**Fundamentals JSON** — React `cache()` per-request dedupe + `unstable_cache` **900s** on single export (`fetchEodhdFundamentalsJson`).

**Daily Bars (portfolio path)** — canonical `loadPortfolioEodBars` with explicit cache key + in-flight dedupe.

**Spot quote (US regular session)** — cross-user `unstable_cache` **15s** keyed by ticker.

**Key-stats bundle route** — `unstable_cache` **43200s**.

**Screener/markets** — epoch-scoped `withScreenerUsMarketCache` + durable `market_snapshot`.

**News hub, superinvestor, macro hub** — snapshot-only user read paths (no duplicate user-path provider traversal proven).

**Asset snapshots** — Supabase `asset_{TICKER}` shared across Web SSR and `/page-initial`.

---

### 3. Which duplicate work is fully proven?

1. Stock page uncached SSR — parallel `fetchEodhdEodDaily` + `getStockPerformance` (`loadKeyIndicatorsForPage`) for same ticker/window (**Finding 1**).
2. Extended-hours delayed quote — no cache; client poll interval **15s** defined in code (**Finding 5**).
3. SSR hot-field loaders and client API routes invoke same functions for spot/chart (**Finding 4** — endpoint traversal proven).
4. Nine section key-stats routes fetch fundamentals independently when called without root (**Finding 7**).
5. `fetchEodhdUsQuoteDelayed` — two independent loader trees, no shared cache (**Finding 6**).

---

### 4. Which findings require runtime validation?

| Finding | Requires runtime validation because |
|---------|-------------------------------------|
| Finding 2 (4 EOD namespaces) | Whether simultaneous cache misses occur across namespaces for same tuple |
| Finding 4 (SSR + client spot/chart) | Whether client poll arrives within **15s** spot cache window of SSR load |
| Finding 10 (batch realtime overlap) | Portfolio vs screener ticker set overlap per user session |
| Finding 9 (stock news) | Whether `images=1` client param triggers different provider branch than SSR |
| Finding 13 (SSR EOD + chart parallel) | Which chart branch (intraday vs EOD fallback) executes per ticker/session |
| Finding 15 (key-stats soft-refresh) | Whether client soft-refresh hits **43200s** route cache |
| All PARTIALLY proven findings | Cache hit state at request time cannot be derived statically |

---

### 5. Which provider-backed datasets have the highest duplicate-work potential based only on static code analysis?

**Ranked by static structural exposure (not request counts):**

1. **Extended Hours delayed quote** — explicitly uncached; client poll **15s**; scales with concurrent client requests (**Finding 5** — Architecture Impact: **High**).

2. **Live Quotes (spot + chart SSR/client loop)** — intentional SSR hot-field refresh + client poll to same API routes; live 1D chart allowlist bypasses cache (**Findings 4, 11, 14**).

3. **Daily Bars** — four independent cache namespaces; proven parallel duplicate on uncached stock SSR (**Findings 1, 2**).

4. **Fundamentals JSON** — 30+ independent call sites; heavy duplicate transformation; provider fetch coalesced only within request/TTL windows (**Finding 3, 7, 8**).

5. **Batch Live Quotes (realtime)** — screener, portfolio, watchlist as separate batch loader trees without proven cross-tree sharing (**Finding 10**).

---

*Document generated entirely from static code analysis.*

*Evidence only.*
