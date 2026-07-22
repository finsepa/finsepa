# SUPERINVESTORS PHASE 0 — SYSTEM AUDIT

**Date:** 2026-07-21  
**Scope:** Full Superinvestors data pipeline (source → ingest → store → API → UI)  
**Mode:** Audit only — no code changes, no optimizations, no feature work  

**Registry size:** 18 hardcoded 13F filers (`SUPERINVESTOR_REGISTRY`)  
**Primary engine:** `lib/superinvestors/berkshire-13f.ts` + freshness/snapshot helpers  

---

## Executive summary

| Area | Finding |
|------|---------|
| Source | **SEC EDGAR only** for live holdings (plus offline JSON fixtures for 3 filers; EODHD search for ticker resolve) |
| Update | **Vercel cron daily 14:00 UTC** + on-demand accession probe (1h cache) |
| Freshness | Latest accessions match SEC for managers with Supabase snapshots; UI = SSR of that cache / live parse |
| Quality | `sum(weights) = 100%` where measured; large filers often lack resolved tickers |
| Competitors | **Dataroma Buffett matches Finsepa exactly** on count, portfolio value, period; CheaperThanGuru not fetchable (403) |
| Biggest risks | Cron force-refresh cost; sparse `market_snapshot` coverage (4/18 profiles); ticker resolution gaps; no dedicated alerts |

---

## 1. Data source

### Every origin of holdings data

| Source | Role | Used for |
|--------|------|----------|
| **SEC EDGAR submissions JSON** `https://data.sec.gov/submissions/CIK{cik}.json` | Filing index | Detect latest `13F-HR` / `13F-HR/A` |
| **SEC EDGAR archives** `https://www.sec.gov/Archives/edgar/data/...` | Infotable XML (and legacy TXT) | Position-level holdings |
| **Offline fixtures** `lib/superinvestors/fixtures/*.json` | Fallback when EDGAR fails | Berkshire, Pershing Square (Ackman), Fundsmith only |
| **Hardcoded CUSIP / issuer → ticker maps** in `berkshire-13f.ts` | Symbol resolution | Common US issuers |
| **EODHD search API** | Issuer name → ticker | Client/API resolve when map misses (`resolve-13f-issuer-ticker`) |
| **Manual / script** `scripts/refresh-berkshire-13f-fixture.mjs` | Regenerate Berkshire fixture from SEC XML | Dev/ops fixture maintenance |

### Not used

- Dataroma / WhaleWisdom / CheaperThanGuru scrapers  
- Third-party commercial 13F APIs  
- Manual CSV import into a holdings table  
- Railway workers for 13F  

**Follows** (`superinvestor_follows`) are user preference data only — not holdings.

---

## 2. Ingest pipeline

### Architecture diagram

```mermaid
flowchart TB
  subgraph sources [Sources]
    SEC[SEC EDGAR submissions + archives]
    FIX[JSON fixtures Berkshire / Pershing / Fundsmith]
    EODHD[EODHD search - ticker resolve only]
  end

  subgraph ingest [Ingest / parse]
    Probe[Filing head probe 13F-HR accession]
    DL[Download infotable XML]
    Parse[Parse infoTable rows]
    Norm[Normalize value units · aggregate by CUSIP]
    Cmp[Compare vs prior filing · weights · sold-out]
    Tx[Build quarter transaction groups]
  end

  subgraph store [Store / cache]
    NC[Next.js unstable_cache accession-keyed]
    MS[(Supabase market_snapshot JSON blobs)]
    MEM[Dev in-memory memo 5 min]
  end

  subgraph api [API / SSR]
    List[SSR /superinvestors list]
    Profile[SSR /superinvestors/slug]
    TxAPI[/api/superinvestors/slug/transactions]
    StockAPI[/api/stocks/ticker/superinvestors]
    Resolve[/api/superinvestors/resolve-issuer-ticker]
    Cron[/api/cron/superinvestor-13f]
  end

  subgraph ui [UI]
    ListUI[Fund table]
    ProfUI[Holdings · allocation · transactions]
    StockTab[Stock Superinvestors tab]
    Avatar[public/superinvestors/*.png]
  end

  SEC --> Probe --> DL --> Parse --> Norm --> Cmp --> Tx
  FIX -.-> Cmp
  Cmp --> NC
  Tx --> NC
  Cmp --> MS
  Tx --> MS
  Cron --> Probe
  Cron --> MS
  List --> NC
  Profile --> NC
  Profile --> MS
  TxAPI --> NC
  StockAPI --> NC
  Resolve --> EODHD
  List --> ListUI
  Profile --> ProfUI
  StockAPI --> StockTab
  Avatar --> ListUI
  Avatar --> ProfUI
```

