import "server-only";

import {
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
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
import { knownQ4CdnBaseForTicker } from "@/lib/market/q4cdn-known-issuer-bases";
import { buildCommonQuarterlyEarningsPages, buildIrSeedUrls } from "@/lib/market/ir-seed-hosts";
import {
  IR_SEED_GENERIC_Q4_HEAD_PROBES_FULL,
  IR_SEED_GENERIC_Q4_HEAD_PROBES_KNOWN_FULL,
  IR_SEED_GENERIC_Q4_ROWS_FULL,
  IR_SEED_GENERIC_Q4_ROWS_KNOWN_BASE_FULL,
} from "@/lib/market/ir-seed-limits";
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
  if (/ir\+overview\+presentation|overview\+presentation/.test(n)) return 900;
  if (/present|presentation|slides|deck|webslides|earnings\+deck|earnings.deck/i.test(n)) return 800;
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
    if (/\.pdf(\?|$)/i.test(final)) return final;
    if (/\/static-files\/[a-f0-9-]{36}/i.test(final)) return final;
    return null;
  } catch {
    return null;
  }
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
  return row.reported && !isEarningsSlidesPreviewUrl(row.secSlidesUrl);
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
  const knownBase = knownQ4CdnBaseForTicker(listingTicker);
  const maxRows = knownBase ? IR_SEED_GENERIC_Q4_ROWS_KNOWN_BASE_FULL : preview ? 2 : IR_SEED_GENERIC_Q4_ROWS_FULL;
  const maxHeadProbes = knownBase
    ? IR_SEED_GENERIC_Q4_HEAD_PROBES_KNOWN_FULL
    : preview
      ? 36
      : IR_SEED_GENERIC_Q4_HEAD_PROBES_FULL;

  const seeds = buildIrSeedUrls(listingTicker, hub).filter((u) => /^https?:\/\//i.test(u));
  if (seeds.length === 0 && !knownBase) return rows;

  const rowsNeedingIdx = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => rowNeedsDocuments(row))
    .sort((a, b) => {
      const slidePriority = Number(rowNeedsSlides(b.row)) - Number(rowNeedsSlides(a.row));
      if (slidePriority !== 0) return slidePriority;
      return (b.row.reportDateYmd ?? "").localeCompare(a.row.reportDateYmd ?? "");
    })
    .slice(0, maxRows)
    .map((x) => x.idx);

  if (rowsNeedingIdx.length === 0) return rows;

  let base: Q4CdnBase | null = knownBase;
  const pdfLinks: string[] = [];
  const seedLimit = preview ? 2 : seeds.length;

  if (!base) {
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
  }

  const uniquePdfLinks = [...new Set(pdfLinks)];
  if (!base && uniquePdfLinks.length === 0) return rows;

  const byRow = rows.map((row, idx) => {
    if (!rowsNeedingIdx.includes(idx)) {
      return { slides: [] as string[], filings: [] as string[] };
    }

    const p = parseRowFiscalQuarter(row, fyEndMonthDay);
    if (!p) return { slides: [] as string[], filings: [] as string[] };

    const needsSlides = rowNeedsSlides(row);
    const needsFilings = rowNeedsFilings(row);

    const fuzzyQuarter = filterQ4CdnPdfLinksForQuarter(uniquePdfLinks, p.fq, p.fy);
    const inQuarterDir = base
      ? uniquePdfLinks.filter((u) => u.startsWith(`${q4CdnQuarterDir(base.financialsBase, p.fy, p.fq)}/`))
      : [];
    const scraped = [...new Set([...inQuarterDir, ...fuzzyQuarter])];

    const slideFromIr = needsSlides ? pickBestPdfFromList(scraped, scoreSlidePdfName) : null;
    const filingFromIr = needsFilings ? pickBestPdfFromList(scraped, scoreFilingPdfName) : null;

    const slides = needsSlides
      ? slideFromIr
        ? [
            slideFromIr,
            ...(base ? buildQ4CdnSlidesCandidates(base.financialsBase, listingTicker, p.fq, p.fy) : []),
          ]
        : base
          ? buildQ4CdnSlidesCandidates(base.financialsBase, listingTicker, p.fq, p.fy)
          : []
      : [];

    const filings = needsFilings
      ? filingFromIr
        ? [
            filingFromIr,
            ...(base ? buildQ4CdnFilingsCandidates(base.financialsBase, listingTicker, p.fq, p.fy) : []),
          ]
        : base
          ? buildQ4CdnFilingsCandidates(base.financialsBase, listingTicker, p.fq, p.fy)
          : []
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
