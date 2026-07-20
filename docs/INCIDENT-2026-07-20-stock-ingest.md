# INCIDENT-2026-07-20 — Stock minute ingest write stall

**Date:** 2026-07-20  
**Symbols:** NVDA, AAPL, QQQ, SPY  
**Services:** `finsepa-stock-minute-ingest` (Railway), Supabase project `pjwzvqvrqqvjgwuouoxy` (`ap-south-1`)  
**Related:** BTC 1D chart truncation (crypto DB read path; separate root cause)  
**Status:** Mitigated (Phase 1 deployed); underlying Railway→Supabase path latency unresolved  
**Verdict after Phase 1 validate:** WATCH — safe to keep deployed; monitor aborts / retry queue

---

## 1. Timeline

All times **UTC** on **2026-07-20** unless noted.

| Time | Event |
|------|--------|
| ~13:25–13:30 | Stock worker healthy. Upserts of 2–4 rows completing ~1.5–3s apart. `pendingUpserts` ≈ 2. Session still `pre`. |
| **13:30:00** | US regular session open (09:30 ET). |
| **13:30:03** | Last successful hot upsert before first abort (~4 rows; inter-success gap already ~12s — latency climbing). |
| **13:30:33** | **First AbortError** — 4-row upsert, attempt 1. Client 15s `AbortController` fired. Queue still tiny (~4). |
| 13:30–13:40 | Abort storm: chunk retries + single-row fallback under global `flushInProgress`. `pendingUpserts` grows (24 → 36 → 68…). WS stays connected; trades keep arriving. |
| **13:40:15–13:40:40** | Brief recovery burst: upserted 15, 15, then 6 bars (~12–13s per 15-row chunk). |
| **13:41:08+** | Sustained abort storm resumes (12-row chunks, then 1-row fallback). Chart “holes” for NVDA/AAPL/QQQ/SPY accumulate. |
| Earlier same day (BTC) | BTC DB nearly continuous; chart looked truncated because PostgREST **1000-row** cap on ascending crypto minute fetch. |
| Prior session | Crypto pagination fix implemented (read path only); stock write path unchanged until Phase 1. |
| **15:48:22** | **Phase 1 deploy** of stock worker (observability + non-blocking retry). Boot: authorized, subscribed 4. |
| 15:48:47 | First post-deploy success (4 bars; latency ~14.3s — near timeout). |
| 15:49:15+ | Natural AbortErrors continue; hot path logs **attempt 1 only**; failures move to `retryQueue`; hot + retry succeed in parallel. |
| 15:48–16:24 | ~36 min validation: post-deploy continuity **32/33** minutes × 4 symbols; session-level gaps from morning remain. Verdict: **WATCH**. |

---

## 2. Root cause investigation

### What was ruled out early

| Hypothesis | Result |
|------------|--------|
| WebSocket disconnect / auth loss | **False.** WS stayed `authorized: true`, `subscribed: 4`, trade counts rising. |
| Flush timer stopped | **False.** Flushes continued; worker logged upsert attempts throughout. |
| Chart / API failing to return existing bars | Secondary. Missing minutes were **not in DB**. |
| Oversized chunks / config change at 13:41 | **False.** `STOCK_WS_FLUSH_CHUNK_SIZE=15` unchanged; first abort was **4 rows**. |
| Queue backlog *caused* the first timeout | **False.** Backlog grew **after** the first abort while `flushInProgress` held. |

### AbortError mechanism (proven)

AbortError came from **our** custom Supabase fetch wrapper in `scripts/stock-ws-minute-ingest.mjs`:

1. `setTimeout(() => ac.abort(), timeoutMs)` in `makeSupabaseFetch`
2. Railway env: `SUPABASE_UPSERT_TIMEOUT_MS=15000` (**15 seconds**)
3. Path: `flushPendingUpserts` → `saveMinuteBarRows` → `upsert` → aborted `fetch`

Not a PostgREST “AbortError” response, not a Supabase SDK built-in timeout independent of our fetch, and not proven as a Railway container CPU crash (worker CPU ~1/24 vCPU during the window).

### Why writes exceeded 15s (Supabase latency check)

Completed PostgREST upserts in Supabase **edge_logs** for `POST /rest/v1/stock_session_minute_bar`:

| Window | Completed upserts | p50 `origin_time` | max |
|--------|-------------------|-------------------|-----|
| 13:25–13:30 | 140 | **~238 ms** | 696 ms |
| 13:30–14:00 | 15 | **~249 ms** | 263 ms |

Statuses were **200/201**. Postgres logs in-window showed **checkpoints only** (no query errors, locks, or statement timeouts). Long checkpoint writes (35s / 113s) began **after** the first abort.

