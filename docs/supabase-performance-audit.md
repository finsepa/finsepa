# Finsepa Supabase / Postgres Performance Audit

**Date:** 2026-07-18  
**Scope:** Read-only codebase + production Supabase/Vercel evidence  
**Status:** Investigation only — no schema changes, no deploys, no data deletes  
**Project:** `pjwzvqvrqqvjgwuouoxy`  
**Stats window:** `pg_stat_statements` / table stats reset at `2026-07-17 14:08:07 UTC` (≈26h before audit)

---

## 1. Executive summary

Finsepa’s database was overwhelmed **without meaningful end-user traffic**. Production evidence shows the load was dominated by **always-on market-data writers and scheduled jobs**, not by portfolio/screener page browsing.

Across the post-reset stats window:

| Workload | Approx. PostgREST / DB activity | Notes |
|---|---|---|
| `crypto_session_minute_bar` upserts | **96,045** calls | Highest call volume; ~95.8k row updates on ~16k live rows |
| `market_snapshot` upserts | **2,725** calls | Highest WAL (~39 MB) and dirty blocks; large JSONB replacements |
| `market_snapshot` reads | **~5,500** calls | Shared cache reads still hit Postgres on dynamic renders |
| `stock_session_minute_bar` upserts | **3,798** calls | Lower than crypto but same rewrite pattern |
| `portfolio_workspace` full reads | **98** calls | Cron/earnings universe scan of all workspace JSON |
| Auth-related reads | thousands | Middleware + shell + API `getUser()` amplification |

Vercel production traffic (last 24h) confirms low human usage and high background/poll load:

- `/api/notifications` — 230
- `/api/stocks/AAPL/live-price` — 199
- `/api/cron/market-snapshots` — 96
- `/api/cron/earnings-notifications` — 96
- `/api/portfolio/workspace` — 51
- `/screener` — 21
- `/portfolio` — 5

**Conclusion:** Micro compute failed because continuous write/read churn exhausted memory and Burst Disk I/O. Upgrading to Small restored headroom. Softening worker flush/backoff already reduced retry storms; the architecture still needs P0/P1 controls before 100 users.

---

## 2. Most likely root cause

### Primary cause (Critical, confidence: High)

**Always-on Railway minute-bar ingest workers repeatedly upserting the same current-minute rows into Supabase, then retrying aggressively during 522/timeouts.**

Evidence:

1. Production `pg_stat_statements`: `crypto_session_minute_bar` INSERT/UPSERT is #1 by total time and call count (**96,045**).
2. Table stats: `crypto_session_minute_bar` has ~16k live rows but ~**95,790** updates; `stock_session_minute_bar` has ~24.6k rows and ~**10,566** updates.
3. Worker code:
   - Crypto: flush debounce default 2s + 60s heartbeat → many rewrites of the same `(ticker, bucket_unix)` row.
   - Stock: flush debounce 1.5s / urgent 40 / periodic 3s + REST fallback + heartbeat → same-minute rewrite pattern.
4. During degradation, failed flushes requeued and retried (stock path can expand a failed 15-row chunk into many single-row attempts).
5. Outage symptoms in Vercel: Cloudflare **522** HTML returned to cron/API paths; middleware Auth timeouts; `/api/notifications` timeouts.

### Amplifying secondary causes

1. **`/api/cron/market-snapshots` every 15 minutes** rewriting large JSONB blobs in `market_snapshot` (largest current row ≈ **1.6 MB**, key `superinvestor_13f_profile_v3_0000850529`; table total ≈ **21 MB**).
2. **Auth `getUser()` amplification** on every protected navigation and every live poll.
3. **Earnings-notifications cron** scanning all `watchlist` + all `portfolio_workspace` every ~15 minutes even with almost no users.
4. **Client live polling** (AAPL/NVDA/BTC header/chart) creating continuous authenticated reads while a page is open.

Memory pressure from frequent dirtying of hot pages + large JSONB rewrite + WAL pressure explains Supabase Support’s Burst Disk I/O exhaustion story.

---

## 3. Top critical findings

