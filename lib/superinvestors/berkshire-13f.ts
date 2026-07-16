import "server-only";

import { unstable_cache } from "next/cache";

import { getSecEdgarUserAgent } from "@/lib/env/server";
import { isValid, parseISO, subMonths } from "date-fns";

import {
  getLatest13fFilingHeadCached,
  thirteenFilingHeadCacheKey,
  withAccessionKeyed13fCache,
} from "@/lib/superinvestors/superinvestor-13f-freshness";
import {
  readSuperinvestor13fProfileSnapshot,
  readSuperinvestorHoldingsTransactionsSnapshot,
  readSuperinvestorHoldingsTransactionsSnapshotRow,
  upsertSuperinvestor13fProfileSnapshot,
  upsertSuperinvestorHoldingsTransactionsSnapshot,
} from "@/lib/superinvestors/superinvestor-13f-holdings-transactions-snapshot";
import { filingHeadMatchesComparison } from "@/lib/superinvestors/superinvestor-13f-cache-utils";
import {
  filterSuperinvestorTransactionsToCurrentHoldings,
  prependSuperinvestorQuarterGroups,
  pruneSpuriousExitReentryTransactions,
} from "@/lib/superinvestors/superinvestor-transaction-utils";
import type {
  Berkshire13fComparisonPayload,
  Berkshire13fComparisonRow,
  Berkshire13fFilingMeta,
  Berkshire13fSoldOutRow,
  Holding13fComparisonStatus,
  InstitutionalHoldingRow,
  InstitutionalHoldingsPayload,
  SuperinvestorQuarterlyTransaction,
  SuperinvestorQuarterlyTransactionKind,
  Superinvestor13fProfilePageData,
  SuperinvestorQuarterTransactionGroup,
  SuperinvestorTransactionsPayload,
} from "@/lib/superinvestors/types";

import berkshireFallback from "@/lib/superinvestors/fixtures/berkshire-holdings-fallback.json";
import fundsmithFallback from "@/lib/superinvestors/fixtures/fundsmith-holdings-fallback.json";
import pershingSquareFallback from "@/lib/superinvestors/fixtures/pershing-square-holdings-fallback.json";

export type SuperinvestorHoldSinceMatch = {
  cik: string;
  /** Prefer CUSIP match when present (stable across filings). */
  cusip: string | null;
  /** Fallback name match when CUSIP is missing. */
  issuer: string;
  titleOfClass: string | null;
};

const DEV_SEC_CACHE_TTL_MS = 5 * 60 * 1000;

const REVALIDATE_SEC_13F_DAY = 86_400;

function normalizeIssuerName(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|del|holdings)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cikPad10(cik: string): string {
  const trimmed = cik.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/^CIK/i, "").replace(/\D+/g, "");
  if (!digits) return trimmed.padStart(10, "0").slice(-10);
  return digits.padStart(10, "0").slice(-10);
}

function devMemoAsync<T>(key: string, fn: () => Promise<T>, ttlMs = DEV_SEC_CACHE_TTL_MS): Promise<T> {
  if (process.env.NODE_ENV === "production") return fn();
  const g = globalThis as unknown as {
    __finsepaDevMemo?: Map<string, { exp: number; v: Promise<unknown> }>;
  };
  if (!g.__finsepaDevMemo) g.__finsepaDevMemo = new Map();
  const now = Date.now();
  const hit = g.__finsepaDevMemo.get(key);
  if (hit && hit.exp > now) return hit.v as Promise<T>;
  const v = fn();
  g.__finsepaDevMemo.set(key, { exp: now + ttlMs, v });
  /** Don't pin a rejected/hung-then-failed promise for the full TTL. */
  void v.catch(() => {
    const cur = g.__finsepaDevMemo?.get(key);
    if (cur?.v === v) g.__finsepaDevMemo?.delete(key);
  });
  return v;
}

async function secFetch(url: string, init: RequestInit & { headers: HeadersInit }): Promise<Response> {
  let attempt = 0;
  let backoffMs = 400;
  // Retry a few times on SEC throttling (429).
  for (;;) {
    const res = await fetch(url, {
      ...init,
      // Bound each SEC hop so profile SSR can't sit on skeleton forever.
      signal: init.signal ?? AbortSignal.timeout(20_000),
    });
    if (res.status !== 429 || attempt >= 4) return res;
    const ra = res.headers.get("retry-after");
    const retryAfterMs = ra && /^\d+$/.test(ra) ? Number(ra) * 1000 : null;
    const wait = retryAfterMs != null ? retryAfterMs : backoffMs;
    await new Promise((r) => setTimeout(r, wait));
    attempt++;
    backoffMs = Math.min(4000, backoffMs * 2);
  }
}

/** Berkshire Hathaway Inc. — SEC central index key (zero-padded). */
const BERKSHIRE_CIK = "0001067983";

/** EDGAR dates for the offline Berkshire snapshot (`berkshire-holdings-fallback.json`). */
const BERKSHIRE_FIXTURE_CURRENT_FILING_DATE = "2026-05-15";
const BERKSHIRE_FIXTURE_CURRENT_REPORT_DATE = "2026-03-31";
const BERKSHIRE_FIXTURE_PREVIOUS_FILING_DATE = "2026-02-17";
const BERKSHIRE_FIXTURE_PREVIOUS_REPORT_DATE = "2025-12-31";

/** Pershing Square Capital Management, L.P. */
export const PERSHING_SQUARE_CIK = "0001336528";

/** Fundsmith LLP (UK manager; SEC 13F filer). */
export const FUNDSMITH_LLP_CIK = "0001569205";

/** Scion Asset Management, LLC (Michael Burry). */
export const SCION_ASSET_MANAGEMENT_CIK = "0001649339";

/** ARK Investment Management LLC (Cathie Wood). */
export const ARK_INVEST_CIK = "0001697748";

/** Himalaya Capital Management LLC (Li Lu). */
export const HIMALAYA_CAPITAL_CIK = "0001709323";

/** Bridgewater Associates, LP (Ray Dalio). */
export const BRIDGEWATER_ASSOCIATES_CIK = "0001350694";

/** Fisher Asset Management, LLC (Ken Fisher). */
export const FISHER_ASSET_MANAGEMENT_CIK = "0000850529";

/** PRIMECAP Management Co/CA/. */
export const PRIMECAP_MANAGEMENT_CIK = "0000763212";

/** Citadel Advisors LLC (Ken Griffin). */
export const CITADEL_ADVISORS_CIK = "0001423053";

/** Daily Journal Corp (Charlie Munger portfolio; 13F filer). */
export const DAILY_JOURNAL_CORP_CIK = "0000783412";

/** BlackRock, Inc. (consolidated 13F — very large position count). */
export const BLACKROCK_INC_CIK = "0002012383";

/** Baillie Gifford & Co (US 13F filer). */
export const BAILLIE_GIFFORD_CO_CIK = "0001088875";

/** Renaissance Technologies LLC (Jim Simons). */
export const RENAISSANCE_TECHNOLOGIES_LLC_CIK = "0001037389";

/** Point72 Asset Management, L.P. (Steven A. Cohen). */
export const POINT72_ASSET_MANAGEMENT_LP_CIK = "0001603466";

/** First Eagle Investment Management LLC. */
export const FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK = "0001325447";

/** TCI Fund Management Ltd (Chris Hohn). */
export const TCI_FUND_MANAGEMENT_LTD_CIK = "0001647251";

/** Grantham, Mayo, Van Otterloo & Co. LLC (GMO; Jeremy Grantham). */
export const GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK = "0001352662";

/** Optional display tickers for common 13F CUSIPs (SEC filings do not include symbols). */
const KNOWN_CUSIP_TICKER: Record<string, string> = {
  "037833100": "AAPL",
  /** American Express common (13F); not to be confused with 025537101 (AEP). */
  "025816109": "AXP",
  /** American Electric Power — was incorrectly labeled AXP in an older map. */
  "025537101": "AEP",
  "060505104": "BAC",
  "191216100": "KO",
  "166764100": "CVX",
  "615369105": "MCO",
  "674599105": "OXY",
  "H1467J104": "CB",
  "500754106": "KHC",
  "02079K305": "GOOGL",
  /** Alphabet Inc. Class C (13F). */
  "02079K107": "GOOG",
  "023436108": "DVA",
  "251794105": "KR",
  "92826C839": "V",
  "829933100": "SIRI",
  "57636Q104": "MA",
  "92343E102": "VRSN",
  "21036P108": "STZ",
  "13961J105": "COF",
  "91324P102": "UNH",
  "25754A201": "DPZ",
  "02005N100": "ALLY",
  "G0084W101": "AON",
  "670346105": "NUE",
  "531229607": "FWONA",
  "526057104": "LEN",
  "73278L105": "POOL",
  "023135106": "AMZN",
  "546347105": "LPX",
  "531229409": "FWONK",
  "553498103": "NYT",
  "422806109": "HEI/A",
  "G17182108": "CHTR",
  "512816109": "LAMR",
  "G0176J109": "ALLE",
  "629377508": "NVR",
  "25243Q205": "DEO",
  "47233W109": "JEF",
  "526057302": "LEN.B",
  "G01125106": "LILAK",
  "03214Q108": "BATRK",
  "G01125130": "LILAK",
  /** Nu Holdings Ltd. Class A ordinary shares (NYSE: NU). */
  "G6683N103": "NU",
  /** Liberty Live Holdings, Inc. Series A common (NASDAQ: LLYVA). */
  "530909100": "LLYVA",
  /** Liberty Live Holdings, Inc. Series C common (NASDAQ: LLYVK). */
  "531229722": "LLYVK",

  /** Pershing Square — Brookfield Corp (NYSE: BN). */
  "11271J107": "BN",
  /** Hertz Global Holdings, Inc. */
  "42806J700": "HTZ",
  /** Hilton Worldwide Holdings Inc. */
  "43300A203": "HLT",
  /** Howard Hughes Holdings Inc. */
  "44267T102": "HHH",
  /** Meta Platforms, Inc. */
  "30303M102": "META",
  /** Restaurant Brands International Inc. */
  "76131D103": "QSR",
  /** Seaport Entertainment Group Inc. */
  "812215200": "SEG",
  /** Uber Technologies Inc. */
  "90353T100": "UBER",

  // Common names that show up in newer 13F filers (Scion/ARK/Himalaya/Bridgewater).
  /** Palantir Technologies Inc. Class A. */
  "69608A108": "PLTR",
  /** Pfizer Inc. */
  "717081103": "PFE",
  /** Halliburton Co. */
  "406216101": "HAL",
  /** Molina Healthcare, Inc. */
  "60855R100": "MOH",
  /** Lululemon Athletica Inc. */
  "550021109": "LULU",
  /** SLM Corp. */
  "78442P106": "SLM",
  /** Bruker Corp. (preferred CUSIP appears in some filings; map to main listing). */
  "116794207": "BRKR",

  /** PDD Holdings Inc. (ADS). */
  "722304102": "PDD",
  /** Berkshire Hathaway Inc. Class B. */
  "084670702": "BRK.B",
  /** Berkshire Hathaway Inc. Class A. */
  "084670108": "BRK.A",
  /** East West Bancorp Inc. */
  "27579R104": "EWBC",
  /** Crocs Inc. */
  "227046109": "CROX",

  /** Fundsmith LLP — ADMA Biologics, Inc. */
  "000899104": "ADMA",
  /** Automatic Data Processing, Inc. */
  "053015103": "ADP",
  /** Catalyst Pharmaceuticals, Inc. */
  "14888U101": "CPRX",
  /** Church & Dwight Co., Inc. */
  "171340102": "CHD",
  /** Clorox Co. */
  "189054109": "CLX",
  /** Doximity, Inc. */
  "26622P107": "DOCS",
  /** Fortinet, Inc. */
  "34959E109": "FTNT",
  /** Graco Inc. */
  "384109104": "GGG",
  /** Home Depot, Inc. */
  "437076102": "HD",
  /** IDEXX Laboratories, Inc. */
  "45168D104": "IDXX",
  /** Intuit Inc. */
  "461202103": "INTU",
  /** Manhattan Associates, Inc. */
  "562750109": "MANH",
  /** Marriott International, Inc. */
  "571903202": "MAR",
  /** Medpace Holdings, Inc. */
  "58506Q109": "MEDP",
  /** Mettler-Toledo International Inc. */
  "592688105": "MTD",
  /** Microsoft Corp. */
  "594918104": "MSFT",
  /** MSCI Inc. */
  "55354G100": "MSCI",
  /** Napco Security Technologies, Inc. */
  "630402105": "NSSC",
  /** Nike, Inc. */
  "654106103": "NKE",
  /** Nutanix Inc. */
  "67059N108": "NTNX",
  /** Oddity Tech Ltd. */
  "M7518J104": "ODD",
  /** Otis Worldwide Corp. */
  "68902V107": "OTIS",
  /** Paycom Software, Inc. */
  "70432V102": "PAYC",
  /** Philip Morris International Inc. */
  "718172109": "PM",
  /** Procter & Gamble Co. */
  "742718109": "PG",
  /** Qualys, Inc. */
  "74758T303": "QLYS",
  /** Rollins, Inc. */
  "775711104": "ROL",
  /** Sabre Corp. */
  "78573M104": "SABR",
  /** Stryker Corp. */
  "863667101": "SYK",
  /** Texas Instruments Inc. */
  "882508104": "TXN",
  /** Vertiv Holdings Co. */
  "92537N108": "VRT",
  /** Waters Corp. */
  "941848103": "WAT",
  /** Zoetis Inc. */
  "98978V103": "ZTS",
};

type SubmissionsRecent = {
  form?: string[];
  filingDate?: string[];
  accessionNumber?: string[];
  reportDate?: string[];
};

/** Older `submissions/CIK…-00N.json` chunks use columnar fields at the root (no `filings.recent` wrapper). */
type SubmissionsColumnarPayload = SubmissionsRecent & {
  filings?: { recent?: SubmissionsRecent };
};

function submissionsColumnFromPayload(payload: SubmissionsColumnarPayload): SubmissionsRecent | undefined {
  if (payload.filings?.recent) return payload.filings.recent;
  if (Array.isArray(payload.form) && Array.isArray(payload.accessionNumber)) return payload;
  return undefined;
}

type SubmissionsFileChunk = {
  name?: string;
  filingCount?: number;
  filingFrom?: string;
  filingTo?: string;
};

type SubmissionsRoot = {
  cik?: string;
  name?: string;
  filings?: { recent?: SubmissionsRecent; files?: SubmissionsFileChunk[] };
};

type ThirteenFilingRef = {
  accession: string;
  filingDate: string | null;
  reportDate: string | null;
};

function is13fHrForm(form: string): boolean {
  return form === "13F-HR" || form === "13F-HR/A";
}

