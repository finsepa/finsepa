# PORTFOLIO MODULE — PRODUCTION PERFORMANCE & DATA EFFICIENCY AUDIT

**Date:** 2026-07-22  
**Mode:** Performance & data efficiency only (no Phase 1–4 formula changes, no SnapTrade logic changes, no UI redesign).  
**Scope:** Opening `/portfolio` (Overview, default Assets sub-tab) for an authenticated user with an existing workspace.  
**Evidence:** Code-path inventory across `app/api/portfolio/**`, `lib/portfolio/**`, `components/portfolio/**`, `lib/market/eodhd-*`, `lib/data/cache-policy.ts`.  
**Runtime benchmarks:** Not instrumented in this pass (no APM / Network waterfall capture). Durations below are **architectural estimates** from request topology; treat as relative, not lab numbers.

**Related:** `docs/PORTFOLIO-METRICS-CERTIFICATION.md`, `docs/PORTFOLIO-FINAL-CERTIFICATION.md`, `docs/eodhd-phase-0-cache-inventory.md`.

---

## 1. Executive Summary

### Verdict: **WATCH**

Portfolio is functionally production-capable and already uses some good patterns (batched realtime quotes, Dietz client dedupe, fundamentals `unstable_cache` 900s, value-history route cache 300s, tab-level `dynamic()` / visit gating). It is **not** certified PASS for data efficiency because Overview cold-load still:

1. Issues **~5 independent heavy POSTs** after live quotes, each often re-fetching the **same N (+ SPY) EOD daily bars** with `cache: "no-store"` at the EOD helper.
2. Posts the **full transactions ledger** 3–4 times per Overview paint (dietz, benchmark-compare, value-history, analytics).
3. Default chart range **YTD** adds **N intraday** EODHD pulls on top of daily bars.
4. Gates first paint on live quotes, then starts a **thundering herd** of analytics/history routes with almost no shared server NAV/bar layer.

| Pass requirement | Result |
|------------------|--------|
| No unnecessary API requests | **FAIL** — parallel Overview POSTs overlap in purpose; full ledger re-posted |
| No unnecessary EODHD requests | **FAIL** — ~4–5× daily EOD fan-out per symbol on cold Overview |
| No duplicated calculations | **WATCH** — Dietz/NAV recomputed in dietz + benchmark + value-history (+ analytics risk series) |
| No duplicated fetches | **FAIL** — no shared EOD bar cache for Portfolio compute routes |
| Proper cache usage | **WATCH** — mixed; Dietz/benchmark/analytics routes uncached |
| Proper batching | **WATCH** — realtime stocks batched; crypto quotes + EOD + fundamentals not |
| No unnecessary rerenders | **WATCH** — workspace context fan-out after quote refresh |
| No unnecessary database work | **PASS** — single-row workspace read/upsert (payload size is the risk) |
| Portfolio loading production-ready | **WATCH** — usable; not optimally efficient |

### Estimated savings if HIGH IMPACT items land

| Lever | Est. reduction (N≈15 holdings, cold Overview) |
|-------|-----------------------------------------------|
| API requests (browser) | **−20–40%** (merge/dedupe Overview compute; optional single “overview bundle”) |
| EODHD daily EOD calls | **−60–80%** (shared bar cache / one load serving dietz+bench+VH+analytics) |
| EODHD intraday | **−50–100%** on YTD if daily samples suffice for Return chart, or cache intraday |
| Bandwidth (request bodies) | **−40–70%** (server-side workspace ledger; stop re-POSTing full txs) |
| Overview interactive time | **−30–50%** warm; **−20–35%** cold (fewer EODHD waits + less JSON parse) |
| Server CPU | **−40–60%** on Overview (one bar load + memoized NAV windows) |

---

## 2. Complete request inventory

Assumptions: logged-in user, workspace in DB + localStorage, `/portfolio`, Overview + Assets, chart range **ytd**, compare overlays off, no public listing sync, SnapTrade logo fetch only if linked.

### 2.1 Frontend → Backend

