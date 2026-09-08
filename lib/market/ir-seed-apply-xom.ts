//
//  ir-seed-apply-xom.ts
//
//  ExxonMobil — scrape investor.exxonmobil.com cloudfront PDFs + known samples.
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
  classifyXomCloudfrontUrl,
  extractXomCloudfrontPdfUrls,
  parseXomQuarterFromFilename,
  XOM_KNOWN_DOCUMENT_URLS,
} from "@/lib/market/ir-seed-xom-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const IR_HOME = "https://investor.exxonmobil.com/";
const IR_RESULTS = "https://investor.exxonmobil.com/earnings/financial-results";
const FETCH_MS = 15_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

type DocPair = { slides: string | null; filings: string | null };

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

function parseRowQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
}

function mergePair(into: Map<string, DocPair>, fq: number, fy: number, kind: "slides" | "filings", url: string) {
  const key = `Q${fq} ${fy}`;
  const cur = into.get(key) ?? { slides: null, filings: null };
  if (kind === "slides" && !cur.slides) cur.slides = url;
  if (kind === "filings" && !cur.filings) cur.filings = url;
  into.set(key, cur);
}

export async function applyIrSeedXomDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) =>
      r.reported &&
      (!isEarningsSlidesPreviewUrl(r.secSlidesUrl) || !isEarningsFilingsPreviewUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const byLabel = new Map<string, DocPair>();

  for (const known of XOM_KNOWN_DOCUMENT_URLS) {
    if (known.slides) mergePair(byLabel, known.fq, known.fy, "slides", known.slides);
    if (known.filings) mergePair(byLabel, known.fq, known.fy, "filings", known.filings);
  }

  for (const page of [IR_HOME, IR_RESULTS]) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const url of extractXomCloudfrontPdfUrls(html)) {
      const kind = classifyXomCloudfrontUrl(url);
      const q = parseXomQuarterFromFilename(url);
      if (!kind || !q) continue;
      mergePair(byLabel, q.fq, q.fy, kind, url);
    }
  }

  if (byLabel.size === 0) return rows;

  return rows.map((row) => {
    if (!row.reported) return row;
    const p = parseRowQuarter(row);
    if (!p) return row;
    const hit = byLabel.get(`Q${p.fq} ${p.fy}`);
    if (!hit) return row;

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;
    if (!isEarningsSlidesPreviewUrl(nextSlides) && hit.slides && isDirectEarningsPdfUrl(hit.slides)) {
      nextSlides = hit.slides;
    }
    if (!isEarningsFilingsPreviewUrl(nextFilings) && hit.filings && isDirectEarningsPdfUrl(hit.filings)) {
      nextFilings = hit.filings;
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