/** Extract 13F-HR accessions from SEC submissions columnar arrays (newest-first). */
function extract13fRefsFromSubmissionsColumn(recent: SubmissionsRecent | undefined): ThirteenFilingRef[] {
  const forms = recent?.form ?? [];
  const accessionNumbers = recent?.accessionNumber ?? [];
  const filingDates = recent?.filingDate ?? [];
  const reportDates = recent?.reportDate ?? [];
  const out: ThirteenFilingRef[] = [];
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i] ?? "";
    if (!is13fHrForm(form)) continue;
    const accession = accessionNumbers[i]?.trim();
    if (!accession) continue;
    out.push({
      accession,
      filingDate: filingDates[i] ?? null,
      reportDate: reportDates[i] ?? null,
    });
  }
  return out;
}

type ThirteenFilingIndex = {
  filerName: string;
  refs: ThirteenFilingRef[];
};

async function load13fFilingIndexUncached(cikPadded: string, ua: string): Promise<ThirteenFilingIndex> {
  const subUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
  const subRes = await secFetch(subUrl, {
    headers: { "User-Agent": ua, Accept: "application/json" },
    cache: "no-store",
  });
  if (!subRes.ok) return { filerName: "Institutional investment manager", refs: [] };

  const root = (await subRes.json()) as SubmissionsRoot;
  const filerName =
    typeof root.name === "string" && root.name.trim() ? root.name.trim() : "Institutional investment manager";
  const refs = extract13fRefsFromSubmissionsColumn(submissionsColumnFromPayload(root));
  const seenAccessions = new Set(refs.map((r) => r.accession));

  const fileChunks = root.filings?.files ?? [];
  for (const chunk of fileChunks) {
    const name = chunk.name?.trim();
    if (!name) continue;
    const chunkUrl = `https://data.sec.gov/submissions/${name}`;
    const chunkRes = await secFetch(chunkUrl, {
      headers: { "User-Agent": ua, Accept: "application/json" },
      cache: "no-store",
    });
    if (!chunkRes.ok) continue;
    const chunkJson = (await chunkRes.json()) as SubmissionsColumnarPayload;
    const older = extract13fRefsFromSubmissionsColumn(submissionsColumnFromPayload(chunkJson));
    for (const ref of older) {
      if (seenAccessions.has(ref.accession)) continue;
      seenAccessions.add(ref.accession);
      refs.push(ref);
    }
  }

  return { filerName, refs };
}

const thirteenFIndexCacheByCik = new Map<string, () => Promise<ThirteenFilingIndex>>();

function get13fFilingIndexCached(cikPadded: string, ua: string): Promise<ThirteenFilingIndex> {
  let loader = thirteenFIndexCacheByCik.get(cikPadded);
  if (!loader) {
    const uncached = () => load13fFilingIndexUncached(cikPadded, ua);
    loader =
      process.env.NODE_ENV === "production"
        ? unstable_cache(uncached, ["superinvestor-13f-filing-index-v5", cikPadded], { revalidate: 86_400 })
        : () => uncached();
    thirteenFIndexCacheByCik.set(cikPadded, loader);
  }
  return loader();
}

