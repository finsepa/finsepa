import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
  isKnownEarningsFilingDocUrl,
  isSecEdgarEarningsReleaseExhibitHtml,
} from "@/lib/market/earnings-document-url";
import { knownCdnDocPlanForRow } from "@/lib/market/ir-seed-known-cdn-patterns";
import { irSeedSlideRowCap } from "@/lib/market/ir-seed-limits";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": UA },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    if (res.ok) return true;
    const getRes = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": UA, Range: "bytes=0-0" },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    return getRes.ok || getRes.status === 206;
  } catch {
    return false;
  }
}

function needsSlides(row: StockEarningsHistoryRow): boolean {
  if (!row.reported) return false;
  if (!isEarningsSlidesPreviewUrl(row.secSlidesUrl)) return true;
  return (
    isSecEdgarEarningsReleaseExhibitHtml(row.secSlidesUrl) && !isDirectEarningsPdfUrl(row.secSlidesUrl)
  );
}

function needsFilings(row: StockEarningsHistoryRow): boolean {
  if (!row.reported) return false;
  if (!isEarningsFilingsPreviewUrl(row.secFilingsUrl)) return true;
  if (isSecEdgarEarningsReleaseExhibitHtml(row.secFilingsUrl) && !isDirectEarningsPdfUrl(row.secFilingsUrl)) {
    return true;
  }
  return false;
}

/**
 * HEAD-probe issuer-specific CDN paths (Microsoft PPTX slides + DOCX press releases, etc.).
 * Runs when slides and/or filings are still missing.
 */
export async function applyKnownCdnSlideDeckUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
  options?: { preview?: boolean; fyEndMonthDay?: string | null },
): Promise<StockEarningsHistoryRow[]> {
  const preview = options?.preview === true;
  const fyEndMonthDay = options?.fyEndMonthDay ?? null;
  const maxRows = irSeedSlideRowCap(preview);

  const needing = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => needsSlides(row) || needsFilings(row))
    .sort((a, b) => (b.row.reportDateYmd ?? "").localeCompare(a.row.reportDateYmd ?? ""))
    .slice(0, maxRows);

  if (needing.length === 0) return rows;

  const plans = rows.map((row) => knownCdnDocPlanForRow(listingTicker, row, { fyEndMonthDay }));
  const unique = [
    ...new Set(plans.flatMap((p) => [...(p?.slideCandidates ?? []), ...(p?.filingCandidates ?? [])])),
  ];
  if (unique.length === 0) return rows;

  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headOk(u))));

  const needingIdx = new Set(needing.map((n) => n.idx));

  return rows.map((row, i) => {
    if (!needingIdx.has(i)) return row;
    const plan = plans[i];
    if (!plan) return row;

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;

    if (needsSlides(row)) {
      const slideHit = plan.slideCandidates.find((u) => ok.get(u));
      if (slideHit) nextSlides = slideHit;
    }
    if (needsFilings(row)) {
      const filingHit = plan.filingCandidates.find((u) => ok.get(u));
      if (filingHit && (isDirectEarningsPdfUrl(filingHit) || isKnownEarningsFilingDocUrl(filingHit))) {
        nextFilings = filingHit;
      }
    }

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
