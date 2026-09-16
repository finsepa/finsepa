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

`AMAT` · `MRK` · `COST` · `KO` · `CAT` · `PLTR` · `UNH` · `LRCX` · `CVX` · `HSBC` · `GOOGL`/`GOOG` · `AVGO` · `ORCL` · `ABBV` · `ADBE` · `DELL` · `MS` · `GE` · `PG` · `NFLX` · `HD` · `GS` · `PM` · `RY` · `ARM` · `BABA` · `PANW` · `SHEL` · `WFC` · `RTX` · `NVS` · `MUFG` · `SNDK` · `NSRGY` · `GEV` · `AZN` · `ANET` · `SIEGY` · `SAP` · `LVMUY` · `LRLCY` · `KLAC` · `TXN` · `SFTBY` · `BHP` · `C` · `TM` · `IBM` · `TMO` · `AXP` · `LIN` · `SAN` · `CRWD` · `AMGN` · `MRVL` · `VZ` · `TTE` · `STX` · `CRM` · `DIS` · `AMD` · `PEP` · `INTU` · `QCOM` · `APH` · `TD` · `TMUS` · `NVO` · `SCHW` · `ADI` · `DE` · `MCD` · `T` · `GILD` · `ABT` · `BLK` · `NEE` · `RIO` · `WELL` · `UNP` · `SMFG` · `WDC` · `UBS` · `COP` · `BA` · `SHOP` · `SCCO` · `PFE` · `BBVA` · `BUD` · `IBKR` · `ETN` · `BX` · `UBER` · `NOW` · `SONY` · `DHR`

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

## Status snapshot (2026-09-16)

Next-10 #3 by mcap — wired: **PFE, BBVA, BUD, IBKR, ETN, BX, UBER, NOW, SONY, DHR**. BUD Q1’23+ on `cdn.builder.io`. BX yellow (combined Press+Presentation; filings empty). UBER yellow (Q1–Q2’22 HTML press only). **NOW** green (`s205.q4cdn.com/916135447`). **SONY** March FY green (`sony.com/.../presen/er/pdf/`; IR FY tag = Finsepa fy−1). **DHR** green (Presentation `/image/` + press `?asPDF`). Never SEC HTML; empty slots left empty.

- **RIO** YELLOW — Calendar FY. HY (Q2) + Annual (Q4) on `riotinto.com` results media (incl. Q2’26); Q1/Q3 empty.
- **WELL** YELLOW — Business Update + Earnings Release; Q4’22 slides empty.
- **UNP** GREEN — Presentation + News Release/Financials.
- **SMFG** YELLOW — March FY; `e_pre` slides (H1/FY) + `e01` filings; Q1/Q3 slides empty. FY3/2022 under `fy2021/`.
- **WDC** YELLOW — June FY; Presentation + Press Release; Q1/Q2’22 slides empty.
- **UBS** GREEN — Results presentation + media release (`ubs.com/content/dam/.../quarterlies/`; Q3/Q4’22 + Q2’24 under `/content/dam/assets/news/`).
- **COP** GREEN — Calendar FY. Call/release deck + earnings release (`static.conocophillips.com/files/resources/`).
- **BA** GREEN — Calendar FY. Presentation + Earnings/Press Release (`s2.q4cdn.com/661678649`). Ex 99.1 CDN filenames may contain `8K` (still IR PDF).
- **SHOP** YELLOW — Calendar FY. Investor Presentation + Press Release (`shopifyinvestors.gcs-web.com/static-files`). Slides for Q3’25–Q2’26; Q1’22–Q2’25 filings-only. Reject 10-Q / supplemental.
- **SCCO** YELLOW — Calendar FY. `pp*` → Slides; `pr*` → Filings (`southerncoppercorp.com/.../wp-content/uploads/`). Q1’22 empty; several filings-only. Never SEC HTML.

Prior next-10: **GILD** green, **ABT** yellow (filings-only), **BLK** green, **NEE** green, **NVO** yellow, **SCHW** green, **ADI** green, **DE** yellow, **MCD** yellow, **T** yellow, **APH** yellow, **TD** green, **TMUS** green.