function decodeXmlText(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

/** Match SEC 13F elements with optional XML namespace prefix (e.g. `ns1:nameOfIssuer`). */
function extractTagContent(block: string, localName: string): string | null {
  const q = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cdata = new RegExp(
    `<(?:[\\w.-]+:)?${q}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</(?:[\\w.-]+:)?${q}>`,
    "i",
  );
  const cd = block.match(cdata);
  if (cd?.[1] != null) return decodeXmlText(cd[1]!);
  const plain = new RegExp(`<(?:[\\w.-]+:)?${q}[^>]*>([^<]*)</(?:[\\w.-]+:)?${q}>`, "i");
  const pl = block.match(plain);
  if (pl?.[1] != null) return decodeXmlText(pl[1]!);
  return null;
}

function extractTagBlock(outer: string, localName: string): string | null {
  const q = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<(?:[\\w.-]+:)?${q}[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${q}>`, "i");
  const m = outer.match(re);
  return m?.[1] ?? null;
}

function extractSharesFromInfoTableBlock(block: string): number | null {
  const inner = extractTagBlock(block, "shrsOrPrnAmt");
  if (!inner) return null;
  const raw = extractTagContent(inner, "sshPrnamt");
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type ParsedInfoRow = {
  issuer: string;
  title: string | null;
  valueThousands: number;
  cusip: string | null;
  shares: number | null;
};

/**
 * SEC 13F `<value>` is **thousands of USD**. Some infotables carry **full USD** in the same
 * field (~1000× too large). A single-line position above this many "thousands" is not credible
 * for any US 13F; treat oversized raw values as dollars and convert back to thousands so
 * `valueThousands * 1000` stays correct everywhere downstream.
 */
const SEC_13F_VALUE_MAX_CREDIBLE_THOUSANDS = 500_000_000;

function normalizeSec13fValueThousands(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return raw;
  if (raw > SEC_13F_VALUE_MAX_CREDIBLE_THOUSANDS) {
    return Math.round(raw / 1000);
  }
  return raw;
}

type RawInfoTableRow = {
  issuer: string;
  title: string | null;
  rawValue: number;
  cusip: string | null;
  shares: number | null;
};

/**
 * SEC Form 13F says `<value>` is thousands of USD, but some filers (notably Berkshire-style
 * multi-manager infotables) put **full USD** in `<value>`. Per-row `>500M → ÷1000` then mixes
 * units (small lines stay 1000× inflated). Infer one scale per file from share-implied prices.
 */
function inferSec13fValueFieldUnit(rows: readonly { rawValue: number; shares: number | null }[]): "thousands" | "dollars" {
  let thousandsVotes = 0;
  let dollarsVotes = 0;
  let maxPxIfThousands = 0;
  for (const r of rows) {
    const { rawValue, shares } = r;
    if (shares == null || shares < 100 || !Number.isFinite(rawValue) || rawValue <= 0) continue;
    const pxIfThousands = (rawValue * 1000) / shares;
    const pxIfDollars = rawValue / shares;
    if (pxIfThousands > maxPxIfThousands) maxPxIfThousands = pxIfThousands;
    const dollarsPlausible = pxIfDollars >= 0.05 && pxIfDollars <= 800_000;
    const thousandsPlausible = pxIfThousands >= 0.05 && pxIfThousands <= 800_000;
    if (dollarsPlausible && pxIfThousands > pxIfDollars * 200) {
      dollarsVotes++;
    } else if (thousandsPlausible && pxIfDollars < 0.5) {
      thousandsVotes++;
    } else if (thousandsPlausible) {
      thousandsVotes++;
    } else if (dollarsPlausible) {
      dollarsVotes++;
    }
  }
  /** No US listing trades above ~$1M/sh; mis-read dollars-as-thousands blows this up. */
  if (maxPxIfThousands > 2_000_000) return "dollars";
  return dollarsVotes > thousandsVotes ? "dollars" : "thousands";
}

function rawInfoRowsFromXml(xml: string): RawInfoTableRow[] {
  const out: RawInfoTableRow[] = [];
  const re = /<(?:[\w.-]+:)?infoTable[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?infoTable>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1] ?? "";
    const issuer = extractTagContent(block, "nameOfIssuer");
    const title = extractTagContent(block, "titleOfClass");
    const valueStr = extractTagContent(block, "value");
    const cusipRaw = extractTagContent(block, "cusip");
    if (!issuer || !valueStr) continue;
    const rawValue = Number.parseInt(valueStr.replace(/,/g, ""), 10);
    if (!Number.isFinite(rawValue) || rawValue < 0) continue;
    const cusip = cusipRaw?.trim() || null;
    const shares = extractSharesFromInfoTableBlock(block);
    out.push({ issuer, title: title || null, rawValue, cusip, shares });
  }
  return out;
}

function parseInfoTableRows(xml: string): ParsedInfoRow[] {
  const rawRows = rawInfoRowsFromXml(xml);
  const unit = inferSec13fValueFieldUnit(rawRows);
  return rawRows.map((r) => {
    const valueThousands =
      unit === "dollars" ? Math.round(r.rawValue / 1000) : normalizeSec13fValueThousands(r.rawValue);
    return {
      issuer: r.issuer,
      title: r.title,
      valueThousands,
      cusip: r.cusip,
      shares: r.shares,
    };
  });
}

type AggregatedHolding = {
  issuer: string;
  title: string | null;
  valueThousands: number;
  /** Normalized 9-char CUSIP when present; else null (match key uses `ISS:` prefix internally). */
  cusip: string | null;
  shares: number | null;
};

function aggregateKeyFromParsed(r: ParsedInfoRow): string {
  return r.cusip && r.cusip.length >= 6 ? r.cusip.toUpperCase() : `ISS:${r.issuer.toUpperCase()}`;
}

/** SEC 13F often lists multiple infoTable rows per issuer (voting / manager splits); consolidate like public summaries. */
function aggregateInfoRowsByCusip(rows: ParsedInfoRow[]): AggregatedHolding[] {
  const map = new Map<string, AggregatedHolding>();
  for (const r of rows) {
    const key = aggregateKeyFromParsed(r);
    const prev = map.get(key);
    const cusipNorm = r.cusip && r.cusip.length >= 6 ? r.cusip.toUpperCase() : null;
    if (!prev) {
      map.set(key, {
        issuer: r.issuer,
        title: r.title,
        valueThousands: r.valueThousands,
        cusip: cusipNorm,
        shares: r.shares,
      });
    } else {
      prev.valueThousands += r.valueThousands;
      if (r.shares != null) {
        prev.shares = (prev.shares ?? 0) + r.shares;
      }
    }
  }
  return [...map.values()];
}

function tickerForCusip(cusip: string | null): string | null {
  if (!cusip || cusip.length < 6) return null;
  const k = cusip.toUpperCase();
  return KNOWN_CUSIP_TICKER[k] ?? null;
}

/** Normalized issuer string for fallback lookup (fixtures omit CUSIPs; SEC wording varies). */
function normalizeIssuerTickerLookupKey(issuer: string): string {
  return issuer
    .trim()
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Known issuer → ticker when CUSIP is missing or not in {@link KNOWN_CUSIP_TICKER}.
 * Keys must match {@link normalizeIssuerTickerLookupKey}.
 */
const KNOWN_ISSUER_TICKER: Record<string, string> = {
  "apple inc": "AAPL",
  "american express co": "AXP",
  "american express company": "AXP",
  "the american express co": "AXP",
  "the american express company": "AXP",
  "bank of america corp": "BAC",
  "bank america corp": "BAC",
  "bank america co": "BAC",
  "coca cola co": "KO",
  "chevron corp": "CVX",
  "chevron corp new": "CVX",
  "moodys corp": "MCO",
  "occidental pete corp": "OXY",
  "occidental petroleum corp": "OXY",
  "chubb limited": "CB",
  "chubb ltd": "CB",
  "kraft heinz co": "KHC",
  "alphabet inc": "GOOGL",
  "davita inc": "DVA",
  "davita healthcare inc": "DVA",
  "davita healthcare partners inc": "DVA",
  "kroger co": "KR",
  "the kroger co": "KR",
  "the kroger company": "KR",
  "kroger company": "KR",
  "visa inc": "V",
  "siriusxm holdings inc": "SIRI",
  "mastercard inc": "MA",
  "verisign inc": "VRSN",
  "berkshire hathaway inc": "BRK.B",
  "berkshire hathaway inc del": "BRK.B",
  "berkshire hathaway inc delaware": "BRK.B",
  "constellation brands inc": "STZ",
  "capital one financial corp": "COF",
  "unitedhealth group inc": "UNH",
  "dominos pizza inc": "DPZ",
  "ally financial inc": "ALLY",
  "aon plc": "AON",
  "nucor corp": "NUE",
  "liberty media corp series c live": "FWONA",
  "lennar corp": "LEN",
  "pool corp": "POOL",
  "amazoncom inc": "AMZN",
  "amazon com inc": "AMZN",
  "louisiana-pacific corp": "LPX",
  "liberty media corp series a live": "FWONK",
  "new york times co cl a": "NYT",
  "heico corp cl a": "HEI/A",
  "liberty media corp formula one series c": "FWONA",
  "charter communications inc": "CHTR",
  "lamar advertising co": "LAMR",
  "allegion plc": "ALLE",
  "nvr inc": "NVR",
  "diageo plc adr": "DEO",
  "jefferies financial group inc": "JEF",
  "lennar corp cl b": "LEN.B",
  "liberty lilac group a": "LILAK",
  "liberty lilac group c": "LILAK",
  "atlanta braves holdings inc series c": "BATRK",
  "nu holdings ltd": "NU",
  "nu holdings ltd cl a": "NU",
  "capital one finl corp": "COF",
  "capital one finl corp com": "COF",
  /** Pershing Square — SEC `nameOfIssuer` variants (CUSIP map is primary). */
  "meta platforms inc": "META",
  "hilton worldwide hldgs inc": "HLT",
  "uber technologies inc": "UBER",
  "restaurant brands intl inc": "QSR",
  "howard hughes holdings inc": "HHH",
  "brookfield corp": "BN",
  "hertz global hldgs inc": "HTZ",
  "seaport entmt group inc": "SEG",
  /** Fundsmith LLP — SEC `nameOfIssuer` abbreviations (CUSIP map is primary). */
  "adma biologics inc": "ADMA",
  "automatic data processing in": "ADP",
  "catalyst pharmaceuticals inc": "CPRX",
  "church and dwight co inc": "CHD",
  "clorox co del": "CLX",
  "doximity inc": "DOCS",
  "fortinet inc": "FTNT",
  "graco inc": "GGG",
  "home depot inc": "HD",
  "idexx labs inc": "IDXX",
  intuit: "INTU",
  "manhattan associates inc": "MANH",
  "marriott intl inc new": "MAR",
  "medpace hldgs inc": "MEDP",
  "mettler toledo international": "MTD",
  "microsoft corp": "MSFT",
  "msci inc": "MSCI",
  "napco sec technologies inc": "NSSC",
  "nike inc": "NKE",
  "nutanix inc": "NTNX",
  "oddity tech ltd": "ODD",
  "otis worldwide corp": "OTIS",
  "paycom software inc": "PAYC",
  "philip morris intl inc": "PM",
  "procter and gamble co": "PG",
  "qualys inc": "QLYS",
  "rollins inc": "ROL",
  "sabre corp": "SABR",
  "stryker corporation": "SYK",
  "texas instrs inc": "TXN",
  "vertiv holdings co": "VRT",
  "waters corp": "WAT",
  "zoetis inc": "ZTS",
};

function issuerBaseForTickerLookup(issuer: string): string {
  return issuer.trim().replace(/\s+new\s*$/i, "").trim();
}

function normalizeTitleTickerHints(title: string | null): string {
  if (!title?.trim()) return "";
  return title
    .trim()
    .toUpperCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");
}

/** Liberty Live Group tickers from `titleOfClass` when CUSIP is absent or shared. */
function tickerFromLibertyLiveTitle(issuer: string, titleOfClass: string | null): string | null {
  const i = normalizeIssuerTickerLookupKey(issuer);
  if (!/\bliberty live\b/.test(i)) return null;
  const t = normalizeTitleTickerHints(titleOfClass);
  if (/\bSERIES\s*C\b|\bSER\s*C\b|\bLLYVK\b/.test(t)) return "LLYVK";
  if (/\bSERIES\s*B\b|\bLLYVB\b/.test(t)) return "LLYVB";
  if (/\bSERIES\s*A\b|\bSER\s*A\b|\bLLYVA\b/.test(t)) return "LLYVA";
  return "LLYVA";
}

function tickerFromLennarTitle(issuer: string, titleOfClass: string | null): string | null {
  const i = normalizeIssuerTickerLookupKey(issuer);
  if (!/\blennar\b/.test(i)) return null;
  const t = normalizeTitleTickerHints(titleOfClass);
  if (/\bCL\s*B\b|\bCLASS\s*B\b/.test(t)) return "LEN.B";
  return "LEN";
}

/**
 * Last-resort match when CUSIP is unknown and the exact normalized issuer string is not in the map.
 * Keeps patterns narrow to avoid false positives outside Berkshire-style names.
 */
function tickerFromIssuerHeuristic(issuer: string, titleOfClass: string | null): string | null {
  const n = normalizeIssuerTickerLookupKey(issuer);
  if (!n) return null;
  const lib = tickerFromLibertyLiveTitle(issuer, titleOfClass);
  if (lib) return lib;
  const len = tickerFromLennarTitle(issuer, titleOfClass);
  if (len) return len;
  if (/\bamerican\s+express\b/.test(n)) return "AXP";
  if (/\bbank\s+of\s+america\b/.test(n) || /\bbank\s+america\b/.test(n)) return "BAC";
  if (/\bcoca[\s-]*cola\b/.test(n)) return "KO";
  if (/\bchevron\b/.test(n)) return "CVX";
  if (/\bmoody/.test(n)) return "MCO";
  if (/\boccidental\b/.test(n)) return "OXY";
  if (/\bkraft\s+heinz\b/.test(n)) return "KHC";
  if (/\balphabet\b/.test(n)) return "GOOGL";
  if (/\bvisa\b/.test(n)) return "V";
  if (/\bmastercard\b/.test(n)) return "MA";
  if (/\bverisign\b/.test(n)) return "VRSN";
  if (/\bconstellation\s+brands\b/.test(n)) return "STZ";
  if (/\bcapital\s+one\b/.test(n)) return "COF";
  if (/\bunitedhealth\b/.test(n)) return "UNH";
  if (/\bdomino/.test(n)) return "DPZ";
  if (/\bnucor\b/.test(n)) return "NUE";
  if (/\bpool\s+(corp|corporation)\b/.test(n)) return "POOL";
  if (/\blouisiana[\s-]*pacific\b/.test(n)) return "LPX";
  if (/\bnew\s+york\s+times\b/.test(n)) return "NYT";
  if (/\bheico\b/.test(n)) return "HEI/A";
  if (/\bcharter\s+communications\b/.test(n)) return "CHTR";
  if (/\blamar\b/.test(n)) return "LAMR";
  if (/\ballegion\b/.test(n)) return "ALLE";
  if (/\bnvr\b/.test(n)) return "NVR";
  if (/\bdiageo\b/.test(n)) return "DEO";
  if (/\bjefferies\b/.test(n)) return "JEF";
  if (/\bliberty\s+lilac\b/.test(n)) return "LILAK";
  if (/\bnu\s+holdings\b/.test(n)) return "NU";
  if (/\batlanta\s+braves\s+holdings\b/.test(n)) return "BATRK";
  if (/\bkroger\b/.test(n)) return "KR";
  if (/\bdavita\b/.test(n)) return "DVA";
  if (/\bmeta\s+platforms\b/.test(n)) return "META";
  if (/\bhilton\s+worldwide\b/.test(n)) return "HLT";
  if (/\bhertz\b/.test(n)) return "HTZ";
  if (/\bhoward\s+hughes\s+holdings\b/.test(n)) return "HHH";
  if (/\brestaurant\s+brands\b/.test(n)) return "QSR";
  if (/\buber\s+technologies\b/.test(n)) return "UBER";
  if (/\bseaport\b/.test(n)) return "SEG";
  if (/\bbrookfield\s+corp\b/.test(n)) return "BN";
  if (/\badma\b/.test(n)) return "ADMA";
  if (/\bautomatic\s+data\s+processing\b/.test(n)) return "ADP";
  if (/\bdoximity\b/.test(n)) return "DOCS";
  if (/\bfortinet\b/.test(n)) return "FTNT";
  if (/\bgraco\b/.test(n) && /\binc\b/.test(n)) return "GGG";
  if (/\bhome\s+depot\b/.test(n)) return "HD";
  if (/\bidexx\b/.test(n)) return "IDXX";
  if (/\bmanhattan\s+associates\b/.test(n)) return "MANH";
  if (/\bmedpace\b/.test(n)) return "MEDP";
  if (/\bmettler[\s-]*toledo\b/.test(n)) return "MTD";
  if (/\bmicrosoft\b/.test(n)) return "MSFT";
  if (/\bmsci\s+inc\b/.test(n)) return "MSCI";
  if (/\bnapco\b/.test(n)) return "NSSC";
  if (/\bnutanix\b/.test(n)) return "NTNX";
  if (/\boddity\b/.test(n)) return "ODD";
  if (/\botis\s+worldwide\b/.test(n)) return "OTIS";
  if (/\bpaycom\b/.test(n)) return "PAYC";
  if (/\bphilip\s+morris\b/.test(n)) return "PM";
  if (/\bprocter\b/.test(n) && /\bgamble\b/.test(n)) return "PG";
  if (/\bqualys\b/.test(n)) return "QLYS";
  if (/\brollins\b/.test(n)) return "ROL";
  if (/\bsabre\b/.test(n)) return "SABR";
  if (/\bstryker\b/.test(n)) return "SYK";
  if (/\btexas\s+instr/.test(n)) return "TXN";
  if (/\bvertiv\b/.test(n)) return "VRT";
  if (/\bwaters\b/.test(n) && /\bcorp\b/.test(n)) return "WAT";
  if (/\bzoetis\b/.test(n)) return "ZTS";
  if (/\bcatalyst\s+pharmaceuticals\b/.test(n)) return "CPRX";
  if (/\bchurch\s+and\s+dwight\b/.test(n)) return "CHD";
  if (/\bclorox\b/.test(n)) return "CLX";
  if (/\bliberty\s+media\b/.test(n) && /\bformula\s+one\b/.test(n)) return "FWONA";
  if (/\bliberty\s+media\b/.test(n) && /\bseries\s+c\s+live\b/.test(n)) return "FWONA";
  if (/\bliberty\s+media\b/.test(n) && /\bseries\s+a\s+live\b/.test(n)) return "FWONK";
  return null;
}

function tickerFor13fRow(cusip: string | null, issuer: string, titleOfClass: string | null = null): string | null {
  const fromCusip = tickerForCusip(cusip);
  if (fromCusip) return fromCusip;
  const lib = tickerFromLibertyLiveTitle(issuer, titleOfClass);
  if (lib) return lib;
  const len = tickerFromLennarTitle(issuer, titleOfClass);
  if (len) return len;
  const k = normalizeIssuerTickerLookupKey(issuer);
  const fromMap = KNOWN_ISSUER_TICKER[k];
  if (fromMap) return fromMap;
  const k2 = normalizeIssuerTickerLookupKey(issuerBaseForTickerLookup(issuer));
  const fromMap2 = k2 !== k ? KNOWN_ISSUER_TICKER[k2] : null;
  if (fromMap2) return fromMap2;
  return tickerFromIssuerHeuristic(issuer, titleOfClass) ?? tickerFromIssuerHeuristic(issuerBaseForTickerLookup(issuer), titleOfClass);
}

/**
 * SEC filing objects live under `edgar/data/{cik}/{accessionNoDash}/`. Usually `cik` is the filer's
 * submissions CIK, but some filers (e.g. Fundsmith LLP) occasionally publish under the CIK encoded
 * in the first 10 digits of the accession number — try filer first, then that prefix when they differ.
 */
function edgarArchiveCikCandidates(filerCikPadded: string, accessionDashed: string): string[] {
  const filer = String(Number.parseInt(filerCikPadded, 10));
  const accNoDash = accessionDashed.replace(/-/g, "");
  const head =
    accNoDash.length >= 10 ? String(Number.parseInt(accNoDash.slice(0, 10), 10)) : filer;
  if (head === filer) return [filer];
  return [filer, head];
}

async function tryFindInfotableXmlUrlForArchiveCik(
  cikNumeric: string,
  accessionDashed: string,
  ua: string,
): Promise<string | null> {
  const acc = accessionDashed.replace(/-/g, "");
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNumeric}/${acc}`;
  const headers: HeadersInit = { "User-Agent": ua, "Accept-Encoding": "gzip, deflate" };

  for (const name of ["infotable.xml", "Infotable.xml"]) {
    const url = `${base}/${name}`;
    const r = await secFetch(url, { headers, cache: "no-store" });
    if (r.ok) return url;
  }

  const jRes = await secFetch(`${base}/index.json`, { headers, cache: "no-store" });
  if (jRes.ok) {
    try {
      const data = (await jRes.json()) as {
        directory?: { item?: { name?: string; size?: string } | { name?: string; size?: string }[] };
      };
      const raw = data.directory?.item;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

      for (const it of list) {
        const n = (it.name ?? "").toLowerCase();
        if (n.endsWith(".xml") && n.includes("infotable")) {
          const url = `${base}/${it.name}`;
          const r = await secFetch(url, { headers, cache: "no-store" });
          if (r.ok) return url;
        }
      }

      const xmlCandidates = list
        .filter((it) => {
          const n = (it.name ?? "").toLowerCase();
          return n.endsWith(".xml") && n !== "primary_doc.xml" && !n.includes("index-headers");
        })
        .sort((a, b) => {
          const sa = Number.parseInt(String(b.size ?? "0"), 10) || 0;
          const sb = Number.parseInt(String(a.size ?? "0"), 10) || 0;
          return sa - sb;
        });

      for (const it of xmlCandidates) {
        const url = `${base}/${it.name}`;
        const r = await secFetch(url, { headers, cache: "no-store" });
        if (!r.ok) continue;
        const text = await r.text();
        if (/<(?:[\w.-]+:)?infoTable\b/i.test(text)) {
          return url;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const hRes = await secFetch(`${base}/index.htm`, { headers, cache: "no-store" });
  if (hRes.ok) {
    const html = await hRes.text();
    const hrefMatch = html.match(/href="([^"]*infotable\.xml[^"]*)"/i);
    if (hrefMatch?.[1]) {
      const tail = hrefMatch[1]!.replace(/^.*\//, "");
      const url = `${base}/${tail}`;
      const r = await secFetch(url, { headers, cache: "no-store" });
      if (r.ok) return url;
    }
  }

  return null;
}

async function findInfotableXmlUrl(
  accessionDashed: string,
  ua: string,
  filerCikPadded: string,
): Promise<string | null> {
  for (const cikNumeric of edgarArchiveCikCandidates(filerCikPadded, accessionDashed)) {
    const url = await tryFindInfotableXmlUrlForArchiveCik(cikNumeric, accessionDashed, ua);
    if (url) return url;
  }
  return null;
}

async function fetchNth13fInfotableXml(
  cikPadded: string,
  ua: string,
  ordinal: number,
): Promise<{
  xml: string;
  accession: string;
  filingDate: string | null;
  reportDate: string | null;
  filerName: string;
} | null> {
  const index = await get13fFilingIndexCached(cikPadded, ua);
  const ref = index.refs[ordinal];
  if (!ref) return null;

  const filerName = index.filerName;
  const infotableUrl = await findInfotableXmlUrl(ref.accession, ua, cikPadded);
  if (!infotableUrl) return null;

  const xmlRes = await secFetch(infotableUrl, {
    headers: { "User-Agent": ua, Accept: "application/xml,text/xml,*/*" },
    cache: "no-store",
  });
  if (!xmlRes.ok) return null;
  const xml = await xmlRes.text();
  return {
    xml,
    accession: ref.accession,
    filingDate: ref.filingDate,
    reportDate: ref.reportDate,
    filerName,
  };
}

async function fetchHoldSinceReportDateUncached(match: SuperinvestorHoldSinceMatch): Promise<string | null> {
  const cikPadded = cikPad10(match.cik);
  if (!cikPadded) return null;
  const ua = getSecEdgarUserAgent();

  const cusipNeedle = match.cusip?.trim() ? match.cusip.trim().toUpperCase() : null;
  const issuerNeedle = normalizeIssuerName(match.issuer);
  const titleNeedle = (match.titleOfClass ?? "").trim().toLowerCase();

  let oldest: string | null = null;
  let consecutiveMisses = 0;
  const MAX_ORDINAL = 24; // ~6 years of quarterlies

  for (let ordinal = 0; ordinal < MAX_ORDINAL; ordinal++) {
    const got = await fetchNth13fInfotableXml(cikPadded, ua, ordinal);
    if (!got) break;

    const parsed = parseInfoTableRows(got.xml);
    let found = false;

    if (cusipNeedle) {
      found = parsed.some((r) => (r.cusip ?? "").trim().toUpperCase() === cusipNeedle);
    } else if (issuerNeedle) {
      found = parsed.some((r) => {
        const issuer = normalizeIssuerName(r.issuer);
        if (!issuer) return false;
        if (issuer !== issuerNeedle && !issuer.includes(issuerNeedle) && !issuerNeedle.includes(issuer)) return false;
        if (!titleNeedle) return true;
        const t = (r.title ?? "").trim().toLowerCase();
        return t === titleNeedle || t.includes(titleNeedle) || titleNeedle.includes(t);
      });
    }

    if (found) {
      consecutiveMisses = 0;
      if (got.reportDate?.trim()) oldest = got.reportDate.trim();
    } else if (oldest) {
      consecutiveMisses++;
      if (consecutiveMisses >= 3) break;
    }
  }

  return oldest;
}

/**
 * Oldest 13F report date where a holding appears ("Hold since").
 * Cached across users; updates quarterly so a daily cache is fine.
 */
export async function getSuperinvestorHoldSinceReportDate(match: SuperinvestorHoldSinceMatch): Promise<string | null> {
  const cik = cikPad10(match.cik);
  const key = `${cik}|${(match.cusip ?? "").trim().toUpperCase()}|${normalizeIssuerName(match.issuer)}|${(match.titleOfClass ?? "")
    .trim()
    .toLowerCase()}`;
  return unstable_cache(
    () => fetchHoldSinceReportDateUncached(match),
    ["superinvestor-hold-since-v1", key],
    { revalidate: REVALIDATE_SEC_13F_DAY },
  )();
}

function aggregateKey(h: AggregatedHolding): string {
  return h.cusip && h.cusip.length >= 6 ? h.cusip.toUpperCase() : `ISS:${h.issuer.toUpperCase()}`;
}

function holdingKeys(holdings: readonly AggregatedHolding[]): Set<string> {
  return new Set(holdings.map(aggregateKey));
}

/** Position missing in one quarterly filing but present in adjacent quarters (parse/amendment gap). */
function isTransient13fFilingGap(deduped: readonly FilingSnapshot[], pairIndex: number, key: string): boolean {
  const newer = deduped[pairIndex];
  const older = deduped[pairIndex + 1];
  if (!newer || !older) return false;

  const inNewer = holdingKeys(newer.holdings).has(key);
  const inOlder = holdingKeys(older.holdings).has(key);
  if (inNewer === inOlder) return false;

  if (inNewer && !inOlder) {
    const twoQuartersBack = deduped[pairIndex + 2];
    return twoQuartersBack != null && holdingKeys(twoQuartersBack.holdings).has(key);
  }

  const oneQuarterNewer = deduped[pairIndex - 1];
  return pairIndex > 0 && oneQuarterNewer != null && holdingKeys(oneQuarterNewer.holdings).has(key);
}

function aggregateKeyFromSoldOutRow(row: Pick<Berkshire13fSoldOutRow, "cusip" | "companyName">): string {
  const cusip = row.cusip?.trim();
  return cusip && cusip.length >= 6 ? cusip.toUpperCase() : `ISS:${row.companyName.toUpperCase()}`;
}

function aggregateKeyFromComparisonRow(row: Pick<Berkshire13fComparisonRow, "cusip" | "companyName">): string {
  const cusip = row.cusip?.trim();
  return cusip && cusip.length >= 6 ? cusip.toUpperCase() : `ISS:${row.companyName.toUpperCase()}`;
}

function compareStatus(
  curShares: number | null,
  prevShares: number | null,
  curValueUsd: number,
  prevValueUsd: number,
): Holding13fComparisonStatus {
  if (prevShares == null && curShares == null) {
    if (curValueUsd > prevValueUsd) return "add";
    if (curValueUsd < prevValueUsd) return "reduce";
    return "unchanged";
  }
  if (prevShares == null && curShares != null) return "add";
  if (prevShares != null && curShares == null) {
    if (curValueUsd > prevValueUsd) return "add";
    if (curValueUsd < prevValueUsd) return "reduce";
    return "unchanged";
  }
  if (prevShares != null && curShares != null) {
    const d = curShares - prevShares;
    if (d > 0) return "add";
    if (d < 0) return "reduce";
    return "unchanged";
  }
  if (prevShares != null && curShares == null) {
    return curValueUsd > prevValueUsd ? "add" : curValueUsd < prevValueUsd ? "reduce" : "unchanged";
  }
  return "unchanged";
}

function sharesChangePctFromPrior(
  curShares: number | null,
  prevShares: number | null,
  hadPriorRow: boolean,
): number | null {
  if (!hadPriorRow || curShares == null || prevShares == null) return null;
  if (prevShares === 0 && curShares === 0) return 0;
  if (prevShares === 0) return null;
  return ((curShares - prevShares) / prevShares) * 100;
}

function buildComparisonRows(
  current: AggregatedHolding[],
  previous: AggregatedHolding[] | null,
): { rows: Berkshire13fComparisonRow[]; soldOut: Berkshire13fSoldOutRow[]; previousTotalUsd: number | null } {
  const prevMap = new Map<string, AggregatedHolding>();
  let previousTotalUsd: number | null = null;
  if (previous?.length) {
    let pt = 0;
    for (const p of previous) {
      prevMap.set(aggregateKey(p), p);
      pt += p.valueThousands * 1000;
    }
    previousTotalUsd = pt;
  }

  const hasPrior = previous != null && previous.length > 0;
  const curTotal = current.reduce((s, c) => s + c.valueThousands * 1000, 0);

  const rows: Berkshire13fComparisonRow[] = [];
  for (const c of current) {
    const key = aggregateKey(c);
    const p = prevMap.get(key) ?? null;
    const curValueUsd = c.valueThousands * 1000;
    const prevValueUsd = p ? p.valueThousands * 1000 : 0;
    const prevShares = p?.shares ?? null;
    const curShares = c.shares ?? null;
    const hadPriorRow = hasPrior && p != null;
    let sharesDelta: number | null = null;
    if (hasPrior && curShares != null) {
      if (p == null) {
        // New 13F line: entire current position is the buy.
        sharesDelta = curShares;
      } else if (prevShares != null) {
        sharesDelta = curShares - prevShares;
      }
    }
    let sharesChangePct = sharesChangePctFromPrior(curShares, prevShares, hadPriorRow);
    if (hasPrior && p == null && curShares != null && curShares > 0) {
      sharesChangePct = null;
    }

    let status: Holding13fComparisonStatus | null;
    if (!hasPrior) status = null;
    else if (p == null) status = "new";
    else status = compareStatus(curShares, prevShares, curValueUsd, prevValueUsd);

    rows.push({
      companyName: c.issuer,
      cusip: c.cusip,
      ticker: tickerFor13fRow(c.cusip, c.issuer, c.title),
      shares: curShares,
      valueUsd: curValueUsd,
      weight: curTotal > 0 ? (curValueUsd / curTotal) * 100 : 0,
      previousShares: hasPrior ? (p?.shares ?? null) : null,
      sharesDelta,
      sharesChangePct,
      status,
    });
  }

  rows.sort((a, b) => b.valueUsd - a.valueUsd);

  const soldOut: Berkshire13fSoldOutRow[] = [];
  if (hasPrior && previous) {
    const curKeys = new Set(current.map((c) => aggregateKey(c)));
    for (const p of previous) {
      const k = aggregateKey(p);
      if (curKeys.has(k)) continue;
      soldOut.push({
        companyName: p.issuer,
        cusip: p.cusip,
        ticker: tickerFor13fRow(p.cusip, p.issuer, p.title),
        previousShares: p.shares ?? null,
        previousValueUsd: p.valueThousands * 1000,
      });
    }
    soldOut.sort((a, b) => b.previousValueUsd - a.previousValueUsd);
  }

  return { rows, soldOut, previousTotalUsd };
}

/** Default profile + holdings tab: ~5 years, one lightweight SEC pass. */
export const SUPERINVESTOR_TRANSACTIONS_STANDARD_QUARTER_PAIRS = 20;

/** Match deep history when user searches a company (e.g. BAC since Q2 2007). */
const SUPERINVESTOR_TRANSACTIONS_HISTORY_START_YEAR = 2007;

/** Hard cap (~21 years) to bound SEC load per filer; still cached for 6h. */
const SUPERINVESTOR_TRANSACTIONS_MAX_QUARTER_PAIRS = 84;

function superinvestorTransactionsQuarterPairsLimit(): number {
  const endYear = new Date().getFullYear();
  const pairs = (endYear - SUPERINVESTOR_TRANSACTIONS_HISTORY_START_YEAR + 1) * 4;
  return Math.min(SUPERINVESTOR_TRANSACTIONS_MAX_QUARTER_PAIRS, Math.max(4, pairs));
}

function superinvestorStandardFilingCount(): number {
  return SUPERINVESTOR_TRANSACTIONS_STANDARD_QUARTER_PAIRS + 1;
}

function superinvestorTransactionsFilingCount(): number {
  return superinvestorTransactionsQuarterPairsLimit() + 1;
}

function quarterLabelFromReportDate(reportDate: string | null): string {
  if (!reportDate?.trim()) return "—";
  const d = parseISO(reportDate.trim());
  if (!isValid(d)) return reportDate.trim();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function impliedSharePriceUsd(valueUsd: number, shares: number | null): number | null {
  if (shares == null || shares <= 0 || !Number.isFinite(valueUsd) || valueUsd <= 0) return null;
  const px = valueUsd / shares;
  return Number.isFinite(px) && px > 0 ? px : null;
}

function transactionPriceStats(
  curValueUsd: number,
  curShares: number | null,
  prevValueUsd: number | null,
  prevShares: number | null,
  sharesDelta: number | null,
): { avg: number | null; low: number | null; high: number | null } {
  const curPx = impliedSharePriceUsd(curValueUsd, curShares);
  const prevPx =
    prevValueUsd != null && prevShares != null ? impliedSharePriceUsd(prevValueUsd, prevShares) : null;

  let avg: number | null = null;
  if (sharesDelta != null && sharesDelta !== 0 && prevValueUsd != null) {
    const valueDelta = curValueUsd - prevValueUsd;
    const tradeAvg = Math.abs(valueDelta / sharesDelta);
    if (Number.isFinite(tradeAvg) && tradeAvg > 0) avg = tradeAvg;
  }
  if (avg == null) avg = curPx ?? prevPx;

  const prices = [curPx, prevPx, avg].filter((p): p is number => p != null && Number.isFinite(p) && p > 0);
  if (prices.length === 0) return { avg: null, low: null, high: null };
  return { avg, low: Math.min(...prices), high: Math.max(...prices) };
}

function kindFromComparisonStatus(status: Holding13fComparisonStatus | null): SuperinvestorQuarterlyTransactionKind | null {
  if (status === "add") return "buy";
  if (status === "reduce") return "sell";
  if (status === "new") return "new";
  return null;
}

function previousPortfolioWeightPct(
  row: Berkshire13fComparisonRow,
  previousTotalUsd: number | null,
): number {
  if (!previousTotalUsd || previousTotalUsd <= 0) return 0;
  if (row.previousShares == null) return 0;
  const curShares = row.shares;
  if (curShares != null && curShares > 0) {
    const prevValueUsd = (row.valueUsd / curShares) * row.previousShares;
    return (prevValueUsd / previousTotalUsd) * 100;
  }
  return 0;
}

function portfolioWeightChangeFromRow(
  row: Berkshire13fComparisonRow,
  previousTotalUsd: number | null,
): number | null {
  return row.weight - previousPortfolioWeightPct(row, previousTotalUsd);
}

function portfolioWeightChangeFromSoldOut(
  row: Berkshire13fSoldOutRow,
  previousTotalUsd: number | null,
): number | null {
  if (!previousTotalUsd || previousTotalUsd <= 0) return null;
  const prevWeight = (row.previousValueUsd / previousTotalUsd) * 100;
  return -prevWeight;
}

function comparisonRowToTransaction(
  row: Berkshire13fComparisonRow,
  quarterLabel: string,
  reportDate: string,
  previousTotalUsd: number | null,
): SuperinvestorQuarterlyTransaction | null {
  const kind = kindFromComparisonStatus(row.status);
  if (!kind) return null;
  if (row.sharesChangePct == null && row.sharesDelta == null && kind !== "new") return null;
  if (row.sharesChangePct === 0 && (row.sharesDelta == null || row.sharesDelta === 0)) return null;

  const prevValueUsd =
    row.previousShares != null && row.shares != null && row.previousShares > 0
      ? (row.valueUsd / (row.shares ?? 1)) * row.previousShares
      : null;
  const { avg, low, high } = transactionPriceStats(
    row.valueUsd,
    row.shares,
    prevValueUsd,
    row.previousShares,
    row.sharesDelta,
  );

  return {
    kind,
    companyName: row.companyName,
    ticker: row.ticker,
    cusip: row.cusip,
    quarterLabel,
    reportDate,
    sharesChangePct: row.sharesChangePct,
    sharesDelta: row.sharesDelta,
    avgClosingPriceUsd: avg,
    priceRangeLowUsd: low,
    priceRangeHighUsd: high,
    portfolioWeightChangePct: portfolioWeightChangeFromRow(row, previousTotalUsd),
  };
}

function soldOutRowToTransaction(
  row: Berkshire13fSoldOutRow,
  quarterLabel: string,
  reportDate: string,
  previousTotalUsd: number | null,
): SuperinvestorQuarterlyTransaction {
  const prevValueUsd = row.previousValueUsd;
  const prevShares = row.previousShares;
  const sharesDelta = prevShares != null ? -prevShares : null;
  const { avg, low, high } = transactionPriceStats(0, null, prevValueUsd, prevShares, sharesDelta);

  return {
    kind: "exit",
    companyName: row.companyName,
    ticker: row.ticker,
    cusip: row.cusip,
    quarterLabel,
    reportDate,
    sharesChangePct: prevShares != null && prevShares > 0 ? -100 : null,
    sharesDelta,
    avgClosingPriceUsd: avg,
    priceRangeLowUsd: low,
    priceRangeHighUsd: high,
    portfolioWeightChangePct: portfolioWeightChangeFromSoldOut(row, previousTotalUsd),
  };
}

type FilingSnapshot = {
  reportDate: string | null;
  filingDate: string | null;
  accession: string | null;
  holdings: AggregatedHolding[];
};

/** SEC may list multiple 13F-HR/A rows for the same report period; keep the newest filing only. */
function dedupeFilingSnapshotsByReportDate(snapshots: FilingSnapshot[]): FilingSnapshot[] {
  const seen = new Set<string>();
  const out: FilingSnapshot[] = [];
  for (const s of snapshots) {
    const rd = s.reportDate?.trim();
    if (!rd) {
      out.push(s);
      continue;
    }
    if (seen.has(rd)) continue;
    seen.add(rd);
    out.push(s);
  }
  return out;
}

function buildQuarterGroupsFromFilingSnapshots(
  snapshots: FilingSnapshot[],
  maxQuarterPairs = superinvestorTransactionsQuarterPairsLimit(),
): SuperinvestorQuarterTransactionGroup[] {
  const deduped = dedupeFilingSnapshotsByReportDate(snapshots);
  const groups: SuperinvestorQuarterTransactionGroup[] = [];
  const seenGroupKeys = new Set<string>();

  for (let i = 0; i < deduped.length - 1 && groups.length < maxQuarterPairs; i++) {
    const newer = deduped[i]!;
    const older = deduped[i + 1]!;
    const newerReport = newer.reportDate?.trim() ?? "";
    const olderReport = older.reportDate?.trim() ?? "";
    if (newerReport && olderReport && newerReport === olderReport) continue;

    const reportDate = newerReport || olderReport;
    if (!reportDate) continue;

    const quarterLabel = quarterLabelFromReportDate(reportDate);
    const { rows, soldOut, previousTotalUsd } = buildComparisonRows(newer.holdings, older.holdings);

    const transactions: SuperinvestorQuarterlyTransaction[] = [];
    for (const row of rows) {
      if (row.status === "new" && isTransient13fFilingGap(deduped, i, aggregateKeyFromComparisonRow(row))) {
        continue;
      }
      const tx = comparisonRowToTransaction(row, quarterLabel, reportDate, previousTotalUsd);
      if (tx) transactions.push(tx);
    }
    for (const row of soldOut) {
      if (isTransient13fFilingGap(deduped, i, aggregateKeyFromSoldOutRow(row))) continue;
      transactions.push(soldOutRowToTransaction(row, quarterLabel, reportDate, previousTotalUsd));
    }

    if (transactions.length === 0) continue;

    transactions.sort((a, b) => {
      const ad = Math.abs(a.sharesDelta ?? 0);
      const bd = Math.abs(b.sharesDelta ?? 0);
      return bd - ad;
    });

    const group: SuperinvestorQuarterTransactionGroup = {
      quarterLabel,
      reportDate,
      filingDate: newer.filingDate,
      transactions,
    };
    const key = `${group.reportDate}|${group.filingDate ?? ""}`;
    if (seenGroupKeys.has(key)) continue;
    seenGroupKeys.add(key);
    groups.push(group);
  }

  return groups;
}

/** Warren Buffett: emit activity only when share counts change (not value-only or filing gaps). */
function berkshireComparisonRowQualifiesForTransaction(
  row: Berkshire13fComparisonRow,
  deduped: readonly FilingSnapshot[],
  pairIndex: number,
): boolean {
  if (isTransient13fFilingGap(deduped, pairIndex, aggregateKeyFromComparisonRow(row))) return false;

  if (row.status === "new") {
    return row.shares != null && row.shares > 0 && row.sharesDelta != null && row.sharesDelta > 0;
  }

  if (row.status !== "add" && row.status !== "reduce") return false;
  if (row.shares == null || row.previousShares == null) return false;
  if (row.sharesDelta == null || row.sharesDelta === 0) return false;
  return true;
}

function berkshireSoldOutQualifiesForTransaction(
  row: Berkshire13fSoldOutRow,
  deduped: readonly FilingSnapshot[],
  pairIndex: number,
): boolean {
  if (isTransient13fFilingGap(deduped, pairIndex, aggregateKeyFromSoldOutRow(row))) return false;
  return row.previousShares != null && row.previousShares > 0;
}

function buildBerkshireQuarterGroupsFromFilingSnapshots(
  snapshots: FilingSnapshot[],
  maxQuarterPairs = superinvestorTransactionsQuarterPairsLimit(),
): SuperinvestorQuarterTransactionGroup[] {
  const deduped = dedupeFilingSnapshotsByReportDate(snapshots);
  const groups: SuperinvestorQuarterTransactionGroup[] = [];
  const seenGroupKeys = new Set<string>();

  for (let i = 0; i < deduped.length - 1 && groups.length < maxQuarterPairs; i++) {
    const newer = deduped[i]!;
    const older = deduped[i + 1]!;
    const newerReport = newer.reportDate?.trim() ?? "";
    const olderReport = older.reportDate?.trim() ?? "";
    if (newerReport && olderReport && newerReport === olderReport) continue;

    const reportDate = newerReport || olderReport;
    if (!reportDate) continue;

    const quarterLabel = quarterLabelFromReportDate(reportDate);
    const { rows, soldOut, previousTotalUsd } = buildComparisonRows(newer.holdings, older.holdings);

    const transactions: SuperinvestorQuarterlyTransaction[] = [];
    for (const row of rows) {
      if (!berkshireComparisonRowQualifiesForTransaction(row, deduped, i)) continue;
      const tx = comparisonRowToTransaction(row, quarterLabel, reportDate, previousTotalUsd);
      if (tx) transactions.push(tx);
    }
    for (const row of soldOut) {
      if (!berkshireSoldOutQualifiesForTransaction(row, deduped, i)) continue;
      transactions.push(soldOutRowToTransaction(row, quarterLabel, reportDate, previousTotalUsd));
    }

    if (transactions.length === 0) continue;

    transactions.sort((a, b) => {
      const ad = Math.abs(a.sharesDelta ?? 0);
      const bd = Math.abs(b.sharesDelta ?? 0);
      return bd - ad;
    });

    const group: SuperinvestorQuarterTransactionGroup = {
      quarterLabel,
      reportDate,
      filingDate: newer.filingDate,
      transactions,
    };
    const key = `${group.reportDate}|${group.filingDate ?? ""}`;
    if (seenGroupKeys.has(key)) continue;
    seenGroupKeys.add(key);
    groups.push(group);
  }

  return groups;
}

function buildBerkshireTransactionsPayloadFromSnapshots(
  meta: { filerDisplayName: string; cik: string; source: "edgar" | "fixture" | "unavailable" },
  snapshots: FilingSnapshot[],
  maxQuarterPairs = superinvestorTransactionsQuarterPairsLimit(),
): SuperinvestorTransactionsPayload {
  return {
    filerDisplayName: meta.filerDisplayName,
    cik: meta.cik,
    quarters: buildBerkshireQuarterGroupsFromFilingSnapshots(snapshots, maxQuarterPairs),
    source: meta.source,
  };
}

function finalizeBerkshireHoldingsTransactions(
  payload: SuperinvestorTransactionsPayload,
  comparison: Berkshire13fComparisonPayload,
): SuperinvestorTransactionsPayload {
  return pruneSpuriousExitReentryTransactions(
    filterSuperinvestorTransactionsToCurrentHoldings(payload, comparison.rows),
  );
}

function unavailableTransactionsPayload(cik: string, filerDisplayName: string): SuperinvestorTransactionsPayload {
  return { filerDisplayName, cik, quarters: [], source: "unavailable" };
}

function syntheticFixtureFilingSnapshots(
  base: AggregatedHolding[],
  endReportDate: string,
  count: number,
): FilingSnapshot[] {
  const end = parseISO(endReportDate);
  const snapshots: FilingSnapshot[] = [];
  let current = base;
  for (let i = 0; i < count; i++) {
    const reportDate = isValid(end) ? subMonths(end, i * 3).toISOString().slice(0, 10) : endReportDate;
    snapshots.push({ reportDate, filingDate: null, accession: null, holdings: current });
    if (i >= count - 1) break;
    current = current.map((r, idx) => {
      const m = syntheticPriorScaleForOffline13fFixtureRow(r.issuer, i * 100 + idx);
      return {
        ...r,
        valueThousands: Math.round(r.valueThousands * m),
        shares: r.shares != null ? Math.max(1, Math.round(r.shares * m)) : null,
      };
    });
  }
  return snapshots;
}

function buildTransactionsPayloadFromSnapshots(
  meta: { filerDisplayName: string; cik: string; source: "edgar" | "fixture" | "unavailable" },
  snapshots: FilingSnapshot[],
  maxQuarterPairs = superinvestorTransactionsQuarterPairsLimit(),
): SuperinvestorTransactionsPayload {
  return {
    filerDisplayName: meta.filerDisplayName,
    cik: meta.cik,
    quarters: buildQuarterGroupsFromFilingSnapshots(snapshots, maxQuarterPairs),
    source: meta.source,
  };
}

export type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";

type Institutional13fSnapshotsResult = {
  filerDisplayName: string;
  snapshots: FilingSnapshot[];
};

type SnapshotsInflightEntry = {
  requestedCount: number;
  promise: Promise<Institutional13fSnapshotsResult | null>;
};

const snapshotsInflight = new Map<string, SnapshotsInflightEntry>();

/** Clear module-level SEC index coalescing (development refresh after new 13F). */
export function clearSuperinvestor13fInMemoryCaches(): void {
  thirteenFIndexCacheByCik.clear();
  snapshotsInflight.clear();
}

async function fetchInstitutional13fSnapshotsUncached(
  cik: string,
  maxFilings: number,
): Promise<Institutional13fSnapshotsResult | null> {
  const ua = getSecEdgarUserAgent();
  try {
    const snapshots: FilingSnapshot[] = [];
    let filerName = "";
    const limit = Math.max(1, Math.min(maxFilings, superinvestorTransactionsFilingCount()));
    for (let ordinal = 0; ordinal < limit; ordinal++) {
      const got = await fetchNth13fInfotableXml(cik, ua, ordinal);
      if (!got) break;
      filerName = got.filerName;
      const agg = aggregateInfoRowsByCusip(parseInfoTableRows(got.xml));
      if (agg.length === 0) break;
      snapshots.push({
        reportDate: got.reportDate,
        filingDate: got.filingDate,
        accession: got.accession,
        holdings: agg,
      });
    }
    if (snapshots.length === 0) return null;
    return { filerDisplayName: filerName || "Institutional investment manager", snapshots };
  } catch {
    return null;
  }
}

/**
 * Coalesce concurrent 13F snapshot fetches (e.g. profile page comparison + transactions).
 * A microtask delay lets parallel callers raise `requestedCount` before the SEC loop starts.
 */
function getInstitutional13fSnapshots(
  cik: string,
  filingCount: number,
): Promise<Institutional13fSnapshotsResult | null> {
  const key = cikPad10(cik);
  let entry = snapshotsInflight.get(key);
  if (entry) {
    entry.requestedCount = Math.max(entry.requestedCount, filingCount);
    return entry.promise;
  }

  entry = {
    requestedCount: filingCount,
    promise: new Promise((resolve) => {
      queueMicrotask(() => {
        const count = entry!.requestedCount;
        void fetchInstitutional13fSnapshotsUncached(key, count)
          .then(resolve)
          .finally(() => {
            snapshotsInflight.delete(key);
          });
      });
    }),
  };
  snapshotsInflight.set(key, entry);
  return entry.promise;
}

function buildComparisonPayloadFromSnapshots(
  cik: string,
  filerDisplayName: string,
  snapshots: FilingSnapshot[],
): Berkshire13fComparisonPayload | null {
  if (snapshots.length === 0) return null;

  const curSnap = snapshots[0]!;
  const prevSnap = snapshots[1];
  const curAgg = curSnap.holdings;
  if (curAgg.length === 0) return null;

  const prevAgg = prevSnap?.holdings ?? null;
  const hasPriorFiling = (prevAgg?.length ?? 0) > 0;
  const { rows, soldOut, previousTotalUsd } = buildComparisonRows(curAgg, prevAgg);

  const prevMeta: Berkshire13fFilingMeta | null = hasPriorFiling && prevSnap
    ? {
        accessionNumber: prevSnap.accession,
        filingDate: prevSnap.filingDate,
        reportDate: prevSnap.reportDate,
      }
    : null;

  return {
    filerDisplayName,
    cik,
    current: {
      accessionNumber: curSnap.accession,
      filingDate: curSnap.filingDate,
      reportDate: curSnap.reportDate,
    },
    previous: hasPriorFiling ? prevMeta : null,
    hasPriorFiling,
    totalValueUsd: curAgg.reduce((s, r) => s + r.valueThousands * 1000, 0),
    previousTotalValueUsd: previousTotalUsd,
    positionCount: rows.length,
    rows,
    soldOut,
    source: "edgar",
  };
}

function createSuperinvestorProfilePageLoader(
  cik: string,
  fallbacks: {
    comparisonFallback: () => Berkshire13fComparisonPayload;
    transactionsFallback: () => SuperinvestorTransactionsPayload;
  },
): () => Promise<Superinvestor13fProfilePageData> {
  const paddedCik = cikPad10(cik);
  const uncached = async (): Promise<Superinvestor13fProfilePageData> => {
    const head = await getLatest13fFilingHeadCached(paddedCik);
    const accKey = thirteenFilingHeadCacheKey(head);

    /** Same path as Berkshire — avoid re-pulling ~20 SEC infotables on every cold visit. */
    const profileCached = await readSuperinvestor13fProfileSnapshot(paddedCik, accKey);
    if (profileCached && filingHeadMatchesComparison(head, profileCached.comparison)) {
      return profileCached;
    }

    const got = await fetchInstitutional13fSnapshotsUncached(paddedCik, superinvestorStandardFilingCount());
    if (!got) {
      return {
        comparison: fallbacks.comparisonFallback(),
        transactions: fallbacks.transactionsFallback(),
      };
    }

    const comparison =
      buildComparisonPayloadFromSnapshots(paddedCik, got.filerDisplayName, got.snapshots) ??
      fallbacks.comparisonFallback();

    const transactions =
      got.snapshots.length >= 2
        ? buildTransactionsPayloadFromSnapshots(
            { filerDisplayName: got.filerDisplayName, cik: paddedCik, source: "edgar" },
            got.snapshots,
            SUPERINVESTOR_TRANSACTIONS_STANDARD_QUARTER_PAIRS,
          )
        : fallbacks.transactionsFallback();

    const page = { comparison, transactions };
    if (comparison.source === "edgar" && accKey !== "none") {
      void upsertSuperinvestor13fProfileSnapshot(paddedCik, accKey, page);
    }
    return page;
  };

  return () =>
    devMemoAsync(`13f:profile-page-v2:${paddedCik}`, () =>
      withAccessionKeyed13fCache("superinvestor-13f-profile-page-v10-snapshot", paddedCik, uncached),
    );
}

async function fetchInstitutionalTransactionsUncached(cik: string): Promise<SuperinvestorTransactionsPayload | null> {
  const got = await getInstitutional13fSnapshots(cik, superinvestorTransactionsFilingCount());
  if (!got || got.snapshots.length < 2) return null;
  return buildTransactionsPayloadFromSnapshots(
    { filerDisplayName: got.filerDisplayName, cik: cikPad10(cik), source: "edgar" },
    got.snapshots,
  );
}

function loadFixtureTransactionsPayload(
  filerDisplayName: string,
  cik: string,
  baseAgg: AggregatedHolding[],
  endReportDate: string,
): SuperinvestorTransactionsPayload {
  const snapshots = syntheticFixtureFilingSnapshots(baseAgg, endReportDate, superinvestorTransactionsFilingCount());
  return buildTransactionsPayloadFromSnapshots({ filerDisplayName, cik, source: "fixture" }, snapshots);
}

function rowsToPayload(
  rows: AggregatedHolding[],
  meta: {
    filerDisplayName: string;
    cik: string;
    accession: string | null;
    filingDate: string | null;
    reportDate: string | null;
    source: "edgar" | "fixture" | "unavailable";
  },
): InstitutionalHoldingsPayload {
  const valueUsdList = rows.map((r) => r.valueThousands * 1000);
  const totalValueUsd = valueUsdList.reduce((s, v) => s + v, 0);
  const holdings: InstitutionalHoldingRow[] = rows.map((r, i) => ({
    issuer: r.issuer,
    titleOfClass: r.title,
    ticker: tickerFor13fRow(r.cusip, r.issuer, r.title),
    valueUsd: valueUsdList[i]!,
    pct: totalValueUsd > 0 ? (valueUsdList[i]! / totalValueUsd) * 100 : 0,
  }));
  holdings.sort((a, b) => b.valueUsd - a.valueUsd);
  return {
    filerDisplayName: meta.filerDisplayName,
    cik: meta.cik,
    reportDate: meta.reportDate,
    filingDate: meta.filingDate,
    accessionNumber: meta.accession,
    totalValueUsd,
    positionCount: holdings.length,
    holdings,
    source: meta.source,
  };
}

function unavailableInstitutionalPayload(cik: string, filerDisplayName: string): InstitutionalHoldingsPayload {
  return rowsToPayload([], {
    filerDisplayName,
    cik,
    accession: null,
    filingDate: null,
    reportDate: null,
    source: "unavailable",
  });
}

function unavailableComparisonPayload(cik: string, filerDisplayName: string): Berkshire13fComparisonPayload {
  return {
    filerDisplayName,
    cik,
    current: {
      accessionNumber: null,
      filingDate: null,
      reportDate: null,
    },
    previous: null,
    hasPriorFiling: false,
    totalValueUsd: 0,
    previousTotalValueUsd: null,
    positionCount: 0,
    rows: [],
    soldOut: [],
    source: "unavailable",
  };
}

function loadFixturePayload(): InstitutionalHoldingsPayload {
  const j = berkshireFallback as {
    filerDisplayName: string;
    cik: string;
    holdings: { issuer: string; titleOfClass: string | null; valueUsd: number }[];
  };
  const rows: ParsedInfoRow[] = j.holdings.map((h) => ({
    issuer: h.issuer,
    title: h.titleOfClass ?? null,
    valueThousands: Math.round(h.valueUsd / 1000),
    cusip: null,
    shares: inferSharesPlaceholder(h.valueUsd),
  }));
  const merged = aggregateInfoRowsByCusip(rows);
  return rowsToPayload(merged, {
    filerDisplayName: j.filerDisplayName,
    cik: j.cik,
    accession: null,
    filingDate: BERKSHIRE_FIXTURE_CURRENT_FILING_DATE,
    reportDate: BERKSHIRE_FIXTURE_CURRENT_REPORT_DATE,
    source: "fixture",
  });
}

/** Deterministic placeholder share count for fixture-only rows (SEC `sshPrnamt` absent in JSON). */
function inferSharesPlaceholder(valueUsd: number): number {
  return Math.max(1, Math.round(valueUsd / 180));
}

function syntheticFixtureCusip(issuer: string, salt: number): string {
  let h = salt;
  for (let i = 0; i < issuer.length; i++) h = (h * 31 + issuer.charCodeAt(i)) >>> 0;
  const n = 100_000_000 + (h % 800_000_000);
  return String(n).padStart(9, "0").slice(0, 9);
}

function fixtureCurrentAggregated(): AggregatedHolding[] {
  const j = berkshireFallback as {
    holdings: { issuer: string; titleOfClass: string | null; valueUsd: number }[];
  };
  const parsed: ParsedInfoRow[] = j.holdings.map((h, idx) => ({
    issuer: h.issuer,
    title: h.titleOfClass ?? null,
    valueThousands: Math.round(h.valueUsd / 1000),
    cusip: syntheticFixtureCusip(h.issuer, idx),
    shares: inferSharesPlaceholder(h.valueUsd),
  }));
  return aggregateInfoRowsByCusip(parsed);
}

function fundsmithFixtureCurrentAggregated(): AggregatedHolding[] {
  const j = fundsmithFallback as {
    holdings: { issuer: string; titleOfClass: string | null; valueUsd: number }[];
  };
  const parsed: ParsedInfoRow[] = j.holdings.map((h, idx) => ({
    issuer: h.issuer,
    title: h.titleOfClass ?? null,
    valueThousands: Math.round(h.valueUsd / 1000),
    cusip: syntheticFixtureCusip(h.issuer, idx),
    shares: inferSharesPlaceholder(h.valueUsd),
  }));
  return aggregateInfoRowsByCusip(parsed);
}

/**
 * Offline 13F snapshot prior: avoid a single scale factor for most rows (that collapses every
 * `sharesChangePct` to the same ~0.8%). Deterministic per-issuer scale mimics quarter-to-quarter dispersion.
 */
function syntheticPriorScaleForOffline13fFixtureRow(issuer: string, index: number): number {
  let h = index * 17;
  for (let k = 0; k < issuer.length; k++) h = (h * 31 + issuer.charCodeAt(k)) >>> 0;
  const u = (h % 2601) / 2600;
  return 0.82 + u * 0.26;
}

function buildSyntheticPreviousForOffline13fFixture(base: AggregatedHolding[]): AggregatedHolding[] {
  return base.map((r, i) => {
    const m = syntheticPriorScaleForOffline13fFixtureRow(r.issuer, i);
    return {
      ...r,
      valueThousands: Math.round(r.valueThousands * m),
      shares: r.shares != null ? Math.round(r.shares * m) : null,
    };
  });
}

async function fetchInstitutionalHoldingsUncached(cik: string): Promise<InstitutionalHoldingsPayload | null> {
  const ua = getSecEdgarUserAgent();
  try {
    const got = await fetchNth13fInfotableXml(cik, ua, 0);
    if (!got) return null;
    const parsed = parseInfoTableRows(got.xml);
    const merged = aggregateInfoRowsByCusip(parsed);
    if (merged.length === 0) return null;

    return rowsToPayload(merged, {
      filerDisplayName: got.filerName,
      cik,
      accession: got.accession,
      filingDate: got.filingDate,
      reportDate: got.reportDate,
      source: "edgar",
    });
  } catch {
    return null;
  }
}

async function fetchInstitutionalComparisonUncached(cik: string): Promise<Berkshire13fComparisonPayload | null> {
  const got = await getInstitutional13fSnapshots(cik, 2);
  if (!got) return null;
  return buildComparisonPayloadFromSnapshots(cikPad10(cik), got.filerDisplayName, got.snapshots);
}

function loadFixtureComparisonPayload(): Berkshire13fComparisonPayload {
  const j = berkshireFallback as { filerDisplayName: string; cik: string };
  const baseAgg = fixtureCurrentAggregated();
  const previousAgg = buildSyntheticPreviousForOffline13fFixture(baseAgg);
  const { rows, soldOut, previousTotalUsd } = buildComparisonRows(baseAgg, previousAgg);
  return {
    filerDisplayName: j.filerDisplayName,
    cik: j.cik,
    current: {
      accessionNumber: null,
      filingDate: BERKSHIRE_FIXTURE_CURRENT_FILING_DATE,
      reportDate: BERKSHIRE_FIXTURE_CURRENT_REPORT_DATE,
    },
    previous: {
      accessionNumber: null,
      filingDate: BERKSHIRE_FIXTURE_PREVIOUS_FILING_DATE,
      reportDate: BERKSHIRE_FIXTURE_PREVIOUS_REPORT_DATE,
    },
    hasPriorFiling: true,
    totalValueUsd: baseAgg.reduce((s, r) => s + r.valueThousands * 1000, 0),
    previousTotalValueUsd: previousTotalUsd,
    positionCount: rows.length,
    rows,
    soldOut,
    source: "fixture",
  };
}

/** SEC filing date for {@link fundsmithFallback} snapshot (Q4 2025 13F-HR on EDGAR). */
const FUNDSMITH_FIXTURE_CURRENT_FILING_DATE = "2026-02-17";
const FUNDSMITH_FIXTURE_CURRENT_REPORT_DATE = "2025-12-31";
const FUNDSMITH_FIXTURE_PREVIOUS_FILING_DATE = "2025-11-13";
const FUNDSMITH_FIXTURE_PREVIOUS_REPORT_DATE = "2025-09-30";

/** Offline snapshot (Q4 2025 13F-HR) when SEC fetches fail in production (e.g. datacenter blocks). */
function loadFundsmithFixtureComparisonPayload(): Berkshire13fComparisonPayload {
  const j = fundsmithFallback as { filerDisplayName: string; cik: string };
  const baseAgg = fundsmithFixtureCurrentAggregated();
  const previousAgg = buildSyntheticPreviousForOffline13fFixture(baseAgg);
  const { rows, soldOut, previousTotalUsd } = buildComparisonRows(baseAgg, previousAgg);
  return {
    filerDisplayName: j.filerDisplayName,
    cik: j.cik,
    current: {
      accessionNumber: null,
      filingDate: FUNDSMITH_FIXTURE_CURRENT_FILING_DATE,
      reportDate: FUNDSMITH_FIXTURE_CURRENT_REPORT_DATE,
    },
    previous: {
      accessionNumber: null,
      filingDate: FUNDSMITH_FIXTURE_PREVIOUS_FILING_DATE,
      reportDate: FUNDSMITH_FIXTURE_PREVIOUS_REPORT_DATE,
    },
    hasPriorFiling: true,
    totalValueUsd: baseAgg.reduce((s, r) => s + r.valueThousands * 1000, 0),
    previousTotalValueUsd: previousTotalUsd,
    positionCount: rows.length,
    rows,
    soldOut,
    source: "fixture",
  };
}

function loadFundsmithFixtureHoldingsPayload(): InstitutionalHoldingsPayload {
  const j = fundsmithFallback as {
    filerDisplayName: string;
    cik: string;
    holdings: { issuer: string; titleOfClass: string | null; valueUsd: number }[];
  };
  const rows: ParsedInfoRow[] = j.holdings.map((h) => ({
    issuer: h.issuer,
    title: h.titleOfClass ?? null,
    valueThousands: Math.round(h.valueUsd / 1000),
    cusip: null,
    shares: inferSharesPlaceholder(h.valueUsd),
  }));
  const merged = aggregateInfoRowsByCusip(rows);
  return rowsToPayload(merged, {
    filerDisplayName: j.filerDisplayName,
    cik: j.cik,
    accession: null,
    filingDate: FUNDSMITH_FIXTURE_CURRENT_FILING_DATE,
    reportDate: FUNDSMITH_FIXTURE_CURRENT_REPORT_DATE,
    source: "fixture",
  });
}

/** SEC filing dates for {@link pershingSquareFallback} snapshot (Q4 2025 13F-HR on EDGAR). */
const PERSHING_FIXTURE_CURRENT_FILING_DATE = "2026-02-17";
const PERSHING_FIXTURE_CURRENT_REPORT_DATE = "2025-12-31";
const PERSHING_FIXTURE_PREVIOUS_FILING_DATE = "2025-11-13";
const PERSHING_FIXTURE_PREVIOUS_REPORT_DATE = "2025-09-30";

function pershingFixtureCurrentAggregated(): AggregatedHolding[] {
  const j = pershingSquareFallback as {
    holdings: { issuer: string; titleOfClass: string | null; valueUsd: number }[];
  };
  const parsed: ParsedInfoRow[] = j.holdings.map((h, idx) => ({
    issuer: h.issuer,
    title: h.titleOfClass ?? null,
    valueThousands: Math.round(h.valueUsd / 1000),
    cusip: syntheticFixtureCusip(h.issuer, idx),
    shares: inferSharesPlaceholder(h.valueUsd),
  }));
  return aggregateInfoRowsByCusip(parsed);
}

function loadPershingFixtureComparisonPayload(): Berkshire13fComparisonPayload {
  const j = pershingSquareFallback as { filerDisplayName: string; cik: string };
  const baseAgg = pershingFixtureCurrentAggregated();
  const previousAgg = buildSyntheticPreviousForOffline13fFixture(baseAgg);
  const { rows, soldOut, previousTotalUsd } = buildComparisonRows(baseAgg, previousAgg);
  return {
    filerDisplayName: j.filerDisplayName,
    cik: j.cik,
    current: {
      accessionNumber: null,
      filingDate: PERSHING_FIXTURE_CURRENT_FILING_DATE,
      reportDate: PERSHING_FIXTURE_CURRENT_REPORT_DATE,
    },
    previous: {
      accessionNumber: null,
      filingDate: PERSHING_FIXTURE_PREVIOUS_FILING_DATE,
      reportDate: PERSHING_FIXTURE_PREVIOUS_REPORT_DATE,
    },
    hasPriorFiling: true,
    totalValueUsd: baseAgg.reduce((s, r) => s + r.valueThousands * 1000, 0),
    previousTotalValueUsd: previousTotalUsd,
    positionCount: rows.length,
    rows,
    soldOut,
    source: "fixture",
  };
}

function loadPershingFixtureHoldingsPayload(): InstitutionalHoldingsPayload {
  const j = pershingSquareFallback as {
    filerDisplayName: string;
    cik: string;
    holdings: { issuer: string; titleOfClass: string | null; valueUsd: number }[];
  };
  const rows: ParsedInfoRow[] = j.holdings.map((h) => ({
    issuer: h.issuer,
    title: h.titleOfClass ?? null,
    valueThousands: Math.round(h.valueUsd / 1000),
    cusip: null,
    shares: inferSharesPlaceholder(h.valueUsd),
  }));
  const merged = aggregateInfoRowsByCusip(rows);
  return rowsToPayload(merged, {
    filerDisplayName: j.filerDisplayName,
    cik: j.cik,
    accession: null,
    filingDate: PERSHING_FIXTURE_CURRENT_FILING_DATE,
    reportDate: PERSHING_FIXTURE_CURRENT_REPORT_DATE,
    source: "fixture",
  });
}

async function fetchBerkshireHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  const got = await fetchInstitutionalHoldingsUncached(BERKSHIRE_CIK);
  return got ?? loadFixturePayload();
}

async function fetchBerkshireComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  const got = await fetchInstitutionalComparisonUncached(BERKSHIRE_CIK);
  return got ?? loadFixtureComparisonPayload();
}

const BERKSHIRE_HOLDINGS_TX_CACHE_PREFIX = "superinvestor-13f-berkshire-holdings-tx-v3";

/**
 * Full 13F quarter-over-quarter history for names in the latest filing only.
 * Persisted in Supabase (segment = latest accession); SEC backfill runs once per new 13F.
 */
async function loadBerkshireHoldingsScopedTransactionsForComparison(
  comparison: Berkshire13fComparisonPayload,
  accKey: string,
): Promise<SuperinvestorTransactionsPayload> {
  const paddedCik = cikPad10(BERKSHIRE_CIK);

  const cached = await readSuperinvestorHoldingsTransactionsSnapshot(paddedCik, accKey);
  if (cached) return cached;

  const priorRow = await readSuperinvestorHoldingsTransactionsSnapshotRow(paddedCik);
  if (priorRow?.payload.quarters.length && priorRow.segment !== accKey) {
    const got = await fetchInstitutional13fSnapshotsUncached(paddedCik, 2);
    if (got && got.snapshots.length >= 2) {
      const newGroups = buildBerkshireQuarterGroupsFromFilingSnapshots(got.snapshots, 1);
      const merged = finalizeBerkshireHoldingsTransactions(
        prependSuperinvestorQuarterGroups(
          {
            ...priorRow.payload,
            filerDisplayName: got.filerDisplayName,
            cik: paddedCik,
            source: "edgar",
          },
          newGroups,
        ),
        comparison,
      );
      void upsertSuperinvestorHoldingsTransactionsSnapshot(paddedCik, accKey, merged);
      return merged;
    }
  }

  const got = await fetchInstitutional13fSnapshotsUncached(paddedCik, superinvestorTransactionsFilingCount());
  if (!got || got.snapshots.length < 2) {
    const j = berkshireFallback as { filerDisplayName: string; cik: string };
    const fixture = loadFixtureTransactionsPayload(
      j.filerDisplayName,
      j.cik,
      fixtureCurrentAggregated(),
      BERKSHIRE_FIXTURE_CURRENT_REPORT_DATE,
    );
    return finalizeBerkshireHoldingsTransactions(fixture, comparison);
  }

  const raw = buildBerkshireTransactionsPayloadFromSnapshots(
    { filerDisplayName: got.filerDisplayName, cik: paddedCik, source: "edgar" },
    got.snapshots,
  );
  const scoped = finalizeBerkshireHoldingsTransactions(raw, comparison);
  void upsertSuperinvestorHoldingsTransactionsSnapshot(paddedCik, accKey, scoped);
  return scoped;
}

async function fetchBerkshireHoldingsScopedTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  const paddedCik = cikPad10(BERKSHIRE_CIK);
  const head = await getLatest13fFilingHeadCached(paddedCik);
  const accKey = thirteenFilingHeadCacheKey(head);
  const comparison = await fetchBerkshireComparisonUncached();
  return loadBerkshireHoldingsScopedTransactionsForComparison(comparison, accKey);
}

async function fetchBerkshireProfilePageUncached(): Promise<Superinvestor13fProfilePageData> {
  const paddedCik = cikPad10(BERKSHIRE_CIK);
  const head = await getLatest13fFilingHeadCached(paddedCik);
  const accKey = thirteenFilingHeadCacheKey(head);

  const profileCached = await readSuperinvestor13fProfileSnapshot(paddedCik, accKey);
  if (profileCached && filingHeadMatchesComparison(head, profileCached.comparison)) {
    return profileCached;
  }

  const comparison = await fetchBerkshireComparisonUncached();
  const transactions = await loadBerkshireHoldingsScopedTransactionsForComparison(comparison, accKey);
  const page = { comparison, transactions };
  void upsertSuperinvestor13fProfileSnapshot(paddedCik, accKey, page);
  return page;
}

async function fetchPershingHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (await fetchInstitutionalHoldingsUncached(PERSHING_SQUARE_CIK)) ?? loadPershingFixtureHoldingsPayload();
}

async function fetchPershingComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (await fetchInstitutionalComparisonUncached(PERSHING_SQUARE_CIK)) ?? loadPershingFixtureComparisonPayload();
}

async function fetchPershingTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  const got = await fetchInstitutionalTransactionsUncached(PERSHING_SQUARE_CIK);
  if (got) return got;
  const j = pershingSquareFallback as { filerDisplayName: string; cik: string };
  return loadFixtureTransactionsPayload(
    j.filerDisplayName,
    j.cik,
    pershingFixtureCurrentAggregated(),
    PERSHING_FIXTURE_CURRENT_REPORT_DATE,
  );
}

async function fetchFundsmithHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (await fetchInstitutionalHoldingsUncached(FUNDSMITH_LLP_CIK)) ?? loadFundsmithFixtureHoldingsPayload();
}

async function fetchFundsmithComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (await fetchInstitutionalComparisonUncached(FUNDSMITH_LLP_CIK)) ?? loadFundsmithFixtureComparisonPayload();
}