| # | Finding | Severity | Runs with 0 users? |
|---|---|---|---|
| 1 | Crypto/stock WS workers rewrite current-minute bars far more often than once/minute | Critical | Yes |
| 2 | Worker retry storms during 522/timeouts amplify write load | Critical | Yes |
| 3 | No retention/partitioning for minute-bar tables | High | Yes (growth) |
| 4 | `market-snapshots` cron rewrites large JSONB every 15m / on cold fills | High | Yes |
| 5 | Auth `getUser()` called by middleware + shell + every polled API | High | Partially (any open session) |
| 6 | Earnings-notify cron full-scans watchlist + portfolio_workspace | High | Yes |
| 7 | Stock page overlapping live-price/chart polls → multiple Auth + DB reads | Medium-High | Only with open pages |
| 8 | Watchlist sync N+1 path can explode PostgREST calls | Medium-High | User-triggered |
| 9 | Admin Supabase client recreated on every call | Medium | Yes |
| 10 | Missing cron overlap locks; backfill claim is non-atomic | Medium | Yes |
| 11 | Portfolio history/returns fan out to EODHD (provider cost), not Postgres | Medium | User-triggered |
| 12 | Observability insufficient for query-count / cache / job correlation | Medium | N/A |

---

## 4. Supabase usage inventory

### 4.1 Client factories

| File | Function | Server/client | Notes |
|---|---|---|---|
| `lib/supabase/server.ts` | `getSupabaseServerClient` | Server | Cookie SSR anon; primary API/RSC |
| `lib/supabase/browser.ts` | `getSupabaseBrowserClient` | Client | Singleton |
| `lib/supabase/admin.ts` | `getSupabaseAdminClient` | Server | Service role; **new client every call** |
| `lib/supabase/middleware.ts` | `createSupabaseMiddlewareClient` | Edge helper | Mostly unused |
| `middleware.ts` | inline `createServerClient` | Edge | Auth gate on protected routes |
| `app/api/auth/login/route.ts` | inline `createServerClient` | Server | Login cookie write |
| `lib/auth/resolve-auth-user.ts` | ad-hoc `createClient` | Server | JWT helper |
| `lib/watchlist/stock-watchlist-count.ts` | ad-hoc `createClient` | Server | RPC caller |
| `scripts/stock-ws-minute-ingest.mjs` | `createClient` ×2 | Worker | Separate read/write timeouts |
| `workers/crypto-minute-ingest/crypto-ws-minute-ingest.mjs` | `createClient` | Worker | Upsert path |
| Direct `pg.Pool` | `lib/auth/verify-*-password.ts`, `lib/admin-health/run-checks.ts` | Server | max 2 each; login/password/health |

**Realtime channels:** none in application code.  
**RPC:** `count_watchlist_for_ticker` only.  
**Storage:** `avatars`, support-feedback attachments.

### 4.2 High-frequency table inventory

| Table | Approx live rows | Role | Dominant writers | Dominant readers |
|---|---:|---|---|---|
| `market_snapshot` | 1,361 | Shared JSON cache for screener/hub/asset/13F | Cron + on-demand warmers | SSR/API snapshot loaders |
| `stock_session_minute_bar` | 24,593 | US equity 1D minute closes | Stock Railway worker | Chart/live-price APIs |
| `crypto_session_minute_bar` | 16,182 | BTC 1D minute closes | Crypto Railway worker | Crypto chart/live-price |
| `stock_session_minute_bar_watch` | 27 | Recently viewed 1D tickers | Chart API touch | Stock worker poll |
| `portfolio_workspace` | 31 | Full portfolio JSON blob | Client debounced PUT | Workspace GET + earnings cron |
| `public_portfolio_listings` | 1 | Public portfolio directory | Client listing sync | Portfolios tab |
| `watchlist*` | ~0 live | User watchlists | Client sync APIs | Watchlist APIs + crons |
| `user_notifications` | ~0 | In-app inbox | Earnings cron | Poll `/api/notifications?count=1` |
| `earnings_release_snapshot` | 10 | Release detection state | Earnings cron | Earnings cron |
| Billing / SnapTrade / follows | small | Account features | User/webhook | Account pages |

### 4.3 Structured usage map (selected high-risk entries)

