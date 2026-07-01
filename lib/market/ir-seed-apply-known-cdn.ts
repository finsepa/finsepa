import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsSlidesPreviewUrl,
  isSecEdgarEarningsReleaseExhibitHtml,
} from "@/lib/market/earnings-document-url";
import { knownCdnSlidePlanForRow } from "@/lib/market/ir-seed-known-cdn-patterns";
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

/**
 * HEAD-probe issuer-specific CDN slide paths (Microsoft PPTX, etc.).
 * Runs for any ticker with a registered pattern when slides are still missing.
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
    .filter(({ row }) => {
      if (!row.reported) return false;
      if (!isEarningsSlidesPreviewUrl(row.secSlidesUrl)) return true;
      return (
        isSecEdgarEarningsReleaseExhibitHtml(row.secSlidesUrl) &&
        !isDirectEarningsPdfUrl(row.secSlidesUrl)
      );
    })
    .sort((a, b) => (b.row.reportDateYmd ?? "").localeCompare(a.row.reportDateYmd ?? ""))
    .slice(0, maxRows);

  if (needing.length === 0) return rows;

  const slidePlans = rows.map((row) => {
    const plan = knownCdnSlidePlanForRow(listingTicker, row, { fyEndMonthDay });
    return plan?.candidates ?? [];
  });

  const uniqueSlides = [...new Set(slidePlans.flat())];
  if (uniqueSlides.length === 0) return rows;

  const slideOk = new Map<string, boolean>();
  await Promise.all(uniqueSlides.map(async (u) => slideOk.set(u, await headOk(u))));

  const needingIdx = new Set(needing.map((n) => n.idx));

  return rows.map((row, i) => {
    if (!needingIdx.has(i)) return row;
    const slideHit = slidePlans[i]!.find((u) => slideOk.get(u));
    if (!slideHit || slideHit === row.secSlidesUrl) return row;
    return { ...row, secSlidesUrl: slideHit };
  });
}