### Data flow (step-by-step)

```
SEC 13F-HR filing published
        ↓
Submissions JSON lists accession + filingDate + reportDate
        ↓
Download primary infotable XML from EDGAR archives
        ↓
Parse <infoTable>: issuer, class, CUSIP, value, shares
        ↓
Infer value scale (thousands vs dollars) → valueThousands
        ↓
Aggregate duplicate CUSIP / issuer lines (multi-manager splits)
        ↓
valueUsd = valueThousands × 1000
weight% = valueUsd / Σ valueUsd × 100
        ↓
Diff vs previous filing → new / add / reduce / unchanged + sold-out
        ↓
Build transaction quarter pairs (standard ~20 pairs on profile; deep history via API)
        ↓
Cache: unstable_cache (keyed by accession) + optional market_snapshot upsert
        ↓
SSR pages / APIs read cache (or re-parse on miss / accession change)
        ↓
UI: holdings table, donut, transactions, stock tab
```

### Storage model

| Store | Contents |
|-------|----------|
| `market_snapshot` keys `superinvestor_13f_profile_v3_{cik10}` | Full profile JSON (`comparison` + `transactions`) |
| `market_snapshot` keys `superinvestor_13f_holdings_tx_v3_{cik10}` | Holdings-scoped tx (Berkshire-oriented path) |
| `superinvestor_follows` | User follows only |
| **No** normalized `holdings` / `filings` SQL tables | Portfolios are JSON + live SEC parse |

**Observed snapshot coverage (2026-07-21):** only **4** profile keys present for **18** registry CIKs (Berkshire, Fisher, Bridgewater/Dalio, Himalaya/Li Lu). Others rely on Next cache and/or on-demand SEC at request time (plus fixtures for Berkshire/Pershing/Fundsmith when EDGAR fails).

---

## 3. Update pipeline

| Mechanism | Detail |
|-----------|--------|
| **Scheduled worker** | Vercel Cron → `GET /api/cron/superinvestor-13f` |
| **Schedule** | `0 14 * * *` — **daily at 14:00 UTC** (`vercel.json`) |
| **Auth** | `Authorization: Bearer CRON_SECRET` |
| **Cron behavior** | `refreshAllSuperinvestor13fPortfolios()` — clear caches, delete CIK snapshots, reload each registry slug from SEC (`maxDuration` 300s) |
| **On-demand** | Profile load probes latest accession (`getLatest13fFilingHeadCached`, **1h** revalidate). Mismatch → delete snapshots + reload |
| **Webhook** | None |
| **Manual** | Dev route `/api/dev/refresh-superinvestor-13f`; fixture refresh script |

**Frequency summary:** daily forced warm + up to hourly “is there a new accession?” probe per visited filer. Heavy XML only when accession changes (Dataroma-style comments in code).

---

## 4. Data freshness

### How to read delays

- **SEC filing date** = when 13F-HR appeared on EDGAR.  
- **Database `updated_at`** = last snapshot rewrite (often **last successful cron**, not first ingest of that accession).  
- **UI** = SSR of snapshot / accession cache; effectively “DB/cache updated” for managers with snapshots.  
- If `segment` matches latest SEC accession → **holdings content is current** even if `updated_at` is weeks after filing date.

### Focus managers (audit 2026-07-21)

