import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import { abbvDocsByLabel } from "@/lib/market/ir-seed-abbv-catalog";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const fromLabel = row.fiscalPeriodLabel?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (fromLabel) return `Q${fromLabel[1]} ${fromLabel[2]}`;
  return null;
}

/**
 * ABBV: curated investors.abbvie.com/static-files press releases (Filings).
 * Pipeline Update decks are optional slides when present in the catalog.
 */
export async function applyIrSeedAbbvDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = abbvDocsByLabel();
  if (byLabel.size === 0) return rows;

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const docs = byLabel.get(label);
    if (!docs) return row;

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;
    if (!isEarningsSlidesPreviewUrl(nextSlides) && docs.slides && isDirectEarningsPdfUrl(docs.slides)) {
      nextSlides = docs.slides;
    }
    if (!isEarningsFilingsPreviewUrl(nextFilings) && docs.filings && isDirectEarningsPdfUrl(docs.filings)) {
      nextFilings = docs.filings;
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