async function fetchFundsmithTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  const got = await fetchInstitutionalTransactionsUncached(FUNDSMITH_LLP_CIK);
  if (got) return got;
  const j = fundsmithFallback as { filerDisplayName: string; cik: string };
  return loadFixtureTransactionsPayload(
    j.filerDisplayName,
    j.cik,
    fundsmithFixtureCurrentAggregated(),
    FUNDSMITH_FIXTURE_CURRENT_REPORT_DATE,
  );
}

async function fetchInstitutionalTransactionsOrUnavailable(
  cik: string,
  filerDisplayName: string,
): Promise<SuperinvestorTransactionsPayload> {
  return (await fetchInstitutionalTransactionsUncached(cik)) ?? unavailableTransactionsPayload(cik, filerDisplayName);
}

async function fetchScionHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(SCION_ASSET_MANAGEMENT_CIK)) ??
    unavailableInstitutionalPayload(SCION_ASSET_MANAGEMENT_CIK, "Scion Asset Management, LLC")
  );
}

async function fetchScionComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(SCION_ASSET_MANAGEMENT_CIK)) ??
    unavailableComparisonPayload(SCION_ASSET_MANAGEMENT_CIK, "Scion Asset Management, LLC")
  );
}

async function fetchScionTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(SCION_ASSET_MANAGEMENT_CIK, "Scion Asset Management, LLC");
}