| Manager | Entity / CIK | SEC filing date | Report period | DB snapshot `updated_at` | Accession match | Filing → DB rewrite lag* | UI |
|---------|--------------|-----------------|---------------|--------------------------|-----------------|---------------------------|-----|
| **Warren Buffett** | Berkshire `0001067983` | **2026-05-15** | 2026-03-31 (Q1 2026) | **2026-07-20T14:01:14Z** | Yes | ~66.6 days* | Same snapshot via SSR |
| **Ken Fisher** | Fisher AM `0000850529` | **2026-05-05** | 2026-03-31 | **2026-07-20T14:02:07Z** | Yes | ~76.6 days* | Same |
| **Ray Dalio** | Bridgewater `0001350694` | **2026-05-15** | 2026-03-31 | **2026-07-20T14:01:40Z** | Yes | ~66.6 days* | Same |
| **Bill Ackman** | Pershing `0001336528` | **2026-05-15** | 2026-03-31 | **No `market_snapshot` row** | n/a | n/a (Next cache / live SEC / fixture) | Depends on request-time cache |
| **Michael Burry** | Scion `0001649339` | **2025-11-03** | 2025-09-30 | **No `market_snapshot` row** | n/a | n/a | Same; SEC latest is older (no newer 13F yet) |

\*Lag is **cron rewrite age**, not “Finsepa was 66 days behind SEC.” Accession equality proves content tracks the latest filing for snapshot-backed managers.

### Freshness report (practical)

| Manager | Content freshness vs SEC | Notes |
|---------|--------------------------|-------|
| Buffett / Fisher / Dalio | **Current** (latest accession cached) | Cron last refreshed 2026-07-20 14:00Z |
| Ackman | **Likely current if page hit SEC recently**; no durable snapshot observed | Fixture exists if EDGAR fails |
| Burry | **Current vs Scion’s latest 13F** (Nov 2025) | No Q1 2026 13F on SEC as of audit |

13F regulatory reality: filings are typically due ~45 days after quarter end — product delay vs “live portfolio” is dominated by **SEC rules**, not only Finsepa cron.

---

## 5. Data quality

Weights are computed as share of filing total: `(valueUsd / Σ valueUsd) × 100`. By construction, **sum(weights) ≈ 100%** for a complete comparison set.

| Manager | Holdings count | Σ weights | Δ vs 100% | Portfolio value (USD) | Notes |
|---------|----------------|-----------|-----------|------------------------|-------|
| Buffett | **29** | **100.000** | **0** | **263,095,705,000** | Matches Dataroma |
| Fisher | **1016** | **100.000** | **0** | **294,892,660,000** | Huge book; ticker resolve sparse |
| Dalio | **993** | **100.000** | **0** | **22,404,552,000** | Same |
| Ackman | — | — | — | — | No snapshot row at audit time |
| Burry | — | — | — | — | No snapshot row at audit time |

**Mismatch:** none for Σ weights on measured portfolios.

**Other quality notes**

- Sold-out lists present (Buffett 16, Fisher 119, Dalio 262) — expected QoQ churn.  
- Berkshire: 2 holdings without ticker (`DELTA AIR LINES INC`, `MACYS INC`) — company names present.  
- Fisher/Dalio: hundreds of rows without ticker until client resolve / map hit — **issuer always present**.  
- Minor duplicate ticker labels after resolve (e.g. Fisher `KO` ×2, Dalio `KO`/`NVR`/`AON`/`HEI/A`) — usually share-class / aggregation edge cases, not double-count of portfolio value (weights already sum to 100% on aggregated rows).

---

## 6. Holding validation

