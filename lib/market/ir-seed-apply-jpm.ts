//
//  ir-seed-apply-jpm.ts
//
//  JPMorgan Chase — HEAD corp-q{n}-{year}.pdf for slides + scrape IR pages for
//  Press Release / Presentation PDFs (Q4 corp-q often 404). Never use transcripts.
//

import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  buildJpmCorpQPdfUrl,
  isJpmTranscriptPdfUrl,
  mergeJpmKnownQuarterDocs,
  parseJpmIrHtmlForQuarterDocs,
  type JpmQuarterDocs,
} from "@/lib/market/ir-seed-jpm-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const IR_PAGES = [
  "https://www.jpmorganchase.com/ir",
  "https://www.jpmorganchase.com/ir/quarterly-earnings",
] as const;

const FETCH_MS = 15_000;
const HEAD_MS = 2500;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function parseRowQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/html", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function headPdfExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": UA },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("text/html")) return false;
    return /\.pdf(\?|$)/i.test(res.url || url);
  } catch {
    return false;
  }
}

function mergeScraped(into: Map<string, JpmQuarterDocs>, from: Map<string, JpmQuarterDocs>) {
  for (const [key, docs] of from) {
    const cur = into.get(key) ?? { slides: null, filings: null };
    if (docs.slides && !cur.slides) cur.slides = docs.slides;
    if (docs.filings && !cur.filings) cur.filings = docs.filings;
    into.set(key, cur);
  }
}

export async function applyIrSeedJpmDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) =>
      r.reported &&
      (!isEarningsSlidesPreviewUrl(r.secSlidesUrl) || !isEarningsFilingsPreviewUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const scraped = new Map<string, JpmQuarterDocs>();
  for (const page of IR_PAGES) {
    const html = await fetchHtml(page);
    if (!html) continue;
    mergeScraped(scraped, parseJpmIrHtmlForQuarterDocs(html));
  }
  const byLabel = mergeJpmKnownQuarterDocs(scraped);

  const corpCandidates = new Map<string, string>();
  for (const row of rows) {
    if (!row.reported) continue;
    if (isEarningsSlidesPreviewUrl(row.secSlidesUrl) && !isJpmTranscriptPdfUrl(row.secSlidesUrl)) continue;
    const p = parseRowQuarter(row);
    if (!p) continue;
    const url = buildJpmCorpQPdfUrl(p.fq, p.fy);
    if (url) corpCandidates.set(`Q${p.fq} ${p.fy}`, url);
  }

  const corpOk = new Map<string, boolean>();
  await Promise.all(
    [...corpCandidates.entries()].map(async ([key, url]) => {
      corpOk.set(key, await headPdfExists(url));
    }),
  );

  return rows.map((row) => {
    if (!row.reported) return row;
    const p = parseRowQuarter(row);
    if (!p) return row;
    const key = `Q${p.fq} ${p.fy}`;
    const hit = byLabel.get(key);

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;

    if (!isEarningsSlidesPreviewUrl(nextSlides) || isJpmTranscriptPdfUrl(nextSlides)) {
      const corp = corpCandidates.get(key);
      // Prefer corp-q when it exists; else scraped / known Earnings Presentation for that FY/FQ only.
      if (corp && corpOk.get(key) && isDirectEarningsPdfUrl(corp) && !isJpmTranscriptPdfUrl(corp)) {
        nextSlides = corp;
      } else if (hit?.slides && isDirectEarningsPdfUrl(hit.slides) && !isJpmTranscriptPdfUrl(hit.slides)) {
        nextSlides = hit.slides;
      }
    }

    if (!isEarningsFilingsPreviewUrl(nextFilings) && hit?.filings && isDirectEarningsPdfUrl(hit.filings)) {
      nextFilings = hit.filings;
    }

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
