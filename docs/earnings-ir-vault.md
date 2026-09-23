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

## Scope (goal: ~500 companies)

North star: first-party IR Slides/Filings for ≈**500** liquid names (Q1 2022 → latest), filled **next-10-by-mcap** in batches of **three tickers at a time**. Skip OTC pink / preferred / duplicate share classes; prefer US listings + major ADRs.

| Layer | What we do |
|-------|------------|
| **History** | Hand-checked IR PDFs, working down the top500 mcap list. |
| **Going forward** | Cron / latest-quarter pull for issuers we already learned. |
| **Beyond ~500** | Stay yellow. Do not historically green the full long tail. |

## IR-PDF-only names

These must never get SEC HTML as a “helpful” fallback:

`AMAT` · `MRK` · `COST` · `KO` · `CAT` · `PLTR` · `UNH` · `LRCX` · `CVX` · `HSBC` · `GOOGL`/`GOOG` · `AVGO` · `ORCL` · `ABBV` · `ADBE` · `DELL` · `MS` · `GE` · `PG` · `NFLX` · `HD` · `GS` · `PM` · `RY` · `ARM` · `BABA` · `PANW` · `SHEL` · `WFC` · `RTX` · `NVS` · `MUFG` · `SNDK` · `NSRGY` · `GEV` · `AZN` · `ANET` · `SIEGY` · `SAP` · `LVMUY` · `LRLCY` · `KLAC` · `TXN` · `SFTBY` · `BHP` · `C` · `TM` · `IBM` · `TMO` · `AXP` · `LIN` · `SAN` · `CRWD` · `AMGN` · `MRVL` · `VZ` · `TTE` · `STX` · `CRM` · `DIS` · `AMD` · `PEP` · `INTU` · `QCOM` · `APH` · `TD` · `TMUS` · `NVO` · `SCHW` · `ADI` · `DE` · `MCD` · `T` · `GILD` · `ABT` · `BLK` · `NEE` · `RIO` · `WELL` · `UNP` · `SMFG` · `WDC` · `UBS` · `COP` · `BA` · `SHOP` · `SCCO` · `PFE` · `BBVA` · `BUD` · `IBKR` · `ETN` · `BX` · `UBER` · `NOW` · `SONY` · `DHR` · `NEM` · `BMY` · `GLW` · `CB` · `BKNG` · `PLD` · `VRTX` · `UL` · `ISRG` · `TJX` · `NET` · `PGR` · `MFG` · `FRCOY` · `BNPQY` · `BMO` · `CFRUY` · `BTI` · `FTNT` · `LMT` · `SPGI` · `TOELY` · `AIQUY` · `HDB` · `PH` · `MPC` · `MDT` · `SNOW` · `MTSUY` · `ZIJMY`

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

## Status snapshot (2026-09-22)

**Goal:** ~500 companies IR coverage (`EARNINGS_IR_VAULT_COVERAGE_GOAL`). Next-10 #14 wired (~229 dedicated).

Next-10 #14 by mcap (after WBKCY on frozen-2026-09-22) — wired: **LITE, MMM, LYG, BCMXY, EMR, NABZY, GLNCY, MHVIY, BCS, BN** (NPPXF skipped → same IR as NTTYY).

- **LITE** (yellow): June FY; earnings call + press on `s21.q4cdn.com/377324469`; Q2’22 slides-only.
- **MMM** (yellow): slides + earnings_release on CloudFront `/3m/`; Q1’22–Q2’23 slides-only.
- **LYG** (green): Results presentation + announcement/IMS on lloydsbankinggroup.com Q1’22→Q2’26.
- **BCMXY** (yellow): filings-only English results on bankcomm.com fileDownload (no decks).
- **EMR** (green): Sept FY; presentation + earnings release on ir.emerson.com/_assets Q1’22→Q3’26.
- **NABZY** (yellow): Sept FY half-year 1H→Q2 / FY→Q4 on nab.com.au; Q1/Q3 empty by design.
- **GLNCY** (yellow): half-year HY→Q2 / Preliminary→Q4 on glencore.com; Q1/Q3 empty by design.
- **MHVIY** (green): March FY; presentation + press on mhi.com Q1’22→Q1’26.
- **BCS** (green): Results Presentation + BPLC RA on home.barclays Q1’22→Q2’26.
- **BN** (yellow): Supplemental + Press on bn.brookfield.com; Q1–Q3’22 empty.