| Check | Result |
|-------|--------|
| Ticker exists | **Partial.** Maps + EODHD resolve; large books often null until resolve API. Buffett 27/29 tickers; Fisher ~57 unique tickers of 1016 rows. |
| Company exists | **Yes** for measured rows (`missingCompany: 0`). |
| Logo / avatar | **Manager avatars** in `public/superinvestors/*.png` for registry (Buffett, Fisher, Dalio, Ackman, Burry present). **Holding logos** = stock logo pipeline when ticker resolves — not part of 13F blob. |
| Duplicates | Aggregation by CUSIP reduces SEC line duplicates. Some ticker-string duplicates remain after resolve. |
| Delisted symbols | No dedicated delist filter; 13F historical names retained. |
| Ticker changes | CUSIP-primary identity; ticker is display/resolve layer — corporate actions not fully modeled. |

---

## 7. History

| Manager (snapshot) | Quarters in profile tx blob | Newest | Oldest | Missing quarters (calendar holes in series) |
|--------------------|----------------------------|--------|--------|-----------------------------------------------|
| Buffett | **45** | Q1 2026 | Q1 2014 | **4:** Q3 2014, Q1 2015, Q2 2015, Q4 2015 |
| Fisher | **16** | Q1 2026 | Q2 2022 | (standard profile depth ~20 pairs / ~5y — not full SEC history) |
| Dalio | **20** | Q1 2026 | Q2 2021 | Profile standard depth |

**Code limits**

- Profile SSR: `SUPERINVESTOR_TRANSACTIONS_STANDARD_QUARTER_PAIRS = 20` (~5 years).  
- Deep API: history from ~**2007**, max ~**84** quarter pairs.  
- SEC submissions “recent” list length varies by filer (Buffett 44 13F forms in recent index; Fisher 120; etc.) — not equal to UI quarter count.

---

## 8. Performance

### Cache usage

| Layer | TTL / behavior |
|-------|----------------|
| Filing head probe | **1 hour** |
| Portfolio by accession | **30 days** (`unstable_cache`) |
| Issuer ticker resolve | **1 day** |
| Dev memo | **5 min** |
| `market_snapshot` | Until accession/cron invalidate |
| Tx API `Cache-Control` | `s-maxage` ~6h (route-level) |

### DB / SQL

| Observation | Detail |
|-------------|--------|
| Queries per profile (warm) | Typically **1** snapshot read (or 0 if Next cache hit) — not normalized multi-table joins |
| Largest rows | Fisher profile ≈ **6.2 MB**; Dalio ≈ **6.3 MB**; Buffett ≈ **76 KB** (audit stringify sizes) |
| Docs note | Prior audit: Fisher ~1.6 MB class of large JSONB; cron daily deletes/reloads = write amplification |
| N+1 (list page) | `loadSuperinvestorsListRows` uses **`Promise.all` of 18 loaders** — parallel fan-out to SEC/cache, **not** SQL N+1. Can still amplify EDGAR/EODHD under cold cache |
| Stock tab | Builds cross-filer index (cached ~6h) — another multi-filer fan-out |
| Holdings table unresolved tickers | Per-issuer resolve calls (cached daily) — potential client fan-out |

### Latency (qualitative)

| Path | Expectation |
|------|-------------|
| Warm SSR profile (snapshot hit) | Dominated by Next/Supabase JSON read — usually sub-second to low seconds |
| Cold / new accession | Multiple SEC downloads + XML parse — can be multi-second to tens of seconds; cron `maxDuration` 300s for all 18 |
| List page cold | Up to 18 parallel portfolio loads |

**No production APM numbers captured in this audit** (no forced load test). Risk rating from architecture + prior `docs/supabase-performance-audit.md`.

---

## 9. Failure modes

| Risk | Type | Notes |
|------|------|-------|
| SEC EDGAR outage / rate limit / User-Agent rejection | **SPOF** | Entire live pipeline depends on EDGAR; fixtures cover only 3 filers |
| Vercel cron failure / `CRON_SECRET` misconfig | Stale warm path | On-demand probe still helps visited pages |
| Sparse `market_snapshot` (14/18 missing) | Inconsistent durability | Cold starts hit SEC harder; harder ops visibility |
| Large JSONB snapshots | Perf / cost | Fisher/Dalio multi-MB rows; cron rewrite |
| Ticker resolve gaps | UX / stock deep-links | Many holdings show issuer only |
| Fixture fallback silently | Stale-data risk | `source !== "edgar"` skips accession wipe — can serve old fixture while SEC is up but failing intermittently |
| No dedicated 13F alerting | Monitoring gap | No Slack/Pager on cron 5xx, accession lag, or weight anomalies |
| Manual fixture script | Manual step | Berkshire fixture refresh is human-operated |
| Regulatory lag | Product expectation | Even perfect sync lags true portfolio by ~45 days |

