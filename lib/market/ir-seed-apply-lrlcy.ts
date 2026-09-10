import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import { isLrlcyIrPdf, mergeLrlcyKnownQuarterDocs } from "@/lib/market/ir-seed-lrlcy-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/**
 * LRLCY: CB H1/FY presentation as Slides; English CP press as Filings.
 * Q1/Q3 are sales press only. Never RFS / URD / division RIF decks.
 */
export async function applyIrSeedLrlcyDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeLrlcyKnownQuarterDocs();
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides =
      hit?.slides && isDirectEarningsPdfUrl(hit.slides) && isLrlcyIrPdf(hit.slides) ? hit.slides : null;
    const nextFilings =
      hit?.filings && isDirectEarningsPdfUrl(hit.filings) && isLrlcyIrPdf(hit.filings) ? hit.filings : null;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
