import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  isSapIrPdf,
  isSapRejected,
  mergeSapConstructedQuarterDocs,
  sapFilingsUrl,
  sapSlidesUrl,
  sapUrlMatchesLabel,
} from "@/lib/market/ir-seed-sap-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function keepSap(url: string | null | undefined, label: string): boolean {
  return Boolean(
    url &&
      isDirectEarningsPdfUrl(url) &&
      isSapIrPdf(url) &&
      !isSapRejected(url) &&
      sapUrlMatchesLabel(url, label),
  );
}

/**
 * SAP: sap-YYYY-qN-presentation as Slides; English statement as Filings.
 * Never mitteilung, Sapphire conference, or performance-measures.
 */
export async function applyIrSeedSapDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => {
    const label = rowLabel(r);
    return r.reported && (!label || !keepSap(r.secSlidesUrl, label) || !keepSap(r.secFilingsUrl, label));
  });
  if (!needs) return rows;

  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeSapConstructedQuarterDocs(labels);

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const constructedSlides = m ? sapSlidesUrl(Number(m[1]), Number(m[2])) : null;
    const constructedFilings = m ? sapFilingsUrl(Number(m[1]), Number(m[2])) : null;
    const nextSlides =
      (keepSap(row.secSlidesUrl, label) ? row.secSlidesUrl : null) ??
      (byLabel.get(label)?.slides && isDirectEarningsPdfUrl(byLabel.get(label)!.slides)
        ? byLabel.get(label)!.slides
        : null) ??
      (constructedSlides && isDirectEarningsPdfUrl(constructedSlides) ? constructedSlides : null);
    const nextFilings =
      (keepSap(row.secFilingsUrl, label) ? row.secFilingsUrl : null) ??
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
