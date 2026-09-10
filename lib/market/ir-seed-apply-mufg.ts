import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  mufgFsIndexUrl,
  mufgPresentationIndexUrl,
  mufgYmFromPeriodEndYmd,
  isMufgIrPdf,
  isMufgRejected,
  mergeMufgIndexMaps,
  parseMufgIrIndexHtml,
} from "@/lib/market/ir-seed-mufg-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function keepMufg(url: string | null | undefined): boolean {
  return Boolean(url && isDirectEarningsPdfUrl(url) && isMufgIrPdf(url) && !isMufgRejected(url));
}

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

/**
 * MUFG: H1/FY slidesYYMM as Slides; highlightsYYMM as Filings.
 * Match calendar month on period-end (Mar 2026 → 2603), not EODHD FY labels.
 * Never speech / databook / Q&A / summary report.
 */
export async function applyIrSeedMufgDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && (!keepMufg(r.secSlidesUrl) || !keepMufg(r.secFilingsUrl)));
  if (!needs) return rows;

  const years = new Set<number>();
  for (const row of rows) {
    const ymd = row.fiscalPeriodEndYmd;
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(5, 7));
    const jpFy = m >= 4 ? y : y - 1;
    years.add(jpFy);
  }

  const htmls = await Promise.all(
    [...years].flatMap((y) => [fetchText(mufgPresentationIndexUrl(y)), fetchText(mufgFsIndexUrl(y))]),
  );
  const byYm = mergeMufgIndexMaps(htmls.filter((h): h is string => Boolean(h)).map(parseMufgIrIndexHtml));
  if (byYm.size === 0) return rows;

  return rows.map((row) => {
    if (!row.reported) return row;
    const ym = mufgYmFromPeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!ym) return row;
    const hit = byYm.get(ym);
    if (!hit) return row;
    const nextSlides =
      (keepMufg(row.secSlidesUrl) ? row.secSlidesUrl : null) ??
      (hit.slides && isDirectEarningsPdfUrl(hit.slides) ? hit.slides : null);
    const nextFilings =
      (keepMufg(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
      (hit.filings && isDirectEarningsPdfUrl(hit.filings) ? hit.filings : null);
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: null };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
