# PORTFOLIO MODULE — FINAL PARITY CERTIFICATION

**Date:** 2026-07-22  
**Mode:** Certification only (no new product features, no UI redesign, no Phase 1–4 formula changes).  
**Depends on:** Phases 1–4 + Phase 5B SnapTrade hardening.  
**Evidence command:** `npm run portfolio:test` → **128/128 pass** (includes certification suite).

---

## 1. Executive verdict

### **PASS** (with inherited provider WATCH items)

Manual Portfolio and Connected Portfolio are **mathematically equivalent after SnapTrade normalization**. There is one **Canonical Portfolio Engine** (Phases 1–4). SnapTrade is only an upstream adapter (`normalize → merge → shared ledger`).

Remaining WATCH items are **provider / ops limitations only** (Daily cache freshness, reconnect UX entry, plaintext `userSecret` at rest). They do **not** create a separate Connected calculation path and do **not** fail economic parity.

| Area | Result |
|------|--------|
| Manual Portfolio | **PASS** |
| Connected Portfolio | **PASS** (adapter) / **WATCH** (provider freshness) |
| Ledger (Phase 1) | **PASS** |
| Returns (Phase 2) | **PASS** |
| Benchmark (Phase 3) | **PASS** |
| Analytics (Phase 4) | **PASS** (shared engines; offline cert covers Dietz/allocation/P&L; live Sharpe/Beta use same APIs) |
| Sync | **PASS** (idempotent upsert) / **WATCH** (cache-pull semantics) |
| Parity | **PASS** |
| UI | **PASS** (unchanged) |
| Data Safety | **PASS** |

---

## 2. Architecture diagram

```text
MANUAL                              CONNECTED
──────                              ─────────
User edits / CSV import             SnapTrade activities / orders
        │                                    │
        │                          ┌─────────┴─────────┐
        │                          │ Adapter (only)    │
        │                          │ normalize activity│
        │                          │ + externalId      │
        │                          │ + safe merge      │
        │                          └─────────┬─────────┘
        │                                    │
        └──────────────┬─────────────────────┘
                       ▼
              Canonical transactions
              (source: MANUAL | SNAPTRADE)
                       │
                       ▼
              Phase 1 — Ledger replay
              lib/portfolio/ledger/*
                       │
                       ▼
              Phase 2 — Modified Dietz
              lib/portfolio/returns/*
                       │
                       ▼
              Phase 3 — Benchmark (SPY contribution Dietz)
              lib/portfolio/benchmark/*
                       │
                       ▼
              Phase 4 — Analytics
              lib/portfolio/analytics/*
                       │
                       ▼
              Existing shared Portfolio UI
```

### Shared modules (canonical)

| Concern | Module |
|---------|--------|
| Ordering | `portfolio-ledger-order.ts` |
| Replay / holdings / cash / realized | `portfolio-ledger-engine.ts` |
| Persist migration | `portfolio-ledger-prepare.ts` |
| Dietz | `modified-dietz.ts`, `portfolio-return-engine.ts` |
| Benchmark | `benchmark-engine.ts` |
| Overview P/L | `overview-metrics.ts`, `realized-pnl-from-trades.ts` |
| Allocation | `portfolio-allocation-rows.ts` |
| Analytics | `lib/portfolio/analytics/*` |

### Adapter-only (Connected)

| Concern | Module | Role |
|---------|--------|------|
| Normalize activity/order | `snaptrade-normalize-activity.ts` | Provider → draft |
| External IDs | `snaptrade-external-id.ts` | Idempotency keys |
| Provenance | `snaptrade-provenance.ts` | `source` helpers |
| Merge | `snaptrade-sync-merge.ts` | Non-destructive upsert |
| Sync orchestration | `sync-brokerage.ts`, `build-sync-transactions.ts` | Fetch + reconcile report |
| Portal / SDK | `server.ts`, API routes | Auth + connection |

**No Connected-specific Dietz, ledger, benchmark, or analytics implementation exists.**

---

## 3. Parity matrix (required fixtures)

Tolerances: USD `≤ 0.005`, quantity `≤ 1e-9`, % `≤ 1e-6`.  
Comparison strips provenance (`source` / `externalId`) and compares economics + Phase 1–3 downstream snapshots.

