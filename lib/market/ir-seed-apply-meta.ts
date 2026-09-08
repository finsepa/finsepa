import "server-only";

import { metaFilingCandidates, metaSlidesCandidates } from "@/lib/market/ir-seed-meta-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export { metaFilingCandidates, metaSlidesCandidates } from "@/lib/market/ir-seed-meta-match";

const HEAD_MS = 2500;

/**
 * Meta fiscal year ends December 31 (calendar-aligned).
 * Q1: Jan–Mar, Q2: Apr–Jun, Q3: Jul–Sep, Q4: Oct–Dec.
 */
function fiscalFromMetaPeriodEndYmd(ymd: string | null): { calendarYear: number; fq: 1 | 2 | 3 | 4 } | null {
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
 * META only:
 * - Slides: Meta earnings presentation PDF on Q4 CDN.
 * - Filings: Exhibit 99.1 or `doc_news/Meta-Reports-…` press-release PDF.
 */
export async function applyIrSeedMetaDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const plans = rows.map((row) => {
    const p = fiscalFromMetaPeriodEndYmd(row.fiscalPeriodEndYmd);
    if (!p) return { slides: [] as string[], filings: [] as string[] };
    return {
      slides: metaSlidesCandidates(p.calendarYear, p.fq),
      filings: metaFilingCandidates(p.calendarYear, p.fq),
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
