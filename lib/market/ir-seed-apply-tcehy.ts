//
//  ir-seed-apply-tcehy.ts
//
//  Tencent — scrape www.tencent.com/en-us/investors/results/ for PPT + results PDFs.
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
import { mergeTcehyKnownQuarterDocs, parseTencentResultsHtml } from "@/lib/market/ir-seed-tcehy-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const RESULTS_URL = "https://www.tencent.com/en-us/investors/results/";
const FETCH_MS = 18_000;
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

export async function applyIrSeedTcehyDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) =>
      r.reported &&
      (!isEarningsSlidesPreviewUrl(r.secSlidesUrl) || !isEarningsFilingsPreviewUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const html = await fetchHtml(RESULTS_URL);
  const byLabel = mergeTcehyKnownQuarterDocs(html ? parseTencentResultsHtml(html) : new Map());
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
