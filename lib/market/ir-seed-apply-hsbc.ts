import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  HSBC_IR_PAGES,
  mergeHsbcKnownQuarterDocs,
  parseHsbcResultsHtml,
} from "@/lib/market/ir-seed-hsbc-match";
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
 * HSBC: Presentation to Investors and Analysts as slides (Q1/Q3 updates, Interim=Q2, Annual=Q4).
 * Never lock transcripts, data packs, media releases, or SEC 6-K HTML.
 */
export async function applyIrSeedHsbcDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && !isDirectEarningsPdfUrl(r.secSlidesUrl));
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  for (const page of HSBC_IR_PAGES) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const [label, docs] of parseHsbcResultsHtml(html, page)) {
      const cur = parsed.get(label) ?? { slides: null, filings: null };
      parsed.set(label, { slides: cur.slides ?? docs.slides, filings: cur.filings ?? docs.filings });
    }
  }
  const byLabel = mergeHsbcKnownQuarterDocs(parsed);

  return rows.map((row) => {
    if (!row.reported || isDirectEarningsPdfUrl(row.secSlidesUrl)) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label)?.slides;
    if (!hit || !isDirectEarningsPdfUrl(hit)) return row;
    return { ...row, secSlidesUrl: hit };
  });
}
