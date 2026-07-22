# PORTFOLIO MODULE — PHASE 1 CORRECTNESS REPORT

**Date:** 2026-07-21  
**Scope:** Manual Portfolio ledger determinism + invalid-state prevention  
**Mode:** No UI redesign; no return methodology; no benchmark work; no brokerage/import  

**Verdict: PASS** (with staged strict persist flag)

---

## Executive summary

Phase 1 makes Manual Portfolio ledgers **deterministic** and blocks **new** impossible sells without destroying existing user data.

| Gate | Status |
|------|--------|
| Canonical order (date → sequence → id) | **Done** — shared helper |
| Same-day chronology preserved | **Done** — sequence from array order / createdAt stamps |
| Orphan / oversell rejection | **Done** — for new mutations |
| Server semantic validation | **Done** — behind `FINSEPA_PORTFOLIO_LEDGER_STRICT=1` |
| Client validation (add/edit/delete) | **Done** — shared pure module |
| Edit/delete cascade safety | **Done** |
| Key Stats placeholders removed | **Done** — empty/unavailable pattern |
| Shared ledger engine | **Done** |
| Legacy-compatible migration | **Done** — additive `sequence` / `legacyAnomaly` |
| Tests | **22/22 PASS** |

---

## 1. Root causes fixed

| Phase 0 ID | Fix |
|------------|------|
| P0-01 Same-day non-determinism | Canonical `sequence`; sort never relies on JS stability alone |
| P0-06 Silent orphan/oversell | Strict reject on new mutations; no `Math.min` clamp for untagged sells |
| P0-03 Fake Key Stats | Placeholders removed; section shows muted empty values |

---

## 2. Canonical ordering

**Definition (everywhere for calculations):**

1. `date` ascending (`YYYY-MM-DD`)
2. `sequence` ascending (finite number)
3. `id` ascending (final tie-breaker)

**Module:** `lib/portfolio/ledger/portfolio-ledger-order.ts`

**UI transactions table** still displays newest-first for layout continuity; **all ledger math** uses the canonical ascending helper.

---

## 3. Validation rules

Shared module: `lib/portfolio/ledger/portfolio-ledger-validate.ts`

| Code | When |
|------|------|
| `SELL_WITHOUT_POSITION` | Sell with no open qty at that point in history |
| `SELL_EXCEEDS_AVAILABLE_SHARES` | Sell qty &gt; available |
| `INVALID_QUANTITY` | Non-positive trade qty |
| `INVALID_PRICE` | Non-positive trade price |
| `INVALID_FEE` | Negative fee |
| `DUPLICATE_TRANSACTION_ID` | Duplicate id in portfolio |
| `DUPLICATE_PORTFOLIO_ID` | Duplicate portfolio id in workspace |
| `INVALID_NUMERIC` / `MISSING_FIELDS` / `INVALID_SPLIT` / `UNKNOWN_TRANSACTION_KIND` | Structural |

**Cash may be negative** — still allowed (product rule unchanged).

**Mutation path (client):** validate full proposed ledger before applying add/edit/delete.

**Persist path (server PUT):**

1. Always parse existing `v:1` workspace (backward compatible).
2. Lazy-migrate sequences + tag historical anomalies (`prepareWorkspaceLedgerForPersist`).
3. If `FINSEPA_PORTFOLIO_LEDGER_STRICT=1` → reject with **422** + structured errors when non-legacy issues remain.
4. If flag unset → migrate + save; log warnings only (**safe default for rollout**).

---

## 4. Ledger engine architecture

```
transactions[]
  → migrate sequences (additive)
  → sortPortfolioTransactionsCanonical
  → replayPortfolioLedger({ mode: "strict" | "display" })
       → cash, holdings (avg cost), realized, issues
```

| File | Role |
|------|------|
| `ledger/portfolio-ledger-order.ts` | Sort / next sequence |
| `ledger/portfolio-ledger-engine.ts` | Single replay |
| `ledger/portfolio-ledger-validate.ts` | Semantic validation |
| `ledger/portfolio-ledger-migrate.ts` | Assign missing sequences |
| `ledger/portfolio-ledger-prepare.ts` | Persist prep + anomaly tags |
| `lib/features/portfolio-correctness.ts` | Strict PUT flag |

Consumers updated to use the engine: `rebuild-holdings-from-trades.ts`, `realized-pnl-from-trades.ts`, `benchmark-inception.ts` (share replay order).

**Holding ids:** deterministic `h:{SYMBOL}` when no prior id / holdingId (removes UUID churn on replay).

---

## 5. Legacy migration behavior

**Additive fields only** (old clients ignore unknown JSON keys):

- `sequence?: number`
- `createdAt?: string`
- `legacyAnomaly?: boolean`

