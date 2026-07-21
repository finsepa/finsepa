# SUPERINVESTORS PHASE 3 — DATA PARITY & CORRECTNESS

**Date:** 2026-07-21  
**Scope:** Accuracy / completeness / freshness vs SEC (source of truth) and Dataroma (benchmark only)  
**Mode:** No UI, UX, layout, navigation, tabs, charts, or feature work  

**Automated validation:** `npm run superinvestors:phase3-validate` → **PASS=18 WATCH=0 FAIL=0**  
**Audit artifact:** `docs/SUPERINVESTORS-PHASE-3-PARITY-AUDIT.json`

---

## Executive summary

Finsepa Superinvestor equity holdings now match an independent SEC EDGAR re-parse for all **18** supported managers (filing accession, counts, portfolio value, weights, top holdings, shares/values).

The primary verified defect was **put/call options aggregated into equity CUSIPs**, which inflated holdings counts and portfolio values for option-heavy filers (Burry, Citadel, Point72, BlackRock, First Eagle). Options are now excluded; preferred equity without `putCall` is retained (SEC truth).

Dataroma remains a benchmark only. Remaining count gaps vs Dataroma are explained and intentionally **not** “fixed” toward Dataroma.

---

## 1. Managers audited (18)

| Manager | Slug | SEC CIK | Dataroma | Finsepa = SEC count |
|---------|------|---------|----------|---------------------|
| Warren Buffett | berkshire-hathaway | 0001067983 | BRK | 29 = 29 |
| Bill Ackman | bill-ackman | 0001336528 | psc | 11 = 11 |
| Terry Smith | terry-smith | 0001569205 | FS | 34 = 34 |
| Michael Burry | michael-burry | 0001649339 | SAM | 4 = 4 |
| Cathie Wood | cathie-wood | 0001697748 | — | 181 = 181 |
| Li Lu | li-lu | 0001709323 | HC | 14 = 14 |
| Ray Dalio | ray-dalio | 0001350694 | — | 993 = 993 |
| Ken Fisher | ken-fisher | 0000850529 | — | 1016 = 1016 |
| PRIMECAP | primecap-management | 0000763212 | — | 320 = 320 |
| Ken Griffin | ken-griffin | 0001423053 | — | 6006 = 6006 |
| Charlie Munger | charlie-munger | 0000783412 | — | 4 = 4 |
| BlackRock | blackrock | 0002012383 | — | 5606 = 5606 |
| Baillie Gifford | baillie-gifford | 0001088875 | — | 271 = 271 |
| Jim Simons | renaissance-technologies | 0001037389 | — | 3213 = 3213 |
| Steven Cohen | point72 | 0001603466 | — | 1983 = 1983 |
| First Eagle | first-eagle | 0001325447 | FE | 421 = 421 |
| Chris Hohn | chris-hohn | 0001647251 | tci | 10 = 10 |
| Jeremy Grantham | jeremy-grantham | 0001352662 | — | 628 = 628 |

Dataroma coverage: **7 / 18** managers.

---

## 2. Discrepancies found (pre-fix)

| Manager | Finsepa (old) | SEC equity | Dataroma | Root cause |
|---------|---------------|------------|----------|------------|
| Michael Burry | 8 | 4 | 3 | Put/call rows merged into equity; Dataroma also drops preferred |
| Ken Griffin | 6733 | 6006 | — | Options aggregated into stock CUSIPs |
| BlackRock | 5610 | 5606 | — | Options in info table |
| Point72 | 2426 | 1983 | — | Options in info table |
| First Eagle | 424 | 421 | 417 | Options (4 rows); Dataroma still below SEC equity |

Secondary operational bug (discovered during refresh):

| Issue | Effect | Root cause |
|-------|--------|------------|
| Cron / force-refresh validated **paginated** holdings (50 rows) | Large books failed `weight_sum` and **did not persist** corrected v4 snapshots | Phase 2A SSR pagination leaked into ingest path |

---

## 3. Issues fixed

### 3.1 Exclude 13F put/call from equity aggregation

- **File:** `lib/superinvestors/berkshire-13f.ts`
- Parse `putCall`; skip put/call lines before CUSIP aggregate
- Preferred / other equity without `putCall` retained
- Unit tests: `lib/superinvestors/superinvestor-13f-options.test.ts`