| # | Fixture | Economic FP | Holdings/Cash/Avg/P&L | Dietz | Benchmark ahead | Allocation | Result |
|---|---------|-------------|------------------------|-------|-----------------|------------|--------|
| 1 | Cash deposit | match | match | match | match | match | **PASS** |
| 2 | Single buy | match | match | match | match | match | **PASS** |
| 3 | Multiple buys | match | match | match | match | match | **PASS** |
| 4 | Partial sell | match | match | match | match | match | **PASS** |
| 5 | Full sell | match | match | match | match | match | **PASS** |
| 6 | Dividend | match | match | match | match | match | **PASS** |
| 7 | Interest | match | match | match | match | match | **PASS** |
| 8 | Deposit + withdrawal | match | match | match | match | match | **PASS** |
| 9 | Fee | match | match | match | match | match | **PASS** |
| 10 | Stock + ETF | match | match | match | match | match | **PASS** |
| 11 | Fractional shares | match | match | match | match | match | **PASS** |
| 12 | Same-day buy/sell | match | match | match | match | match | **PASS** |
| 13 | Same-day deposit/buy | match | match | match | match | match | **PASS** |
| 14 | Manual adj in Connected | n/a (mixed) | manual preserved | coherent | — | — | **PASS** |
| 15 | Reconnect | no duplicate broker rows | stable | — | — | — | **PASS** |
| 16 | Incremental Sync | upsert / no dups | stable | — | — | — | **PASS** |
| 17 | Full Sync | manuals preserved | stable | — | — | — | **PASS** |
| 18 | Provider correction | same `externalId` updates | price/sum updated once | — | — | — | **PASS** |
| 19 | Duplicate Sync | identical workspace key | stable | — | — | — | **PASS** |
| 20 | Large Portfolio | n=10k import | holdings ≤500 symbols | — | — | — | **PASS** |

Evidence: `lib/portfolio/certification/portfolio-parity-certification.test.ts`.

---

## 4. Determinism results

| Check | Result |
|-------|--------|
| Normalize same activities ×3 → identical draft JSON | **PASS** |
| Merge empty → incoming ×3 → identical `workspaceDeterminismKey` | **PASS** |
| Holdings fingerprint stable across repeated sync | **PASS** |
| Duplicate full sync does not change row count | **PASS** |
| Local Finsepa IDs preserved on upsert | **PASS** (merge keeps existing `id`) |

---

## 5. Sync stability & manual coexistence

Verified:

- Sync **never** deletes `MANUAL` rows (full or incremental).
- Broker rows absent from one response are **preserved**.
- Manual + broker rows with identical economics **coexist** (no cross-source dedupe).
- Broker rows stay `SNAPTRADE`; manual stays `MANUAL` after sync.
- Provider correction with same activity id updates economics in place (no second buy).
- Reconnect with new `authorizationId` does **not** duplicate history (`externalId` remains account+activity scoped).
- Unknown activity → warning only; **0** ledger rows.

---

## 6. Performance (local `tsx` measurements)

| Activities | Holdings (approx) | Normalize | Merge (2×) | Ledger+snapshot | Total |
|------------|-------------------|-----------|------------|-----------------|-------|
| 10 | 10 | ~0.2 ms | ~0.1 ms | ~0.2 ms | ~0.5 ms |
| 100 | 100 | ~0.9 ms | ~0.3 ms | ~1 ms | ~2–5 ms |
| 1,000 | 500 | ~6 ms | ~2 ms | ~9 ms | ~17 ms |
| 10,000 | 500 | — | — | — | ~73 ms |

No O(n²) merge/normalize regression observed. Soft CI budgets enforced in tests.

---

## 7. Repository consistency audit

| Pattern | Classification |
|---------|----------------|
| `lib/snaptrade/snaptrade-normalize-activity.ts` | **provider adapter** (canonical normalize) |
| `lib/snaptrade/snaptrade-sync-merge.ts` | **provider adapter** (canonical merge) |
| `lib/snaptrade/build-sync-transactions.ts` | **provider adapter** (fetch + report-only reconcile) |
| `lib/portfolio/ledger/*` | **shared portfolio engine** |
| `lib/portfolio/returns/*` | **shared portfolio engine** |
| `lib/portfolio/benchmark/*` | **shared portfolio engine** |
| `lib/portfolio/analytics/*` | **shared portfolio engine** |
| UI brokerage labels / sync modal | **UI-only** |
| Legacy content-hash merge | **removed** (Phase 5B) |
| Auto synthetic reconcile | **disabled by default** (`adjustPositionsToBrokerage: false`) |

