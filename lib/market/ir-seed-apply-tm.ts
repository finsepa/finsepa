import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  TM_FY_END,
  isTmIrPdf,
  isTmRejected,
  mergeTmConstructedQuarterDocs,
  tmFilingsUrl,
  tmSlidesUrl,
  tmUrlMatchesLabel,
} from "@/lib/market/ir-seed-tm-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, TM_FY_END) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function keepTm(url: string | null | undefined, label: string): boolean {
  return Boolean(
    url &&
      isDirectEarningsPdfUrl(url) &&
      isTmIrPdf(url) &&
      !isTmRejected(url) &&
      tmUrlMatchesLabel(url, label),
  );
}

/**
 * TM: Mar FY matching vault labels. presentation_2_en as Slides; English summary as Filings.
 * Never JP-only / transcript / Q&A.
 */
export async function applyIrSeedTmDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeTmConstructedQuarterDocs(labels);

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const constructedSlides = m ? tmSlidesUrl(Number(m[1]), Number(m[2])) : null;
    const constructedFilings = m ? tmFilingsUrl(Number(m[1]), Number(m[2])) : null;
    const nextSlides =
      (keepTm(row.secSlidesUrl, label) ? row.secSlidesUrl : null) ??
      (byLabel.get(label)?.slides && isDirectEarningsPdfUrl(byLabel.get(label)!.slides)
        ? byLabel.get(label)!.slides
        : null) ??
      (constructedSlides && isDirectEarningsPdfUrl(constructedSlides) ? constructedSlides : null);
    const nextFilings =
      (keepTm(row.secFilingsUrl, label) ? row.secFilingsUrl : null) ??
      (byLabel.get(label)?.filings && isDirectEarningsPdfUrl(byLabel.get(label)!.filings)
        ? byLabel.get(label)!.filings
        : null) ??
      (constructedFilings && isDirectEarningsPdfUrl(constructedFilings) ? constructedFilings : null);
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
