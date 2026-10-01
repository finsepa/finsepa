import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import { isUpsIrPdf, isUpsRejected, mergeUpsKnownQuarterDocs } from "@/lib/market/ir-seed-ups-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow, fyEndMonthDay: string | null): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, fyEndMonthDay) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/** UPS: IR PDFs → Slides/Filings. Never SEC HTML. */
export async function applyIrSeedUpsDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
  options?: { fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeUpsKnownQuarterDocs();
  const fyEnd = options?.fyEndMonthDay ?? null;
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row, fyEnd);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides =
      hit?.slides && isDirectEarningsPdfUrl(hit.slides) && !isUpsRejected(hit.slides)
        ? hit.slides
        : isUpsIrPdf(row.secSlidesUrl) && row.secSlidesUrl === hit?.slides
          ? row.secSlidesUrl
          : null;
    const nextFilings =
      hit?.filings && isDirectEarningsPdfUrl(hit.filings) && !isUpsRejected(hit.filings)
        ? hit.filings
        : isUpsIrPdf(row.secFilingsUrl) && row.secFilingsUrl === hit?.filings
          ? row.secFilingsUrl
          : null;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