| File | Function / surface | Table / RPC | S/C | When | Frequency | Approx DB requests | Cached? | Risk |
|---|---|---|---|---|---|---:|---|---|
| `workers/crypto-minute-ingest/crypto-ws-minute-ingest.mjs` | `flushPendingUpserts` | `crypto_session_minute_bar` | Worker | Always-on | ~every 2s + heartbeat/min | 1 upsert/flush (many rewrites) | No | **Critical** |
| `scripts/stock-ws-minute-ingest.mjs` | `flushPendingUpserts` / `saveMinuteBarRows` | `stock_session_minute_bar` | Worker | Market hours (+ fallback) | 1.5–3s / urgent | Chunked upserts + retries | No | **Critical** |
| `scripts/stock-ws-minute-ingest.mjs` | `syncSubscriptions` | `stock_session_minute_bar_watch`, `watchlist`, `market_snapshot` | Worker | Always-on | every 60s | 1–4 reads | No | High |
| `app/api/cron/market-snapshots/route.ts` | cron GET | `market_snapshot` | Server | Schedule | every 15m | Many freshness reads + upserts | Freshness skip | High |
| `lib/market/market-snapshot-store.ts` | `read*/upsert*` | `market_snapshot` | Server | SSR/API/cron | Per key | 1–2 reads / 1 upsert | Segment TTL | High |
| `lib/screener/screener-eod-bars-snapshot.ts` | per-symbol EOD cache | `market_snapshot` | Server | Cold slow ingest | Up to ~500 symbols | 1 read + 1 write/symbol | Segment | High |
| `app/api/cron/earnings-notifications/route.ts` | cron | `watchlist`, `portfolio_workspace`, `earnings_release_snapshot`, `user_notifications` | Server | Schedule | ~every 15m | Full scans + upserts | No | High |
| `lib/notifications/earnings-notify-universe.ts` | `buildEarningsNotifyInterestMap` | `watchlist`, `portfolio_workspace` | Server | Cron | ~every 15m | 2 unbounded reads | No | High |
| `middleware.ts` + `protected-app-shell.tsx` | auth gate | Auth (`getUser`) + `billing_subscriptions` | Edge/Server | Every protected nav | Per navigation | 2–3 | No | High |
| `app/api/stocks/[ticker]/live-price/route.ts` | live quote | Auth + minute-bar/latest | Server | Client poll | 15s while open | 1 auth + 0–2 DB | Partial | High |
| `app/api/stocks/[ticker]/chart/route.ts` | 1D chart | Auth + `stock_session_minute_bar` + watch touch | Server | Client poll | 60s while open | 1 auth + 1–3 DB | Live no-store | High |
| `app/api/crypto/[symbol]/live-price/route.ts` | BTC live | Auth + `crypto_session_minute_bar` | Server | Client poll | 30s BTC | 1 auth + 1 DB | no-store | Medium-High |
| `components/portfolio/portfolio-workspace-provider.tsx` | hydrate/save | via `/api/portfolio/workspace` | Client→Server | Mount + 500ms debounce | On change | 1 GET + frequent PUT | localStorage | Medium |
| `lib/watchlist/operations.ts` (`syncWatchlistFromClient`) | sync | `watchlist*` | Server | Sync API | On sync | **O(n)** N+1 | No | Medium-High |
| `lib/watchlist/stock-watchlist-count.ts` | RPC | `count_watchlist_for_ticker` | Server | Stock header | On demand | 1 RPC | Partial | Medium |
| `app/api/portfolio/value-history/route.ts` | history | Auth only (data via EODHD) | Server | Chart range | On demand | 1 auth | `unstable_cache` 300s | Medium (provider) |
| `app/api/portfolio/period-returns/route.ts` | returns | Auth only (EODHD fanout) | Server | Chart | On demand | 1 auth | Limited | Medium (provider) |
| `lib/auth/verify-password-for-email.ts` | login | direct `auth.users` via `pg` | Server | Login | Rare | 1 SQL | No | Low (conn risk) |
| Notifications client | unread poll | `user_notifications` | Client→Server | Shell open | 60s | count query | No | Medium |

Full page budgets (order of magnitude):

- Protected navigation: **~3** Supabase/Auth ops before page data.
- Stock 1D open: Auth stack + snapshot reads + minute bars + watch touch; then **live-price every 15s** and **chart every 60s**.
- Portfolio open: Auth + workspace blob + later overview/history endpoints (mostly EODHD after auth).
- Screener: Auth + several large `market_snapshot` key reads.

---

## 5. Query and N+1 findings

### 5.1 Confirmed / high-confidence N+1 and fanout

