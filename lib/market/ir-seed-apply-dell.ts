import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  DELL_FY_END,
  DELL_IR_PAGES,
  mergeDellKnownQuarterDocs,
  parseDellQuarterlyResultsHtml,
} from "@/lib/market/ir-seed-dell-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, DELL_FY_END) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
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
 * DELL: Performance Review static-files as slides. IR HTML is often Cloudflare 403
 * from this host — catalog still locks issuer URLs. Never lock transcripts, tables, or SEC.
 */
export async function applyIrSeedDellDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && !isDirectEarningsPdfUrl(r.secSlidesUrl));
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  for (const page of DELL_IR_PAGES) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const [label, docs] of parseDellQuarterlyResultsHtml(html, page)) {
      const cur = parsed.get(label) ?? { slides: null, filings: null };
      parsed.set(label, { slides: cur.slides ?? docs.slides, filings: cur.filings ?? docs.filings });
    }
  }
  const byLabel = mergeDellKnownQuarterDocs(parsed);

  return rows.map((row) => {
    if (!row.reported || isDirectEarningsPdfUrl(row.secSlidesUrl)) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label)?.slides;
    if (!hit || !isDirectEarningsPdfUrl(hit)) return row;
    return { ...row, secSlidesUrl: hit };
  });
}