**Conclusion:** PostgREST/DB query time for *completed* requests did **not** jump to >15s. Completions **collapsed** after open (≈25–34/min → ≈0–3/min). Most likely class: **end-to-end HTTP non-completion** on Railway (US West) → Supabase (`ap-south-1`), with client abort at 15s. Incomplete requests leave no `origin_time`.

**Confidence:** High that AbortError ≠ PostgREST compute latency spike. Medium on the positive network-path attribution (incomplete requests are not timed server-side in our metrics).

### Aggravating worker design (pre–Phase 1)

A single global `flushInProgress` held through:

- up to 5 in-place attempts × (15s timeout + exponential backoff), then  
- single-row fallback × 5 attempts each  

One stall blocked **all** subsequent hot flushes for minutes while WS kept filling `pendingUpserts` (cap 600; new distinct buckets dropped at cap → gaps).

---

## 3. BTC investigation

Investigated in parallel because 1D chart looked truncated / stale.

| Layer | Finding |
|-------|---------|
| DB (`crypto_session_minute_bar` / equivalent path) | ~continuous (~1440 bars / 24h; ~1 missing minute). |
| Chart read path | Ascending fetch hit PostgREST **default max rows (1000)** → only oldest ~1000 minutes returned → stale tail / “short” series. |
| Root cause | **Read pagination**, not worker write failure. |
| Fix | Paginate crypto DB reads (`.range()` page size 1000, safety cap 2000). Tests added. **Stock pipeline intentionally untouched.** |
| Out of scope for this incident doc’s stock write fix | Crypto worker, tip pin, UI, stock chart fill. |

BTC and stock incidents were **related only as “chart hole” symptoms**; root causes differed.

---

## 4. Stock investigation

### Data layer

For NVDA / AAPL / QQQ / SPY on 2026-07-20 session:

- DB minute series **not continuous** after open — large missing ranges especially after ~13:41 (and earlier intermittent from 13:30).
- EODHD live `1m` often empty; chart cannot invent bars absent from DB.
- **Layer:** worker → Supabase write path (not chart render as primary cause).

### Worker behavior during abort storm (pre–Phase 1)

- Rows per successful upsert before first abort: typically **2–4** (avg ~2.88).
- First abort: **4 rows**.
- After backlog: observed payloads **15** (chunk cap), **12**, then **1** (fallback).
- Successful write duration (healthy): p50 ~**1.8s**, p95 ~**2.8s**; last success before first abort ~**12s**.

### Phase 1 validation (post 15:48 deploy)

- Hot flush: **one attempt**; failures → `retryQueue`; flush lock released.
- Retry and hot upserts interleaved (`upserted N` and `upserted N (retry)` same second).
- Post-deploy continuity ≈ **32/33** minutes × 4 symbols (~1 miss at 16:14Z).
- Session-level missing minutes from morning abort storm **not backfilled** (expected).
- Zero duplicate `(ticker, bucket_unix)` rows observed.

---

## 5. Evidence

### Railway worker logs

- Sustained `AbortError: This operation was aborted rows N attempt K` with ~15s + backoff spacing.
- WS: `authorized: true`, rising `tradeMsgCount`, no reconnect storm at first failure.
- Heartbeats: `pendingUpserts` rising only after aborts (pre–Phase 1).

### Railway metrics (13:25–14:00)

- Stock worker CPU ~0.7–1.3 vCPU of 24 (~4% util) — not CPU-bound.
- Memory well under limit.

### Supabase

- Edge `origin_time` ~230–260 ms on completed upserts before and after 13:30.
- Completed upsert **rate** collapse after open.
- `postgres_logs`: checkpoints only in window; later slow checkpoint writes after first abort.
- Project region: **ap-south-1**; worker region: **US West** (edge CF colo SJC on completed requests).

### Code / config

- `makeSupabaseFetch` + `SUPABASE_UPSERT_TIMEOUT_MS=15000`.
- Pre–Phase 1: multi-attempt + sleep under `flushInProgress`.
- Phase 1: `HOT_FLUSH_MAX_ATTEMPTS = 1`, `retryQueue`, `inFlightKeys`, extended `/health` fields.

### DB continuity (illustrative, Phase 1 validate ~16:20Z)

| Scope | Result |
|-------|--------|
| Full session missing minutes | Large (e.g. NVDA ~82, SPY ~95) — mostly pre–Phase 1 |
| Post-deploy (15:48–16:20) | 32/33 expected minutes per symbol |
| Duplicates | 0 |

---

## 6. Why Phase 1 was implemented

Phase 1 targeted the **proven worker failure mode**, not the unresolved network/PostgREST path:

