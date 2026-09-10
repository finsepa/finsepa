//
//  ir-seed-apply-avgo.ts
//
//  Broadcom — scrape quarterly-results news links, then resolve each release's
//  `/node/{id}/pdf` press-release PDF for Filings.
//  No public quarterly earnings slide decks (evergreen “Company Presentation” is
//  not a quarter deck). Leave Slides empty; never lock SEC HTML as Slides.
//

import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  avgoKnownFilingUrl,
  extractAvgoNodePdfPath,
  parseAvgoQuarterlyResultsHtml,
} from "@/lib/market/ir-seed-avgo-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const QUARTERLY_URL = "https://investors.broadcom.com/financial-information/quarterly-results";
const ORIGIN = "https://investors.broadcom.com";
const FETCH_MS = 15_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

/** Broadcom FY ends ~early November. */
const AVGO_FY_END = "11-02";

async function fetchText(url: string): Promise<string | null> {
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

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, AVGO_FY_END) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/**
 * AVGO: map IR news-release PDFs (`/node/N/pdf`) onto Filings for matching fiscal quarters.
 */
export async function applyIrSeedAvgoDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && !isDirectEarningsPdfUrl(r.secFilingsUrl));
  if (!needs) return rows;

  const listHtml = await fetchText(QUARTERLY_URL);
  const byLabel = listHtml ? parseAvgoQuarterlyResultsHtml(listHtml) : new Map();

  const neededLabels = new Set(
    rows
      .filter((r) => r.reported && !isDirectEarningsPdfUrl(r.secFilingsUrl))
      .map(rowLabel)
      .filter((x): x is string => Boolean(x)),
  );

  const pdfByLabel = new Map<string, string>();
  if (byLabel.size > 0) {
    await Promise.all(
      [...byLabel.entries()]
        .filter(([label]) => neededLabels.has(label))
        .map(async ([label, entry]) => {
          const detail = await fetchText(`${ORIGIN}${entry.href}`);
          if (!detail) return;
          const path = extractAvgoNodePdfPath(detail);
          if (!path) return;
          pdfByLabel.set(label, `${ORIGIN}${path}`);
        }),
    );
  }

  return rows.map((row) => {
    if (!row.reported || isDirectEarningsPdfUrl(row.secFilingsUrl)) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = pdfByLabel.get(label) ?? avgoKnownFilingUrl(label);
    if (!hit || !isDirectEarningsPdfUrl(hit)) return row;
    return { ...row, secFilingsUrl: hit };
  });
}