1. **Watchlist sync N+1** (`lib/watchlist/operations.ts` sync path)
   - Per omitted ticker: delete.
   - Per desired ticker: collection lookups + exists + upsert + state touch.
   - Can become tens–hundreds of PostgREST calls on a full sync.

2. **Stock page overlapping polls**
   - Header live-price effect + mount effect + `PriceChart` immediate refresh/poll.
   - Each API hit re-auths and may read minute bars / touch watch.
   - Explains heavy `/api/stocks/AAPL/live-price` volume with few page views.

3. **Market-snapshot stale fallback double-read**
   - `readMarketSnapshotWithStaleFallback` can do exact-segment read then full-key read.

4. **Earnings notify universe**
   - Unbounded `select` of all watchlist rows and all portfolio workspace JSON every cron run.

5. **Screener EOD per-symbol snapshot cache**
   - Cold slow ingest: up to ~500 independent `market_snapshot` read/write pairs.

6. **Portfolio history/returns**
   - `Promise.all(symbols.map(...))` over holdings against EODHD.
   - Not a Postgres N+1, but a provider fanout that also multiplies Auth calls if charts remount.

### 5.2 Large reads

| Pattern | Where | Impact |
|---|---|---|
| Full `data` JSONB by key | `market_snapshot` | Max row ≈ 1.6 MB; avg ≈ 10 KB; table 21 MB |
| Full `state` JSONB | `portfolio_workspace` | Avg ≈ 1.7 KB; max ≈ 39 KB today; full-table cron scan |
| Minute bars for session | `stock_session_minute_bar` | ~390 rows/session, ordered, indexed |
| Watchlist ticker dump | workers/backfill | `.limit(5000)` / `.limit(10000)` |
| `select('*')` | billing summary / billing-db | Small tables; overfetch only |

### 5.3 Expensive DB patterns

- `count_watchlist_for_ticker`: `COUNT(DISTINCT user_id) WHERE ticker = ?` without `(ticker, user_id)` index.
- Watchlist user snapshot: `WHERE user_id ORDER BY sort_order, created_at` without matching composite index.
- Many RLS policies re-evaluate `auth.uid()` per row (Supabase advisor WARN).
- Unindexed FK: `watchlist_user_state.active_collection_id`.
- Redundant indexes exist (crypto DESC duplicate of PK; several prefix duplicates).

### 5.4 Explicit answers

| Question | Answer |
|---|---|
| What overloads Supabase with zero active users? | Railway minute-bar workers + 15m crons (`market-snapshots`, `earnings-notifications`) + any open-tab polls |
| Can one page load cause dozens/hundreds of queries? | Yes for watchlist full sync / cold stock page with snapshot misses; typical warm stock open is fewer DB queries but many Auth+API polls afterward |
| Background processes that can exhaust Disk I/O? | **Yes** — workers + market_snapshot JSONB rewrites |
| Portfolio history recalculated from raw tx repeatedly? | **Yes in app/EODHD**, not from Postgres transaction tables (txs live in `portfolio_workspace.state` JSON). Cached ~5m for value-history |
| Large historical price tables scanned? | **No normalized historical price tables.** Minute-bar tables are the growing DB history; long EOD history is external |
| Identical market-data queries repeated across users? | Provider data often `unstable_cache`d; **Supabase snapshot/auth still often re-hit** |
| Could jobs overlap? | **Yes** — no distributed locks; backfill claim non-atomic |
| Infinite/accidental refetch loop? | No clear infinite loop; **overlapping intentional polls** and retry storms are the practical equivalent |

---

## 6. Cron / background job findings

From `vercel.json` + Railway workers:

| Job | Schedule | Zero-user? | Overlap lock? | Risk |
|---|---|---|---|---|
| `/api/cron/market-snapshots` | every 15m | Yes | No (freshness race only) | High — large JSONB + cold EOD fanout |
| `/api/cron/earnings-notifications` | :07/:22/:37/:52 | Yes | No | High — full user scans |
| `/api/cron/superinvestor-13f` | daily 14:00 | Yes | No | Medium — forced deletes/reloads |
| `/api/cron/earnings-document-cache-warm?shard=N` | daily by weekday | Yes | No | Medium — external fanout + cache writes |
| `/api/cron/stock-minute-bar-backfill` | weekdays 03:00 | Yes | **No atomic claim** | High burst potential |
| `/api/cron/key-indicators-warm?shard=N` | weekly shards | Yes | No | Medium |
| Stock WS worker (Railway) | continuous | Yes | In-process only | **Critical** |
| Crypto WS worker (Railway) | continuous 24/7 | Yes | In-process only | **Critical** |