| # | Request | Purpose | Trigger | Cache | Reuse / merge / eliminate? |
|---|---------|---------|---------|-------|----------------------------|
| 1 | `POST /api/portfolio/live-quotes` `{symbols[]}` | Mark-to-market holdings | Workspace hydrate (`refreshQuotes`) | Client session fingerprint **60s**; server `unstable_cache` **300s** | **Keep** — gates `portfolioDisplayReady`. Already batched stocks. |
| 2 | `GET /api/portfolio/workspace` | Hydrate server ledger | Mount | None | **Keep** — canonical DB source. |
| 3 | `PUT /api/portfolio/workspace` (0–2×) | Upload local-newer / debounced save after quotes | After GET / 500ms debounce | None | **Watch** — full-blob PUT after quote rewrite is heavy; debounce exists. |
| 4 | `POST /api/portfolio/overview-market` | Per-symbol period % + dividend yields | Overview cards mount | sessionStorage **5m**; server fast **60s** / yield **12h** | **Keep**; merge later into overview bundle. |
| 5 | `POST /api/portfolio/dietz-returns` | Period profit $/% cards | Cards effect `[transactions]` | Client fingerprint **60s** + in-flight | **Keep** API; extend client pattern to siblings. |
| 6 | `POST /api/portfolio/benchmark-compare` | S&P / Ahead | Cards effect `[transactions]` | None (keep-prior UI) | **Merge** with dietz or shared bars; add client dedupe. |
| 7 | `POST /api/portfolio/value-history` | Overview chart series | Chart mount / range | Server `unstable_cache` **300s** by user+range+txFp | **Keep**; share EOD bars with #5–6,8. |
| 8 | `POST /api/portfolio/analytics` | Key Stats | Metrics effect `[holdings,transactions]` | Fundamentals/macro only | **Keep**; share bars; fingerprint deps. |
| 9 | `GET /api/stocks/{sym}/header-meta` ×0–N | Display names when name≡ticker | Holdings table | Identity **12h** | **Batch** via portfolio header-meta or skip when name present. |
| 10 | `GET /api/snaptrade/brokerage-logo?…` | Broker logo | If connected | `no-store` | Optional; low cost. |

**Not on default Overview:** dividends-schedule, period-returns, earnings-dates, portfolio header-meta (Slices), Allocation Dietz (Allocation sub-tab; shares Dietz client cache if warm), Performance tab value-history, SnapTrade sync.

### 2.2 Backend → Database

| Request | Query | Notes |
|---------|-------|-------|
| workspace GET | `portfolio_workspace` `select state,updated_at` by `user_id` | **1 row**, full JSONB |
| workspace PUT | `upsert` full `state` | **1 write**, full JSONB |
| overview slow / dividends | `market_snapshot` per ticker (when enabled) | Parallel, not classic N+1 loops |

### 2.3 Backend → EODHD (per Overview cold load, N holdings)

| Consumer | Endpoint pattern | Count (order of mag.) |
|----------|------------------|------------------------|
| live-quotes | `/api/real-time/{first}?s=…` | **⌈N/15⌉** stock batches (+ **N crypto** spot paths) |
| overview-market | `/api/eod/{sym}` via `getStockPerformance` | **N + SPY** (cached **60s** after warm) |
| overview-market | `/api/fundamentals/{sym}` | **N** stocks for yield (cached **900s**) |
| dietz-returns | `/api/eod/{sym}` **no-store** | **N + SPY** |
| benchmark-compare | `/api/eod/{sym}` **no-store** (+ retry) | **N + SPY** (up to **2×** on empty) |
| value-history | `/api/eod/{sym}` **no-store** | **N** |
| value-history YTD | `/api/intraday/{sym}` | **~N–2N** (1h then 5m fallback) |
| analytics | `/api/eod/{sym}` **no-store** | **N + SPY** |
| analytics | `/api/fundamentals/{sym}` | **N + SPY** (shared 900s cache) |
| analytics | FRED fed funds (not EODHD) | **1** (day cache) |

**Cold N=15 estimate:** ~**8–12** browser calls; ~**75–100+** EODHD HTTP equivalents (dominated by uncached daily EOD × pipelines + YTD intraday).

### 2.4 Response / payload notes

