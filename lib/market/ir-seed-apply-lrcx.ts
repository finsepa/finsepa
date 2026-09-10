import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import { earningsPdfHrefMatchesQuarterLabels } from "@/lib/market/gcs-web-earnings-presentations";
import {
  LRCX_IR_PAGES,
  mergeLrcxKnownQuarterDocs,
  parseLrcxQuarterlyResultsHtml,
} from "@/lib/market/ir-seed-lrcx-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function lrcxRowLabel(row: StockEarningsHistoryRow): string | null {
  const ymd = row.fiscalPeriodEndYmd?.trim() ?? "";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month === 3) return `Q3 ${year}`;
    if (month === 6) return `Q4 ${year}`;
    if (month === 9) return `Q1 ${year + 1}`;
    if (month === 12) return `Q2 ${year + 1}`;
  }
  const fromLabel = row.fiscalPeriodLabel?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (fromLabel) return `Q${fromLabel[1]} ${fromLabel[2]}`;
  return null;
}

function lrcxExistingSlidesMatchRow(url: string | null | undefined, label: string): boolean {
  if (typeof url !== "string" || !isDirectEarningsPdfUrl(url)) return false;
  return earningsPdfHrefMatchesQuarterLabels(url, [label]);
}

function lrcxRowNeedsSlides(row: StockEarningsHistoryRow): boolean {
  if (!row.reported) return false;
  const label = lrcxRowLabel(row);
  if (!label) return !isDirectEarningsPdfUrl(row.secSlidesUrl);
  return !lrcxExistingSlidesMatchRow(row.secSlidesUrl, label);
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
 * LRCX: first-party /image/ earnings slides. Never lock Exhibit 99.1, 10-Q/10-K, or SEC HTML.
 */
export async function applyIrSeedLrcxDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => lrcxRowNeedsSlides(r));
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  const catalog = mergeLrcxKnownQuarterDocs(parsed);
  const catalogCoversNeed = rows
    .filter((r) => lrcxRowNeedsSlides(r))
    .every((r) => {
      const label = lrcxRowLabel(r);
      return Boolean(label && isDirectEarningsPdfUrl(catalog.get(label)?.slides));
    });
  if (!catalogCoversNeed) {
    try {
      for (const page of LRCX_IR_PAGES) {
        const html = await fetchHtml(page);
        if (!html) continue;
        for (const [label, docs] of parseLrcxQuarterlyResultsHtml(html, page)) {
          const cur = parsed.get(label) ?? { slides: null, filings: null };
          parsed.set(label, { slides: cur.slides ?? docs.slides, filings: cur.filings ?? docs.filings });
        }
      }
    } catch {
      /* Catalog still applies. */
    }
  }
  const byLabel = mergeLrcxKnownQuarterDocs(parsed);

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = lrcxRowLabel(row);
    if (!label) return row;
    if (lrcxExistingSlidesMatchRow(row.secSlidesUrl, label)) return row;
    const hit = byLabel.get(label)?.slides;
    if (!hit || !isDirectEarningsPdfUrl(hit)) return row;
    return { ...row, secSlidesUrl: hit };
  });
}
