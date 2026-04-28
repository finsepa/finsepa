import "server-only";

import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

/** Meta IR (investor.atmeta.com) slide decks are served via Q4 CDN. */
const META_Q4CDN_FINANCIALS = "https://s21.q4cdn.com/399680738/files/doc_financials";

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

function metaSlidesCandidates(calendarYear: number, fq: 1 | 2 | 3 | 4): string[] {
  const base = `${META_Q4CDN_FINANCIALS}/${calendarYear}/q${fq}`;
  return [
    `${base}/Earnings-Presentation-Q${fq}-${calendarYear}.pdf`,
    `${base}/Earnings-Presentation-Q${fq}-${calendarYear}-FINAL.pdf`,
    `${base}/Earnings-Presentation-Q${fq}-${calendarYear}-Final.pdf`,
  ];
}

/**
 * Meta earnings release (often “Exhibit 99.1”) PDFs are posted under `doc_financials/{year}/q{q}`.
 * Example: `.../2025/q4/Meta-12-31-2025-Exhibit-99-1-FINAL.pdf`.
 */
function metaFilingCandidates(calendarYear: number, fq: 1 | 2 | 3 | 4): string[] {
  const mmdd = fq === 1 ? "03-31" : fq === 2 ? "06-30" : fq === 3 ? "09-30" : "12-31";
  const core = `Meta-${mmdd}-${calendarYear}-Exhibit-99-1`;
  const bases = [
    `${META_Q4CDN_FINANCIALS}/${calendarYear}/q${fq}`,
    // Some quarters post the exhibit under doc_downloads instead of doc_financials.
    `https://s21.q4cdn.com/399680738/files/doc_downloads`,
    // Some items appear under doc_news (less common for Exhibit 99.1, but cheap to probe).
    `https://s21.q4cdn.com/399680738/files/doc_news`,
  ];
  const names = [
    `${core}-FINAL.pdf`,
    `${core}-Final.pdf`,
    `${core}.pdf`,
    `${core}_FINAL.pdf`,
    `${core}_Final.pdf`,
    // Older quarters sometimes used all-caps `META-...`
    `${core.replace(/^Meta-/, "META-")}-FINAL.pdf`,
    `${core.replace(/^Meta-/, "META-")}_FINAL.pdf`,
  ];
  return bases.flatMap((b) => names.map((n) => `${b}/${n}`));
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
 * META only:
 * - Slides: Meta earnings presentation PDF on Q4 CDN.
 *
 * Form 10-Q / 10-K on EDGAR are typically HTML/XBRL without companion PDFs; **Filings** stay on SEC 8-K enrichment.
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