| Route | Response size | Body concern |
|-------|---------------|--------------|
| workspace | Large (entire ledger) | Dominates bandwidth on hydrate |
| live-quotes | Tiny | OK |
| overview-market | Small–medium | OK |
| dietz / benchmark | Tiny | **Request** body is large (full txs) |
| value-history | Medium–large (YTD points) | Full txs in + dense points out |
| analytics | Medium | Full holdings + txs in |

---

## 3. Waterfall analysis

Architectural timeline for cold Overview (relative):

```
0ms     Navigate /portfolio
          │
~0–50ms   LocalStorage bootstrap → applyWorkspaceState
          │         ┌─────────────────────────────┐
          ├────────►│ POST live-quotes            │  BLOCKING for portfolioDisplayReady
          │         └─────────────────────────────┘
          ├────────► GET workspace (parallel if not already applied)
          │
~quotes   holdingsMarkToMarketReady = true
~ready    Overview mounts (cards + chart + metrics + holdings)
          │
          ├─► POST overview-market  ─┐
          ├─► POST dietz-returns     │  PARALLEL herd
          ├─► POST benchmark-compare │  (no shared coordinator)
          ├─► POST value-history     │  each may wait on EODHD N×
          └─► POST analytics         ┘
          │
~+EODHD   Cards / chart / Key Stats fill (slowest of herd wins TTI)
          │
idle      User interaction; Allocation Dietz may hit client cache
```

| Pattern | Finding |
|---------|---------|
| Sequential | Quotes (and often workspace) **before** Overview compute |
| Parallel | Five Overview POSTs after ready — good for latency **if** EODHD budget allows; bad for **duplicate** provider work |
| Blocking | `portfolioDisplayReady` waits on MTM quotes |
| Idle | Little intentional stagger; no progressive “shell then Key Stats” priority beyond dynamic chart |

---

## 4. EODHD inventory

| Data | Current source | Typical Portfolio frequency | TTL / cache | Batch? | Duplicate? |
|------|----------------|----------------------------|-------------|--------|------------|
| Live quotes (stocks) | `fetchEodhdRealtimeSymbolsRaw` | Eager on `/portfolio` | Route **300s** | **Yes** (15/chunk) | Low |
| Live quotes (crypto) | `getCryptoLiveSpotPriceUsd` | Same | Nested perf **60s** | **No** (per symbol) | Medium |
| Historical daily | `fetchEodhdEodDaily` / `Retry` | Every Overview compute | **Helper: no-store** | No | **High** — 4–5 pipelines |
| Historical daily (perf cards) | `getStockPerformance` → EOD | overview-market | **60s** `unstable_cache` | No | Separate from compute routes |
| Intraday | `fetchEodhdIntraday` | YTD value-history | no-store | No | High on default range |
| Fundamentals | `fetchEodhdFundamentalsJson` | overview yield + analytics | **900s** + React `cache()` | No (no bulk wrapper in repo) | Cold stampede possible |
| Dividends calendar/history | dividends schedule tab | On Dividends visit | **300s** helpers + schedule **60s** | No | OK lazy |
| Benchmark SPY bars | dietz + bench + analytics (+ overview perf) | Overview | Mixed | No | **High** |
| Fed funds / Shiller | analytics | Overview Key Stats | Day / existing macro caches | N/A | Low |

### Part 3 questions

| Question | Answer |
|----------|--------|
| Same data downloaded twice? | **Yes** — daily EOD for holdings (+ SPY) across dietz / benchmark / value-history / analytics. |
| Fundamentals more than once? | **Often twice per symbol cold** (yield + analytics); warm hits **900s** cache. |
| Historical prices reused? | **Only** inside a single request’s `Promise.all`, or via overview `getStockPerformance` 60s — **not** across Portfolio compute routes. |
| Benchmark prices reused? | **No** shared SPY series across routes. |
| Batch replace multiple? | Realtime already batched. **Bulk fundamentals** exists at EODHD but **no in-repo client**. Multi-symbol EOD **not** available as one HTTP in current helpers. |
| One endpoint several modules? | **Recommended:** shared `loadPortfolioEodBars(symbols, from, to)` + optional overview bundle API. |

