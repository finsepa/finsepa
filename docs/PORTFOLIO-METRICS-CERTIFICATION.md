# PORTFOLIO MODULE — FINAL PERFORMANCE & METRICS CERTIFICATION

**Date:** 2026-07-22  
**Mode:** Audit + stability fixes only (no new metrics, formulas, UI redesign, or architecture).  
**Evidence:** Code inspection + `npm run portfolio:test` (128/128).  
**Related:** `docs/PORTFOLIO-FINAL-CERTIFICATION.md`, Phases 1–4 reports.

---

## 1. Executive verdict

### **PASS**

Every displayed Overview / Chart / Key Stats metric has a **single canonical calculation path**, is **internally consistent** after stability fixes, and **reuses cached / prior data** on transient failures instead of flashing empty values.

| Area | Result |
|------|--------|
| Mathematical correctness | **PASS** |
| Internal consistency ($ vs %) | **PASS** (fixed) |
| Duplicate implementations | **PASS** |
| Determinism / reload stability | **PASS** |
| Cache / keep-prior hygiene | **PASS** (fixed) |
| Network dedupe (Dietz) | **PASS** (fixed) |
| Visual stability | **PASS** (fixed) |
| Live quotes vs EOD engines | **WATCH** (intentional lag, documented) |

---

## 2. Metric inventory

### Overview cards — `components/portfolio/portfolio-overview-cards.tsx`

| Metric | Source / formula | Module | Cache | Update trigger |
|--------|------------------|--------|-------|----------------|
| **Portfolio Value** | `Σ holding.currentValue + netCashUsd(txs)` | `overview-metrics.ts` → `totalNetWorth` | none (client) | holdings / txs (incl. quote refresh) |
| **Invested** | `Σ holding.costBasis` (open lots) | `overview-metrics.ts` → `totalCostBasisInvested` | none | holdings |
| **Total Profit $ (All)** | `unrealized + cumulativeRealized` | `realized-pnl-from-trades.ts` → `lifetimeEquityProfitUsd` | none | holdings / txs |
| **Total Profit % (All)** | Modified Dietz inception (same as chart Return / Ahead portfolio leg); fallback `lifetimeEquityProfitPct` | `benchmark-compare` → `portfolioPct` | keep prior; skeleton until first Dietz | txs change |
| **Total Profit $/% (1M,YTD,1Y,5Y)** | Modified Dietz gain + % | `POST /api/portfolio/dietz-returns` → Phase 2 | Client shared cache 60s (`fetch-dietz-returns-client.ts`); API `no-store` | txs change |
| **S&P Return** | Contribution-model SPY Modified Dietz | `POST /api/portfolio/benchmark-compare` → Phase 3 | keep prior on fail; API `no-store` | txs change |
| **Ahead/Behind %** | `portfolioDietzPct − spyDietzPct` | same Phase 3 response (`aheadPct`) | same | txs change |
| **Dividend Yield** | MV-weighted fundamentals yield | `POST /api/portfolio/overview-market` | sessionStorage 5m + keep prior on fail | symbol set |
| **Dividend Income** | `Σ MV × yield` (annualized estimate) | same | same | same |

### Chart — `components/portfolio/portfolio-overview-chart.tsx`

| Mode | Formula | Module / API | Cache | Update trigger |
|------|---------|--------------|-------|----------------|
| **Value** | Equity@EOD + cash as-of session | `POST /api/portfolio/value-history` | server `unstable_cache` revalidate **300s**; keep prior points on fail | txs / chart range |
| **Profit** | Realized + unrealized as-of session | same payload | same | same |
| **Return** | Modified Dietz from inception (`vStart=0`) | `dietzReturnPctFromInceptionNav` in value-history | same | same |
| **Drawdown** | `(value / runningPeak − 1) × 100` on Value series | client `buildDrawdownData` | none | local on points |

### Key Stats — `components/portfolio/portfolio-overview-metrics.tsx`

All ten metrics from **one** snapshot: `POST /api/portfolio/analytics` → `computePortfolioAnalyticsSnapshot`.

