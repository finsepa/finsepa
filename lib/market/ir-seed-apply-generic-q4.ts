import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
} from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  buildQ4CdnFilingsCandidates,
  buildQ4CdnSlidesCandidates,
  filterQ4CdnPdfLinksForQuarter,
  q4CdnQuarterDir,
} from "@/lib/market/q4cdn-earnings-pdf-patterns";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const FETCH_MS = 12_000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

type Q4CdnBase = {
  filesBase: string;
  financialsBase: string;
};

export type GenericQ4DocumentOptions = {
  preview?: boolean;
  fyEndMonthDay?: string | null;
};

function extractQ4CdnBaseFromHtml(html: string): Q4CdnBase | null {
  const re = /https?:\/\/s\d+\.q4cdn\.com\/\d+\/files\b/gi;
  const m = html.match(re);
  const hit = m?.[0] ?? null;
  if (!hit) return null;
  const filesBase = hit.replace(/\/+$/, "");
  return { filesBase, financialsBase: `${filesBase}/doc_financials` };
}

function extractAbsolutePdfLinks(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return out;
  }

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const raw = (m[1] ?? "").replace(/&amp;/g, "&").trim();
    if (!raw || raw.startsWith("javascript:") || raw === "#") continue;
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      continue;
    }
    if (!/\.pdf(\?|#|$)/i.test(abs.pathname + abs.search + abs.hash)) continue;
    out.push(abs.href.split("#")[0]!);
  }
  return [...new Set(out)];
}

function scoreSlidePdfName(file: string): number {
  const n = file.toLowerCase();
  if (!n.endsWith(".pdf")) return -1;
  if (/present|presentation|slides|deck|webslides/.test(n)) return 800;
  if (/supplement|operational|data/.test(n)) return 300;
  return 40;
}

function scoreFilingPdfName(file: string): number {
  const n = file.toLowerCase();
  if (!n.endsWith(".pdf")) return -1;
  if (/earnings[-_ ]?release|results|exhibit[-_ ]?99|ex[-_ ]?99|press[-_ ]?release|financial[-_ ]?results/.test(n))
    return 800;
  if (/10-?q|10-?k|form[-_ ]?10/.test(n)) return 600;
  return 30;
}