Next-10 #13 by mcap (after XIACY on frozen-2026-09-22) — wired: **ELV, DDOG, JCI, WMB, PROSY, ICE, IFNNY, MNST, CSX, WBKCY** (ATLCY skipped → same IR as ATLKY).

- **ELV** (yellow): Supplemental/Earnings Presentation + Release on `s202.q4cdn.com/665319960`; slides from Q4’23 (Q1’22–Q3’23 filings-only).
- **DDOG** (yellow): Supplemental + press on investors.datadoghq.com; slides sparse (Q3’23 + Q3’25–Q2’26).
- **JCI** (green): Sept FY; slides + press on `s21.q4cdn.com/502874060` Q1’22→Q3’26.
- **WMB** (yellow): Presentation + Release on investor.williams.com/static-files; Q2’23 filings HTML-only, Q4’25 slides null.
- **PROSY** (yellow): March FY semi-annual HY→Q2 / FY→Q4 on prosus.com; Q1/Q3 empty by design.
- **ICE** (yellow): Presentation + Press on `s2.q4cdn.com/154085107`; Q2’26 slides missing.
- **IFNNY** (yellow): Sept FY; investor presentation + press on infineon.com / assets.infineon.com; press gaps.
- **MNST** (yellow): filings-only `/node/N/pdf` on investors.monsterbevcorp.com (no decks).
- **CSX** (green): Presentation + QFR on `s2.q4cdn.com/859568992` Q1’22→Q2’26.
- **WBKCY** (yellow): Sept FY half-year; 1H→Q2 / FY→Q4 on westpac.com.au; Q1/Q3 empty by design.

Next-10 #12 by mcap (after GD on frozen-2026-09-22) — wired: **CEG, MRAAY, MELI, HCA, SNHIY, DUK, NTTYY, HWM, MAR, XIACY**.

- **CEG** (yellow): Earnings Call Presentation + Release on investors.constellationenergy.com; Q4’24/Q4’25 filings-only.
- **MRAAY** (green): March FY; *-e-speach.ashx + *-e-fls.ashx on corporate.murata.com Q1’22→Q1’27.
- **MELI** (yellow): Letters (Q2’22–Q3’23) + Financial Results on http2.mlstatic.com; Q4’25/Q1’26 empty.
- **HCA** (yellow): filings-only press on `s23.q4cdn.com/949900249` (no quarterly decks).
- **SNHIY** (yellow): filings-only cninfo/dfcfw + HKEX English from Q4’25 (no decks).
- **DUK** (green): Earnings Presentation + Release on `s201.q4cdn.com/583395453` Q1’22→Q2’26.
- **NTTYY** (green): March FY; presentation + kessan release on group.ntt Q1’22→Q1’26.
- **HWM** (green): Earnings Presentation + Results press on howmet.com Q1’22→Q2’26.
- **MAR** (yellow): filings-only Press Release+Tables on `marriott.gcs-web.com/static-files` (no decks).
- **XIACY** (green): Presentation + EN announcement on ir.mi.com Q1’22→Q2’26.

Next-10 #11 by mcap (after CME on frozen-2026-09-22) — wired: **TT, BYDDY, USB, MITSY, ITUB, KKR, PNC, MGCLY, PSTVY, GD**.

