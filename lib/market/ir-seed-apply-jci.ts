import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import { isJciIrPdf, isJciRejected, mergeJciKnownQuarterDocs } from "@/lib/market/ir-seed-jci-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow, fyEndMonthDay: string | null): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, fyEndMonthDay) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/** JCI: IR PDFs → Slides/Filings. Never SEC HTML. */
export async function applyIrSeedJciDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
  options?: { fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeJciKnownQuarterDocs();
  // Johnson Controls Sept FY (catalog keys are issuer fiscal quarters).
  const fyEnd = options?.fyEndMonthDay ?? "09-30";
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row, fyEnd);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides =
      hit?.slides && isDirectEarningsPdfUrl(hit.slides) && !isJciRejected(hit.slides)
        ? hit.slides
        : isJciIrPdf(row.secSlidesUrl) && row.secSlidesUrl === hit?.slides
          ? row.secSlidesUrl
          : null;
    const nextFilings =
      hit?.filings && isDirectEarningsPdfUrl(hit.filings) && !isJciRejected(hit.filings)
        ? hit.filings
        : isJciIrPdf(row.secFilingsUrl) && row.secFilingsUrl === hit?.filings
          ? row.secFilingsUrl
          : null;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