### 3.2 Cache / snapshot key bump (v4 / no-options)

- Profile / holdings-tx / full-tx snapshot keys → `*_v4_*`
- Next.js accession caches → `*-no-options` suffixes
- Forces rebuild so option-inflated rows are not served

### 3.3 Ingest uses full holdings book

- `loadSuperinvestorProfilePageDataFull` for cron, force-refresh, and soft refresh validate/persist
- SSR UI still uses paginated `loadSuperinvestorProfilePageData`
- **Commits:** `bbd13b8`, `1b553dc`, `42a1bf4`

### 3.4 Re-ingest

All 18 `superinvestor_13f_profile_v4_*` rows refreshed and validated against SEC.

---

## 4. Remaining differences vs Dataroma

| Manager | Finsepa / SEC | Dataroma | Explanation |
|---------|---------------|----------|-------------|
| Michael Burry | **4** positions, value **$68.1M** | **3** positions, value **$55.0M** | Finsepa includes **BRUKER preferred** (no `putCall` in SEC). Dataroma omits preferred. Same common shares (MOH, LULU, SLM) match share counts and values. |
| First Eagle | **421** / **$59.00B** | **417** / **$58.89B** | Finsepa matches SEC equity-only aggregate. Dataroma is 4 short — likely preferred / share-class filtering on their side. Top-5 tickers, shares, and values align. |
| Berkshire, Ackman, Fundsmith, Li Lu, TCI | Exact count match | Exact | No material gap |
| 11 managers | SEC-matched | N/A | Not listed on Dataroma |

**Policy:** Never alter Finsepa data solely to match Dataroma. SEC remains authoritative.

---

## 5. Validation matrix (automated)

Script: `scripts/superinvestor-phase3-parity-audit.mjs` + `scripts/superinvestor-phase3-validate.mjs`

Checks per manager (PASS/FAIL):

- filing freshness (accession vs SEC latest)
- holdings count vs SEC equity-only
- portfolio value vs SEC
- weights sum ≈ 100%
- top holdings order vs SEC
- shares/values spot check
- duplicate rows
- ticker resolution
- activity counts (present / non-blocking vs Dataroma)

**Result after fix + refresh: PASS=18 / FAIL=0**

---

## 6. Regression notes

| Area | Status |
|------|--------|
| UI / layout / tabs / navigation | Unchanged |
| Holdings pagination (50/page SSR) | Unchanged for page render; ingest no longer uses page slice |
| Profile APIs / snapshot read path | Compatible (`*_v4_*` keys) |
| Snapshot invalidation on new accession | Intact (head probe + key segment) |
| Warm Activity (`/transactions`) | Restored via local cold rebuild after force-refresh wiped `transactions_full_v4_*`. Berkshire Activity uses holdings-scoped `holdings_tx_v4` (by design), not full history. |
| Citadel full-tx persist | Succeeds locally (~6 min); Cloudflare ~125s / client 300s cuts can disconnect before response — server may still finish upsert |

Ops: after any mass `forceRefresh`, warm Activity for large books from a long-timeout host (local/dev). Profile SEC parity does not by itself rebuild full Activity history.

---

## 7. Confidence

| Claim | Confidence |
|-------|------------|
| Equity holdings count / value / weights match SEC for all 18 | **High** (independent re-parse + persisted snapshot audit) |
| Options no longer inflate equity books | **High** (XML putCall filter + unit tests + count deltas closed) |
| Preferred retained when SEC reports equity (no putCall) | **High** (Burry BRKR preferred) |
| Dataroma gaps are their filtering, not Finsepa under-count | **High** for Burry; **Medium-High** for First Eagle (−4) |
| Activity full-history warm path after force-refresh | **High** after local full-tx backfill (Citadel/RenTech/Point72 `cache=hit`; large JSONB reads still ~2–5s as in Phase 2A) |

---

## 8. How to re-run

```bash
npm run superinvestors:test
npm run superinvestors:phase3-audit
npm run superinvestors:phase3-validate
```

Single manager:

```bash
node --env-file=.env.local scripts/superinvestor-phase3-parity-audit.mjs --slug=michael-burry
```