function pickBestPdfFromList(urls: string[], score: (file: string) => number): string | null {
  const ranked = urls
    .map((u) => ({ u, s: score(decodeURIComponent(u.split("/").pop()?.split("?")[0] ?? "")) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.u ?? null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("text/html") && !ct.toLowerCase().includes("application/xhtml")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function headResolvePdfUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": UA },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("text/html")) return null;
    const final = res.url || url;
    if (!/\.pdf(\?|$)/i.test(final)) return null;
    return final;
  } catch {
    return null;
  }
}

function domainFromCompanyWebsite(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = host.split(".").filter(Boolean);
    if (parts.length < 2) return null;
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

function buildIrSeedUrls(hub: StockEarningsDocumentHub): string[] {
  const out: string[] = [];
  if (hub.irWebsite && /^https?:\/\//i.test(hub.irWebsite)) out.push(hub.irWebsite);
  if (hub.companyWebsite && /^https?:\/\//i.test(hub.companyWebsite)) out.push(hub.companyWebsite);

  const root = domainFromCompanyWebsite(hub.companyWebsite);
  if (root) {
    out.push(`https://investor.${root}/`);
    out.push(`https://ir.${root}/`);
    out.push(`https://investors.${root}/`);
    out.push(`https://${root}/investor-relations/`);
    out.push(`https://${root}/investors/`);
  }
  return [...new Set(out)];
}

function buildCommonQuarterlyEarningsPages(seed: string, preview: boolean): string[] {
  let u: URL | null = null;
  try {
    u = new URL(seed);
  } catch {
    return [];
  }
  const origin = u.origin;
  if (preview) return [seed];
  return [
    seed,
    `${origin}/financial-information/quarterly-earnings/`,
    `${origin}/financials/`,
    `${origin}/quarterly-results/`,
    `${origin}/events-and-presentations/`,
  ];
}

function parseRowFiscalQuarter(
  row: StockEarningsHistoryRow,
  fyEndMonthDay: string | null,
): { fq: number; fy: number } | null {
  const fromYmd = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, fyEndMonthDay);
  if (fromYmd) return fromYmd;
  return fiscalQuarterFromLabel(row.fiscalPeriodLabel);
}

function rowNeedsSlides(row: StockEarningsHistoryRow): boolean {
  return row.reported && !isDirectEarningsPdfUrl(row.secSlidesUrl);
}

function rowNeedsFilings(row: StockEarningsHistoryRow): boolean {
  return row.reported && !isEarningsFilingsPreviewUrl(row.secFilingsUrl);
}

function rowNeedsDocuments(row: StockEarningsHistoryRow): boolean {
  return rowNeedsSlides(row) || rowNeedsFilings(row);
}

/**
 * Default universe path for Q4 Inc. investor sites:
 * discover CDN from IR HTML → scrape quarter PDF links → HEAD-probe known patterns.
 */
export async function applyIrSeedGenericQ4DocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: GenericQ4DocumentOptions,
): Promise<StockEarningsHistoryRow[]> {
  const preview = options?.preview === true;
  const fyEndMonthDay = options?.fyEndMonthDay ?? null;
  const maxRows = preview ? 2 : 8;
  const maxHeadProbes = preview ? 36 : 140;

  const seeds = buildIrSeedUrls(hub).filter((u) => /^https?:\/\//i.test(u));
  if (seeds.length === 0) return rows;

  const rowsNeedingIdx = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => rowNeedsDocuments(row))
    .sort((a, b) =>
      (b.row.reportDateYmd ?? "").localeCompare(a.row.reportDateYmd ?? ""),
    )
    .slice(0, maxRows)
    .map((x) => x.idx);

  if (rowsNeedingIdx.length === 0) return rows;

  let base: Q4CdnBase | null = null;
  const pdfLinks: string[] = [];
  const seedLimit = preview ? 2 : seeds.length;

  for (const seed of seeds.slice(0, seedLimit)) {
    for (const page of buildCommonQuarterlyEarningsPages(seed, preview)) {
      const html = await fetchHtml(page);
      if (!html) continue;
      pdfLinks.push(...extractAbsolutePdfLinks(html, page));
      if (!base) base = extractQ4CdnBaseFromHtml(html);
      if (base && preview) break;
    }
    if (base) break;
  }

  if (!base) return rows;

  const uniquePdfLinks = [...new Set(pdfLinks)];
  const byRow = rows.map((row, idx) => {
    if (!rowsNeedingIdx.includes(idx)) {
      return { slides: [] as string[], filings: [] as string[] };
    }

    const p = parseRowFiscalQuarter(row, fyEndMonthDay);
    if (!p) return { slides: [] as string[], filings: [] as string[] };

    const needsSlides = rowNeedsSlides(row);
    const needsFilings = rowNeedsFilings(row);

    const qDir = q4CdnQuarterDir(base.financialsBase, p.fy, p.fq);
    const inQuarterDir = uniquePdfLinks.filter((u) => u.startsWith(`${qDir}/`));
    const fuzzyQuarter = filterQ4CdnPdfLinksForQuarter(uniquePdfLinks, p.fq, p.fy);
    const scraped = [...new Set([...inQuarterDir, ...fuzzyQuarter])];

    const slideFromIr = needsSlides ? pickBestPdfFromList(scraped, scoreSlidePdfName) : null;
    const filingFromIr = needsFilings ? pickBestPdfFromList(scraped, scoreFilingPdfName) : null;

    const slides = needsSlides
      ? slideFromIr
        ? [slideFromIr, ...buildQ4CdnSlidesCandidates(base.financialsBase, p.fq, p.fy)]
        : buildQ4CdnSlidesCandidates(base.financialsBase, p.fq, p.fy)
      : [];

    const filings = needsFilings
      ? filingFromIr
        ? [filingFromIr, ...buildQ4CdnFilingsCandidates(base.financialsBase, listingTicker, p.fq, p.fy)]
        : buildQ4CdnFilingsCandidates(base.financialsBase, listingTicker, p.fq, p.fy)
      : [];

    return { slides, filings };
  });

  const unique = [...new Set(byRow.flatMap((x) => [...x.slides, ...x.filings]))].slice(0, maxHeadProbes);
  const resolved = new Map<string, string | null>();
  await Promise.all(unique.map(async (u) => resolved.set(u, await headResolvePdfUrl(u))));

  return rows.map((row, i) => {
    const { slides, filings } = byRow[i]!;
    const slideHit = slides.map((u) => resolved.get(u) ?? null).find((u): u is string => !!u) ?? null;
    const filingHit = filings.map((u) => resolved.get(u) ?? null).find((u): u is string => !!u) ?? null;
    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings = filingHit ?? row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
