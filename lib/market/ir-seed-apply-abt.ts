import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  isAbtIrStaticFiles,
  isAbtRejected,
  mergeAbtKnownQuarterDocs,
} from "@/lib/market/ir-seed-abt-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/**
 * ABT: filings-only (earnings press PDF). Slides stay null — no quarterly decks.
 * Never SEC HTML / infographic-as-slides.
 */
export async function applyIrSeedAbtDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byLabel = mergeAbtKnownQuarterDocs();
  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    const nextSlides = null;
    const nextFilings =
      hit?.filings && isDirectEarningsPdfUrl(hit.filings) && !isAbtRejected(hit.filings)
        ? hit.filings
        : isAbtIrStaticFiles(row.secFilingsUrl) && row.secFilingsUrl === hit?.filings
          ? row.secFilingsUrl
          : null;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