Search confirmation: no SnapTrade-specific Dietz/Sharpe/Beta/ledger replay path under `lib/snaptrade`. Downstream UI cards call shared APIs only.

---

## 8. Remaining WATCH items (provider / ops only)

1. **Sync freshness** — Sync still means “Finsepa finished importing available SnapTrade Daily cache,” not verified live brokerage refresh (no `refreshBrokerageAuthorization` + webhook wait).
2. **Reconnect UX** — In-place reconnect is wired; no new UI entry was added under the no-redesign constraint.
3. **`userSecret` at rest** — Still plaintext at application layer (DB encryption-at-rest assumed).
4. **Multi-currency positions** — Non-USD cash guarded; positions remain USD-centric without a full FX layer.
5. **Live Key Stats risk ratios** — Offline cert proves shared Dietz/benchmark/allocation/P&L; Sharpe/Sortino/Beta still depend on shared EOD market feeds for both Manual and Connected equally.

---

## 9. Production recommendation

**Ship Connected + Manual as one engine.**

Rollout posture:

1. Keep Phase 5B safe-merge + report-only reconcile as default.
2. Monitor sync warnings (`UNKNOWN_ACTIVITY`, `POSITION_MISMATCH`, `MULTI_CURRENCY_UNSUPPORTED`).
3. Treat provider Daily cache lag as disclosed freshness, not a parity defect.
4. Optional later: async refresh + webhooks (does not change parity math).

**Rollback:** Revert adapter/merge flags only; do not rewrite workspaces. Manual portfolios are unaffected by SnapTrade adapter changes.

---

## 10. Gate table

| Gate | Result | Evidence |
|------|--------|----------|
| Source provenance | **PASS** | `source` on rows; missing ⇒ MANUAL |
| Stable external IDs | **PASS** | `snaptrade-external-id` + cert fixtures |
| Manual rows preserved | **PASS** | merge tests + fixture 14/17 |
| Safe broker upsert | **PASS** | fixture 18/19 |
| No cross-source dedupe | **PASS** | Phase 5B + coexistence tests |
| Broker rows immutable (policy) | **PASS** | workspace provider blocks; merge does not convert sources |
| Unknown activities visible | **PASS** | warning, not silent drop |
| Deterministic ordering | **PASS** | economic FP + ×3 sync |
| Reconciliation report-only default | **PASS** | Phase 5B settings |
| No fabricated cost basis by default | **PASS** | adjust off |
| Sync semantics accurate (cache pull disclosed) | **WATCH** | Phase 5B |
| Concurrency-safe | **PASS** | sync lock (Phase 5B) |
| Reconnect preserves portfolio | **PASS** | fixture 15 |
| Multi-currency safe (cash) | **PASS** / positions **WATCH** | Phase 5B |
| Manual/Connected parity | **PASS** | fixtures 1–13 |
| Phase 1–4 regression | **PASS** | 128 tests |
| UI unchanged | **PASS** | no UI edits in certification |
| User data preserved | **PASS** | non-destructive merge |

---

## 11. Certification artifacts

| Artifact | Path |
|----------|------|
| Fixtures | `lib/portfolio/certification/parity-fixtures.ts` |
| Compare harness | `lib/portfolio/certification/parity-compare.ts` |
| Automated suite | `lib/portfolio/certification/portfolio-parity-certification.test.ts` |
| Pure normalizer (adapter) | `lib/snaptrade/snaptrade-normalize-activity.ts` |
| Prior hardening report | `docs/PORTFOLIO-PHASE-5-SNAPTRADE-INTEGRATION.md` |

---

## Final statement

After normalization there is **no** “Manual calculation path” and **no** “Connected calculation path.”

There is only the **Canonical Portfolio Engine** (Phases 1–4).  
SnapTrade is an upstream adapter. Parity is certified **PASS**.