**On next successful save / sync:**

1. Missing `sequence` → assigned from **current stored array order** within each date (preserves same-day chronology).
2. Orphan/oversell sells discovered under display replay → tagged `legacyAnomaly: true` (**not deleted, amounts unchanged**).
3. Display/load continues to soft-handle tagged anomalies (Phase 0 skip/clamp) so historical books remain visible.
4. New untagged orphan/oversell mutations are rejected.

**No destructive DB migration.** Workspace schema version remains `v: 1`.

**Rollback:** unset `FINSEPA_PORTFOLIO_LEDGER_STRICT`; optional fields are ignored by older code paths; removing Phase 1 code still leaves readable JSON.

---

## 6. Tests and results

```bash
npm run portfolio:test
```

**22 passed / 0 failed**, including:

1. Buy → sell same day  
2. Sell → buy same day rejected  
3. Idempotent replay  
4–7. Orphan / oversell / full exit / fractional crypto  
8. Two buys + partial sell avg cost  
9–10. Edit/delete buy breaking later sell  
11–12. Duplicate id / invalid price·qty·fee  
13. Legacy sequence migration  
14. Legacy orphan tagged + workspace still validates  
15. Phase 0 scenarios A, B, F, H, I, J  

Client/server validators are the **same pure module** (parity by construction).

---

## 7. Before / after deterministic scenarios

| Scenario | Before (Phase 0) | After (Phase 1) |
|----------|------------------|-----------------|
| Same-day Buy then Sell (seq 1→2) | Order depended on array/sort stability | Deterministic full exit, realized = proceeds − cost |
| Same-day Sell then Buy (seq 1→2) | Could silently skip sell or flip | **Rejected** as `SELL_WITHOUT_POSITION` for new data |
| Orphan sell | Skipped silently | Rejected unless `legacyAnomaly` |
| Oversell | Clamped via `Math.min` | Rejected unless `legacyAnomaly` |
| Edit Buy 10→5 with later Sell 8 | Could leave clamped book | **Rejected** |
| Key Stats | Fake Sharpe 1.12 etc. | Muted empty `0` pattern |

---

## 8. Existing invalid data discovery

Handled at persist-prep time (not deleted):

| Finding | Action |
|---------|--------|
| Missing sequences | Assigned from array order |
| Ambiguous same-day groups | Sequences preserve relative order |
| Historical orphan/oversell sells | Tagged `legacyAnomaly`; warnings on PUT |

Operators can inspect PUT logs for `ledger warnings` and `legacyTaggedByPortfolio` after rollout.

---

## 9. Remaining risks

| Risk | Severity | Notes |
|------|----------|-------|
| Strict PUT off by default | intentional | Turn on after dry-run in prod |
| Display table still newest-first | Low | Visual only; math is canonical |
| SnapTrade merge path | Out of scope | May still write soft sells; next Manual prepare will tag |
| Deterministic holding id change | Low | May rematerialize holding row ids as `h:SYM` |
| Return / benchmark bugs (P0-02, P0-04, P0-05) | Unchanged | Explicitly deferred |

---

## 10. Production deployment recommendation

### Stage 1 — ship code (default safe)

1. Deploy Phase 1 with **`FINSEPA_PORTFOLIO_LEDGER_STRICT` unset**.
2. Client mutations already reject bad new sells/edits/deletes.
3. PUT migrates sequences + tags anomalies; never deletes txs.
4. Monitor logs for warning volume.

### Stage 2 — dry-run / limited validation

1. Sample production `portfolio_workspace` rows offline: parse → `prepareWorkspaceLedgerForPersist` → `validateWorkspaceState`.
2. Confirm: portfolio count, tx count unchanged; only additive fields.
3. Enable `FINSEPA_PORTFOLIO_LEDGER_STRICT=1` on preview, then production.

### Stage 3 — full strict persist

Reject PUT with 422 for untagged ledger errors (clients already toast).

### Do not

- Bulk rewrite all workspaces in a destructive migration
- Enable strict persist before sampling anomaly rates

---

## Compatibility checklist

| Requirement | Met |
|-------------|-----|
| Existing workspace JSON still parses (`v:1`) | Yes |
| No portfolio/transaction deletes | Yes |
| IDs unchanged | Yes |
| RLS unchanged | Yes |
| Optional fields additive | Yes |
| Legacy portfolios readable | Yes |
| Rollback possible | Yes |
| UI layout preserved | Yes |
| Brokerage/import untouched (except shared types) | Yes |

---

## Final verdict

# PASS

Safe to deploy with strict persist **off**, then enable the flag after a production-shaped dry-run. Do **not** start return methodology or benchmark work until Phase 1 is live and monitored.