---

## 5. Cache audit

| Layer | Location | TTL | Invalidation | Notes |
|-------|----------|-----|--------------|-------|
| Client session | Quote ledger fingerprint | 60s | Time / fingerprint | Skips repeat quote refresh |
| Client module | `fetchPortfolioDietzReturnsClient` | 60s + in-flight | Ledger fingerprint | **Canonical pattern** — not copied to bench/VH/analytics |
| sessionStorage | overview-market v2 | 5m | Symbol set key | Good |
| `unstable_cache` | live-quotes | 300s | Symbol set | Good |
| `unstable_cache` | overview fast/slow/yield | 60s / 12h | Symbols / ticker | Good |
| `unstable_cache` | value-history route | 300s | userId + range + txFp | Good; still pays EOD on miss |
| `unstable_cache` | fundamentals JSON | 900s | Ticker | Shared app-wide |
| `unstable_cache` | dividends schedule | 60s | Holdings + window | Lazy tab |
| HTTP Cache-Control | overview-market / value-history | private short/warm | — | Browser/CDN limited for POST |
| Route | dietz, benchmark, analytics | **no-store** | Every call | **Missing shared bar cache** |
| React `cache()` | fundamentals per-request | request | — | Helps RSC; limited for route handlers |
| Workspace | localStorage + DB | durable | PUT / merge | Not a compute cache |

**Redundant:** overview fast cache wraps performance which is already 60s-cached.  
**Missing:** shared EOD daily bar cache; client dedupe for benchmark / value-history / analytics.

---

## 6. Database audit

| Query | Exec pattern | Indexes | Rows | N+1? | Issue |
|-------|--------------|---------|------|------|-------|
| workspace GET | `maybeSingle` by PK `user_id` | PK | 1 | No | Large JSON parse of full ledger |
| workspace PUT | upsert full state | PK | 1 | No | Rewrites entire blob on quote-driven saves |
| market_snapshot | per-ticker reads | segment keys | 1/ticker | Parallel | Acceptable |
| Cron all workspaces | full table scan of `state` | — | all users | No | Heavy ops path (earnings notify) — out of Overview UI |

**Verdict:** Query shape is efficient; **serialization / payload size** is the DB-adjacent cost, not scan count.

---

## 7. React performance audit

| Topic | Finding |
|-------|---------|
| Context | `PortfolioWorkspaceProvider` value includes display holdings/txs + ready flags — quote refresh → broad tree re-render (shell + page). |
| Memo | Chart, dividends, cash, earnings, holdings panels use `memo` selectively; Overview cards/metrics less isolated. |
| Effects | Dietz/bench/VH/analytics keyed on `transactions` / `holdings` **array identity** — ledger prepare / quote rewrite can refetch even when economics unchanged (Dietz fingerprint mitigates only Dietz). |
| Suspense | Page wrapped in Suspense; chart `dynamic(ssr:false)`. |
| Tabs | `tabsVisited` prevents mounting Performance/Dividends/Cash/Transactions until visited — **good**. |
| Allocation | Dietz only when Allocation sub-tab needs it — **good**; shares Dietz client cache. |
| Layout shift | Skeletons on metrics/cards reduce flash (metrics certification); not re-audited visually here. |

**Necessary renders:** mostly yes after quote gate. **Unnecessary work:** refetch storms on identity churn; context fan-out.

---

## 8. Network duplication audit

| Duplicate | Callers | Canonical recommendation |
|-----------|---------|--------------------------|
| Daily EOD N symbols | overview perf, dietz, benchmark, value-history, analytics | **One** `getCachedEodDaily(sym, from, to)` used by all Portfolio servers |
| SPY daily | same (+ calendar) | Same shared helper; single SPY series per (from,to) |
| Fundamentals N | overview yield, analytics | Already shared 900s; optional bulk API later |
| Full txs POST | dietz, bench, VH, analytics | Prefer server read of workspace by `userId` + portfolioId, or shared client fingerprint + slim body |
| Dietz math | dietz-returns vs value-history Return window vs bench portfolio leg | Keep formulas (Phase 2/3); share **bars + NAV marks** only |
| value-history | Overview + Performance tab | Same API — OK; rely on 300s cache when fingerprint stable |
| header-meta ×N | holdings names | Batch or persist names on holdings |

