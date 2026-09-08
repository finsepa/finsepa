import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  amatNewsReleasePageUrls,
  mergeAmatKnownQuarterDocs,
  parseAmatNewsReleaseHtml,
  parseAmatQuarterlyResultsHtml,
} from "@/lib/market/ir-seed-amat-match";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const fromLabel = row.fiscalPeriodLabel?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (fromLabel) return `Q${fromLabel[1]} ${fromLabel[2]}`;
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  return p ? `Q${p.fq} ${p.fy}` : null;
}

function parseRowQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
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

function mergeDocs(
  into: Map<string, { slides: string | null; filings: string | null }>,
  from: Map<string, { slides: string | null; filings: string | null }>,
): void {
  for (const [label, docs] of from) {
    const cur = into.get(label) ?? { slides: null, filings: null };
    into.set(label, {
      slides: cur.slides ?? docs.slides,
      filings: cur.filings ?? docs.filings,
    });
  }
}

/**
 * AMAT: IR GCS decks as slides, Exhibit 99.1 news-release static-files as filings.
 * Never lock SEC HTML when an IR PDF exists.
 */
export async function applyIrSeedAmatDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) => r.reported && (!isDirectEarningsPdfUrl(r.secSlidesUrl) || !isDirectEarningsPdfUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  const quarterlyPages = [
    "https://ir.appliedmaterials.com/financial-information/quarterly-results",
    "https://investor.appliedmaterials.com/financial-information/quarterly-results",
  ];
  for (const page of quarterlyPages) {
    const html = await fetchHtml(page);
    if (!html) continue;
    mergeDocs(parsed, parseAmatQuarterlyResultsHtml(html, page));
  }

  const newsPages = [
    ...new Set(
      rows.flatMap((r) => {
        const p = parseRowQuarter(r);
        return p && r.reported && !isDirectEarningsPdfUrl(r.secFilingsUrl)
          ? amatNewsReleasePageUrls(p.fq, p.fy)
          : [];
      }),
    ),
  ];
  for (const page of newsPages) {
    const html = await fetchHtml(page);
    if (!html) continue;
    mergeDocs(parsed, parseAmatNewsReleaseHtml(html, page));
  }

  const byLabel = mergeAmatKnownQuarterDocs(parsed);

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
