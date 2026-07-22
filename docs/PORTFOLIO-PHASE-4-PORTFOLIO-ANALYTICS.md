# PORTFOLIO MODULE — PHASE 4 PORTFOLIO ANALYTICS

**Date:** 2026-07-21  
**Scope:** Manual Portfolio Key Stats only  
**Mode:** Replace muted placeholders with real calculations when data suffices — **no UI redesign**, no ledger/Dietz/benchmark changes, no workspace persistence of analytics  

---

## Final verdict: **PASS**

| Gate | Result |
|------|--------|
| No fake / hardcoded analytics | PASS — unavailable → `—` muted |
| Shared analytics engine | PASS — `lib/portfolio/analytics/` |
| Flow-aware return series | PASS |
| Risk metrics (Sharpe, Sortino, Vol, Beta) | PASS — CONDITIONAL on history |
| Turnover | PASS |
| Fundamentals (P/E, margins, ROCE, cash conversion) | PASS — CONDITIONAL on ≥70% coverage |
| Alpha / MDD / CAGR | BLOCKED — not in UI (documented) |
| Phases 1–3 regression | PASS — `npm run portfolio:test` **79/79** |
| User data / storage unchanged | PASS |

---

## 1. Analytics surface audit

| Surface | Location | Pre–Phase 4 |
|---------|----------|-------------|
| Key Stats (10 metrics) | `portfolio-overview-metrics.tsx` | `EMPTY_METRICS` with muted `"0"` |
| Overview cards | Value / profit / S&P / dividends | Phase 2–3 (unchanged) |
| Performance charts | Value / profit / return / drawdown | Unchanged |
| Period bars | Dietz vs contribution Dietz | Phase 2–3 |
| APIs | none for Key Stats | **New** `POST /api/portfolio/analytics` |

**Labels present (implement):** P/E, Sharpe, Sortino, Cash conversion, Gross margin, Operating margin, ROCE, Volatility, Portfolio turnover, Beta  

**Not present (do not add):** Alpha, Max drawdown, CAGR  

---

## 2. READY / CONDITIONAL / BLOCKED

| Metric | Class | Notes |
|--------|-------|-------|
| Volatility | CONDITIONAL | ≥60 daily flow-aware returns |
| Sharpe | CONDITIONAL | Same series + FRED FEDFUNDS rf |
| Sortino | CONDITIONAL | Same; zero downside → unavailable |
| Beta | CONDITIONAL | ≥60 paired vs Phase 3 contribution SPY |
| Turnover | READY | Ledger trades / current equity MV |
| P/E | CONDITIONAL | Earnings-yield agg; ≥70% eligible MV |
| Gross / Operating margin | CONDITIONAL | MV-weighted; ≥70% |
| ROCE | CONDITIONAL | MV-weighted constituent ROCE; ≥70% |
| Cash conversion | CONDITIONAL | OCF/NI (stock Key Stats definition); ≥70% |
| Alpha | BLOCKED | No UI |
| Max drawdown | BLOCKED | No Key Stats card |
| CAGR | BLOCKED | No UI; flow-aware CAGR not selected |

---

## 3–4. Formulas, period, annualization

### Canonical daily return

Between consecutive session marks \(V_{t-1}, V_t\) with external cash \(CF_t\) on day \(t\):

\[
r_t = \frac{V_t - V_{t-1} - CF_t}{V_{t-1} + CF_t/2}
\]

- Period: trailing **1Y** session dates (SPY calendar)  
- Skip if equity mark coverage &lt; 50% or gap &gt; 5 calendar days beyond consecutive sessions  
- Annualization factor **N = 252**

### Risk

| Metric | Formula |
|--------|---------|
| Volatility | \(s \times \sqrt{252} \times 100\%\) (sample σ, N−1) |
| Sharpe | \((\bar{r}_e / s_e) \times \sqrt{252}\), \(r_e = r - r_f\) |
| Sortino | \((\bar{r}_e / DD) \times \sqrt{252}\), \(DD=\sqrt{\mathrm{mean}(\min(r_e,0)^2)}\) |
| Beta | \(\mathrm{Cov}(r_p,r_b)/\mathrm{Var}(r_b)\) on aligned dates |

Minimum observations: **60** (prefer 252).

### Turnover

\[
\mathrm{Turnover}_{12m} = \frac{\min(\sum |\mathrm{buys}|,\sum |\mathrm{sells}|)}{\mathrm{AvgEquity}} \times 100\%
\]

AvgEquity ≈ current equity MV (documented approximation). Cash / income / expense excluded.

### Fundamentals

| Metric | Aggregation |
|--------|-------------|
| P/E | \(1 / \sum w_i (1/\mathrm{PE}_i)\) over positive PE; cash/crypto out; ETF only if PE&gt;0 |
| Margins | \(\sum w_i m_i\) (MV weights), display % |
| ROCE | MV-weighted constituent ROCE (EODHD / derived EBIT÷(Assets−CL)) |
| Cash conversion | MV-weighted OCF/NI |

Coverage threshold: **70%** of eligible equity MV.

