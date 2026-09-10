import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  GE_IR_PAGES,
  mergeGeKnownQuarterDocs,
  parseGeEventsHtml,
} from "@/lib/market/ir-seed-ge-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const fromLabel = row.fiscalPeriodLabel?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (fromLabel) return `Q${fromLabel[1]} ${fromLabel[2]}`;
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/html", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * GE: earnings webcast presentation as slides. Never 10-Q, transcripts, Investor Day, or conference decks.
 */
export async function applyIrSeedGeDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) => r.reported && (!isDirectEarningsPdfUrl(r.secSlidesUrl) || !isDirectEarningsPdfUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  for (const page of GE_IR_PAGES) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const [label, docs] of parseGeEventsHtml(html, page)) {
      const cur = parsed.get(label) ?? { slides: null, filings: null };
      parsed.set(label, { slides: cur.slides ?? docs.slides, filings: cur.filings ?? docs.filings });
    }
  }
  const byLabel = mergeGeKnownQuarterDocs(parsed);

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    if (!hit) return row;
    const nextSlides =
      (isDirectEarningsPdfUrl(row.secSlidesUrl) ? row.secSlidesUrl : null) ?? hit.slides ?? row.secSlidesUrl;
    const nextFilings =
      (isDirectEarningsPdfUrl(row.secFilingsUrl) ? row.secFilingsUrl : null) ?? hit.filings ?? row.secFilingsUrl;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: row.secFilingsUrl };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