async function fetchArkHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(ARK_INVEST_CIK)) ??
    unavailableInstitutionalPayload(ARK_INVEST_CIK, "ARK Investment Management LLC")
  );
}

async function fetchArkComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(ARK_INVEST_CIK)) ??
    unavailableComparisonPayload(ARK_INVEST_CIK, "ARK Investment Management LLC")
  );
}

async function fetchHimalayaHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(HIMALAYA_CAPITAL_CIK)) ??
    unavailableInstitutionalPayload(HIMALAYA_CAPITAL_CIK, "Himalaya Capital Management LLC")
  );
}

async function fetchHimalayaComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(HIMALAYA_CAPITAL_CIK)) ??
    unavailableComparisonPayload(HIMALAYA_CAPITAL_CIK, "Himalaya Capital Management LLC")
  );
}

async function fetchBridgewaterHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(BRIDGEWATER_ASSOCIATES_CIK)) ??
    unavailableInstitutionalPayload(BRIDGEWATER_ASSOCIATES_CIK, "Bridgewater Associates, LP")
  );
}

async function fetchBridgewaterComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(BRIDGEWATER_ASSOCIATES_CIK)) ??
    unavailableComparisonPayload(BRIDGEWATER_ASSOCIATES_CIK, "Bridgewater Associates, LP")
  );
}

