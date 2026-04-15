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

/** Berkshire Hathaway Inc. — SEC central index key (zero-padded). */
const BERKSHIRE_CIK = "0001067983";

/** Optional display tickers for common 13F CUSIPs (SEC filings do not include symbols). */
const KNOWN_CUSIP_TICKER: Record<string, string> = {
  "037833100": "AAPL",
  "025537101": "AXP",
  "060505104": "BAC",
  "191216100": "KO",
  "166764100": "CVX",
  "615369105": "MCO",
  "674599105": "OXY",
  "H1467J104": "CB",
  "500754106": "KHC",
  "02079K305": "GOOGL",
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

function parseInfoTableRows(xml: string): ParsedInfoRow[] {
  const rows: ParsedInfoRow[] = [];
  const re = /<(?:[\w.-]+:)?infoTable[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?infoTable>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1] ?? "";
    const issuer = extractTagContent(block, "nameOfIssuer");
    const title = extractTagContent(block, "titleOfClass");
    const valueStr = extractTagContent(block, "value");
    const cusipRaw = extractTagContent(block, "cusip");
    if (!issuer || !valueStr) continue;
    const valueThousands = Number.parseInt(valueStr.replace(/,/g, ""), 10);
    if (!Number.isFinite(valueThousands) || valueThousands < 0) continue;
    const cusip = cusipRaw?.trim() || null;
    const shares = extractSharesFromInfoTableBlock(block);
    rows.push({ issuer, title: title || null, valueThousands, cusip, shares });
  }
  return rows;
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

async function findInfotableXmlUrl(cikNumeric: string, accessionDashed: string, ua: string): Promise<string | null> {
  const acc = accessionDashed.replace(/-/g, "");
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNumeric}/${acc}`;
  const headers: HeadersInit = { "User-Agent": ua, "Accept-Encoding": "gzip, deflate" };

  for (const name of ["infotable.xml", "Infotable.xml"]) {
    const url = `${base}/${name}`;
    const r = await fetch(url, { headers, cache: "no-store" });
    if (r.ok) return url;
  }

  const jRes = await fetch(`${base}/index.json`, { headers, cache: "no-store" });
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
          const r = await fetch(url, { headers, cache: "no-store" });
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
        const r = await fetch(url, { headers, cache: "no-store" });
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

  const hRes = await fetch(`${base}/index.htm`, { headers, cache: "no-store" });
  if (hRes.ok) {
    const html = await hRes.text();
    const hrefMatch = html.match(/href="([^"]*infotable\.xml[^"]*)"/i);
    if (hrefMatch?.[1]) {
      const tail = hrefMatch[1]!.replace(/^.*\//, "");
      const url = `${base}/${tail}`;
      const r = await fetch(url, { headers, cache: "no-store" });
      if (r.ok) return url;
    }
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
  const subRes = await fetch(subUrl, {
    headers: { "User-Agent": ua, Accept: "application/json" },
    cache: "no-store",
  });
  if (!subRes.ok) return null;

  const root = (await subRes.json()) as SubmissionsRoot;
  const filerName =
    typeof root.name === "string" && root.name.trim() ? root.name.trim() : "Berkshire Hathaway Inc.";
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

  const cikNumeric = String(Number.parseInt(cikPadded, 10));
  const infotableUrl = await findInfotableXmlUrl(cikNumeric, accession, ua);
  if (!infotableUrl) return null;

  const xmlRes = await fetch(infotableUrl, {
    headers: { "User-Agent": ua, Accept: "application/xml,text/xml,*/*" },
    cache: "no-store",
  });
  if (!xmlRes.ok) return null;
  const xml = await xmlRes.text();
  return { xml, accession, filingDate, reportDate, filerName };
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
      ticker: tickerForCusip(c.cusip),
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
        ticker: tickerForCusip(p.cusip),
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
    source: "edgar" | "fixture";
  },
): InstitutionalHoldingsPayload {
  const valueUsdList = rows.map((r) => r.valueThousands * 1000);
  const totalValueUsd = valueUsdList.reduce((s, v) => s + v, 0);
  const holdings: InstitutionalHoldingRow[] = rows.map((r, i) => ({
    issuer: r.issuer,
    titleOfClass: r.title,
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
    filingDate: null,
    reportDate: null,
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

/** Prior-period snapshot: slightly different weights; still includes names later sold out of the “current” fixture. */
function buildSyntheticPreviousForFixture(base: AggregatedHolding[]): AggregatedHolding[] {
  return base.map((r, i) => ({
    ...r,
    valueThousands: Math.round(r.valueThousands * (i === 0 ? 0.86 : i === 1 ? 1.04 : 0.992)),
    shares: r.shares != null ? Math.round(r.shares * (i === 0 ? 0.86 : i === 1 ? 1.04 : 0.992)) : null,
  }));
}

function loadFixtureComparisonPayload(): Berkshire13fComparisonPayload {
  const j = berkshireFallback as { filerDisplayName: string; cik: string };
  const baseAgg = fixtureCurrentAggregated();
  const previousAgg = buildSyntheticPreviousForFixture(baseAgg);
  const soldNames = new Set(["Diageo Plc ADR", "Atlanta Braves Holdings Inc. Series C"]);
  const currentCore = baseAgg.filter((r) => !soldNames.has(r.issuer));
  const extraNew: AggregatedHolding = {
    issuer: "Nu Holdings Ltd.",
    title: "COM CL A",
    valueThousands: Math.round(35_000_000 / 1000),
    cusip: syntheticFixtureCusip("Nu Holdings Ltd.", 999),
    shares: 2_000_000,
  };
  const currentWithNew = [...currentCore, extraNew];
  const { rows, soldOut, previousTotalUsd } = buildComparisonRows(currentWithNew, previousAgg);
  return {
    filerDisplayName: j.filerDisplayName,
    cik: j.cik,
    current: { accessionNumber: null, filingDate: null, reportDate: "2024-09-30" },
    previous: { accessionNumber: null, filingDate: null, reportDate: "2024-06-30" },
    hasPriorFiling: true,
    totalValueUsd: currentWithNew.reduce((s, r) => s + r.valueThousands * 1000, 0),
    previousTotalValueUsd: previousTotalUsd,
    positionCount: rows.length,
    rows,
    soldOut,
    source: "fixture",
  };
}

async function fetchBerkshireHoldingsUncached(): Promise<InstitutionalHoldingsPayload> {
  const ua = getSecEdgarUserAgent();
  try {
    const got = await fetchNth13fInfotableXml(BERKSHIRE_CIK, ua, 0);
    if (!got) return loadFixturePayload();
    const parsed = parseInfoTableRows(got.xml);
    const merged = aggregateInfoRowsByCusip(parsed);
    if (merged.length === 0) return loadFixturePayload();

    return rowsToPayload(merged, {
      filerDisplayName: got.filerName,
      cik: BERKSHIRE_CIK,
      accession: got.accession,
      filingDate: got.filingDate,
      reportDate: got.reportDate,
      source: "edgar",
    });
  } catch {
    return loadFixturePayload();
  }
}

async function fetchBerkshireComparisonUncached(): Promise<Berkshire13fComparisonPayload> {
  const ua = getSecEdgarUserAgent();
  try {
    const cur = await fetchNth13fInfotableXml(BERKSHIRE_CIK, ua, 0);
    if (!cur) return loadFixtureComparisonPayload();

    const prev = await fetchNth13fInfotableXml(BERKSHIRE_CIK, ua, 1);
    const curParsed = parseInfoTableRows(cur.xml);
    const curAgg = aggregateInfoRowsByCusip(curParsed);
    if (curAgg.length === 0) return loadFixtureComparisonPayload();

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
      cik: BERKSHIRE_CIK,
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
    return loadFixtureComparisonPayload();
  }
}

const getBerkshireHoldingsCached = unstable_cache(
  async () => fetchBerkshireHoldingsUncached(),
  ["berkshire-hathaway-13f-v5-index-xml-cusip"],
  { revalidate: 21_600 },
);

const getBerkshireHoldingsComparisonCached = unstable_cache(
  async () => fetchBerkshireComparisonUncached(),
  ["berkshire-hathaway-13f-comparison-v3-shares-pct-col"],
  { revalidate: 21_600 },
);

/** In development, skip `unstable_cache` so layout/component edits and SEC responses are not masked by a warm cache. */
export async function getBerkshireHoldings() {
  if (process.env.NODE_ENV !== "production") {
    return fetchBerkshireHoldingsUncached();
  }
  return getBerkshireHoldingsCached();
}

export async function getBerkshireHoldingsComparison() {
  if (process.env.NODE_ENV !== "production") {
    return fetchBerkshireComparisonUncached();
  }
  return getBerkshireHoldingsComparisonCached();
}