1. **Observability (R3)** — expose pending/retry/flush/latency/abort counters on `/health` and heartbeats so stalls are visible without log archaeology.
2. **Non-blocking retry (minimal R1)** — one hot attempt, then hand off to `retryQueue` with exponential backoff **off** the flush lock so fresh minute closes keep flushing.

**Explicitly not in Phase 1:** stall auto-recovery, timeout increase, pending drop-policy rewrite, chunk isolation redesign, architecture cleanup.

**Constraints preserved:** market-data behavior, bucketing, close calc, WS/coalesce, allowlist, chunk defaults, 15s timeout, `ON CONFLICT (ticker, bucket_unix)`, schema, chart APIs.

---

## 7. Before / after metrics

### Architecture behavior

| Metric / behavior | Before Phase 1 | After Phase 1 |
|-------------------|----------------|---------------|
| Hot upsert attempts per failure | Up to 5 + single-row fallback under lock | **1** then enqueue retry |
| Flush lock during backoff sleep | **Yes** (blocks all hot flushes) | **No** (backoff on retry path) |
| `/health` write metrics | Mostly `pendingUpserts` | + `retryQueueSize`, `flushInProgress`, `flushStartedAt`, success/fail/latency/stall/abort/retry counters |
| Fresh minutes during AbortError storm | Starved for minutes | Continue (pending stays small, ~0–12) |
| Duplicate bars | N/A (upsert conflict) | Still 0 (same conflict key) |

### Continuity (same session)

| Window | Continuity |
|--------|------------|
| Open → ~15:47 (pre–Phase 1) | Large multi-minute gaps (abort + flush lock) |
| 15:48 → ~16:20 (post–Phase 1) | **~32/33** minutes × NVDA/AAPL/QQQ/SPY |

### Live abort load (post–Phase 1, ~36 min sample)

Illustrative end-state around 16:24Z:

- `upsertSuccessCount` ≈ 44–45  
- `upsertAbortCount` ≈ 100–105  
- `retryCount` ≈ 65–68  
- `retryQueueSize` oscillating **0–16** (drains when path recovers)

Phase 1 **did not** remove AbortErrors; it **contained** their impact on hot ingestion.

---

## 8. Remaining risks

1. **Railway → Supabase path still often exceeds 15s** — AbortErrors remain common during open; charts can still miss isolated minutes (e.g. 16:14).
2. **`retryQueue` growth under prolonged stall** — bounded coalescing by key, but aged keys can linger; no Phase 1 drop policy or stall recovery.
3. **Cross-region latency / incomplete requests** — US West worker ↔ `ap-south-1` Supabase; completed `origin_time` stays fast, incomplete calls invisible in edge latency.
4. **Historical gaps not backfilled** — morning holes remain in `stock_session_minute_bar` until a separate fill job (out of Phase 1 scope).
5. **Concurrent hot + retry writers (different keys)** — intentional; if PostgREST is saturated, dual flight may add QPS (watch after open).
6. **Pending cap (600)** — under extreme stall, brand-new `ticker:bucket` keys can still be dropped (pre-existing).
7. **WATCH posture** — requires monitoring `retryQueueSize`, `upsertAbortCount`, `writeStallSeconds`, latest bar age during RTH.

---

## 9. Future improvements (Phase 2+)

Ranked from prior design; **not implemented**:

| Priority | Item | Intent |
|----------|------|--------|
| P1 | **Stall detector + recovery (R4)** | Abort stuck fetch, release lease, cooldown; no synthetic bars |
| P1 | **Smarter pending pressure (R6)** | Prefer dropping aged retries over live minutes; metric on drops |
| P1 | **Timeout vs retry config clarity (R5)** | Keep 15s default; document independent knobs (do not “fix” by raising timeout alone) |
| P2 | Bound write concurrency (R7) | Cap hot+retry in-flight globally (e.g. 1–2) on recovery stampede |
| P2 | Per-attempt latency logs (R8) | Correlate with edge `origin_time` |
| Later | Chunk isolation redesign | Fail one chunk without delaying others inside a batch (partially eased by retry queue) |
| Later | Infra | Investigate region/path (worker region, pooling, Supabase advisories); optional backfill for 2026-07-20 holes |
| Out of scope | Chart synthetic fill | Do not invent minutes; fix write/read data layer first |

---

## References

- Worker: `scripts/stock-ws-minute-ingest.mjs`  
- Docker/Railway: `workers/stock-minute-ingest/`  
- Table: `stock_session_minute_bar` (`ticker`, `bucket_unix` conflict key)  
- Crypto read pagination (separate fix): crypto session minute bar fetch helpers / store  

**Incident owner note:** Treat Phase 1 as a **containment** deploy. Close remaining risk only after sustained low `upsertAbortCount` / empty `retryQueue` during regular hours, or after Phase 2+ stall/path work.