---

## 10. Competitor check — Warren Buffett

### Dataroma (`holdings.php?m=BRK`) — fetched 200 OK

| Field | Dataroma | Finsepa (snapshot) | Match? |
|-------|----------|--------------------|--------|
| Period | Q1 2026 | Q1 2026 | Yes |
| Portfolio date | 31 Mar 2026 | report 2026-03-31 | Yes |
| No. of stocks | **29** | **29** | Yes |
| Portfolio value | **$263,095,705,000** | **$263,095,705,000** | **Exact** |
| Top names | AAPL, AXP, KO, BAC, CVX, OXY, GOOGL, … | Same order in top holdings | Yes |
| Last update UX | Site “Updated …” banners elsewhere; BRK page is period-based | Cron rewrite 2026-07-20; content = May 15 filing | Comparable content age |

**Differences:** Dataroma adds live quote / activity chrome Finsepa does not mirror 1:1. Core 13F economics **align**.

### CheaperThanGuru

| Check | Result |
|-------|--------|
| `cheaperthanguru.com` / manager URL | **HTTP 403** from audit environment |
| Holdings / weights / value / last update | **Could not verify** |

---

## Deliverables summary

### Architecture diagram

See §2 Mermaid (sources → parse → cache → SSR/API → UI).

### Data flow diagram

See §2 step list (SEC → XML → aggregate → weights → cache → UI).

### Freshness report

See §4 table. Snapshot-backed managers track latest SEC accession; Ackman/Burry lack durable snapshot rows at audit time.

### Performance report

See §8. Dominant costs: multi-MB JSON snapshots, 18-way list fan-out, daily cron force refresh, cold SEC parses.

### Quality report

See §5–§7. Weight sums exact; ticker resolution incomplete for large books; Berkshire history missing 4 older quarters.

### Risks

See §9.

### Recommendations (audit only — do not implement here)

1. **Persist snapshots for all 18 CIKs** (or document intentional Next-only cache) so Ackman/Burry/etc. match Buffett durability.  
2. **Cron health alerts** (success/fail, duration, per-slug errors, accession vs SEC head).  
3. **Avoid interpreting `updated_at − filingDate` as ingest SLA**; monitor **accession equality** + bar age of content.  
4. **Ticker coverage KPI** (% rows with ticker on latest filing) especially Fisher/Dalio.  
5. **Snapshot size strategy** for multi-MB profiles (split tx vs holdings, compression, or blob store) — design only until Phase 1+.  
6. **Competitor recheck** CheaperThanGuru from an allowed network when 403 clears.  
7. Clarify product copy: data is **13F as-filed**, not real-time fund holdings.

---

## Key file index

| Path | Role |
|------|------|
| `lib/superinvestors/berkshire-13f.ts` | Parse, aggregate, compare, history |
| `lib/superinvestors/superinvestor-registry.ts` | 18 filers |
| `lib/superinvestors/superinvestor-13f-freshness.ts` | Accession probe + cache TTLs |
| `lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot.ts` | `market_snapshot` R/W |
| `lib/superinvestors/load-superinvestor-profile-data.ts` | SSR + force refresh + cron loop |
| `lib/superinvestors/load-superinvestors-list-rows.ts` | List fan-out |
| `app/api/cron/superinvestor-13f/route.ts` | Daily warm |
| `vercel.json` | `0 14 * * *` |
| `supabase/migrations/20260522120000_superinvestor_follows.sql` | Follows |
| `docs/supabase-performance-audit.md` | Prior perf notes on 13F blobs |

---

**Phase 0 complete.** No code was modified.
