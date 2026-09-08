//
//  ir-seed-apply-asml.ts
//
//  ASML — scrape asml.com/en/investors/financial-results/q{N}-{year} for
//  Investor Relations presentation + press-release PDFs (ourbrand / media.asml).
//

import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  asmlQuarterResultsPageUrl,
  parseAsmlQuarterResultsHtml,
} from "@/lib/market/ir-seed-asml-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 15_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

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

function parseRowQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
}

export async function applyIrSeedAsmlDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needing = rows
    .map((row, idx) => ({ row, idx }))
    .filter(
      ({ row }) =>
        row.reported &&
        (!isEarningsSlidesPreviewUrl(row.secSlidesUrl) || !isEarningsFilingsPreviewUrl(row.secFilingsUrl)),
    );
  if (needing.length === 0) return rows;

  const byKey = new Map<string, { slides: string | null; filings: string | null }>();
  const keys = [
    ...new Set(
      needing
        .map(({ row }) => parseRowQuarter(row))
        .filter((p): p is { fq: number; fy: number } => Boolean(p))
        .map((p) => `${p.fq}:${p.fy}`),
    ),
  ];

  await Promise.all(
    keys.map(async (key) => {
      const [fqS, fyS] = key.split(":");
      const fq = Number(fqS);
      const fy = Number(fyS);
      const html = await fetchHtml(asmlQuarterResultsPageUrl(fq, fy));
      if (!html) return;
      byKey.set(key, parseAsmlQuarterResultsHtml(html));
    }),
  );

  if (byKey.size === 0) return rows;

  return rows.map((row) => {
    if (!row.reported) return row;
    const p = parseRowQuarter(row);
    if (!p) return row;
    const hit = byKey.get(`${p.fq}:${p.fy}`);
    if (!hit) return row;

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;
    if (!isEarningsSlidesPreviewUrl(nextSlides) && hit.slides && isDirectEarningsPdfUrl(hit.slides)) {
      nextSlides = hit.slides;
    }
    if (!isEarningsFilingsPreviewUrl(nextFilings) && hit.filings && isDirectEarningsPdfUrl(hit.filings)) {
      nextFilings = hit.filings;
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
