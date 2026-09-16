import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  isDhrAsPdfUrl,
  isDhrIrPdf,
  isDhrRejected,
  mergeDhrKnownQuarterDocs,
} from "@/lib/market/ir-seed-dhr-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function isDhrLockable(url: string | null | undefined): boolean {
  if (!url || isDhrRejected(url)) return false;
  return isDirectEarningsPdfUrl(url) || isDhrAsPdfUrl(url) || isDhrIrPdf(url);
}

/**
 * DHR: Earnings Presentation → Slides; press `?asPDF` → Filings.
 * Never Non-GAAP / Supplement / 10-Q / overview / SEC HTML. Calendar FY.
 */
export async function applyIrSeedDhrDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeDhrKnownQuarterDocs();
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides =
      hit?.slides && isDhrLockable(hit.slides)
        ? hit.slides
        : isDhrIrPdf(row.secSlidesUrl) && row.secSlidesUrl === hit?.slides
          ? row.secSlidesUrl
          : null;
    const nextFilings =
      hit?.filings && isDhrLockable(hit.filings)
        ? hit.filings
        : isDhrIrPdf(row.secFilingsUrl) && row.secFilingsUrl === hit?.filings
          ? row.secFilingsUrl
          : null;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