**Legacy vs canonical:** Dietz client (`fetch-dietz-returns-client.ts`) is the only Overview client dedupe. Benchmark/analytics/VH are legacy-parallel.

---

## 9. Computation audit

| Engine | Where | Repeat on Overview? | Memoize / cache? | Stay realtime? |
|--------|-------|---------------------|------------------|----------------|
| Ledger replay / NAV | dietz, bench, VH, analytics | **Yes** independent | Cache bars; optional memo NAV by (asOf, fp) | No — EOD OK |
| Period Dietz | dietz-returns | Once (client deduped) | Keep 60s client | Period cards OK cached |
| Inception Dietz vs SPY | benchmark-compare | Once per txs identity | Add client dedupe + bar cache | Soft realtime |
| Chart series | value-history | Once per range/txs | Route 300s; share bars | Range switch may recompute |
| Analytics risk/fund | analytics | Once | Share bars; fingerprint holdings | Soft |
| Allocation Dietz | client → dietz API | Lazy | Client cache | Soft |
| Live MTM | live-quotes | Eager | 60s/300s | **Yes** stay freshest |

---

## 10. Payload audit

| Surface | Size driver | Unused / repeated | Compression |
|---------|-------------|-------------------|-------------|
| workspace GET/PUT | All portfolios’ holdings + **full transactions** (fat SnapTrade fields) | Clients often need one portfolio | gzip already; consider slim sync / per-portfolio columns later |
| dietz / bench / VH / analytics POST | Same txs array 3–4× | Server already has workspace | **Eliminate re-POST** (HIGH) |
| value-history response | Dense YTD points | Chart may not need all fields | Slim `returnPct`/`profit` when mode known (LOW) |
| analytics response | Full Key Stats snapshot | UI uses all ten metrics | OK |
| overview-market | Perf maps + yields | OK | OK |

---

## 11. Performance benchmark (methodology & qualitative)

Instrument next: Chrome Performance + Network HAR, or server logs of EODHD budget (`eodhd-hourly-budget`) around `/portfolio`.

| Scenario | Expected shape (code-based) |
|----------|-----------------------------|
| Cold load | Quotes → herd of 5 POSTs → EODHD-bound |
| Warm load (&lt;60s) | Quotes may skip; Dietz client hit; overview sessionStorage hit; **bench/analytics/VH may still miss** shared bars |
| Portfolio switch | New symbols → new quotes + new Overview herd |
| Overview tab | Already visited — remount cost depends on keep-alive / visited flags |
| Chart range switch | New value-history (cache miss per range+fp); **YTD costliest** |
| Transaction edit | Fingerprint change → invalidate Dietz client + VH cache + refetch bench/analytics |
| Sync (SnapTrade) | Extra sync POST + workspace PUT + quote refresh — out of Overview steady-state |
| Quote refresh | Context rerender; analytics may refetch if holdings identity changes |
| Analytics refresh | Full fundamentals+bars path |

*Measured ms / KB not captured in this audit → listed under Remaining WATCH.*

---

## 12. Repository search summary

| Pattern | Portfolio-relevant finding |
|---------|----------------------------|
| `/api/portfolio/*` | 11 routes; 5–6 hit on default Overview |
| `fetchEodhdEodDaily` | **no-store**; Portfolio compute overuses |
| `fetchEodhdEodDailyScreener` | Cached sibling — **unused** by Portfolio |
| `unstable_cache` | live-quotes, overview, VH, dividends, fundamentals — **not** dietz/bench/analytics |
| `fetchPortfolioDietzReturnsClient` | Only shared client compute cache |
| Bulk fundamentals | **Not implemented** in repo |
| Dead fetches | None critical; Performance/Dividends correctly lazy |

---

## 13. Optimization recommendations

### HIGH IMPACT

