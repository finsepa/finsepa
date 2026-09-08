import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import { muDocsByPeriodEnd } from "@/lib/market/ir-seed-mu-catalog";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/**
 * MU: curated q4cdn earnings decks + prepared remarks (August FY).
 * Prefer direct `.pdf` CDN URLs — `investors.micron.com/static-files/*` 403s in `/api/ir-pdf`.
 */
export async function applyIrSeedMuDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byEnd = muDocsByPeriodEnd();
  if (byEnd.size === 0) return rows;

  return rows.map((row) => {
    if (!row.reported) return row;
    const fiscal = row.fiscalPeriodEndYmd;
    if (!fiscal) return row;
    const docs = byEnd.get(fiscal);
    if (!docs) return row;

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;
    if (!isEarningsSlidesPreviewUrl(nextSlides) && isDirectEarningsPdfUrl(docs.slides)) {
      nextSlides = docs.slides;
    } else if (
      nextSlides &&
      /investors\.micron\.com\/static-files\//i.test(nextSlides) &&
      isDirectEarningsPdfUrl(docs.slides)
    ) {
      // Upgrade broken static-files links to CDN PDFs even if already set.
      nextSlides = docs.slides;
    }
    if (!isEarningsFilingsPreviewUrl(nextFilings) && isDirectEarningsPdfUrl(docs.filings)) {
      nextFilings = docs.filings;
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
