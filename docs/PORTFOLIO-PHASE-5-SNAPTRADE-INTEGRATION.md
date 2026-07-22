# PORTFOLIO MODULE — PHASE 5B SNAPTRADE INTEGRATION (HARDENING)

**Date:** 2026-07-22
**Scope:** Correctness + safety hardening of the existing SnapTrade importer. No UI redesign, no Phase 1–4 formula changes.
**Mode:** Additive / non-destructive. Every change is backward compatible with existing (source-less) ledgers.
**Predecessor:** `docs/PORTFOLIO-PHASE-5-SNAPTRADE-AUDIT.md` (Phase 5A — FAIL).

---

## 1. Executive verdict

### Phase 5B verdict: **WATCH**

All **hard gates** for provenance, external identity, and safe merge are now **PASS**. The overall
verdict is held at **WATCH** for one honest reason: **Sync is still a synchronous *cache pull***.
Phase 5B does **not** implement `refreshBrokerageAuthorization` or `ACCOUNT_HOLDINGS_UPDATED`
webhooks, so on Daily-cadence connections a Sync can complete while showing provider data that is
up to ~24h old. This is disclosed to the user in existing sync copy ("SnapTrade daily cache… may be
up to 24h old") and is not a data-loss risk — it is a freshness caveat.

**What changed vs 5A (the critical failures are fixed):**

- Sync can **no longer delete manual transactions** — full-window sync no longer replaces the ledger.
- Rows carry durable **provider external IDs**; sync is idempotent by `externalId` (no content-hash dedupe).
- Every row has **`source`** provenance; broker rows are **read-only** in the UI.
- Default reconciliation is **REPORT-ONLY** — Sync no longer fabricates Buy/Sell/Cash rows by default.
- Unknown activities produce **structured warnings** instead of silent `null` drops.
- Overlapping syncs for the same connection are **serialized** (module-level lock).
- Reconnect plumbing routes an existing linked portfolio through the **same** portfolio (no duplicate).

---

## 2. Gate table (honest)

| # | Gate | Status | Evidence / caveat |
|---|------|--------|-------------------|
| 1 | Manual txs never deleted by Sync | **PASS** | `mergeSnaptradeSyncSafe` preserves ALL `MANUAL` rows unconditionally; covered by tests. Full-replace path removed from `applySnapTradeSyncToPortfolio`. |
| 2 | Stable external transaction identity | **PASS** | `snaptrade-external-id.ts`: `snaptrade:{activity|order}:{acct}:{id}`; full-precision fallback hash (no 4dp/2dp rounding). |
| 3 | Sync idempotent (upsert by externalId) | **PASS** | Re-running a sync upserts broker rows by `externalId`, preserving local ids; tests assert update-not-duplicate. |
| 4 | No cross-source dedupe | **PASS** | Merge never compares a manual row to a broker row; legacy no-id broker rows match **within broker source only**. Test: identical manual+broker content both survive. |
| 5 | Row-level provenance (MANUAL vs broker) | **PASS** | `source` field on `PortfolioTransaction`; `transactionSource` / `isSnaptradeBrokerRow` / `isManualTransaction`; missing ⇒ MANUAL (idempotent normalize). |
| 6 | Broker rows read-only in UI | **PASS** | Edit + delete blocked in workspace provider for `isSnaptradeBrokerRow` with `toast.error`. |
| 7 | Default reconciliation = REPORT-ONLY | **PASS** | `adjustPositionsToBrokerage` default now `false`; report emits `POSITION_MISMATCH` / `CASH_MISMATCH` / `HISTORY_INCOMPLETE` warnings without fabricating rows. |
| 8 | Unknown activities not silently dropped | **PASS** | `mapActivityToDraft` returns a structured `UNKNOWN_ACTIVITY` warning; expanded map covers INTEREST, WITHDRAWAL, FEE, TAX, WITHHOLDING, TRANSFER IN/OUT. |
| 9 | Concurrency safe | **PASS** | Module-level lock in `sync-brokerage.ts` keyed by `userId:authorizationId` serializes overlapping syncs. |
| 10 | Multi-currency safety | **PASS (guarded)** | Non-USD balances are **not** summed as USD; emits `MULTI_CURRENCY_UNSUPPORTED`; cash reconciliation skipped. Multi-currency *positions* still render USD-centric (documented limitation). |
| 11 | Reconnect without duplicate portfolio | **WATCH** | Plumbing wired end-to-end (`reconnectAuthorizationId` → portal, `reconnectPortfolioId` → in-place resync). No standalone UI entry point was added (constraint: no UI redesign), so it is currently reachable only when a caller supplies the reconnect payload. |
| 12 | Async refresh completion before "done" | **WATCH** | Not implemented. Sync = synchronous **cache pull**. No `refreshBrokerageAuthorization`, no webhook handler. Freshness caveat surfaced in existing copy. |
| 13 | Automated tests | **PASS** | `snaptrade-external-id.test.ts` + `snaptrade-sync-merge.test.ts` wired into `npm run portfolio:test` (101 tests green). |
| 14 | Adapter uses Phase 1–4 only downstream | **PASS** | Unchanged: import → `replayTradeTransactionsToHoldings` (Phase 1) → shared Phase 2–4 APIs. No formula edits. |
| 15 | userSecret server-only / route auth / RLS | **PASS** | Unchanged from 5A (still PASS). userSecret plaintext-at-rest remains a documented residual risk. |

---

## 3. Files changed

### New (`lib/snaptrade/`)
- `snaptrade-external-id.ts` — deterministic, full-precision external identifiers.
- `snaptrade-provenance.ts` — `source` helpers + idempotent normalize.
- `snaptrade-sync-merge.ts` — `mergeSnaptradeSyncSafe` (the only sanctioned merge).
- `snaptrade-external-id.test.ts`, `snaptrade-sync-merge.test.ts` — invariant tests.

### Rewritten / modified
- `lib/snaptrade/build-sync-transactions.ts` — provenance + externalIds on every row; expanded activity map; structured warnings; REPORT-ONLY reconciliation; multi-currency guard; returns `{ transactions, warnings, reconciliation }`; `adjustPositionsToBrokerage` default off.
- `lib/snaptrade/sync-brokerage.ts` — passes `authorizationId` to builder; returns `warnings` + `reconciliation`; module-level concurrency lock.
- `lib/snaptrade/sync-settings.ts` — `adjustPositionsToBrokerage` defaults to `false` (opt-in only).
- `components/portfolio/portfolio-types.ts` — additive provenance fields on `PortfolioTransaction`; `reconnectPortfolioId` on connect payload.
- `components/portfolio/portfolio-workspace-provider.tsx` — `applySnapTradeSyncToPortfolio` now uses `mergeSnaptradeSyncSafe` (never full-replace) after provenance-normalize; broker rows read-only (edit/delete blocked); reconnect routes to in-place resync.
- `components/portfolio/use-snaptrade-connect-portal.tsx` — threads `reconnectAuthorizationId` into the portal POST and `reconnectPortfolioId` into the complete payload.
- `package.json` — `portfolio:test` includes the two new suites.
- Deleted `lib/snaptrade/merge-sync-transactions.ts` (legacy content-hash merge; no remaining references).

The API route `app/api/snaptrade/sync/route.ts` is unchanged — it already returns the full result
object, so `warnings` + `reconciliation` flow to the client automatically.

---

## 4. Safe-merge semantics (authoritative)

`mergeSnaptradeSyncSafe({ existing, incoming, updateFromYmd })`:

1. **All MANUAL rows preserved**, always — sync cannot delete them.
2. Broker rows (`SNAPTRADE` + `SNAPTRADE_ADJUSTMENT`) **upserted by `externalId`**, keeping local id + first `importedAt`.
3. Existing broker rows **not** present in incoming are **preserved** (no tombstones).
4. `updateFromYmd` only bounds which existing broker rows may be **refreshed**; rows dated before the window are never rewritten (and never deleted).
5. **No cross-source dedupe.** Legacy broker rows without an `externalId` match incoming **only within the broker source**, via a full-precision content key.

---

## 5. Reconciliation policy

- **Default = REPORT-ONLY** (`adjustPositionsToBrokerage: false`). The builder computes a
  `reconciliation` report (per-symbol position diffs + cash diff) and emits warnings
  (`POSITION_MISMATCH`, `CASH_MISMATCH`, `HISTORY_INCOMPLETE`) — it does **not** invent rows.
- **Opt-in ADJUSTED** (`adjustPositionsToBrokerage: true`) appends synthetic
  `SNAPTRADE_ADJUSTMENT` rows with **stable adjustment externalIds** (`snaptrade:adjust:…`) so a
  later sync upserts (not duplicates) them. These rows are broker-immutable and clearly noted.

---

## 6. Known gaps / follow-ups (WATCH items)

1. **Freshness / async refresh** — implement `connections.refreshBrokerageAuthorization` + an
   authenticated `ACCOUNT_HOLDINGS_UPDATED` webhook (signature + idempotency) so Sync can wait for
   provider generation on Daily plans. Until then, Sync = cache pull.
2. **Reconnect UX** — plumbing exists; a product entry point (e.g. a "Reconnect" action on a
   disabled connection) was intentionally not added under the no-UI-redesign constraint.
3. **Multi-currency positions** — non-USD *cash* is guarded; non-USD *positions* still render as
   USD-centric. A real FX layer is out of scope here.
4. **userSecret at rest** — stored plaintext (DB-encryption-at-rest assumed). Application-level
   encryption remains a residual risk.
5. **Parity fixtures** — merge/identity invariants are covered; full Manual-vs-normalized-SnapTrade
   golden fixtures (the 17 audit scenarios) are a further step.

---

## 7. Test evidence

```
npm run portfolio:test
# … 101 tests, 24 suites, 0 fail
#   snaptrade external ids — provider ids / fallback hash / adjustments
#   mergeSnaptradeSyncSafe — manual preservation / broker upsert / updateFromYmd window / ordering
```

Source files typecheck clean (`tsc --noEmit`); the only diagnostics are the repo-wide, pre-existing
`.ts`-extension pattern in `*.test.ts` files, which run under `tsx`, not `tsc`.
