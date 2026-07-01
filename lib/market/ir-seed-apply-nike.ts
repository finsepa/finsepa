import "server-only";

import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  nikeFilingCandidateUrls,
  nikeKnownPresentationUrl,
  nikePresentationCandidateUrls,
} from "@/lib/market/nike-q4cdn-document-pdfs";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const MAY_FY_END = "05-31";

async function headPdfExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*" },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("text/html")) return false;
    const final = res.url || url;
    return /\.pdf(\?|$)/i.test(final);
  } catch {
    return false;
  }
}

function parseNikeFiscalQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  const fromYmd = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, MAY_FY_END);
  if (fromYmd) return fromYmd;
  return fiscalQuarterFromLabel(row.fiscalPeriodLabel);
}

function isDirectPdfUrl(href: string | null | undefined): boolean {
  return href != null && href.startsWith("https://") && /\.pdf(\?|#|$)/i.test(href);
}

async function firstExistingPdf(urls: string[]): Promise<string | null> {
  const unique = [...new Set(urls)];
  for (const url of unique) {
    if (await headPdfExists(url)) return url;
  }
  return null;
}

/**
 * Resolve Nike slides / earnings-release PDFs from q4cdn via cheap HEAD probes (no IR HTML crawl).
 * Replaces SEC browse fallbacks when a direct PDF exists.
 */
export async function applyIrSeedNikeDocumentUrls(
  rows: StockEarningsHistoryRow[],
): Promise<StockEarningsHistoryRow[]> {
  const candidateLists = rows.map((row) => {
    if (!row.reported) return null;
    const hasSlides = isDirectPdfUrl(row.secSlidesUrl);
    const hasFilings = isDirectPdfUrl(row.secFilingsUrl);
    if (hasSlides && hasFilings) return null;

    const p = parseNikeFiscalQuarter(row);
    if (!p) return null;
    const slides = hasSlides
      ? []
      : [
          ...(nikeKnownPresentationUrl(p.fq, p.fy) ? [nikeKnownPresentationUrl(p.fq, p.fy)!] : []),
          ...nikePresentationCandidateUrls(p.fq, p.fy),
        ];
    const filings = hasFilings ? [] : nikeFilingCandidateUrls(p.fq, p.fy);
    if (slides.length === 0 && filings.length === 0) return null;
    return { slides, filings };
  });

  const unique = [
    ...new Set(candidateLists.flatMap((c) => (c ? [...c.slides, ...c.filings] : []))),
  ].slice(0, 48);
  const ok = new Map<string, boolean>();
  await Promise.all(
    unique.map(async (url) => {
      ok.set(url, await headPdfExists(url));
    }),
  );

  return rows.map((row, i) => {
    const list = candidateLists[i];
    if (!list) return row;

    const slideHit = list.slides.find((u) => ok.get(u)) ?? null;
    const filingHit = list.filings.find((u) => ok.get(u)) ?? null;
    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings = filingHit ?? row.secFilingsUrl;

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