async function fetchFisherHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(FISHER_ASSET_MANAGEMENT_CIK)) ??
    unavailableInstitutionalPayload(FISHER_ASSET_MANAGEMENT_CIK, "Fisher Asset Management, LLC")
  );
}

async function fetchFisherComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(FISHER_ASSET_MANAGEMENT_CIK)) ??
    unavailableComparisonPayload(FISHER_ASSET_MANAGEMENT_CIK, "Fisher Asset Management, LLC")
  );
}

async function fetchPrimecapHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(PRIMECAP_MANAGEMENT_CIK)) ??
    unavailableInstitutionalPayload(PRIMECAP_MANAGEMENT_CIK, "PRIMECAP Management Co/CA/")
  );
}

async function fetchPrimecapComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(PRIMECAP_MANAGEMENT_CIK)) ??
    unavailableComparisonPayload(PRIMECAP_MANAGEMENT_CIK, "PRIMECAP Management Co/CA/")
  );
}

async function fetchCitadelHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(CITADEL_ADVISORS_CIK)) ??
    unavailableInstitutionalPayload(CITADEL_ADVISORS_CIK, "Citadel Advisors LLC")
  );
}

async function fetchCitadelComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(CITADEL_ADVISORS_CIK)) ??
    unavailableComparisonPayload(CITADEL_ADVISORS_CIK, "Citadel Advisors LLC")
  );
}