1. **Shared Portfolio EOD bar loader**  
   Wrap `fetchEodhdEodDaily` / crypto bars with `unstable_cache` keyed by `(symbol, from, to)` at **300s** (or reuse screener-style snapshot). Wire dietz, benchmark-compare, value-history, analytics, period-returns.  
   - Est.: **−60–80%** EODHD daily calls; **−30–50%** Overview server CPU.

2. **Client dedupe for benchmark-compare + value-history + analytics**  
   Copy Dietz fingerprint + in-flight map pattern.  
   - Est.: **−30–50%** duplicate browser POSTs on remount / Strict Mode / identity churn.

3. **Stop POSTing full ledger 4×**  
   Authenticated routes load txs from `portfolio_workspace` by `userId` + `portfolioId` (or accept tx fingerprint + server hydrate).  
   - Est.: **−40–70%** upload bandwidth; less JSON parse CPU.

4. **YTD chart cost**  
   Prefer daily samples for default YTD Return/Value unless intraday proven necessary; or cache intraday **300s**.  
   - Est.: **−N to −2N** EODHD intraday per Overview.

### MEDIUM

5. Overview **bundle** API returning market + dietz periods + benchmark + analytics stub in one round-trip (still using shared bars).  
6. Fingerprint `holdings`/`transactions` before analytics effect (avoid quote-rewrite refetch).  
7. Batch header-meta / persist company names on holdings.  
8. Crypto live quotes: batch or longer coalesce.  
9. Split workspace context (quotes vs ledger) to cut rerenders.

### LOW

10. Slim value-history point payload by chart mode.  
11. Align overview-fast cache with nested performance TTL (remove double wrap).  
12. Evaluate EODHD bulk fundamentals for analytics-only cold paths.

**Do not change** Phase 1–4 formulas or SnapTrade merge rules while doing the above — only I/O, cache keys, and request shape.

---

## 14. Estimated improvements (rollup)

| Metric | Today (cold N≈15) | After HIGH items | Δ |
|--------|-------------------|------------------|---|
| Browser API calls (Overview) | ~8–12 | ~5–7 | **−20–40%** |
| EODHD daily EOD | ~75 | ~15–25 | **−60–80%** |
| EODHD intraday (YTD) | ~15–30 | ~0–15 | **−50–100%** |
| Upload bytes (txs×4) | ~4× ledger | ~1× or 0× | **−40–75%** |
| Time to Overview interactive | EODHD-bound herd | Shared bars + less JSON | **−20–35%** cold |
| Server CPU / Overview | 4× bar loads + 3× NAV | 1× bars + shared marks | **−40–60%** |
| React render noise | Context + refetch | Fingerprint + split context | **−10–25%** |

---

## 15. Remaining WATCH items

- [ ] Capture real HAR + server timings (cold/warm/switch) to replace architectural estimates.  
- [ ] Confirm product need for YTD **intraday** two-per-day samples vs daily.  
- [ ] Design workspace slim sync without breaking SnapTrade fields / offline localStorage.  
- [ ] Next.js `unstable_cache` + large closure over transactions in value-history — validate hit rate in production.  
- [ ] EODHD hourly budget headroom under concurrent users opening Portfolio.  
- [ ] Metrics doc still mentions inception Return on chart in places — keep math docs in sync with windowed Return (separate from this perf audit).

---

## 16. Pass / Fail checklist

| Requirement | Status |
|-------------|--------|
| No unnecessary API requests | **FAIL** |
| No unnecessary EODHD requests | **FAIL** |
| No duplicated calculations | **WATCH** |
| No duplicated fetches | **FAIL** |
| Proper cache usage | **WATCH** |
| Proper batching | **WATCH** |
| No unnecessary rerenders | **WATCH** |
| No unnecessary database work | **PASS** |
| Loading production-ready (efficiency) | **WATCH** |

### Final certification: **WATCH**

Safe to run in production for correctness (see metrics / final cert docs). **Not** certified as minimum-request / minimum-EODHD. Implement HIGH IMPACT items 1–4, re-measure, then re-grade toward **PASS**.

---

*No Phase 1–4 or SnapTrade logic was modified for this audit. Code changes deferred until measured optimization PRs.*
