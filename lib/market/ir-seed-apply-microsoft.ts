import "server-only";

import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

const MSFT_SLIDES_CDN = "https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp";

/**
 * Microsoft fiscal year ends in June.
 * FY label: period ending Sep–Dec of calendar year Y belongs to FY(Y+1) Q1–Q2; Jan–Jun belongs to FY Y Q3–Q4.
 */
function fiscalFromMicrosoftPeriodEndYmd(ymd: string | null): { fy: number; fq: 1 | 2 | 3 | 4 } | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [ys, ms] = ymd.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

  const fy = m >= 7 ? y + 1 : y;
  let fq: 1 | 2 | 3 | 4;
  if (m >= 7 && m <= 9) fq = 1;
  else if (m >= 10) fq = 2;
  else if (m <= 3) fq = 3;
  else fq = 4;
  return { fy, fq };
}

/** Public CDN slide deck (PPTX). Q4 path uses lowercase `q4` only; Q1–Q3 use `Q{q}`. */
function microsoftSlideDeckCandidates(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  const yy = String(fy % 100).padStart(2, "0");
  if (fq === 4) return [`${MSFT_SLIDES_CDN}/SlidesFY${yy}q4`];
  return [`${MSFT_SLIDES_CDN}/SlidesFY${yy}Q${fq}`];
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*" },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * MSFT only:
 * - Slides: official earnings slide deck on `cdn-dynmedia-1.microsoft.com` (PPTX — use “Open in new tab” in preview).
 *
 * Form 10-Q / 10-K on EDGAR are typically HTML/XBRL without companion PDFs; **Filings** stay on SEC 8-K enrichment.
 */
export async function applyIrSeedMicrosoftDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const slidePlans = rows.map((row) => {
    const p = fiscalFromMicrosoftPeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!p) return { candidates: [] as string[] };
    return { candidates: microsoftSlideDeckCandidates(p.fy, p.fq) };
  });

  const uniqueSlides = [...new Set(slidePlans.flatMap((s) => s.candidates))];
  const slideOk = new Map<string, boolean>();
  await Promise.all(uniqueSlides.map(async (u) => slideOk.set(u, await headOk(u))));

  return rows.map((row, i) => {
    const slideHit = slidePlans[i]!.candidates.find((u) => slideOk.get(u));
    const nextSlides = slideHit ?? row.secSlidesUrl;
    if (nextSlides === row.secSlidesUrl) return row;
    return { ...row, secSlidesUrl: nextSlides };
  });
}