### Worker write mechanics (root-cause detail)

**Crypto**

- Debounce default: 2s.
- Heartbeat: 60s re-stamps last price into current minute.
- Same PK `(ticker, bucket_unix)` upserted many times/minute.
- Retries with exponential backoff (improved), but baseline rewrite rate remains high.

**Stock**

- Debounce 1.5s, urgent threshold 40, periodic 3s.
- Chunk size 15, max attempts 5; failed chunks fall back to single-row retries.
- Watch poll every 60s; REST fallback when WS stale.
- Heartbeat keeps current minutes fresh.

### Market snapshot mechanics

- Hot segment ~15m; slow segment per session day; frozen up to 48h.
- Skip/retag reduces normal provider calls.
- Cold slow/frozen path can still create hundreds of per-symbol `market_snapshot` rows (`screener_eod_bars_*`) plus large canonical blobs.
- Hub news can fan out up to ~80 provider calls when stale.

### Backfill hazards

- Selects pending rows, then marks `in_progress` later → two runs can claim the same work.
- Up to 15 tickers × ~90 tick windows; recursive split can exceed nominal call counts.
- Upserts up to ~390 bars/ticker into `stock_session_minute_bar`.

---

## 7. Index recommendations

**Do not apply automatically.** Validate with `EXPLAIN ANALYZE` and table sizes first. Prefer `CREATE INDEX CONCURRENTLY`.

### 7.1 Recommended adds

```sql
-- 1) Speeds count_watchlist_for_ticker (ticker filter + distinct user_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS watchlist_ticker_user_id_idx
ON public.watchlist (ticker, user_id);
```

- Query: `COUNT(DISTINCT user_id) WHERE ticker = $1`
- Why: current plan can scan all watchlist rows as the table grows.
- Impact: High for stock-header watch counts at scale.
- Cost: extra write overhead on watchlist mutations.

```sql
-- 2) Matches snapshot load order
CREATE INDEX CONCURRENTLY IF NOT EXISTS watchlist_user_sort_created_idx
ON public.watchlist (user_id, sort_order, created_at);
```

- Query: `WHERE user_id = $1 ORDER BY sort_order, created_at`
- Impact: Medium; avoids sort/filter mismatch as lists grow.
- Cost: reorder updates touch index more.

```sql
-- 3) Collection snapshot order
CREATE INDEX CONCURRENTLY IF NOT EXISTS watchlist_collections_user_sort_created_idx
ON public.watchlist_collections (user_id, sort_order, created_at);
```

- Impact: Medium/low today (few collections/user).

```sql
-- 4) Unindexed FK for ON DELETE SET NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS watchlist_user_state_active_collection_idx
ON public.watchlist_user_state (active_collection_id)
WHERE active_collection_id IS NOT NULL;
```

- Impact: Low urgency now; correctness/maintenance benefit.

```sql
-- 5) Follow list ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS superinvestor_follows_user_created_idx
ON public.superinvestor_follows (user_id, created_at DESC);
```

- Impact: Low until follow counts grow.

### 7.2 Potentially redundant / unused (review before drop)

Confirmed structural redundancy candidates:

- `crypto_session_minute_bar_ticker_bucket_idx` (PK already `(ticker, bucket_unix)`; idx_scan=0)
- `earnings_document_cache` ticker-only prefix duplicates PK
- `earnings_slide_host_patterns_host_idx` (PK prefix)
- Several unused indexes flagged by advisors (`market_snapshot_segment_idx`, billing indexes, etc.)

**Do not drop indexes during an incident.** Measure with `pg_stat_user_indexes` after a full business week.

### 7.3 Retention / growth (more important than new indexes)

Minute-bar tables lack deletion/partitioning:

- Stock unique growth ≈ symbols × ~390 bars/session.
- Crypto unique growth ≈ 1,440 bars/day/pair.
- Update churn ≫ unique inserts.

Suggested future design (not applied):

- Retain rolling N sessions for stocks / rolling 48–72h for crypto.
- Or partition by day and detach old partitions.

### 7.4 Production advisor highlights

