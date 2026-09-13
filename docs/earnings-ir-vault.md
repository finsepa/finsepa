# Earnings IR vault (for devs)

Light notes on how we fill **Slides** (Company IR) on the stock earnings tab.

**Reports** (8-K + 10-Q/10-K) are HIGH-confidence SEC matches in `earnings_document_cache` (`eight_k_url`, `form10_url`, `form10_kind`). They are **not** stored in this lock-once vault. Do not put SEC into `slides_url` / `filings_url`.

Existing `filings_url` IR PDFs stay locked for later Earnings Release / IR overlay work. They are not a v1 primary UI action.

We want each reported quarter (from **Q1 2022** onward) to have a first-party IR **Slides** PDF when the issuer published one — like Quartr, not like EDGAR HTML.

## The two documents

| Column | What it is | Typical file |
|--------|------------|--------------|
| **Slides** | Earnings deck / IR overview / supplement | `*Presentation*.pdf`, `*Slide-Deck*.pdf`, `*Earnings-Supplement*.pdf` |
| **Filings** | Press / news / earnings **release** PDF | `*Earnings-Release*.pdf`, `*Operating-Results*.pdf`, Exhibit 99.1 **PDF** |

They must be **two different URLs**. Same PDF in both slots is one report, not two.

## Traffic lights

Per quarter:

- **Green** — both PDFs, distinct
- **Yellow** — only one
- **Red** — neither

Per ticker: green only if **every** in-scope quarter is green. One hole → ticker stays yellow. That is honest, not a bug.

## What we lock (and what we don’t)

**Lock**

- Issuer IR site or their CDN (q4cdn, GCS `static-files`, wp-content, etc.)
- Direct `.pdf` (or a known PDF-without-suffix pattern, e.g. Broadcom `/node/N/pdf`)
- After lock: copy into Supabase `earnings-ir-docs` when we can, so Cloudflare doesn’t break preview

**Never lock**

- SEC HTML (`.htm` exhibits)
- HTML press pages (`caterpillar.com/.../h/*.html`)
- Transcripts, 10-Q / 10-K, margin schedules, CAGNY / conference decks
- Monthly sales-only releases (Costco “August sales”)
- One PDF used as both slides and filings

If the IR site simply never published a press PDF, **leave filings empty**. Yellow is correct. Filling the hole with SEC HTML is how we had to redo AMAT / MRK / COST / KO / CAT.

## How we actually fill it

Do **not** scrape 10–50 names in one batch. That is how SEC HTML leaked in.

Working method: **three tickers at a time**.

1. Open the IR site in a real browser (many IR pages are Cloudflare).
2. Learn the URL pattern (folder + filename), don’t guess.
3. Catalog every in-scope quarter: slides URL and/or filings URL, or **none**.
4. Unlock any existing `sec.gov` / HTML locks for those tickers.
5. Add a **dedicated seed** (known catalog + HTML parser if the page is fetchable).
6. Put the ticker in `EARNINGS_IR_VAULT_IR_PDF_ONLY_TICKERS` so backfill **cannot** fall back to SEC.
7. Backfill **only those tickers**, then mirror PDFs.

```bash
npm run earnings:ir-vault -- --tickers=COST,KO,CAT
npm run earnings:ir-docs-mirror -- --tickers=COST,KO,CAT --plain-only
```

Merge is **lock-once**: a correct lock is never overwritten. Wrong SEC locks must be unlocked first or they stick forever.

## Scope (don’t boil the ocean)

| Layer | What we do |
|-------|------------|
| **History** | Curated ~25–50 large names, Q1 2022 → latest. Hand-checked IR PDFs. |
| **Going forward** | Cron / latest-quarter pull for issuers we already learned. |
| **Long tail** | Stay yellow. Do not historically green ~2500 names. |

## IR-PDF-only names

These must never get SEC HTML as a “helpful” fallback:

`AMAT` · `MRK` · `COST` · `KO` · `CAT` · `PLTR` · `UNH` · `LRCX` · `CVX` · `HSBC` · `GOOGL`/`GOOG` · `AVGO` · `ORCL` · `ABBV` · `ADBE` · `DELL` · `MS` · `GE` · `PG` · `NFLX` · `HD` · `GS` · `PM` · `RY` · `ARM` · `BABA` · `PANW` · `SHEL` · `WFC` · `RTX` · `NVS` · `MUFG` · `SNDK` · `NSRGY` · `GEV` · `AZN` · `ANET` · `SIEGY` · `SAP` · `LVMUY` · `LRLCY` · `KLAC` · `TXN` · `SFTBY` · `BHP` · `C` · `TM` · `IBM` · `TMO` · `AXP` · `LIN` · `SAN` · `CRWD` · `AMGN` · `MRVL` · `VZ` · `TTE` · `STX` · `CRM` · `DIS` · `AMD` · `PEP` · `INTU` · `QCOM` · `APH` · `TD` · `TMUS` · `NVO` · `SCHW` · `ADI` · `DE` · `MCD` · `T` · `GILD` · `ABT` · `BLK` · `NEE`

Add a ticker here when you redo it the right way (`lib/market/earnings-ir-vault-types.ts`).

## Where the code lives

| Piece | Place |
|-------|--------|
| Vault table | Supabase `earnings_ir_vault` |
| Hosted PDFs | bucket `earnings-ir-docs` (`TICKER/YYYY-MM-DD/{slides,filings}.pdf`) |
| Merge / lights | `lib/market/earnings-ir-vault-store.ts`, `earnings-ir-vault-types.ts` |
| Backfill | `lib/market/earnings-ir-vault-backfill.ts` |
| Per-issuer catalogs | `lib/market/ir-seed-*-match.ts` + `ir-seed-apply-*.ts` |
| Wire-up | `lib/market/ir-seed-apply.ts` (`DEDICATED_IR_SEED_TICKERS`) |
| Preview proxy | `GET /api/ir-pdf` + `lib/market/ir-pdf-proxy-allowlist.ts` |

## Status snapshot (2026-09-13)

Next batch by mcap — wired: **GILD, ABT, BLK, NEE** (completes next-10 after NVO…T). HTTP/browser catalogs; never SEC HTML; empty slots left empty.

- **GILD** GREEN — Calendar FY. Earnings Presentation + Press Release (`s29.q4cdn.com/585078350`).
- **ABT** YELLOW — filings-only. Calendar FY. Earnings press PDFs on `abbottinvestor.com/static-files`; infographics are not Slides.
- **BLK** GREEN — Calendar FY. Earnings Release Supplement + Earnings Release (`s24.q4cdn.com/856567660`); some releases use `Earning-Release` filenames.
- **NEE** GREEN — Calendar FY. Earnings Slides + News Release (`investor.nexteraenergy.com` Sitecore media; path typos `fillings` / `event_presentaion`). Q1’25 filings = Exhibit 99 PDF.

Also wired earlier in this next-10: **NVO** yellow (slides-only), **SCHW** green, **ADI** green, **DE** yellow, **MCD** yellow (filings-only), **T** yellow.

Prior: **NVO** yellow, **SCHW** green, **ADI** green, **DE** yellow, **MCD** yellow, **T** yellow, **APH** yellow, **TD** green, **TMUS** green.