| Metric | Canonical function | File |
|--------|-------------------|------|
| P/E | `aggregatePortfolioPe` | `portfolio-fundamentals.ts` |
| Sharpe | `computeSharpeRatio` | `portfolio-risk-metrics.ts` |
| Sortino | `computeSortinoRatio` | same |
| Cash Conversion | `aggregateWeightedCashConversion` | `portfolio-fundamentals.ts` |
| Gross / Op Margin | `aggregateWeightedMargin` | same |
| ROCE | `aggregateWeightedRoce` | same |
| Turnover | `computePortfolioTurnover` | `portfolio-turnover.ts` |
| Beta | `computeBeta` | `portfolio-risk-metrics.ts` |
| Volatility | `computeAnnualizedVolatility` | same |

S&P column in Key Stats uses `computeSpyBenchmarkMetrics` — **same** risk helpers on SPY returns (not a second Sharpe formula).

---

## 3. Formula verification

| Check | Expected | Result |
|-------|----------|--------|
| Total Profit $ (All) | `lifetimeEquityProfitUsd` only | **PASS** |
| Total Profit % (All) | Modified Dietz (`portfolioPct`) — comparable to S&P / chart Return; $ still lifetime equity | **PASS** |
| Period profit | Phase 2 Dietz only | **PASS** |
| Ahead % | Phase 3 `aheadPct = rPort − rSpy` | **PASS** |
| S&P card | Phase 3 `benchmarkPct` | **PASS** |
| Key Stats risk | Phase 4 `portfolio-risk-metrics` only | **PASS** |
| Key Stats PE/margins | Phase 4 fundamentals aggregators only | **PASS** |
| Chart Return | Phase 2 Dietz via NAV history | **PASS** |
| Drawdown | Derived from Value series only | **PASS** |

**Note:** Key Stats “ahead” coloring is a **relative % vs the S&P metric value** for that row — not the Overview Ahead percentage points. Different surface, not a duplicate Ahead engine.

---

## 4. Cache audit

| Layer | Behavior |
|-------|----------|
| **Dietz client** | In-memory fingerprint cache + in-flight dedupe (`lib/portfolio/returns/fetch-dietz-returns-client.ts`), TTL 60s. Cards (4 periods) and Allocation donut share results. |
| **overview-market** | `sessionStorage` 5 min by symbol key; keep prior on network error. |
| **value-history** | Next `unstable_cache` 300s by ledger fingerprint; client keeps prior points on error. |
| **analytics / benchmark / dietz API** | `Cache-Control: private, no-store` (always fresh for authenticated POST). Client keeps prior snapshot/compare/Dietz on failure. |
| **React** | Overview cards always mounted; Chart + Key Stats mount once when Overview first visited, then stay mounted (`hidden`) — **tab switch does not remount or refetch**. |

Metrics are **not** recomputed on theme change, sidebar open, or intra-workspace nav once data is loaded.

---

## 5. Network audit

| Endpoint | Callers | Dedupe |
|----------|---------|--------|
| `/api/portfolio/dietz-returns` | Overview cards + Allocation donut | **Shared client** — one fetch path; period merge into fingerprint cache |
| `/api/portfolio/benchmark-compare` | Overview cards only | single effect |
| `/api/portfolio/analytics` | Key Stats only | single effect + retry |
| `/api/portfolio/overview-market` | Overview cards only | session cache + load-key guard |
| `/api/portfolio/value-history` | Chart only | server cache 300s; gen guard against stale range races |

No second analytics or benchmark client for Overview.

---

## 6. Render / stability audit

### Fixes applied this certification (correctness / stability only)

1. **All-time Total Profit %** — Modified Dietz (matches chart Return and Ahead). Total Profit $ remains lifetime equity dollars. Skeleton until first Dietz so lifetime ~27% does not flash before ~38%.
2. **Dietz fetch failure** — keep prior period slices (no clear to `{}`).
3. **Allocation Dietz failure** — keep prior center %.
4. **overview-market failure** — keep prior yields / spy perf (no wipe to empty).
5. **Chart history failure** — keep prior points; show error string; generation counter avoids stale overwrite.
6. **Shared Dietz client** — eliminate duplicate Dietz HTTP when cards + donut need overlapping periods.

### Remaining intentional behavior

