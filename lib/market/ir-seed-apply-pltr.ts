import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import { labelFromPltrPeriod, pltrSlidesUrlForLabel } from "@/lib/market/ir-seed-pltr-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

/**
 * PLTR: dash `Business Update` PDF as slides. Q3 2022 has no first-party PDF (WAF HTML).
 * Never lock SEC press HTML or third-party copies. Filings are out of scope for this seed.
 */
export async function applyIrSeedPltrDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && !isDirectEarningsPdfUrl(r.secSlidesUrl));
  if (!needs) return rows;

  return rows.map((row) => {
    if (!row.reported || isDirectEarningsPdfUrl(row.secSlidesUrl)) return row;
    const label = labelFromPltrPeriod(row.fiscalPeriodLabel);
    if (!label) return row;
    const hit = pltrSlidesUrlForLabel(label);
    if (!hit || !isDirectEarningsPdfUrl(hit)) return row;
    return { ...row, secSlidesUrl: hit };
  });
}
