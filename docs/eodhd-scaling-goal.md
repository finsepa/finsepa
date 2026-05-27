# EODHD scaling goal

**Target:** ≤100,000 traced EODHD HTTP calls/day at ≤1,000 DAU.

**Logos:** `dev.logos` — not counted in EODHD budget.

## Phases

| Phase | Status | Work |
|-------|--------|------|
| P0 | Implemented | `FINSEPA_EODHD_MAX_REQUESTS_PER_DAY` (recommend `80000` in prod) |
| P1 | Done | Defer portfolio `live-price` on list/hub routes; screener dedupe |
| P1补 | Done | Defer `/charting`, `/comparison`, `/economy` |
| P2 | Implemented | `market_snapshot` table + cron + read path for screener/heatmap/watchlist |
| P3+ | Planned | Earnings/news/macro hub cron; search; asset detail cache |

## P2 operations

1. Run migration `20260527140000_market_snapshot.sql` on Supabase.
2. Vercel env:
   - `CRON_SECRET` — random string; Vercel Cron sends `Authorization: Bearer …`
   - `SUPABASE_SERVICE_ROLE_KEY` — already required for admin client
   - `FINSEPA_EODHD_MAX_REQUESTS_PER_DAY=80000`
   - `FINSEPA_MARKET_SNAPSHOT_READ=1` (default on; set `0` to disable reads)
3. After deploy, trigger once: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/market-snapshots`
4. Verify: screener/heatmap refresh → EODHD flat; cron tick moves counter.

Cron schedule: every 15 minutes (`vercel.json`). Ingest skips when frozen segment is fresh or live segment updated &lt;14m ago.