- Many `auth_rls_initplan` WARN policies → wrap `auth.uid()` as `(select auth.uid())`.
- Auth DB connections use absolute max 10 → prefer percentage allocation after compute upgrades.
- One unindexed FK: `watchlist_user_state.active_collection_id`.

---

## 8. Caching recommendations

### What already works

- Broad `unstable_cache` coverage for EODHD/screener/heatmap/fundamentals.
- Hub/market snapshots reduce provider fanout when fresh.
- Client screener page LRU + in-flight dedupe.
- Portfolio live quotes batched into one POST.

### Gaps

1. Snapshot-first loaders still hit Supabase on every dynamic render.
2. Protected shell forces dynamic rendering (`cookies`/`headers`/auth), so shared market payloads cannot be fully static.
3. Many responses use `private, s-maxage=...` — `private` prevents shared CDN reuse; browser benefit of `s-maxage` is limited.
4. No `cacheTag` / `revalidateTag` after cron writes; freshness is TTL/segment based.
5. Live 1D chart/price paths intentionally `no-store` — correct for freshness, expensive for Auth/DB.

### Recommendations

| Data | Current | Proposed |
|---|---|---|
| Screener/hot market blobs | `market_snapshot` + Next cache | Keep; add in-process/edge memo for hottest keys (top500, stocks_all_pages) for 30–60s |
| Hub news/macro/economy | snapshot + daily/15m TTLs | Keep; ensure news warm does not run every 15m if unchanged |
| Stock/crypto 1D live | DB poll + no-store | Prefer worker→memory/edge hot cache; poll DB less; coalesce multi-component polls |
| Company fundamentals/profile | `unstable_cache` | Keep; ensure one server entrypoint per page |
| Portfolio history | recompute from tx JSON + EODHD | Precompute/ persisted series per portfolio fingerprint |
| Auth user | getUser everywhere | Request-local memo + avoid duplicate middleware/shell/API checks for pure market GETs where safe |

---

## 9. Connection and Realtime findings

### Connections

- Primary access path is PostgREST via supabase-js (HTTP), not long-lived SQL connections for market data.
- Direct `pg.Pool` exists in 3 server modules (`max: 2` each) for password verify + admin health.
- Admin client factory is non-singleton → object churn on hot snapshot paths.
- Auth connection strategy absolute (10) should become percentage-based after upgrades.

### Realtime

- No Supabase Realtime DB subscriptions in app code.
- “Live” = EODHD WebSocket workers + authenticated polling APIs.
- Auth `onAuthStateChange` subscriptions in React appear cleaned up.

### Parallelism risks

- Stock cold SSR: large `Promise.all` fanout.
- Hub news: up to 60 concurrent stock-news fetches on miss.
- Worker/PostgREST retry amplification under 522s.
- No visibility/offline gating on client polls.

---

## 10. P0 / P1 / P2 / P3 action plan

### P0 — immediate stability (do first)

| Action | Files | Problem | Change | Benefit | Risk | Test |
|---|---|---|---|---|---|---|
| Cap minute-bar write rate to ≤1 upsert/symbol/minute (or coalesce dirty flag) | `workers/crypto-minute-ingest/crypto-ws-minute-ingest.mjs`, `scripts/stock-ws-minute-ingest.mjs` | Same-minute rewrite churn | Only flush when bucket changes or heartbeat once/minute; keep backoff | Large Disk I/O / WAL reduction | Medium (chart continuity) | Worker logs + `pg_stat_statements` upsert rate |
| Keep / harden 522 backoff + queue caps | same workers | Retry storms | Already partially done; ensure stock single-row fallback is bounded; hard queue max for crypto | Prevents death spiral | Low | Simulate 522; verify backoff |
| Pause or stretch market-snapshots during incidents | `vercel.json`, cron route | 15m large JSONB rewrite while DB sick | Temporary disable / 30–60m schedule / skip hub news if fresh | Stops secondary load | Low | Cron logs show skip |
| Pause earnings-notifications during incidents | cron route | Full scans every 15m | Disable or run hourly | Cuts full-table JSON reads | Low | Cron disabled |
| Confirm only 1 replica each Railway service | Railway config | Duplicate writers | Enforce replicas=1 | Prevents double write load | Low | Railway status |

### P1 — next 2–3 days