- **TT** (green): Earnings Deck/Presentation + Earnings Release on `s2.q4cdn.com/950394465` Q1’22→Q2’26.
- **BYDDY** (yellow): filings-only HKEX results on `www1.hkexnews.hk` (bydglobal SPA has no lockable decks).
- **USB** (green): Earnings Call Presentation + Earnings Release on `s203.q4cdn.com/711684571` Q1’22→Q2’26.
- **MITSY** (green): March FY; IR Meeting ppt + flash on mitsui.com Q1’22→Q1’27.
- **ITUB** (yellow): sparse MZ IQ filemanager PDFs (Q1’24 filings, Q4’24 slides, Q1’26 both, Q2’26 slides); rest empty.
- **KKR** (yellow): Investor Presentation + Earnings Release on ir.kkr.com; slides gaps Q3’22 / Q3’23 / Q4’23.
- **PNC** (green): Earnings Slides + Earnings Release on CloudFront `/pnc/` Q1’22→Q2’26.
- **MGCLY** (yellow): Snapshot + press/financial reports on midea.com.cn/content/dam; Q1–Q2’26 empty.
- **PSTVY** (yellow): Results Presentations (Interim→Q2, Annual→Q4) + reports on psbc.com; Q1/Q3 filings-only.
- **GD** (green): Highlights/Outlook + Exhibit 99.1 on `s22.q4cdn.com/891946778` Q1’22→Q2’26.

Next-10 #10 by mcap — wired: **IBN, ENLAY, ATLKY, TKOMY, AEM, ABNB, EQNR, SO, PWR, VRT** (CNQ→VRT); plus **CME** (ATLKY-era discovery fill).

Next-10 #10 by mcap — wired: **IBN, ENLAY, ATLKY, TKOMY, AEM, ABNB, EQNR, SO, PWR, VRT** (CNQ→VRT); plus **CME** (ATLKY-era discovery fill).

- **IBN** (green): March FY; Investor Presentation + PR1/Performance Review on icici.bank.in Q1’22→Q2’26.
- **ENLAY** (yellow): trimestrali *-risultati* + English press on enel.com; Q4’25/Q1’26 slides-only; Q2’26 empty.
- **ATLKY** (green): handout/presentation + interim report on atlascopcogroup.com Q1’22→Q2’26.
- **CME** (green): Quarterly Earnings Commentary + Earnings Press Release on `investor.cmegroup.com/static-files` Q1’22→Q2’26.
- **TKOMY** (green): March FY; Overview/Results Presentation + Summary Report on tokiomarinehd.com Q1’22→Q1’26.
- **AEM** (yellow): Presentation + news release on ir.agnicoeagle.com Q1’22→Q4’24 (2025+ feed empty).
- **ABNB** (yellow): Shareholder Letter slides-only on `s26.q4cdn.com/656283129` (HTML press).
- **EQNR** (green): Sanity CDN presentation + financial statements/review Q1’22→Q2’26.
- **SO** (green): presentation + press on `s27.q4cdn.com/273397814` Q1’22→Q2’26.
- **PWR** (yellow): Earnings Deck + press on quantaservices.com; Q1’23 filings-only.
- **VRT** (yellow): Results Presentation + Earnings Release on `s205.q4cdn.com/554782763`; Q4’24 slides-only (CNQ replacement).
- **CNQ** (skipped): HTML-only — no lockable PDFs.

Next-10 #9 by mcap — wired: **EQIX, CAIXY, ING, FCX, ITOCY, MCK, APP, GSK, AAGIY, SNY**.

- **EQIX** (green): Earnings Presentation + Press/Financials on Equinix CloudFront Q1’22→Q2’26.
- **CAIXY** (green): CaixaBank Webcast_*_en + Informe Financiero/IF ENG on caixabank.com Q1’22→Q2’26.
- **ING** (green): results presentation + press on ing.com Q1’22→Q2’26.
- **FCX** (green): CC presentation + Earnings Release on `s22.q4cdn.com/529358580` Q1’22→Q2’26 (Q3’25 uses CC_supplementary as slides).
- **ITOCY** (green): March FY; Business Results Summary (`*_02_e`) + Consolidated FS (`*_01_e`) on itochu.co.jp Q1’22→Q1’27.
- **MCK** (green): March FY; Presentation + Earnings/Press on `s24.q4cdn.com/128197368` Q1’22→Q1’27.
- **APP** (green): Earnings Presentation/Shareholder Letter/Financial Update + Press Release on `s21.q4cdn.com/165405286` Q1’22→Q2’26.
- **GSK** (green): results slides/presentation + announcement on gsk.com/media Q1’22→Q2’26.
- **AAGIY** (yellow): semi-annual HY→Q2 / FY→Q4 Analyst Presentation + Results Ann on aia.com; Q1/Q3 empty.
- **SNY** (green): Results Presentation + pressreleases PDF on sanofi.com Q1’22→Q2’26.

