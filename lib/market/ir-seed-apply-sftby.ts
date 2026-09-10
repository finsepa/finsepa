import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  SFTBY_FY_END,
  isSftbyIrPdf,
  isSftbyRejected,
  mergeSftbyConstructedQuarterDocs,
  sftbyFilingsUrl,
  sftbySlidesUrl,
  sftbyUrlMatchesLabel,
} from "@/lib/market/ir-seed-sftby-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, SFTBY_FY_END) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function keepSftby(url: string | null | undefined, label: string): boolean {
  return Boolean(
    url &&
      isDirectEarningsPdfUrl(url) &&
      isSftbyIrPdf(url) &&
      !isSftbyRejected(url) &&
      sftbyUrlMatchesLabel(url, label),
  );
}

/**
 * SFTBY: Mar FY. English earnings-presentation as Slides; financial-report as Filings.
 * Japanese filename FY is vault FY − 1. Never investor-presentation briefing / datasheet / JP-only.
 */
export async function applyIrSeedSftbyDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeSftbyConstructedQuarterDocs(labels);

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const constructedSlides = m ? sftbySlidesUrl(Number(m[1]), Number(m[2])) : null;
    const constructedFilings = m ? sftbyFilingsUrl(Number(m[1]), Number(m[2])) : null;
    const nextSlides =
      (keepSftby(row.secSlidesUrl, label) ? row.secSlidesUrl : null) ??
      (byLabel.get(label)?.slides && isDirectEarningsPdfUrl(byLabel.get(label)!.slides)
        ? byLabel.get(label)!.slides
        : null) ??
      (constructedSlides && isDirectEarningsPdfUrl(constructedSlides) ? constructedSlides : null);
    const nextFilings =
      (keepSftby(row.secFilingsUrl, label) ? row.secFilingsUrl : null) ??
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
