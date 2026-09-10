import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  aznUrlMatchesLabel,
  isAznIrPdf,
  isAznRejected,
  mergeAznKnownQuarterDocs,
} from "@/lib/market/ir-seed-azn-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function keepAzn(url: string | null | undefined, label: string): boolean {
  return Boolean(
    url &&
      isDirectEarningsPdfUrl(url) &&
      isAznIrPdf(url) &&
      !isAznRejected(url) &&
      aznUrlMatchesLabel(url, label),
  );
}

/**
 * AZN: results presentation as Slides; English announcement as Filings.
 * Never aide-memoire, clinical appendix, transcript, or Swedish/Deutsch.
 */
export async function applyIrSeedAznDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeAznKnownQuarterDocs();
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides =
      (keepAzn(row.secSlidesUrl, label) && row.secSlidesUrl === hit?.slides ? row.secSlidesUrl : null) ??
      (hit?.slides && isDirectEarningsPdfUrl(hit.slides) && isAznIrPdf(hit.slides) ? hit.slides : null);
    const nextFilings =
      (keepAzn(row.secFilingsUrl, label) && row.secFilingsUrl === hit?.filings ? row.secFilingsUrl : null) ??
      (hit?.filings && isDirectEarningsPdfUrl(hit.filings) && isAznIrPdf(hit.filings) ? hit.filings : null);
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
