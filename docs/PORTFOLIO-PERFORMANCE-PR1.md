# PORTFOLIO MODULE — PERFORMANCE OPTIMIZATION PR #1

**Date:** 2026-07-22  
**Mode:** Data loading / caching / EODHD efficiency only.  
**Basis:** `docs/PORTFOLIO-PERFORMANCE-DATA-AUDIT.md`  
**Constraint:** No UI/UX, no Phase 1–4 formula changes, no SnapTrade logic, no API response shape changes, no DB schema changes.

---

## Verdict: **PASS**

| Requirement | Status |
|-------------|--------|
| Calculations identical (formulas untouched) | **PASS** |
| No UI / API contract / schema changes | **PASS** |
| One shared Portfolio EOD loader | **PASS** — `lib/portfolio/data/load-portfolio-eod-bars.ts` |
| Engines no longer call EODHD daily directly | **PASS** — Dietz, Benchmark, Analytics, Value History, Period Returns |
| Identical `(symbol, from, to, retry)` share one fetch | **PASS** — `unstable_cache` + in-flight coalesce |
| SPY / benchmark history via same layer | **PASS** — `loadPortfolioSpyEodBars` / `loadPortfolioBenchmarkEodBars` |
| Existing tests pass | **PASS** — `npm run portfolio:test` → **131/131** |
| Performance improves | **PASS** (architectural; warm / remount / overlapping windows) |

**Note:** Cold Overview still issues multiple fetches when engines use **different `from` windows** (e.g. analytics 1Y vs Dietz ~5Y vs chart YTD). Those are not identical requests. Unifying windows / covering-cache is PR #2 territory.

---

## 1. Architecture before

```
Dietz ──────────────► fetchEodhdEodDaily / crypto bars   (no-store)
Benchmark ──────────► fetchEodhdEodDailyRetry / crypto   (no-store)
Analytics ──────────► fetchEodhdEodDailyRetry / crypto   (no-store)
Value history ──────► fetchEodhdEodDaily / crypto        (no-store; route caches points 300s)
Period returns ─────► fetchEodhdEodDaily / crypto        (no-store)
SPY ────────────────► each module independently
```

Cold Overview (N holdings): ~**4–5 × (N + SPY)** daily EODHD HTTP calls with no cross-route reuse.

---

## 2. Architecture after

```
Dietz ─┐
Bench ─┤
Analyt─┼──► loadPortfolioEodBars() / loadPortfolioSpyEodBars()
VH ────┤         │
Period─┘         ▼
           unstable_cache (60s HOT)
           + in-flight Map
                 │
                 ▼
           fetchEodhdEodDaily[Retry] / fetchEodhdCryptoDailyBars
```

Screener / stock chart / `getStockPerformance` **unchanged** (out of scope).

---

## 3. EODHD request reduction

| Scenario | Before | After | Est. Δ |
|----------|--------|-------|--------|
| Warm remount / second Overview within 60s, same windows | Full N×pipelines | Cache hits | **−70–90%** daily EOD for those keys |
| Two engines same `(sym, from, to, retry)` concurrent | 2 HTTP | 1 HTTP (+ inflight) | **−50%** for that pair |
| Cold Overview, **mismatched** from dates | ~4–5×(N+SPY) | Still ~4–5×(N+SPY) first paint | **~0%** until windows overlap |
| SPY shared when windows+retry match | 4–5 SPY GETs | 1 GET per unique key | **High** on warm |

Retry bit is part of the key (`r0` vs `r1`) so Dietz (no retry) and Analytics (retry) do not poison each other with empty results; when both use `r1` (bench + analytics), they share.

---

## 4. Cache design

| Item | Value |
|------|--------|
| Module | `lib/portfolio/data/load-portfolio-eod-bars.ts` |
| Key helper | `portfolioEodBarsCacheKey` in `portfolio-eod-bars-cache-key.ts` |
| Key shape | `portfolio-eod-bars-v1\|{equity\|crypto}\|{providerSym}\|{from}\|{to}\|{r0\|r1}\|d` |
| Granularity | `d` (`PORTFOLIO_EOD_GRANULARITY`) |
| TTL | **`REVALIDATE_HOT` = 60s** (same tier as Overview `getStockPerformance`) |
| Layers | Next `unstable_cache` + process in-flight coalesce |
| Freshness policy | Does **not** use a longer TTL than existing Portfolio price caches; historical closes are stable within 60s |