async function fetchDailyJournalHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(DAILY_JOURNAL_CORP_CIK)) ??
    unavailableInstitutionalPayload(DAILY_JOURNAL_CORP_CIK, "Daily Journal Corp")
  );
}

async function fetchDailyJournalComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(DAILY_JOURNAL_CORP_CIK)) ??
    unavailableComparisonPayload(DAILY_JOURNAL_CORP_CIK, "Daily Journal Corp")
  );
}

async function fetchBlackrockHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(BLACKROCK_INC_CIK)) ??
    unavailableInstitutionalPayload(BLACKROCK_INC_CIK, "BlackRock, Inc.")
  );
}

async function fetchBlackrockComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(BLACKROCK_INC_CIK)) ??
    unavailableComparisonPayload(BLACKROCK_INC_CIK, "BlackRock, Inc.")
  );
}

async function fetchBaillieGiffordHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(BAILLIE_GIFFORD_CO_CIK)) ??
    unavailableInstitutionalPayload(BAILLIE_GIFFORD_CO_CIK, "Baillie Gifford & Co")
  );
}

async function fetchBaillieGiffordComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(BAILLIE_GIFFORD_CO_CIK)) ??
    unavailableComparisonPayload(BAILLIE_GIFFORD_CO_CIK, "Baillie Gifford & Co")
  );
}

async function fetchRenaissanceHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(RENAISSANCE_TECHNOLOGIES_LLC_CIK)) ??
    unavailableInstitutionalPayload(RENAISSANCE_TECHNOLOGIES_LLC_CIK, "Renaissance Technologies LLC")
  );
}

async function fetchRenaissanceComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(RENAISSANCE_TECHNOLOGIES_LLC_CIK)) ??
    unavailableComparisonPayload(RENAISSANCE_TECHNOLOGIES_LLC_CIK, "Renaissance Technologies LLC")
  );
}

async function fetchPoint72HoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(POINT72_ASSET_MANAGEMENT_LP_CIK)) ??
    unavailableInstitutionalPayload(POINT72_ASSET_MANAGEMENT_LP_CIK, "Point72 Asset Management, L.P.")
  );
}

async function fetchPoint72ComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(POINT72_ASSET_MANAGEMENT_LP_CIK)) ??
    unavailableComparisonPayload(POINT72_ASSET_MANAGEMENT_LP_CIK, "Point72 Asset Management, L.P.")
  );
}

async function fetchFirstEagleHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK)) ??
    unavailableInstitutionalPayload(FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK, "First Eagle Investment Management LLC")
  );
}

async function fetchFirstEagleComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK)) ??
    unavailableComparisonPayload(FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK, "First Eagle Investment Management LLC")
  );
}

async function fetchTciFundHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(TCI_FUND_MANAGEMENT_LTD_CIK)) ??
    unavailableInstitutionalPayload(TCI_FUND_MANAGEMENT_LTD_CIK, "TCI Fund Management Ltd")
  );
}

async function fetchTciFundComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(TCI_FUND_MANAGEMENT_LTD_CIK)) ??
    unavailableComparisonPayload(TCI_FUND_MANAGEMENT_LTD_CIK, "TCI Fund Management Ltd")
  );
}

async function fetchGmoHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (
    (await fetchInstitutionalHoldingsUncached(GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK)) ??
    unavailableInstitutionalPayload(GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK, "Grantham, Mayo, Van Otterloo & Co. LLC")
  );
}

async function fetchGmoComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (
    (await fetchInstitutionalComparisonUncached(GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK)) ??
    unavailableComparisonPayload(GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK, "Grantham, Mayo, Van Otterloo & Co. LLC")
  );
}

async function fetchArkTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(ARK_INVEST_CIK, "ARK Investment Management LLC");
}

async function fetchHimalayaTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(HIMALAYA_CAPITAL_CIK, "Himalaya Capital Management LLC");
}

async function fetchBridgewaterTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(BRIDGEWATER_ASSOCIATES_CIK, "Bridgewater Associates, LP");
}

async function fetchFisherTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(FISHER_ASSET_MANAGEMENT_CIK, "Fisher Asset Management, LLC");
}

async function fetchPrimecapTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(PRIMECAP_MANAGEMENT_CIK, "PRIMECAP Management Co/CA/");
}

async function fetchCitadelTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(CITADEL_ADVISORS_CIK, "Citadel Advisors LLC");
}

async function fetchDailyJournalTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(DAILY_JOURNAL_CORP_CIK, "Daily Journal Corp");
}

async function fetchBlackrockTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(BLACKROCK_INC_CIK, "BlackRock, Inc.");
}

async function fetchBaillieGiffordTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(BAILLIE_GIFFORD_CO_CIK, "Baillie Gifford & Co");
}

async function fetchRenaissanceTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(RENAISSANCE_TECHNOLOGIES_LLC_CIK, "Renaissance Technologies LLC");
}

async function fetchPoint72TransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(POINT72_ASSET_MANAGEMENT_LP_CIK, "Point72 Asset Management, L.P.");
}

async function fetchFirstEagleTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(
    FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK,
    "First Eagle Investment Management LLC",
  );
}

async function fetchTciFundTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(TCI_FUND_MANAGEMENT_LTD_CIK, "TCI Fund Management Ltd");
}

async function fetchGmoTransactionsUncached(): Promise<SuperinvestorTransactionsPayload> {
  return fetchInstitutionalTransactionsOrUnavailable(
    GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK,
    "Grantham, Mayo, Van Otterloo & Co. LLC",
  );
}

export const getBerkshireProfilePage = () =>
  devMemoAsync(`13f:profile-page:${BERKSHIRE_CIK}`, () =>
    withAccessionKeyed13fCache(
      "superinvestor-13f-profile-page-v13-berkshire-q1-2026",
      BERKSHIRE_CIK,
      fetchBerkshireProfilePageUncached,
    ),
  );

export const getPershingSquareProfilePage = createSuperinvestorProfilePageLoader(PERSHING_SQUARE_CIK, {
  comparisonFallback: loadPershingFixtureComparisonPayload,
  transactionsFallback: () => {
    const j = pershingSquareFallback as { filerDisplayName: string; cik: string };
    return loadFixtureTransactionsPayload(
      j.filerDisplayName,
      j.cik,
      pershingFixtureCurrentAggregated(),
      PERSHING_FIXTURE_CURRENT_REPORT_DATE,
    );
  },
});

export const getFundsmithProfilePage = createSuperinvestorProfilePageLoader(FUNDSMITH_LLP_CIK, {
  comparisonFallback: loadFundsmithFixtureComparisonPayload,
  transactionsFallback: () => {
    const j = fundsmithFallback as { filerDisplayName: string; cik: string };
    return loadFixtureTransactionsPayload(
      j.filerDisplayName,
      j.cik,
      fundsmithFixtureCurrentAggregated(),
      FUNDSMITH_FIXTURE_CURRENT_REPORT_DATE,
    );
  },
});

export const getScionProfilePage = createSuperinvestorProfilePageLoader(SCION_ASSET_MANAGEMENT_CIK, {
  comparisonFallback: () =>
    unavailableComparisonPayload(SCION_ASSET_MANAGEMENT_CIK, "Scion Asset Management, LLC"),
  transactionsFallback: () =>
    unavailableTransactionsPayload(SCION_ASSET_MANAGEMENT_CIK, "Scion Asset Management, LLC"),
});

export const getArkProfilePage = createSuperinvestorProfilePageLoader(ARK_INVEST_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(ARK_INVEST_CIK, "ARK Investment Management LLC"),
  transactionsFallback: () => unavailableTransactionsPayload(ARK_INVEST_CIK, "ARK Investment Management LLC"),
});

export const getHimalayaProfilePage = createSuperinvestorProfilePageLoader(HIMALAYA_CAPITAL_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(HIMALAYA_CAPITAL_CIK, "Himalaya Capital Management"),
  transactionsFallback: () => unavailableTransactionsPayload(HIMALAYA_CAPITAL_CIK, "Himalaya Capital Management"),
});

export const getBridgewaterProfilePage = createSuperinvestorProfilePageLoader(BRIDGEWATER_ASSOCIATES_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(BRIDGEWATER_ASSOCIATES_CIK, "Bridgewater Associates, LP"),
  transactionsFallback: () => unavailableTransactionsPayload(BRIDGEWATER_ASSOCIATES_CIK, "Bridgewater Associates, LP"),
});

export const getFisherProfilePage = createSuperinvestorProfilePageLoader(FISHER_ASSET_MANAGEMENT_CIK, {
  comparisonFallback: () =>
    unavailableComparisonPayload(FISHER_ASSET_MANAGEMENT_CIK, "Fisher Asset Management, LLC"),
  transactionsFallback: () =>
    unavailableTransactionsPayload(FISHER_ASSET_MANAGEMENT_CIK, "Fisher Asset Management, LLC"),
});

