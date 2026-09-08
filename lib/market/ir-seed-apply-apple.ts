import "server-only";

import {
  appleFilingsCandidates,
  appleNewsroomConsolidatedStatementsCandidates,
} from "@/lib/market/ir-seed-apple-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export {
  apple10kCandidates,
  apple10qCandidates,
  appleFilingsCandidates,
  appleNewsroomConsolidatedStatementsCandidates,
} from "@/lib/market/ir-seed-apple-match";

const HEAD_MS = 2500;

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

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": "Mozilla/5.0" },
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
    return {
      slides: appleNewsroomConsolidatedStatementsCandidates(p.fy, p.fq),
      filings: appleFilingsCandidates(p.fy, p.fq),
    };
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
