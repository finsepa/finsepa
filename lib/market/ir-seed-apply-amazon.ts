import "server-only";

import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

/** Amazon IR webcast slides (PDF) on Q4 Inc. CDN — same tree as `ir.aboutamazon.com` redirects. */
const AMZN_Q4CDN_FINANCIALS = "https://s2.q4cdn.com/299287126/files/doc_financials";
const AMZN_Q4CDN_FILES = "https://s2.q4cdn.com/299287126/files";

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

/** Earnings release (Exhibit 99.1) PDFs — these are the most consistent “SEC Forms” artifacts on Amazon IR. */
function amazonEarningsReleaseCandidates(calendarYear: number, fq: 1 | 2 | 3 | 4): string[] {
  const base = `${AMZN_Q4CDN_FINANCIALS}/${calendarYear}/q${fq}`;
  const v = `AMZN-Q${fq}-${calendarYear}-Earnings-Release.pdf`;
  // Some quarters (e.g. FY2025 Q4) are stored under `doc_earnings/.../earnings-result/`.
  const vAlt = `${AMZN_Q4CDN_FILES}/doc_earnings/${calendarYear}/q${fq}/earnings-result/${v}`;
  return [vAlt, `${base}/${v}`];
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
 * - Filings: Amazon earnings release PDF (often the IR “SEC Forms” document for the quarter).
 *
 * Periodic Form 10-Q / 10-K on EDGAR are often HTML/XBRL without companion PDFs; we prefer the IR-hosted earnings release PDF.
 */
export async function applyIrSeedAmazonDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const plans = rows.map((row) => {
    const p = fiscalFromAmazonPeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!p) return { slides: [] as string[], filings: [] as string[] };
    return {
      slides: amazonWebslidesPdfCandidates(p.calendarYear, p.fq),
      filings: amazonEarningsReleaseCandidates(p.calendarYear, p.fq),
    };
  });

  const unique = [...new Set(plans.flatMap((p) => [...p.slides, ...p.filings]))];
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headOk(u))));

  return rows.map((row, i) => {
    const { slides, filings } = plans[i]!;
    const slideHit = slides.find((u) => ok.get(u));
    const filingHit = filings.find((u) => ok.get(u));

    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings = filingHit ?? row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