Next-10 #8 by mcap — wired: **SBUX, HOOD, AXAHY, ADP, LOW, SPOT, CM, SYK, ENB, PSX**.

- **SBUX** (yellow): late-Sept FY; Earnings at a Glance + Earnings Release on `s203.q4cdn.com/326826266`; Q1–Q3’22 filings-only.
- **HOOD** (green): calendar; Earnings Presentation + Press Release on `investors.robinhood.com/static-files` Q1’22→Q2’26.
- **AXAHY** (yellow): semi-annual; HY→Q2 / FY→Q4 presentation+press on Prismic; Q1/Q3 empty.
- **ADP** (green): June FY; Earnings Deck/Presentation + Earnings Release on `s205.q4cdn.com/887941133` Q1’22→Q4’26.
- **LOW** (yellow): filings-only press on `corporate.lowes.com` (infographic not locked as slides).
- **SPOT** (yellow): Shareholder Deck/Letter slides-only on `s29.q4cdn.com/175625835`.
- **CM** (green): Oct 31 FY; presentation + newsrelease on cibc.com quarterly-results Q1’22→Q3’26.
- **SYK** (yellow): filings-only press on `s22.q4cdn.com/857738142` (no quarterly decks).
- **ENB** (yellow): Earnings Presentation slides-only on enbridge.com media (HTML press).
- **PSX** (green): Presentation + Earnings Release on `s22.q4cdn.com/128149789` Q1’22→Q2’26.

Next-10 #7 by mcap — wired: **BNS, MO, ACN, CVS, VLO, PDD, BP, OVCHY, ZURVY, ASX**.

- **BNS** (green): Oct 31 FY; Investor Presentation + Quarterly Press Release-EN.
- **MO** (green): Sitecore Presentation + Press/Earnings Release Q1’22→Q2’26.
- **ACN** (yellow): Aug 31 FY; Q3’23 filings-only.
- **CVS** (green): q4cdn Earnings-Presentation + Earnings-Release.
- **VLO** / **PDD** (yellow): filings-only.
- **BP** (green): `bp.com/api/files` results + presentation slides.
- **OVCHY** (green): OCBC `iwov-resources/.../quarterly-results` Highlights/Presentation + Press/Media Release.
- **ZURVY** (yellow): HY/FY decks; Q1/Q3 release-only.
- **ASX** (green): ASE Technology Holding — TodayIR Presentation + Press Release.

Next-10 #6 by mcap — wired: **TOELY, SPGI, AIQUY, MPC, HDB, PH, MDT, SNOW, MTSUY, ZIJMY**.

- **SPGI** GREEN — Q1’22→Q2’26; Earnings Call Slides + Earnings Release (`s29.q4cdn.com/690959130`).
- **TOELY** GREEN — March FY Q1’22→Q1’27; `*presentations-e.pdf` + `*tanshin-e.pdf` on tel.com.
- **AIQUY** GREEN — Q1’22→Q2’26 activity/H1/FY presentation + press (`airliquide.com/sites/.../files`).
- **MPC** GREEN — Q1’22→Q2’26 slides + press on `s2.q4cdn.com/142437514` (doc_news fills older PRs).
- **HDB** YELLOW — March FY; earnings-presentation + press-release; solid Q1’24→Q1’27; FY22–23 sparse.
- **PH** GREEN — June FY Q1’22→Q4’26; Earnings Presentation + press on cloudfront.
- **MDT** GREEN — late-April FY Q1’22→Q1’27; Presentation + Press on `investorrelations.medtronic.com`.
- **SNOW** YELLOW — Jan FY; Investor Presentation slides on `s26.q4cdn.com/463892824`; filings null (HTML press).
- **MTSUY** YELLOW — March FY; meetings + earnings PDFs on mitsubishicorp.com; early FY22–23 gaps.
- **ZIJMY** YELLOW — calendar; English results PDFs on zijinmining.com; no slide decks; several empties.

