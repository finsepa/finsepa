# EODHD scaling goal

**Target:** ≤100,000 traced EODHD HTTP calls/day at ≤1,000 DAU.

**Logos:** `dev.logos` — not counted in EODHD budget.

## Phases

| Phase | Status | Work |
|-------|--------|------|
| P0 | Implemented | `FINSEPA_EODHD_MAX_REQUESTS_PER_DAY` (recommend `80000` in prod) |
| P1 | Done | Defer portfolio `live-price` on list/hub routes; screener dedupe |
| P1补 | Done | Defer `/charting`, `/comparison`, `/economy` |
| P2 | Done | `market_snapshot` table + cron + read path for screener/heatmap/watchlist |
| P3 | Done | Hub snapshots: macro, news (3 tabs), earnings (3 weeks), economy (US) |
| P4 | Done | Search: 300ms debounce, EODHD only for queries ≥2 chars; charting/comparison skip SSR stock bundles |
| P5 | Done | Per-ticker asset snapshots (`asset_{TICKER}`); defer portfolio live quotes on `/stock/*` |
| P6 | Done | Daily load model + traced traffic probe API + CLI |

## P2 operations

1. Run migration `20260527140000_market_snapshot.sql` on Supabase.
2. Vercel env:
   - `CRON_SECRET` — random string; Vercel Cron sends `Authorization: Bearer …`
   - `SUPABASE_SERVICE_ROLE_KEY` — already required for admin client
   - `FINSEPA_EODHD_MAX_REQUESTS_PER_DAY=80000`
   - `FINSEPA_MARKET_SNAPSHOT_READ=1` (default on; set `0` to disable reads)
3. After deploy, trigger once: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/market-snapshots`
4. Verify: screener/heatmap/hub pages refresh → EODHD flat; cron tick moves counter.

Cron schedule: every 15 minutes (`vercel.json`). Market ingest skips when frozen segment is fresh or live segment updated &lt;14m ago. Hub ingest skips per-key when segment is fresh (macro/news daily, earnings/economy weekly).

**P3 hub keys:** `hub_macro_dashboard`, `hub_news_*`, `hub_earnings_week_YYYY-MM-DD`, `hub_economy_week_YYYY-MM-DD_US`. Earnings ingest uses universe market-cap only (never set `EARNINGS_USE_FUNDAMENTALS_MC=1` in prod).

## P4 behavior

- **Search:** 300ms debounce (`SEARCH_CLIENT_DEBOUNCE_MS`). Queries of 1 char match local universe only; EODHD `/search` runs only when trimmed query length ≥ 2 (`SEARCH_MIN_QUERY_LENGTH` in `global-asset-search` / `eodhd-search`).
- **Charting:** no SSR `loadStockPageInitialData`; workspace loads `/api/.../fundamentals-series` per ticker on demand.
- **Comparison:** no SSR stock bundles; `ComparisonWorkspace` fetches `header-meta`, `performance`, and `key-stats-bundle` per ticker via `fetchComparisonTickerSlice`.

## P5 behavior

- **Storage:** `market_snapshot` rows keyed `asset_{TICKER}` (same table/segment as P2/P3). First visit in a US market segment runs the full `loadStockPageInitialDataUncached` fan-out and upserts the bundle (async).
- **Reads:** Same segment hit serves the cached bundle. **Live** session: only 1D chart + `headerLiveSpotUsd` are refetched (~2 EODHD paths). **Frozen** session: serve snapshot as-is (chart included).
- **Flag:** Uses `FINSEPA_MARKET_SNAPSHOT_READ` (`0` disables asset reads/writes).
- **Portfolio:** `/stock/*` defers workspace `live-price` refresh for all holdings (detail page still polls the viewed ticker via `/api/stocks/[ticker]/live-price`).

## Portfolio EODHD optimizations

- **Live marks:** `POST /api/portfolio/live-quotes` batches holdings via EODHD realtime (~1 credit/symbol per chunk), replacing N× `/api/stocks/.../live-price` intraday attempts (~5 credits each).
- **Hydrate:** Local snapshot applies without quotes; server merge refreshes quotes **once per ledger fingerprint** (no double local+remote fan-out).
- **Overview:** `POST /api/portfolio/overview-market` shares one fundamentals fetch per symbol for dividend yield; `unstable_cache` 60s per symbol set; client skips duplicate loads when holdings unchanged.

## P6 — load test & budget proof

**Goal:** Show **≤80,000** traced EODHD HTTP calls/day at **1,000 DAU** (headroom under the 100k plan).

### 1. Analytical model (local, no API key)

```bash
npm run eodhd:estimate
```

Prints `1000_dau_moderate` and `1000_dau_heavy` scenarios. Exit code **1** only if **moderate** exceeds 80k (`heavy` is a stress case). Tune constants in `lib/market/eodhd-daily-load-model.ts` (and keep `scripts/eodhd-load-estimate.mjs` in sync).

### 2. Traced probe (staging/prod)

Measures real per-scope EODHD counts on one serverless isolate:

```bash
CRON_SECRET='…' BASE_URL=https://app.finsepa.com npm run eodhd:probe
```

Optional worst-case cron ingest (expensive):

```bash
CRON_SECRET='…' BASE_URL=https://app.finsepa.com npm run eodhd:probe -- --ingest
```

API: `GET /api/cron/eodhd-traffic-probe?ticker=AAPL` (same `Authorization: Bearer $CRON_SECRET` as market cron).

**Calibrate the model** from probe output:

| Probe scope | Use for scenario field |
|-------------|-------------------------|
| `screener/page1-snapshot-read` | `eodhdPerListPageView` (expect **0**) |
| `asset/AAPL-cold` | `eodhdPerAssetColdLoad` |
| `asset/AAPL-warm` | `eodhdPerAssetWarmLoad` |
| `cron/market-ingest` (with `?ingest=1`) | `eodhdPerMarketIngest` |
| `cron/hub-ingest` | `eodhdPerHubIngestRun` |

### 3. Production week check

1. `FINSEPA_EODHD_MAX_REQUESTS_PER_DAY=80000` on Vercel.
2. Optional `FINSEPA_PROVIDER_BUDGET_LOG=1` when debugging cap hits.
3. Compare EODHD provider dashboard daily usage vs `npm run eodhd:estimate` totals.
4. Re-run `eodhd:probe` after changing ingest cadence or asset traffic.

**Note:** In-process caps and probe counts are **per Node isolate**, not global across all Vercel instances. The model assumes snapshot sharing so user traffic does not multiply list-page EODHD cost.
