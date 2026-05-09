import "server-only";

import { unstable_cache } from "next/cache";

import { getSecEdgarUserAgent } from "@/lib/env/server";
import type {
  Berkshire13fComparisonPayload,
  Berkshire13fComparisonRow,
  Berkshire13fFilingMeta,
  Berkshire13fSoldOutRow,
  Holding13fComparisonStatus,
  InstitutionalHoldingRow,
  InstitutionalHoldingsPayload,
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
  return v;
}

async function secFetch(url: string, init: RequestInit & { headers: HeadersInit }): Promise<Response> {
  let attempt = 0;
  let backoffMs = 400;
  // Retry a few times on SEC throttling (429).
  for (;;) {
    const res = await fetch(url, init);
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
const BERKSHIRE_FIXTURE_CURRENT_FILING_DATE = "2026-02-17";
const BERKSHIRE_FIXTURE_CURRENT_REPORT_DATE = "2025-12-31";
const BERKSHIRE_FIXTURE_PREVIOUS_FILING_DATE = "2025-11-14";
const BERKSHIRE_FIXTURE_PREVIOUS_REPORT_DATE = "2025-09-30";

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

type SubmissionsRoot = {
  cik?: string;
  name?: string;
  filings?: { recent?: SubmissionsRecent };
};

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

function findAll13fHrIndices(forms: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < forms.length; i++) {
    const f = forms[i] ?? "";
    if (f === "13F-HR" || f === "13F-HR/A") out.push(i);
  }
  return out;
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
  const subUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
  const subRes = await secFetch(subUrl, {
    headers: { "User-Agent": ua, Accept: "application/json" },
    cache: "no-store",
  });
  if (!subRes.ok) return null;

  const root = (await subRes.json()) as SubmissionsRoot;
  const filerName =
    typeof root.name === "string" && root.name.trim() ? root.name.trim() : "Institutional investment manager";
  const recent = root.filings?.recent;
  const forms = recent?.form ?? [];
  const accessionNumbers = recent?.accessionNumber ?? [];
  const filingDates = recent?.filingDate ?? [];
  const reportDates = recent?.reportDate ?? [];

  const indices = findAll13fHrIndices(forms);
  const idx = indices[ordinal];
  if (idx === undefined || !accessionNumbers[idx]) return null;

  const accession = accessionNumbers[idx]!;
  const filingDate = filingDates[idx] ?? null;
  const reportDate = reportDates[idx] ?? null;

  const infotableUrl = await findInfotableXmlUrl(accession, ua, cikPadded);
  if (!infotableUrl) return null;

  const xmlRes = await secFetch(infotableUrl, {
    headers: { "User-Agent": ua, Accept: "application/xml,text/xml,*/*" },
    cache: "no-store",
  });
  if (!xmlRes.ok) return null;
  const xml = await xmlRes.text();
  return { xml, accession, filingDate, reportDate, filerName };
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
    const sharesDelta =
      hasPrior && p != null && curShares != null && prevShares != null ? curShares - prevShares : null;
    const sharesChangePct = sharesChangePctFromPrior(curShares, prevShares, hasPrior && p != null);

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
  const ua = getSecEdgarUserAgent();
  try {
    const cur = await fetchNth13fInfotableXml(cik, ua, 0);
    if (!cur) return null;

    const prev = await fetchNth13fInfotableXml(cik, ua, 1);
    const curParsed = parseInfoTableRows(cur.xml);
    const curAgg = aggregateInfoRowsByCusip(curParsed);
    if (curAgg.length === 0) return null;

    const prevAgg = prev ? aggregateInfoRowsByCusip(parseInfoTableRows(prev.xml)) : null;
    const hasPriorFiling = (prevAgg?.length ?? 0) > 0;
    const { rows, soldOut, previousTotalUsd } = buildComparisonRows(curAgg, prevAgg);

    const prevMeta: Berkshire13fFilingMeta | null = hasPriorFiling
      ? {
          accessionNumber: prev!.accession,
          filingDate: prev!.filingDate,
          reportDate: prev!.reportDate,
        }
      : null;

    const curMeta: Berkshire13fFilingMeta = {
      accessionNumber: cur.accession,
      filingDate: cur.filingDate,
      reportDate: cur.reportDate,
    };

    return {
      filerDisplayName: cur.filerName,
      cik,
      current: curMeta,
      previous: hasPriorFiling ? prevMeta : null,
      hasPriorFiling,
      totalValueUsd: curAgg.reduce((s, r) => s + r.valueThousands * 1000, 0),
      previousTotalValueUsd: previousTotalUsd,
      positionCount: rows.length,
      rows,
      soldOut,
      source: "edgar",
    };
  } catch {
    return null;
  }
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

async function fetchPershingHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (await fetchInstitutionalHoldingsUncached(PERSHING_SQUARE_CIK)) ?? loadPershingFixtureHoldingsPayload();
}

async function fetchPershingComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (await fetchInstitutionalComparisonUncached(PERSHING_SQUARE_CIK)) ?? loadPershingFixtureComparisonPayload();
}

