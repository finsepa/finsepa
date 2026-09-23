import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import { isCmeIrPdf, isCmeRejected, mergeCmeKnownQuarterDocs } from "@/lib/market/ir-seed-cme-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/** CME: IR PDFs → Slides/Filings. Never SEC HTML. */
export async function applyIrSeedCmeDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeCmeKnownQuarterDocs();
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides =
      hit?.slides && isDirectEarningsPdfUrl(hit.slides) && !isCmeRejected(hit.slides)
        ? hit.slides
        : isCmeIrPdf(row.secSlidesUrl) && row.secSlidesUrl === hit?.slides
          ? row.secSlidesUrl
          : null;
    const nextFilings =
      hit?.filings && isDirectEarningsPdfUrl(hit.filings) && !isCmeRejected(hit.filings)
        ? hit.filings
        : isCmeIrPdf(row.secFilingsUrl) && row.secFilingsUrl === hit?.filings
          ? row.secFilingsUrl
          : null;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
