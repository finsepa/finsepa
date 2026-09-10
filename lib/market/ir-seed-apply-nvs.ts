import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  isNvsIrPdf,
  isNvsRejected,
  mergeNvsConstructedQuarterDocs,
  nvsFilingsUrl,
  nvsSlidesUrl,
  nvsUrlMatchesLabel,
} from "@/lib/market/ir-seed-nvs-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function keepNvs(url: string | null | undefined, label: string): boolean {
  return Boolean(
    url &&
      isDirectEarningsPdfUrl(url) &&
      isNvsIrPdf(url) &&
      !isNvsRejected(url) &&
      nvsUrlMatchesLabel(url, label),
  );
}

/**
 * NVS: qN-YYYY-investor-presentation as Slides; English media-release as Filings.
 * Never Deutsch, interim financial report, ESG update, or SEC.
 */
export async function applyIrSeedNvsDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => {
    const label = rowLabel(r);
    return r.reported && (!label || !keepNvs(r.secSlidesUrl, label) || !keepNvs(r.secFilingsUrl, label));
  });
  if (!needs) return rows;

  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeNvsConstructedQuarterDocs(labels);

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const constructedSlides = m ? nvsSlidesUrl(Number(m[1]), Number(m[2])) : null;
    const constructedFilings = m ? nvsFilingsUrl(Number(m[1]), Number(m[2])) : null;
    const nextSlides =
      (keepNvs(row.secSlidesUrl, label) ? row.secSlidesUrl : null) ??
      (byLabel.get(label)?.slides && isDirectEarningsPdfUrl(byLabel.get(label)!.slides)
        ? byLabel.get(label)!.slides
        : null) ??
      (constructedSlides && isDirectEarningsPdfUrl(constructedSlides) ? constructedSlides : null);
    const nextFilings =
      (keepNvs(row.secFilingsUrl, label) ? row.secFilingsUrl : null) ??
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