---

## 5. Risk-free-rate policy

**Source:** FRED Effective Federal Funds Rate (`FEDFUNDS`) via existing `fetchFedFundsTargetSeriesCached`.  

**Conversion:** `dailyRf = (annualPct / 100) / 252`.  

**If unavailable:** Sharpe & Sortino → `MISSING_RISK_FREE` (unavailable).  

Documented temporary policy until a dedicated 3M T-bill series is wired.

---

## 6. Benchmark alignment

Beta uses the **Phase 3 contribution-model** SPY NAV path with the same external cash flows and session calendar as the portfolio return series (adjusted close).

---

## 7–9. Fundamental methodology, coverage, freshness

- Provider: **EODHD fundamentals** (Highlights / Valuation / statements)  
- Freshness: live fetch per request (batched); not persisted in workspace  
- Exclusions: `CASH`, `CRYPTO`, `ETF_UNSUPPORTED`, `MISSING_FUNDAMENTALS`, `NEGATIVE_EARNINGS`, `INVALID_VALUE`  
- Negative PE never coerced to 0  

---

## 10. Tests

```bash
npm run portfolio:test
```

**79/79** Phase 1–3 + Phase 4 analytics (A–N, P–Z, AA–AE).

Independent checks: earnings-yield PE for equal 10×/20× → **13.333**; beta of identical series → **1**; Sortino with no downside → **unavailable**.

---

## 11. Performance

| Path | Behavior |
|------|----------|
| Key Stats load | One `POST /api/portfolio/analytics` |
| Internals | Parallel: equity EODs, SPY EOD, FEDFUNDS cache, fundamentals per holding |
| Cap | 500 holdings / 4000 txs |
| Failure | Soft envelope; UI stays `—` |

Approx provider calls: O(holdings) fundamentals + O(symbols) EOD (batched `Promise.all`). No N+1 sequential chain beyond that batch.

---

## 12. Unavailable-state behavior

- `status: "unavailable"` → display **`—`** in muted gray  
- Never show fabricated `0` as a calculated result  
- Layout / labels unchanged  
- Analytics errors do not block portfolio load  

---

## 13. Repository consistency audit

| Symbol / path | Classification |
|---------------|----------------|
| Former `EMPTY_METRICS` zeros | **Removed** — replaced by engine |
| `lib/portfolio/analytics/*` | **Canonical** |
| Stock Key Stats (single ticker) | Unrelated stock page — unchanged |
| Chart drawdown | NAV series UI — not Key Stats |
| `PLACEHOLDER_METRICS` | **Not found** |

---

## 14. Remaining limitations

| Limitation | Severity |
|------------|----------|
| Turnover denominator = current equity (not true period average) | Low |
| FEDFUNDS vs 3M T-bill for Sharpe | Medium (documented) |
| ETF look-through earnings not fabricated | By design |
| Crypto calendars mixed into SPY session marks | Accepted for Manual USD book |
| Average ROCE vs aggregate EBIT/capital | Ratio-weighted when only ratios available |
| Cold cache / provider outage | Unavailable, not fake |

---

## 15. Production deployment recommendation

Safe to deploy:

1. No workspace migration  
2. Soft-fail analytics API  
3. Key Stats shows `—` until sufficient history/coverage  

Monitor: analytics API latency, EODHD fundamentals budget, FEDFUNDS cache hits.

---

## Metric status table

| Metric | Formula | Period | Source | Min history/coverage | Status | Confidence |
|--------|---------|--------|--------|----------------------|--------|------------|
| Sharpe | excess mean/σ × √252 | 1Y | Flow-aware r + FEDFUNDS | 60d | CONDITIONAL | High |
| Sortino | excess mean/DD × √252 | 1Y | Same | 60d + downside | CONDITIONAL | High |
| Volatility | σ × √252 | 1Y | Flow-aware r | 60d | CONDITIONAL | High |
| Beta | Cov/Var vs SPY contrib | 1Y | Paired r | 60 paired | CONDITIONAL | High |
| Turnover | min(buy,sell)/equity | 12M | Ledger | n/a | READY | High |
| P/E | 1/Σ w·(1/PE) | TTM | EODHD | 70% MV | CONDITIONAL | High |
| Gross margin | Σ w·m | TTM | EODHD | 70% | CONDITIONAL | High |
| Op. margin | Σ w·m | TTM | EODHD | 70% | CONDITIONAL | High |
| ROCE | Σ w·ROCE | TTM | EODHD/derived | 70% | CONDITIONAL | Medium |
| Cash conversion | Σ w·(OCF/NI) | TTM | EODHD | 70% | CONDITIONAL | High |
| Alpha | — | — | — | — | BLOCKED | — |
| Max DD | — | — | — | — | BLOCKED | — |
| CAGR | — | — | — | — | BLOCKED | — |

---

## Rollback

1. Revert `portfolio-overview-metrics.tsx` to muted empty pattern  
2. Remove `/api/portfolio/analytics` and `lib/portfolio/analytics/`  
3. No data migration required  