| Action | Files | Problem | Change | Benefit | Risk | Test |
|---|---|---|---|---|---|---|
| Coalesce stock live polls | `components/stock/stock-page-content.tsx`, `components/chart/PriceChart.tsx` | Duplicate immediate fetches | Shared store / single poller; no double mount fetch | Cuts Auth+DB QPS | Medium UI | Network panel: 1 live-price + 1 chart cadence |
| Request-local auth memo / reduce getUser tax | middleware, shell, API auth helper | Triple auth | Cache user per request; consider lighter gate for some GETs | Lower Auth RPS | Medium security review | Log getUser count/request |
| Singleton admin client | `lib/supabase/admin.ts` | Recreate client | Module singleton | Less churn | Low | Unit/smoke |
| Earnings universe incremental | `lib/notifications/earnings-notify-universe.ts` | Full scans | Cache ticker→users; only dirty users/portfolios | Big cron DB cut | Medium | Cron timing + SQL |
| Add watchlist indexes (after EXPLAIN) | migrations | RPC/snapshot plans | Add recommended indexes concurrently | Scale readiness | Low | EXPLAIN before/after |
| Atomic backfill claiming | `stock-session-tick-backfill.ts` | Overlap | `FOR UPDATE SKIP LOCKED` / lease | Prevents double backfill | Medium | Two parallel cron invokes |
| Minute-bar retention job | new cron/SQL | Unbounded growth | Delete/partition old buckets | Caps table size/IO | Medium | Count before/after on staging |

### P2 — architectural

| Action | Files | Problem | Change | Benefit | Risk | Test |
|---|---|---|---|---|---|---|
| Split `market_snapshot` hot vs archival | snapshot stores | 1.6MB rows + many keys in one table | Separate tables or blob storage for huge 13F/news packs | Less buffer cache pressure | High | Size + p95 read |
| Precompute portfolio value history | portfolio value-history stack | Recompute from raw txs + EODHD | Persist series by fingerprint | Stable portfolio UX at scale | High | Compare series |
| Batch watchlist sync | `lib/watchlist/operations.ts` | N+1 | Single RPC/SQL upsert set | Sync reliability | Medium | Sync 200 tickers |
| Edge/shared cache for public market keys | API routes / CDN headers | private s-maxage useless for shared | Public cache where auth not required, or move auth out of shared GETs | Multi-user reuse | Medium security | Cache hit headers |
| Cron distributed locks | all cron routes | Overlap | Lease row / advisory lock | No duplicate heavy runs | Medium | Parallel invoke |

### P3 — before ~100 active users

| Action | Benefit |
|---|---|
| RLS `auth.uid()` initplan fixes across policies | Lower per-row policy overhead |
| Normalize holdings/transactions out of JSON (or secondary index tables) for notify/analytics | Avoid full workspace scans |
| Partition minute bars by day | Retention + vacuum efficiency |
| Query-count/cache/job telemetry + alerts | Catch next I/O spike early |
| Load-test staging at 25/50 concurrent users on Portfolio/Screener/Asset | Prove capacity beyond Small |

---

## 11. Testing plan

### Safe environments

- Prefer **local** + **staging Supabase project**.
- Do **not** run load tests against production.
- Read-only prod checks OK: `EXPLAIN`, `pg_stat_*`, advisors, Vercel log aggregates.

### Measure requests per page

1. Chrome DevTools Network: filter `/api` + document.
2. Server: enable `FINSEPA_PROVIDER_TRACE=1` and add temporary Supabase query counter wrapper.
3. Record for: cold vs warm, logged-out vs logged-in.

### Detect N+1

- Watch Network waterfall for repeating identical endpoints.
- For watchlist sync: count PostgREST calls while syncing N tickers (expect O(1)/O(log N), not O(N) multi-statement chains).
- SQL: `pg_stat_statements` before/after action.

### Cron testing

- Call cron routes with `Authorization: Bearer $CRON_SECRET` on staging.
- Assert skip reasons when fresh.
- Run two overlapping invokes to verify lock behavior (after P1 lock lands).
- Capture duration, rows written, provider calls, runId.

### EXPLAIN ANALYZE (read-only)

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(DISTINCT user_id)
FROM public.watchlist
WHERE ticker = 'AAPL';

