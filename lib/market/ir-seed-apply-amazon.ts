import "server-only";

import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

/** Amazon IR webcast slides (PDF) on Q4 Inc. CDN — same tree as `ir.aboutamazon.com` redirects. */
const AMZN_Q4CDN_FINANCIALS = "https://s2.q4cdn.com/299287126/files/doc_financials";

/**
 * Amazon fiscal year ends December 31 (calendar-aligned).
 * Q1: Jan–Mar, Q2: Apr–Jun, Q3: Jul–Sep, Q4: Oct–Dec.
 */
function fiscalFromAmazonPeriodEndYmd(ymd: string | null): { calendarYear: number; fq: 1 | 2 | 3 | 4 } | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [ys, ms] = ymd.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

  let fq: 1 | 2 | 3 | 4;
  if (m <= 3) fq = 1;
  else if (m <= 6) fq = 2;
  else if (m <= 9) fq = 3;
  else fq = 4;
  return { calendarYear: y, fq };
}

/** Amazon has rotated `Webslides` suffixes (`-FINAL`, `_Final`, plain); HEAD picks the first hit. */
function amazonWebslidesPdfCandidates(calendarYear: number, fq: 1 | 2 | 3 | 4): string[] {
  const yy = String(calendarYear % 100).padStart(2, "0");
  const base = `${AMZN_Q4CDN_FINANCIALS}/${calendarYear}/q${fq}`;
  return [
    `${base}/Webslides_Q${fq}${yy}.pdf`,
    `${base}/Webslides_Q${fq}${yy}-FINAL.pdf`,
    `${base}/Webslides_Q${fq}${yy}_FINAL.pdf`,
    `${base}/Webslides_Q${fq}${yy}_Final.pdf`,
  ];
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
 * AMZN only:
 * - Slides: Amazon “Webslides” earnings deck PDF on Q4 CDN for the quarter.
 *
 * Periodic Form 10-Q / 10-K on EDGAR are often HTML/XBRL; **Filings** stay on SEC 8-K enrichment.
 */
export async function applyIrSeedAmazonDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const slidePlans = rows.map((row) => {
    const p = fiscalFromAmazonPeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!p) return { candidates: [] as string[] };
    return { candidates: amazonWebslidesPdfCandidates(p.calendarYear, p.fq) };
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