export const getPrimecapProfilePage = createSuperinvestorProfilePageLoader(PRIMECAP_MANAGEMENT_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(PRIMECAP_MANAGEMENT_CIK, "PRIMECAP Management"),
  transactionsFallback: () => unavailableTransactionsPayload(PRIMECAP_MANAGEMENT_CIK, "PRIMECAP Management"),
});

export const getCitadelProfilePage = createSuperinvestorProfilePageLoader(CITADEL_ADVISORS_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(CITADEL_ADVISORS_CIK, "Citadel Advisors LLC"),
  transactionsFallback: () => unavailableTransactionsPayload(CITADEL_ADVISORS_CIK, "Citadel Advisors LLC"),
});

export const getDailyJournalProfilePage = createSuperinvestorProfilePageLoader(DAILY_JOURNAL_CORP_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(DAILY_JOURNAL_CORP_CIK, "Daily Journal Corp"),
  transactionsFallback: () => unavailableTransactionsPayload(DAILY_JOURNAL_CORP_CIK, "Daily Journal Corp"),
});

export const getBlackrockProfilePage = createSuperinvestorProfilePageLoader(BLACKROCK_INC_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(BLACKROCK_INC_CIK, "BlackRock, Inc."),
  transactionsFallback: () => unavailableTransactionsPayload(BLACKROCK_INC_CIK, "BlackRock, Inc."),
});

export const getBaillieGiffordProfilePage = createSuperinvestorProfilePageLoader(BAILLIE_GIFFORD_CO_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(BAILLIE_GIFFORD_CO_CIK, "Baillie Gifford & Co"),
  transactionsFallback: () => unavailableTransactionsPayload(BAILLIE_GIFFORD_CO_CIK, "Baillie Gifford & Co"),
});

export const getRenaissanceTechnologiesProfilePage = createSuperinvestorProfilePageLoader(
  RENAISSANCE_TECHNOLOGIES_LLC_CIK,
  {
    comparisonFallback: () =>
      unavailableComparisonPayload(RENAISSANCE_TECHNOLOGIES_LLC_CIK, "Renaissance Technologies LLC"),
    transactionsFallback: () =>
      unavailableTransactionsPayload(RENAISSANCE_TECHNOLOGIES_LLC_CIK, "Renaissance Technologies LLC"),
  },
);

export const getPoint72ProfilePage = createSuperinvestorProfilePageLoader(POINT72_ASSET_MANAGEMENT_LP_CIK, {
  comparisonFallback: () =>
    unavailableComparisonPayload(POINT72_ASSET_MANAGEMENT_LP_CIK, "Point72 Asset Management, L.P."),
  transactionsFallback: () =>
    unavailableTransactionsPayload(POINT72_ASSET_MANAGEMENT_LP_CIK, "Point72 Asset Management, L.P."),
});

export const getFirstEagleProfilePage = createSuperinvestorProfilePageLoader(
  FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK,
  {
    comparisonFallback: () =>
      unavailableComparisonPayload(
        FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK,
        "First Eagle Investment Management LLC",
      ),
    transactionsFallback: () =>
      unavailableTransactionsPayload(
        FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK,
        "First Eagle Investment Management LLC",
      ),
  },
);

export const getTciFundProfilePage = createSuperinvestorProfilePageLoader(TCI_FUND_MANAGEMENT_LTD_CIK, {
  comparisonFallback: () => unavailableComparisonPayload(TCI_FUND_MANAGEMENT_LTD_CIK, "TCI Fund Management Ltd"),
  transactionsFallback: () => unavailableTransactionsPayload(TCI_FUND_MANAGEMENT_LTD_CIK, "TCI Fund Management Ltd"),
});

export const getGmoProfilePage = createSuperinvestorProfilePageLoader(GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK, {
  comparisonFallback: () =>
    unavailableComparisonPayload(GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK, "Grantham, Mayo, Van Otterloo & Co. LLC"),
  transactionsFallback: () =>
    unavailableTransactionsPayload(GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK, "Grantham, Mayo, Van Otterloo & Co. LLC"),
});
















































/** In development, skip `unstable_cache` so layout/component edits and SEC responses are not masked by a warm cache. */
export async function getBerkshireHoldings() {
  return devMemoAsync("13f:berkshire:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", BERKSHIRE_CIK, fetchBerkshireHoldingsUncached),
  );
}

export async function getBerkshireHoldingsComparison() {
  return devMemoAsync("13f:berkshire:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v10", BERKSHIRE_CIK, fetchBerkshireComparisonUncached),
  );
}

export async function getBerkshireQuarterlyTransactions() {
  return devMemoAsync("13f:berkshire:transactions", () =>
    withAccessionKeyed13fCache(BERKSHIRE_HOLDINGS_TX_CACHE_PREFIX, BERKSHIRE_CIK, fetchBerkshireHoldingsScopedTransactionsUncached),
  );
}

export async function getPershingSquareHoldings() {
  return devMemoAsync("13f:pershing:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", PERSHING_SQUARE_CIK, fetchPershingHoldingsUncached),
  );
}

export async function getPershingSquareHoldingsComparison() {
  return devMemoAsync("13f:pershing:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", PERSHING_SQUARE_CIK, fetchPershingComparisonUncached),
  );
}

export async function getPershingSquareQuarterlyTransactions() {
  return devMemoAsync("13f:pershing:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", PERSHING_SQUARE_CIK, fetchPershingTransactionsUncached),
  );
}

export async function getFundsmithHoldings() {
  return devMemoAsync("13f:fundsmith:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", FUNDSMITH_LLP_CIK, fetchFundsmithHoldingsUncached),
  );
}

export async function getFundsmithHoldingsComparison() {
  return devMemoAsync("13f:fundsmith:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", FUNDSMITH_LLP_CIK, fetchFundsmithComparisonUncached),
  );
}

export async function getFundsmithQuarterlyTransactions() {
  return devMemoAsync("13f:fundsmith:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", FUNDSMITH_LLP_CIK, fetchFundsmithTransactionsUncached),
  );
}

export async function getScionHoldings() {
  return devMemoAsync("13f:scion:holdings:v2", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", SCION_ASSET_MANAGEMENT_CIK, fetchScionHoldingsUncached),
  );
}

export async function getScionHoldingsComparison() {
  return devMemoAsync("13f:scion:comparison:v2", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", SCION_ASSET_MANAGEMENT_CIK, fetchScionComparisonUncached),
  );
}

export async function getScionQuarterlyTransactions() {
  return devMemoAsync("13f:scion:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", SCION_ASSET_MANAGEMENT_CIK, fetchScionTransactionsUncached),
  );
}

export async function getArkHoldings() {
  return devMemoAsync("13f:ark:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", ARK_INVEST_CIK, fetchArkHoldingsUncached),
  );
}

export async function getArkHoldingsComparison() {
  return devMemoAsync("13f:ark:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", ARK_INVEST_CIK, fetchArkComparisonUncached),
  );
}

export async function getArkQuarterlyTransactions() {
  return devMemoAsync("13f:ark:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", ARK_INVEST_CIK, fetchArkTransactionsUncached),
  );
}

export async function getHimalayaHoldings() {
  return devMemoAsync("13f:himalaya:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", HIMALAYA_CAPITAL_CIK, fetchHimalayaHoldingsUncached),
  );
}

export async function getHimalayaHoldingsComparison() {
  return devMemoAsync("13f:himalaya:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", HIMALAYA_CAPITAL_CIK, fetchHimalayaComparisonUncached),
  );
}

export async function getHimalayaQuarterlyTransactions() {
  return devMemoAsync("13f:himalaya:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", HIMALAYA_CAPITAL_CIK, fetchHimalayaTransactionsUncached),
  );
}

export async function getBridgewaterHoldings() {
  return devMemoAsync("13f:bridgewater:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", BRIDGEWATER_ASSOCIATES_CIK, fetchBridgewaterHoldingsUncached),
  );
}

export async function getBridgewaterHoldingsComparison() {
  return devMemoAsync("13f:bridgewater:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", BRIDGEWATER_ASSOCIATES_CIK, fetchBridgewaterComparisonUncached),
  );
}

export async function getBridgewaterQuarterlyTransactions() {
  return devMemoAsync("13f:bridgewater:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", BRIDGEWATER_ASSOCIATES_CIK, fetchBridgewaterTransactionsUncached),
  );
}

export async function getFisherHoldings() {
  return devMemoAsync("13f:fisher:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", FISHER_ASSET_MANAGEMENT_CIK, fetchFisherHoldingsUncached),
  );
}

export async function getFisherHoldingsComparison() {
  return devMemoAsync("13f:fisher:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", FISHER_ASSET_MANAGEMENT_CIK, fetchFisherComparisonUncached),
  );
}

export async function getFisherQuarterlyTransactions() {
  return devMemoAsync("13f:fisher:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", FISHER_ASSET_MANAGEMENT_CIK, fetchFisherTransactionsUncached),
  );
}

export async function getPrimecapHoldings() {
  return devMemoAsync("13f:primecap:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", PRIMECAP_MANAGEMENT_CIK, fetchPrimecapHoldingsUncached),
  );
}

export async function getPrimecapHoldingsComparison() {
  return devMemoAsync("13f:primecap:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", PRIMECAP_MANAGEMENT_CIK, fetchPrimecapComparisonUncached),
  );
}

export async function getPrimecapQuarterlyTransactions() {
  return devMemoAsync("13f:primecap:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", PRIMECAP_MANAGEMENT_CIK, fetchPrimecapTransactionsUncached),
  );
}

export async function getCitadelHoldings() {
  return devMemoAsync("13f:citadel:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", CITADEL_ADVISORS_CIK, fetchCitadelHoldingsUncached),
  );
}

export async function getCitadelHoldingsComparison() {
  return devMemoAsync("13f:citadel:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", CITADEL_ADVISORS_CIK, fetchCitadelComparisonUncached),
  );
}

export async function getCitadelQuarterlyTransactions() {
  return devMemoAsync("13f:citadel:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", CITADEL_ADVISORS_CIK, fetchCitadelTransactionsUncached),
  );
}

export async function getDailyJournalHoldings() {
  return devMemoAsync("13f:daily-journal:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", DAILY_JOURNAL_CORP_CIK, fetchDailyJournalHoldingsUncached),
  );
}

export async function getDailyJournalHoldingsComparison() {
  return devMemoAsync("13f:daily-journal:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", DAILY_JOURNAL_CORP_CIK, fetchDailyJournalComparisonUncached),
  );
}

export async function getDailyJournalQuarterlyTransactions() {
  return devMemoAsync("13f:daily-journal:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", DAILY_JOURNAL_CORP_CIK, fetchDailyJournalTransactionsUncached),
  );
}

export async function getBlackrockHoldings() {
  return devMemoAsync("13f:blackrock:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", BLACKROCK_INC_CIK, fetchBlackrockHoldingsUncached),
  );
}

export async function getBlackrockHoldingsComparison() {
  return devMemoAsync("13f:blackrock:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", BLACKROCK_INC_CIK, fetchBlackrockComparisonUncached),
  );
}

export async function getBlackrockQuarterlyTransactions() {
  return devMemoAsync("13f:blackrock:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", BLACKROCK_INC_CIK, fetchBlackrockTransactionsUncached),
  );
}

export async function getBaillieGiffordHoldings() {
  return devMemoAsync("13f:baillie-gifford:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", BAILLIE_GIFFORD_CO_CIK, fetchBaillieGiffordHoldingsUncached),
  );
}

export async function getBaillieGiffordHoldingsComparison() {
  return devMemoAsync("13f:baillie-gifford:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", BAILLIE_GIFFORD_CO_CIK, fetchBaillieGiffordComparisonUncached),
  );
}

export async function getBaillieGiffordQuarterlyTransactions() {
  return devMemoAsync("13f:baillie-gifford:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", BAILLIE_GIFFORD_CO_CIK, fetchBaillieGiffordTransactionsUncached),
  );
}

export async function getRenaissanceTechnologiesHoldings() {
  return devMemoAsync("13f:renaissance:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", RENAISSANCE_TECHNOLOGIES_LLC_CIK, fetchRenaissanceHoldingsUncached),
  );
}

export async function getRenaissanceTechnologiesHoldingsComparison() {
  return devMemoAsync("13f:renaissance:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", RENAISSANCE_TECHNOLOGIES_LLC_CIK, fetchRenaissanceComparisonUncached),
  );
}

export async function getRenaissanceTechnologiesQuarterlyTransactions() {
  return devMemoAsync("13f:renaissance:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", RENAISSANCE_TECHNOLOGIES_LLC_CIK, fetchRenaissanceTransactionsUncached),
  );
}

export async function getPoint72Holdings() {
  return devMemoAsync("13f:point72:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", POINT72_ASSET_MANAGEMENT_LP_CIK, fetchPoint72HoldingsUncached),
  );
}

export async function getPoint72HoldingsComparison() {
  return devMemoAsync("13f:point72:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", POINT72_ASSET_MANAGEMENT_LP_CIK, fetchPoint72ComparisonUncached),
  );
}

export async function getPoint72QuarterlyTransactions() {
  return devMemoAsync("13f:point72:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", POINT72_ASSET_MANAGEMENT_LP_CIK, fetchPoint72TransactionsUncached),
  );
}

export async function getFirstEagleHoldings() {
  return devMemoAsync("13f:first-eagle:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK, fetchFirstEagleHoldingsUncached),
  );
}

export async function getFirstEagleHoldingsComparison() {
  return devMemoAsync("13f:first-eagle:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK, fetchFirstEagleComparisonUncached),
  );
}

export async function getFirstEagleQuarterlyTransactions() {
  return devMemoAsync("13f:first-eagle:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", FIRST_EAGLE_INVESTMENT_MANAGEMENT_LLC_CIK, fetchFirstEagleTransactionsUncached),
  );
}

export async function getTciFundHoldings() {
  return devMemoAsync("13f:tci-fund:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", TCI_FUND_MANAGEMENT_LTD_CIK, fetchTciFundHoldingsUncached),
  );
}

export async function getTciFundHoldingsComparison() {
  return devMemoAsync("13f:tci-fund:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", TCI_FUND_MANAGEMENT_LTD_CIK, fetchTciFundComparisonUncached),
  );
}

export async function getTciFundQuarterlyTransactions() {
  return devMemoAsync("13f:tci-fund:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", TCI_FUND_MANAGEMENT_LTD_CIK, fetchTciFundTransactionsUncached),
  );
}

export async function getGmoHoldings() {
  return devMemoAsync("13f:gmo:holdings", () =>
    withAccessionKeyed13fCache("superinvestor-13f-holdings-v7", GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK, fetchGmoHoldingsUncached),
  );
}

export async function getGmoHoldingsComparison() {
  return devMemoAsync("13f:gmo:comparison", () =>
    withAccessionKeyed13fCache("superinvestor-13f-comparison-v9", GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK, fetchGmoComparisonUncached),
  );
}

export async function getGmoQuarterlyTransactions() {
  return devMemoAsync("13f:gmo:transactions", () =>
    withAccessionKeyed13fCache("superinvestor-13f-transactions-v7", GRANTHAM_MAYO_VAN_OTTERLOO_LLC_CIK, fetchGmoTransactionsUncached),
  );
}