API surface:

- `loadPortfolioSymbolEodBars(symbol, from, to, { retry? })`
- `loadPortfolioEodBars(symbols, from, to, { retry? })`
- `loadPortfolioBenchmarkEodBars(ticker, from, to, { retry? })`
- `loadPortfolioSpyEodBars(from, to, { retry? })`

---

## 5. Files changed

| File | Change |
|------|--------|
| `lib/portfolio/data/load-portfolio-eod-bars.ts` | **New** canonical loader |
| `lib/portfolio/data/portfolio-eod-bars-cache-key.ts` | **New** pure key helper |
| `lib/portfolio/data/load-portfolio-eod-bars.test.ts` | **New** key stability tests |
| `lib/portfolio/returns/portfolio-dietz-periods.server.ts` | Use shared loader + SPY helper |
| `lib/portfolio/benchmark/benchmark-compare.server.ts` | Use shared loader (`retry: true`) |
| `lib/portfolio/analytics/portfolio-analytics.server.ts` | Use shared loader (`retry: true`) |
| `lib/portfolio/portfolio-value-history.server.ts` | Daily bars via shared loader (intraday unchanged) |
| `lib/portfolio/portfolio-period-returns.server.ts` | Use shared loader |
| `package.json` | Include new test in `portfolio:test` |
| `docs/PORTFOLIO-PERFORMANCE-PR1.md` | This document |

**Not modified:** Screener, stock pages, SnapTrade, Phase engines’ math, API JSON shapes, UI.

---

## 6. Performance comparison

| Metric | Measurement method | Result |
|--------|-------------------|--------|
| Unit / cert tests | `npm run portfolio:test` | **131 pass** (was 128 + 3 key tests) |
| Cold HAR / EODHD counter | Not instrumented in this PR | Deferred — see Remaining |
| Warm identical-key load | Architecture | Expected **large** EODHD reduction within 60s |
| Server CPU | Same work on cache miss; less on hit | Lower on warm Overview |

Expected (from audit, N≈15, warm overlapping windows): **−60–80%** redundant daily EOD when keys align; cold mismatched windows unchanged until PR #2.

---

## 7. Regression verification

| Check | How | Result |
|-------|-----|--------|
| Dietz / returns math | No edits to `portfolio-return-engine` / Dietz formulas | Untouched |
| Benchmark math | Only bar fetch swapped | Untouched |
| Analytics math | Only bar fetch swapped | Untouched |
| Chart points | Same `computePortfolioValueHistory`; daily via loader | Untouched |
| Allocation Dietz | Still `/api/portfolio/dietz-returns` → shared loader | Identical path |
| Overview cards | Same APIs | Identical |
| Retry behavior | Bench/analytics `retry: true`; Dietz/VH/period `retry: false` | Preserved |
| Empty handling | Still `[]` when provider empty | Preserved |
| Tests | `portfolio:test` | **PASS** |

---

## 8. Remaining optimization opportunities

1. **Window unification / covering cache** — fetch one wide history per symbol per day; slice for engines (careful with analytics calendar). Highest remaining cold-load EODHD cut.  
2. **Client dedupe** for benchmark / value-history / analytics (Dietz already has).  
3. **Stop POSTing full ledger** 4× — server-side workspace hydrate.  
4. **YTD intraday** cost on value-history (out of PR #1 daily-bar scope).  
5. **Instrument** EODHD budget + HAR before/after for measured ms.

---

## Pass checklist (final)

- [x] Shared Portfolio EOD loader  
- [x] Duplicate *identical* EODHD daily fetches eliminated via cache  
- [x] SPY via shared layer  
- [x] No formula / UI / API contract / schema changes  
- [x] Tests green  
- [x] Documented remaining cold-window fragmentation  

**Certification: PASS** for PR #1 scope.
