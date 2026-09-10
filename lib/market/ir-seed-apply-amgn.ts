import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import { isAmgnIrStaticFiles, isAmgnRejected, mergeAmgnKnownQuarterDocs } from "@/lib/market/ir-seed-amgn-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/**
 * AMGN: earnings-call slides as Slides; earnings-release PDF as Filings.
 * Never 8-K wrapper, 10-Q, or transcript.
 */
export async function applyIrSeedAmgnDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeAmgnKnownQuarterDocs();
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides =
      hit?.slides && isDirectEarningsPdfUrl(hit.slides) && !isAmgnRejected(hit.slides)
        ? hit.slides
        : isAmgnIrStaticFiles(row.secSlidesUrl) && row.secSlidesUrl === hit?.slides
          ? row.secSlidesUrl
          : null;
    const nextFilings =
      hit?.filings && isDirectEarningsPdfUrl(hit.filings) && !isAmgnRejected(hit.filings)
        ? hit.filings
        : isAmgnIrStaticFiles(row.secFilingsUrl) && row.secFilingsUrl === hit?.filings
          ? row.secFilingsUrl
          : null;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
