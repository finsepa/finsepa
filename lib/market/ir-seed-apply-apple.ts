import "server-only";

import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

const APPLE_Q4CDN = "https://s2.q4cdn.com/470004039/files";

function fiscalFromApplePeriodEndYmd(ymd: string | null): { fy: number; fq: 1 | 2 | 3 | 4 } | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [ys, ms] = ymd.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

  // Apple fiscal year ends in September:
  // Q1: Oct–Dec, Q2: Jan–Mar, Q3: Apr–Jun, Q4: Jul–Sep.
  const fy = m >= 10 ? y + 1 : y;
  const fq: 1 | 2 | 3 | 4 =
    m >= 10 ? 1 : m <= 3 ? 2 : m <= 6 ? 3 : 4;
  return { fy, fq };
}

function appleNewsroomConsolidatedStatementsPdfUrl(fy: number, fq: number): string {
  const yy2 = String(fy % 100).padStart(2, "0");
  return `https://www.apple.com/newsroom/pdfs/fy${fy}-q${fq}/FY${yy2}_Q${fq}_Consolidated_Financial_Statements.pdf`;
}

function apple10qCandidates(fy: number, fq: number): string[] {
  // Apple has used multiple naming conventions over time; HEAD probe picks the winner.
  return [
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q${fq}/filing/10Q-Q${fq}-${fy}-as-filed.pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q${fq}/filing/_10-Q-Q${fq}-${fy}-As-Filed.pdf`,
    `${APPLE_Q4CDN}/doc_financials/${fy}/q${fq}/_10-Q-Q${fq}-${fy}-(As-Filed).pdf`,
  ];
}

function apple10kCandidates(fy: number): string[] {
  return [
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q4/filing/10K-Q4-${fy}-as-filed.pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q4/filing/_10-K-Q4-${fy}-As-Filed.pdf`,
    `${APPLE_Q4CDN}/doc_earnings/${fy}/q4/filing/10-K-Q4-${fy}-As-Filed.pdf`,
    `${APPLE_Q4CDN}/doc_financials/${fy}/ar/_10-K-${fy}-As-Filed.pdf`,
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
 * AAPL only:
 * - Slides: Apple "Consolidated Financial Statements" PDF (Newsroom) for the fiscal quarter.
 * - Filings: Apple q4cdn PDFs for Form 10-Q / 10-K ("as filed") when available.
 *
 * Uses `fiscalPeriodEndYmd` to compute Apple fiscal quarter (FY ends in September).
 */
export async function applyIrSeedAppleDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byRow = rows.map((row) => {
    const p = fiscalFromApplePeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!p) return { slides: [] as string[], filings: [] as string[] };
    const slides = [appleNewsroomConsolidatedStatementsPdfUrl(p.fy, p.fq)];
    const filings = p.fq === 4 ? apple10kCandidates(p.fy) : apple10qCandidates(p.fy, p.fq);
    return { slides, filings };
  });

  const unique = [...new Set(byRow.flatMap((x) => [...x.slides, ...x.filings]))];
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headOk(u))));

  return rows.map((row, i) => {
    const { slides, filings } = byRow[i]!;
    const slideHit = slides.find((u) => ok.get(u));
    const filingHit = filings.find((u) => ok.get(u));

    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings = filingHit ?? row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}