EXPLAIN (ANALYZE, BUFFERS)
SELECT bucket_unix, close
FROM public.stock_session_minute_bar
WHERE ticker = 'AAPL' AND session_ymd = CURRENT_DATE
ORDER BY bucket_unix;
```

Avoid `EXPLAIN ANALYZE` on huge writes in prod.

### Concurrent users (staging only)

Simulate 5 / 10 / 25 / 50 concurrent users with k6/Artillery against staging:

1. Login once per VU (or use test JWTs).
2. Navigate: Home/Markets → Screener → Asset (AAPL) → Watchlist → Portfolio.
3. Keep Asset page open 3 minutes to include poll load.
4. Metrics: p95 latency, 5xx, Supabase CPU/IO, Auth errors, worker lag.

### Pages to test first

1. **Asset/stock page** (poll amplification)
2. **Screener** (large snapshot reads)
3. **Portfolio** (workspace blob + history fanout)
4. **Watchlist** (sync N+1)
5. **Home/Markets/News** (hub snapshots)

---

## 12. Observability

### Current state

Present:

- Vercel Analytics / Speed Insights
- Optional `FINSEPA_PROVIDER_TRACE`
- Admin health latency checks
- Cron JSON summaries
- Worker `/health`

Missing:

- Request/correlation IDs
- Query count per request
- Cache hit/miss metrics for snapshots
- Cron/job run IDs
- Systematic route duration/error metrics
- Sentry/OTel (or equivalent)
- Alerts on minute-bar freshness / cron success / Auth p95

### Minimal setup proposal

1. **Request context wrapper** for App Router handlers:
   - `requestId`, route, duration, status
   - `supabaseQueries`, `supabaseMs`
   - `providerCalls`, `cacheOutcome`
2. **Snapshot helper metrics**: key, exact/stale/miss/error, row age, bytes, latency.
3. **Cron `runId`** in every log/response.
4. **Worker health fields**: reconnects, flush failures, oldest pending age, last error, messages in/out.
5. **Supabase dashboards**: Query Performance, Disk IO, CPU, connections; keep `pg_stat_statements` enabled.
6. Alerts:
   - cron missed/failed
   - snapshot age > SLA
   - Auth error rate / p95
   - minute-bar staleness
   - worker flush failure streak

---

## 13. Questions / data needed from Supabase dashboard

Please capture (screenshots or CSV) for the incident window:

1. Compute size history (Nano/Micro → Small) and exact upgrade time.
2. Disk IO / Burst IO charts for the outage day.
3. CPU / Memory saturation charts.
4. Query Performance top queries by time and by calls (confirm matches this audit).
5. API gateway logs filtered to 522/504 for:
   - `/rest/v1/crypto_session_minute_bar`
   - `/rest/v1/stock_session_minute_bar`
   - `/rest/v1/market_snapshot`
6. Connection pool saturation (Auth + PostgREST + Postgres).
7. Whether any replica/read-replica or PITR restore occurred around `2026-07-17 14:08 UTC` (stats reset time).
8. Current daily Burst IO remaining after upgrade.
9. Table bloat / vacuum age for `market_snapshot` and minute-bar tables.
10. Confirmation Railway services each have **replicas = 1**.

---

## 14. Appendix — production evidence snapshot

Captured during audit (read-only SQL / Vercel MCP):

- DB backends: 9
- Temp files: 3 (~59 MB) since stats reset
- `market_snapshot` size: ~21 MB; max JSON ≈ 1.6 MB
- Crypto writes last 10m at audit time: 11 (post-mitigation, much healthier than outage rates)
- Stock writes last 10m: 0 (outside regular session)
- Vercel 24h status mix included **26× 504** and Auth/middleware timeouts during the incident
- Runtime errors showed Cloudflare **522** HTML bubbling into earnings-notifications and Auth retries

---

## 15. Final readiness judgment

| Question | Judgment |
|---|---|
| Most likely failure reason | Continuous minute-bar upsert churn (+ retry amplification) exhausting Micro memory/Burst IO, amplified by 15m snapshot crons |
| Small compute sufficient now? | **Yes for current low traffic**, after worker backoff + upgrade — **not a substitute for P0/P1 fixes** |
| Ready for 100 active users? | **No** — poll amplification, auth tax, snapshot JSONB size, watchlist sync N+1, and missing retention/locks would recreate pressure |

**Stop point:** Audit complete. No fixes implemented. Awaiting approval before any P0 changes.
