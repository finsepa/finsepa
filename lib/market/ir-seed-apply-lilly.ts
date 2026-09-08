import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import { mergeLillyKnownQuarterDocs, parseLillyQuarterlyResultsHtml } from "@/lib/market/ir-seed-lilly-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const LLY_QUARTERLY_URL = "https://investor.lilly.com/financial-information/quarterly-results";
const FETCH_MS = 15_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

async function fetchLillyQuarterlyHtml(): Promise<string | null> {
  try {
    const res = await fetch(LLY_QUARTERLY_URL, {
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

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const fromLabel = row.fiscalPeriodLabel?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (fromLabel) return `Q${fromLabel[1]} ${fromLabel[2]}`;
  return null;
}

/**
 * LLY: scrape investor.lilly.com quarterly-results for Press Release + Earnings Presentation PDFs.
 */
export async function applyIrSeedLillyDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) =>
      r.reported &&
      (!isEarningsSlidesPreviewUrl(r.secSlidesUrl) || !isEarningsFilingsPreviewUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const html = await fetchLillyQuarterlyHtml();
  const byLabel = mergeLillyKnownQuarterDocs(html ? parseLillyQuarterlyResultsHtml(html) : new Map());
  if (byLabel.size === 0) return rows;

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
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