Next-10 #5 by mcap — wired: **MFG, FRCOY, BNPQY, NET, FTNT, LMT, PGR, BMO, CFRUY, BTI**.

- **NET** GREEN — Cloudflare Supplemental → Slides; Exhibit 99.1 → Filings (`cloudflare.net/files`).
- **FTNT** YELLOW — `investor.fortinet.com/static-files` decks all quarters; EX 99.1 for recent only.
- **LMT** YELLOW — MediaRoom Conf-Call-Charts + Earnings-Release; gaps Q2/Q4’24 (+ older).
- **PGR** YELLOW — IR Call → Slides (mostly Q2/Q4); GlobeNewswire Complete Earnings Release → Filings.
- **MFG** YELLOW — Mizuho March FY; Summary *_2 → Slides; data pack → Filings; Q1–Q3’24 filings null.
- **FRCOY** GREEN — Fast Retailing August FY; `*_results_en.pdf` + `tanshin*eng.pdf`.
- **BNPQY** GREEN — BNP calendar; `invest.bnpparibas/en/document/{q}q{yy}-slides|-pr` (PDF without `.pdf`).
- **BMO** GREEN — October FY; AnalystPresentation + EarningsRelease under `/ir/qtrinfo/`.
- **CFRUY** YELLOW — Richemont EN presentation + ad-hoc press; Q2/Q4’22 sales filings-only.
- **BTI** YELLOW — UK semi-annual; HY→Q2 / FY→Q4 on bat.com; Q1/Q3 empty by design.

Prior next-10 #4 — wired: **ISRG, TJX, UL, CB, PLD, NEM, GLW, VRTX, BMY, BKNG**.

- **NEM** — Newmont q4cdn Presentation + Press Release.
- **BMY** — Bristol Myers Squibb presentation + press (bms.com / q4cdn).
- **GLW** — Corning q4cdn earnings PDFs.
- **CB** YELLOW — Chubb Corporate Presentation + press; slides missing Q4’22 / Q1–Q2’23 / Q1’24.
- **BKNG** YELLOW — Booking q4cdn; older quarters may be filings-only (presentation gaps).
- **PLD** YELLOW — Prologis supplemental PDF → Slides; filings empty (HTML release).
- **VRTX** YELLOW — Vertex `investors.vrtx.com/static-files` presentations; filings empty (HTML release).
- **UL** YELLOW — Unilever `/files/` presentation + full announcement from Q4’23; Q1/Q3’23 filings via UUID paths; earlier empty.
- **ISRG** YELLOW — Intuitive `static-files` Investor Presentations + `/node/N/pdf` press filings (Q4’24→Q2’26); older quarters often slides-only or empty.
- **TJX** YELLOW — January FY. Filings-only press PDFs on `tjx.com/docs/.../quarterly-results/` (Q4’22→Q2’27); no IR slide deck.

Never SEC HTML; empty slots left empty.

Prior next-10 #3: **PFE, BBVA, BUD, IBKR, ETN, BX, UBER, NOW, SONY, DHR**. BUD Q1’23+ on `cdn.builder.io`. BX yellow (combined Press+Presentation; filings empty). UBER yellow (Q1–Q2’22 HTML press only). **NOW** green (`s205.q4cdn.com/916135447`). **SONY** March FY green (`sony.com/.../presen/er/pdf/`; IR FY tag = Finsepa fy−1). **DHR** green (Presentation `/image/` + press `?asPDF`).

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
