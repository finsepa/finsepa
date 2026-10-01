import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import { isWuxayIrPdf, isWuxayRejected, mergeWuxayKnownQuarterDocs } from "@/lib/market/ir-seed-wuxay-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow, fyEndMonthDay: string | null): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, fyEndMonthDay) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/** WUXAY: IR PDFs → Slides/Filings. Never SEC HTML. */
export async function applyIrSeedWuxayDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
  options?: { fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeWuxayKnownQuarterDocs();
  const fyEnd = options?.fyEndMonthDay ?? null;
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row, fyEnd);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides =
      hit?.slides && isDirectEarningsPdfUrl(hit.slides) && !isWuxayRejected(hit.slides)
        ? hit.slides
        : isWuxayIrPdf(row.secSlidesUrl) && row.secSlidesUrl === hit?.slides
          ? row.secSlidesUrl
          : null;
    const nextFilings =
      hit?.filings && isDirectEarningsPdfUrl(hit.filings) && !isWuxayRejected(hit.filings)
        ? hit.filings
        : isWuxayIrPdf(row.secFilingsUrl) && row.secFilingsUrl === hit?.filings
          ? row.secFilingsUrl
          : null;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