async function fetchFundsmithHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  return (await fetchInstitutionalHoldingsUncached(FUNDSMITH_LLP_CIK)) ?? loadFundsmithFixtureHoldingsPayload();
}

async function fetchFundsmithComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  return (await fetchInstitutionalComparisonUncached(FUNDSMITH_LLP_CIK)) ?? loadFundsmithFixtureComparisonPayload();
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

const getBerkshireHoldingsCached = unstable_cache(
  async () => fetchBerkshireHoldingsUncached(),
  ["berkshire-hathaway-13f-v10-ticker-cusip-map"],
  { revalidate: 21_600 },
);

const getBerkshireHoldingsComparisonCached = unstable_cache(
  async () => fetchBerkshireComparisonUncached(),
  ["berkshire-hathaway-13f-comparison-v8-ticker-cusip-map"],
  { revalidate: 21_600 },
);

const getPershingHoldingsCached = unstable_cache(
  async () => fetchPershingHoldingsUncached(),
  ["pershing-square-13f-v4-holdings-fixture-fallback"],
  { revalidate: 21_600 },
);

const getPershingHoldingsComparisonCached = unstable_cache(
  async () => fetchPershingComparisonUncached(),
  ["pershing-square-13f-v4-comparison-fixture-fallback"],
  { revalidate: 21_600 },
);

const getFundsmithHoldingsCached = unstable_cache(
  async () => fetchFundsmithHoldingsUncached(),
  ["fundsmith-llp-13f-v5-holdings-fixture-fallback"],
  { revalidate: 21_600 },
);

const getFundsmithHoldingsComparisonCached = unstable_cache(
  async () => fetchFundsmithComparisonUncached(),
  ["fundsmith-llp-13f-v5-comparison-fixture-fallback"],
  { revalidate: 21_600 },
);

const getScionHoldingsCached = unstable_cache(
  async () => fetchScionHoldingsUncached(),
  ["scion-asset-management-13f-v1"],
  { revalidate: 21_600 },
);

