import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  isWfcRejected,
  mergeWfcConstructedQuarterDocs,
  wfcFilingsUrl,
  wfcSlidesUrl,
} from "@/lib/market/ir-seed-wfc-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function keepWfc(url: string | null | undefined): boolean {
  return Boolean(
    url &&
      isDirectEarningsPdfUrl(url) &&
      /wellsfargo\.com\/assets\/pdf\/about\/investor-relations\/earnings\//i.test(url) &&
      !isWfcRejected(url),
  );
}

/**
 * WFC: financial-results (Q3 2025: presentation) as Slides; earnings PDF as Filings.
 * Akamai often returns HTML from this host — still lock issuer URLs (same as PM GCS).
 * Never lock supplement, 10-Q, or transcripts.
 */
export async function applyIrSeedWfcDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && (!keepWfc(r.secSlidesUrl) || !keepWfc(r.secFilingsUrl)));
  if (!needs) return rows;

  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeWfcConstructedQuarterDocs(labels);

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const constructedSlides = m ? wfcSlidesUrl(Number(m[1]), Number(m[2])) : null;
    const constructedFilings = m ? wfcFilingsUrl(Number(m[1]), Number(m[2])) : null;
    const nextSlides =
      (keepWfc(row.secSlidesUrl) ? row.secSlidesUrl : null) ??
      (byLabel.get(label)?.slides && isDirectEarningsPdfUrl(byLabel.get(label)!.slides)
        ? byLabel.get(label)!.slides
        : null) ??
      (constructedSlides && isDirectEarningsPdfUrl(constructedSlides) ? constructedSlides : null);
    const nextFilings =
      (keepWfc(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
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