- First Overview visit still loads chart + analytics once (expected).
- Quote refresh updates live Value / Invested / All $ / % and re-triggers analytics (holdings dep); does **not** refetch Dietz / benchmark / chart history (EOD-based). Brief live-vs-EOD divergence is expected → **WATCH**.

---

## 7. Update policy (authoritative)

| Event | Refresh |
|-------|---------|
| New / edit / delete transaction | Yes — txs fingerprint changes → Dietz, benchmark, chart, analytics |
| Successful SnapTrade Sync | Yes — merged txs |
| Quote refresh | Value, Invested, All profit $, lifetime %, dividend weights, analytics |
| Overview period dropdown | Client only (cached Dietz map) |
| Chart range change | value-history refetch |
| Chart metric (Value/Profit/Return/Drawdown) | Client only on existing points |
| Tab change (Overview already visited) | **No** |
| Sidebar / theme / same-workspace nav | **No** |

---

## 8. Performance audit

| Path | Notes |
|------|-------|
| Initial portfolio load | Workspace + quote refresh; Overview cards fire market + Dietz + benchmark in parallel |
| First Overview visit | + value-history + analytics (+ allocation Dietz via shared client) |
| Portfolio switch | New txs/holdings → effects re-run; Dietz cache key changes |
| Metric recomputation | Pure client math for Value/Invested/All $/% is cheap; heavy work is server EOD |
| Repeated Dietz | Shared client cache avoids second HTTP within 60s for same ledger |

Offline Phase 1–4 engine perf remains covered by `portfolio:test` certification suite (10k txs ~tens of ms).

---

## 9. Duplicate implementation audit

| Family | Canonical | Duplicates found? |
|--------|-----------|-------------------|
| Lifetime equity $ / % | `lifetimeEquityProfitUsd` / `lifetimeEquityProfitPct` | **No** |
| Modified Dietz primitive | `computeModifiedDietzReturn` | **No** (multiple call sites, one formula) |
| Ahead (Overview) | `comparePortfolioToBenchmark` → `aheadPct` | **No** |
| Sharpe / Sortino / Vol / Beta | `portfolio-risk-metrics.ts` | **No** |
| PE / margins / ROCE / cash conversion | `portfolio-fundamentals.ts` | **No** |
| Turnover | `portfolio-turnover.ts` | **No** |

Search terms covered: Sharpe, Sortino, Beta, Volatility, PE, Turnover, Benchmark, Ahead, Profit %, Return %.

---

## 10. Remaining WATCH items

1. **Live marks vs EOD engines** — Cards Value/All $ use live quotes; chart Return, Dietz periods, and risk metrics use EOD NAV. After quote refresh, card $ can move before chart/Dietz catch up. Not a dual formula — different mark sources by design.
2. **API responses `no-store`** — Correct for authenticated POSTs; freshness relies on client keep-prior + Dietz client cache + value-history `unstable_cache`.
3. **Key Stats vs Overview “ahead” wording** — different semantics (relative metric vs Dietz pp). UI labels already distinguish surfaces; no formula merge required.

---

## 11. Optimization recommendations (non-blocking)

1. Optional React context for Overview market + Dietz to remove even the shared-module hop (not required).
2. AbortController on value-history fetch body (gen guard already present).
3. Consider warming Dietz client from cards before Allocation mounts (already helped by fingerprint cache when cards load first).

---

## 12. Gate table

| Gate | Result |
|------|--------|
| Every metric mathematically correct | **PASS** |
| No duplicate implementations | **PASS** |
| Consistent values after reload | **PASS** |
| No race wipe of good data | **PASS** |
| Metrics reuse cached / prior data | **PASS** |
| Unnecessary Dietz recomputation/network reduced | **PASS** |
| Visually stable on transient failure | **PASS** |
| Canonical Phase 1–4 engines | **PASS** |

---

## Final statement

Portfolio metrics are certified **PASS**.

Canonical rule:

- **All-time $ and %** → lifetime equity (Phase 1 replay semantics).
- **Period cards / Allocation return / Chart Return** → Modified Dietz (Phase 2).
- **S&P + Ahead** → Phase 3 contribution Dietz only.
- **Key Stats** → Phase 4 analytics only.

Stability fixes in this pass ensure failed refetches no longer clear successful metric state, and Dietz network work is shared across Overview surfaces.
