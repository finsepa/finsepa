//
//  ir-seed-apply-walmart.ts
//
//  Walmart — scrape stock.walmart.com financial-results once, then attach Presentation +
//  Earnings Release PDFs via scored multi-filter matching (see ir-seed-walmart-match.ts).
//

import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  isWmtEarningsReleaseUrl,
  isWmtPresentationUrl,
  parseWmtDocKeyFromUrl,
  pickBestWmtDocKeyForRow,
  wmtKeyId,
  type WmtDocKey,
} from "@/lib/market/ir-seed-walmart-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 8000;
const WMT_RESULTS_URL = "https://stock.walmart.com/financial-information/financial-results";

async function fetchWmtFinancialResultsHtml(): Promise<string | null> {
  try {
    const res = await fetch(WMT_RESULTS_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "FinsepaBot/1.0 (earnings-docs; contact=dev@finsepa.app)",
      },
      signal: AbortSignal.timeout(FETCH_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractWmtPdfUrls(html: string): string[] {
  const out: string[] = [];
  const re = /https?:\/\/stock\.walmart\.com\/_assets\/[^"'\\\s>]+\.pdf/gi;
  for (const m of html.matchAll(re)) {
    const u = m[0]?.replace(/&amp;/g, "&");
    if (u) out.push(u);
  }
  const rel = /href="(\/_assets\/[^"]+\.pdf)"/gi;
  for (const m of html.matchAll(rel)) {
    const path = m[1];
    if (path) out.push(`https://stock.walmart.com${path}`);
  }
  // JSON / escaped embeds on the IR page
  const escaped = /stock\.walmart\.com\\\/_assets\\\/[^"'\\\s>]+\.pdf/gi;
  for (const m of html.matchAll(escaped)) {
    const u = `https://${m[0].replace(/\\\//g, "/")}`;
    out.push(u);
  }
  return [...new Set(out)];
}

/**
 * WMT only: scrape IR financial-results → bucket by FY/Q → score-match each history row.
 */
export async function applyIrSeedWalmartDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needing = rows.some(
    (r) =>
      r.reported &&
      (!isDirectEarningsPdfUrl(r.secSlidesUrl) || !isDirectEarningsPdfUrl(r.secFilingsUrl)),
  );
  if (!needing) return rows;

  const html = await fetchWmtFinancialResultsHtml();
  if (!html) return rows;

  const pdfs = extractWmtPdfUrls(html);
  if (pdfs.length === 0) return rows;

  type Bucket = { slides: string | null; filings: string | null };
  const byKey = new Map<string, Bucket>();
  const keys: WmtDocKey[] = [];
  for (const url of pdfs) {
    const key = parseWmtDocKeyFromUrl(url);
    if (!key) continue;
    const id = wmtKeyId(key);
    const bucket = byKey.get(id) ?? { slides: null, filings: null };
    const isNew = !byKey.has(id);
    if (!bucket.slides && isWmtPresentationUrl(url)) bucket.slides = url;
    if (!bucket.filings && isWmtEarningsReleaseUrl(url)) bucket.filings = url;
    byKey.set(id, bucket);
    if (isNew) keys.push(key);
  }

  return rows.map((row) => {
    if (!row.reported) return row;
    const needsSlides = !isDirectEarningsPdfUrl(row.secSlidesUrl);
    const needsFilings = !isDirectEarningsPdfUrl(row.secFilingsUrl);
    if (!needsSlides && !needsFilings) return row;

    const best = pickBestWmtDocKeyForRow(row, keys);
    if (!best) return row;
    const bucket = byKey.get(wmtKeyId(best.key));
    if (!bucket) return row;

    const nextSlides = (needsSlides && bucket.slides ? bucket.slides : null) ?? row.secSlidesUrl;
    const nextFilings = (needsFilings && bucket.filings ? bucket.filings : null) ?? row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
