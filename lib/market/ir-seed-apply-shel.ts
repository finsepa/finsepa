import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  SHEL_MODEL_JSON,
  isShelRejected,
  parseShelQuarterlyModelJson,
} from "@/lib/market/ir-seed-shel-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function keepShel(url: string | null | undefined): boolean {
  return Boolean(url && isDirectEarningsPdfUrl(url) && /shell\.com/i.test(url) && !isShelRejected(url));
}

/**
 * SHEL: qN-YYYY-slides as Slides; quarterly-press-release as Filings.
 * Parse AEM model.json at apply-time (hashes change). Never QRA / transcript / accessibility.
 */
export async function applyIrSeedShelDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && (!keepShel(r.secSlidesUrl) || !keepShel(r.secFilingsUrl)));
  if (!needs) return rows;

  let raw: string | null = null;
  try {
    const res = await fetch(SHEL_MODEL_JSON, {
      redirect: "follow",
      headers: { Accept: "application/json,text/plain,*/*", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (res.ok) raw = await res.text();
  } catch {
    raw = null;
  }
  if (!raw) return rows;

  const byLabel = parseShelQuarterlyModelJson(raw);
  if (byLabel.size === 0) return rows;

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    if (!hit) return row;
    const nextSlides =
      (keepShel(row.secSlidesUrl) ? row.secSlidesUrl : null) ??
      (hit.slides && isDirectEarningsPdfUrl(hit.slides) ? hit.slides : null);
    const nextFilings =
      (keepShel(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
      (hit.filings && isDirectEarningsPdfUrl(hit.filings) ? hit.filings : null);
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