const getScionHoldingsComparisonCached = unstable_cache(
  async () => fetchScionComparisonUncached(),
  ["scion-asset-management-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getArkHoldingsCached = unstable_cache(async () => fetchArkHoldingsUncached(), ["ark-invest-13f-v1"], { revalidate: 21_600 });

const getArkHoldingsComparisonCached = unstable_cache(
  async () => fetchArkComparisonUncached(),
  ["ark-invest-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getHimalayaHoldingsCached = unstable_cache(
  async () => fetchHimalayaHoldingsUncached(),
  ["himalaya-capital-13f-v1"],
  { revalidate: 21_600 },
);

const getHimalayaHoldingsComparisonCached = unstable_cache(
  async () => fetchHimalayaComparisonUncached(),
  ["himalaya-capital-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getBridgewaterHoldingsCached = unstable_cache(
  async () => fetchBridgewaterHoldingsUncached(),
  ["bridgewater-associates-13f-v1"],
  { revalidate: 21_600 },
);

const getBridgewaterHoldingsComparisonCached = unstable_cache(
  async () => fetchBridgewaterComparisonUncached(),
  ["bridgewater-associates-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getFisherHoldingsCached = unstable_cache(async () => fetchFisherHoldingsUncached(), ["fisher-asset-management-13f-v1"], {
  revalidate: 21_600,
});

const getFisherHoldingsComparisonCached = unstable_cache(
  async () => fetchFisherComparisonUncached(),
  ["fisher-asset-management-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getPrimecapHoldingsCached = unstable_cache(async () => fetchPrimecapHoldingsUncached(), ["primecap-management-13f-v1"], {
  revalidate: 21_600,
});

const getPrimecapHoldingsComparisonCached = unstable_cache(
  async () => fetchPrimecapComparisonUncached(),
  ["primecap-management-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getCitadelHoldingsCached = unstable_cache(async () => fetchCitadelHoldingsUncached(), ["citadel-advisors-13f-v1"], {
  revalidate: 21_600,
});

const getCitadelHoldingsComparisonCached = unstable_cache(
  async () => fetchCitadelComparisonUncached(),
  ["citadel-advisors-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getDailyJournalHoldingsCached = unstable_cache(
  async () => fetchDailyJournalHoldingsUncached(),
  ["daily-journal-corp-13f-v1"],
  { revalidate: 21_600 },
);

const getDailyJournalHoldingsComparisonCached = unstable_cache(
  async () => fetchDailyJournalComparisonUncached(),
  ["daily-journal-corp-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getBlackrockHoldingsCached = unstable_cache(async () => fetchBlackrockHoldingsUncached(), ["blackrock-inc-13f-v1"], {
  revalidate: 21_600,
});

const getBlackrockHoldingsComparisonCached = unstable_cache(
  async () => fetchBlackrockComparisonUncached(),
  ["blackrock-inc-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getBaillieGiffordHoldingsCached = unstable_cache(
  async () => fetchBaillieGiffordHoldingsUncached(),
  ["baillie-gifford-co-13f-v1"],
  { revalidate: 21_600 },
);

const getBaillieGiffordHoldingsComparisonCached = unstable_cache(
  async () => fetchBaillieGiffordComparisonUncached(),
  ["baillie-gifford-co-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getRenaissanceHoldingsCached = unstable_cache(
  async () => fetchRenaissanceHoldingsUncached(),
  ["renaissance-technologies-llc-13f-v1"],
  { revalidate: 21_600 },
);

const getRenaissanceHoldingsComparisonCached = unstable_cache(
  async () => fetchRenaissanceComparisonUncached(),
  ["renaissance-technologies-llc-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getPoint72HoldingsCached = unstable_cache(async () => fetchPoint72HoldingsUncached(), ["point72-asset-management-13f-v1"], {
  revalidate: 21_600,
});

const getPoint72HoldingsComparisonCached = unstable_cache(
  async () => fetchPoint72ComparisonUncached(),
  ["point72-asset-management-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getFirstEagleHoldingsCached = unstable_cache(
  async () => fetchFirstEagleHoldingsUncached(),
  ["first-eagle-investment-management-13f-v1"],
  { revalidate: 21_600 },
);

const getFirstEagleHoldingsComparisonCached = unstable_cache(
  async () => fetchFirstEagleComparisonUncached(),
  ["first-eagle-investment-management-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getTciFundHoldingsCached = unstable_cache(async () => fetchTciFundHoldingsUncached(), ["tci-fund-management-13f-v1"], {
  revalidate: 21_600,
});

const getTciFundHoldingsComparisonCached = unstable_cache(
  async () => fetchTciFundComparisonUncached(),
  ["tci-fund-management-13f-comparison-v1"],
  { revalidate: 21_600 },
);

const getGmoHoldingsCached = unstable_cache(
  async () => fetchGmoHoldingsUncached(),
  ["grantham-mayo-van-otterloo-13f-v1"],
  { revalidate: 21_600 },
);

const getGmoHoldingsComparisonCached = unstable_cache(
  async () => fetchGmoComparisonUncached(),
  ["grantham-mayo-van-otterloo-13f-comparison-v1"],
  { revalidate: 21_600 },
);

/** In development, skip `unstable_cache` so layout/component edits and SEC responses are not masked by a warm cache. */
export async function getBerkshireHoldings() {
  return devMemoAsync("13f:berkshire:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchBerkshireHoldingsUncached() : getBerkshireHoldingsCached(),
  );
}

export async function getBerkshireHoldingsComparison() {
  return devMemoAsync("13f:berkshire:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchBerkshireComparisonUncached() : getBerkshireHoldingsComparisonCached(),
  );
}

export async function getPershingSquareHoldings() {
  return devMemoAsync("13f:pershing:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchPershingHoldingsUncached() : getPershingHoldingsCached(),
  );
}

export async function getPershingSquareHoldingsComparison() {
  return devMemoAsync("13f:pershing:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchPershingComparisonUncached() : getPershingHoldingsComparisonCached(),
  );
}

export async function getFundsmithHoldings() {
  return devMemoAsync("13f:fundsmith:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchFundsmithHoldingsUncached() : getFundsmithHoldingsCached(),
  );
}

export async function getFundsmithHoldingsComparison() {
  return devMemoAsync("13f:fundsmith:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchFundsmithComparisonUncached() : getFundsmithHoldingsComparisonCached(),
  );
}

export async function getScionHoldings() {
  return devMemoAsync("13f:scion:holdings:v2", () =>
    process.env.NODE_ENV !== "production" ? fetchScionHoldingsUncached() : getScionHoldingsCached(),
  );
}

export async function getScionHoldingsComparison() {
  return devMemoAsync("13f:scion:comparison:v2", () =>
    process.env.NODE_ENV !== "production" ? fetchScionComparisonUncached() : getScionHoldingsComparisonCached(),
  );
}

export async function getArkHoldings() {
  return devMemoAsync("13f:ark:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchArkHoldingsUncached() : getArkHoldingsCached(),
  );
}

export async function getArkHoldingsComparison() {
  return devMemoAsync("13f:ark:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchArkComparisonUncached() : getArkHoldingsComparisonCached(),
  );
}

export async function getHimalayaHoldings() {
  return devMemoAsync("13f:himalaya:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchHimalayaHoldingsUncached() : getHimalayaHoldingsCached(),
  );
}

export async function getHimalayaHoldingsComparison() {
  return devMemoAsync("13f:himalaya:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchHimalayaComparisonUncached() : getHimalayaHoldingsComparisonCached(),
  );
}

export async function getBridgewaterHoldings() {
  return devMemoAsync("13f:bridgewater:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchBridgewaterHoldingsUncached() : getBridgewaterHoldingsCached(),
  );
}

export async function getBridgewaterHoldingsComparison() {
  return devMemoAsync("13f:bridgewater:comparison", () =>
    process.env.NODE_ENV !== "production"
      ? fetchBridgewaterComparisonUncached()
      : getBridgewaterHoldingsComparisonCached(),
  );
}

export async function getFisherHoldings() {
  return devMemoAsync("13f:fisher:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchFisherHoldingsUncached() : getFisherHoldingsCached(),
  );
}

export async function getFisherHoldingsComparison() {
  return devMemoAsync("13f:fisher:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchFisherComparisonUncached() : getFisherHoldingsComparisonCached(),
  );
}

export async function getPrimecapHoldings() {
  return devMemoAsync("13f:primecap:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchPrimecapHoldingsUncached() : getPrimecapHoldingsCached(),
  );
}

export async function getPrimecapHoldingsComparison() {
  return devMemoAsync("13f:primecap:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchPrimecapComparisonUncached() : getPrimecapHoldingsComparisonCached(),
  );
}

export async function getCitadelHoldings() {
  return devMemoAsync("13f:citadel:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchCitadelHoldingsUncached() : getCitadelHoldingsCached(),
  );
}

export async function getCitadelHoldingsComparison() {
  return devMemoAsync("13f:citadel:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchCitadelComparisonUncached() : getCitadelHoldingsComparisonCached(),
  );
}

export async function getDailyJournalHoldings() {
  return devMemoAsync("13f:daily-journal:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchDailyJournalHoldingsUncached() : getDailyJournalHoldingsCached(),
  );
}

export async function getDailyJournalHoldingsComparison() {
  return devMemoAsync("13f:daily-journal:comparison", () =>
    process.env.NODE_ENV !== "production"
      ? fetchDailyJournalComparisonUncached()
      : getDailyJournalHoldingsComparisonCached(),
  );
}

export async function getBlackrockHoldings() {
  return devMemoAsync("13f:blackrock:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchBlackrockHoldingsUncached() : getBlackrockHoldingsCached(),
  );
}

export async function getBlackrockHoldingsComparison() {
  return devMemoAsync("13f:blackrock:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchBlackrockComparisonUncached() : getBlackrockHoldingsComparisonCached(),
  );
}

export async function getBaillieGiffordHoldings() {
  return devMemoAsync("13f:baillie-gifford:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchBaillieGiffordHoldingsUncached() : getBaillieGiffordHoldingsCached(),
  );
}

export async function getBaillieGiffordHoldingsComparison() {
  return devMemoAsync("13f:baillie-gifford:comparison", () =>
    process.env.NODE_ENV !== "production"
      ? fetchBaillieGiffordComparisonUncached()
      : getBaillieGiffordHoldingsComparisonCached(),
  );
}

export async function getRenaissanceTechnologiesHoldings() {
  return devMemoAsync("13f:renaissance:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchRenaissanceHoldingsUncached() : getRenaissanceHoldingsCached(),
  );
}

export async function getRenaissanceTechnologiesHoldingsComparison() {
  return devMemoAsync("13f:renaissance:comparison", () =>
    process.env.NODE_ENV !== "production"
      ? fetchRenaissanceComparisonUncached()
      : getRenaissanceHoldingsComparisonCached(),
  );
}

export async function getPoint72Holdings() {
  return devMemoAsync("13f:point72:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchPoint72HoldingsUncached() : getPoint72HoldingsCached(),
  );
}

export async function getPoint72HoldingsComparison() {
  return devMemoAsync("13f:point72:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchPoint72ComparisonUncached() : getPoint72HoldingsComparisonCached(),
  );
}

export async function getFirstEagleHoldings() {
  return devMemoAsync("13f:first-eagle:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchFirstEagleHoldingsUncached() : getFirstEagleHoldingsCached(),
  );
}

export async function getFirstEagleHoldingsComparison() {
  return devMemoAsync("13f:first-eagle:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchFirstEagleComparisonUncached() : getFirstEagleHoldingsComparisonCached(),
  );
}

export async function getTciFundHoldings() {
  return devMemoAsync("13f:tci-fund:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchTciFundHoldingsUncached() : getTciFundHoldingsCached(),
  );
}

export async function getTciFundHoldingsComparison() {
  return devMemoAsync("13f:tci-fund:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchTciFundComparisonUncached() : getTciFundHoldingsComparisonCached(),
  );
}

export async function getGmoHoldings() {
  return devMemoAsync("13f:gmo:holdings", () =>
    process.env.NODE_ENV !== "production" ? fetchGmoHoldingsUncached() : getGmoHoldingsCached(),
  );
}

export async function getGmoHoldingsComparison() {
  return devMemoAsync("13f:gmo:comparison", () =>
    process.env.NODE_ENV !== "production" ? fetchGmoComparisonUncached() : getGmoHoldingsComparisonCached(),
  );
}
