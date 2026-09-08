//
//  ir-seed-apply-pg.ts
//
//  Procter & Gamble — June FY-end; Q4 CDN uses ScriptSlides-{JAS|OND|JFM|AMJ}-YYYY
//  and Q#-FY2425-RELEASE naming (IR pages are JS-only, so HEAD-probe CDN dirs).
//

import "server-only";

import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const PG_FY_END = "06-30";
const PG_Q4CDN_FINANCIALS = "https://s204.q4cdn.com/332108499/files/doc_financials";

/** Season label on ScriptSlides PDFs + the calendar year embedded in the filename. */
function pgSeason(fq: number, fy: number): { code: string; year: number } {
  if (fq === 1) return { code: "JAS", year: fy - 1 };
  if (fq === 2) return { code: "OND", year: fy - 1 };
  if (fq === 3) return { code: "JFM", year: fy };
  return { code: "AMJ", year: fy };
}

function parsePgFiscalQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return (
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, PG_FY_END) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel)
  );
}

export function pgSlidesCandidateUrls(fq: number, fy: number): string[] {
  const base = `${PG_Q4CDN_FINANCIALS}/${fy}/q${fq}`;
  const { code, year } = pgSeason(fq, fy);
  return [
    `${base}/Q${fq}-FY-${fy}-Earnings-Slides-web.pdf`,
    `${base}/Q${fq}-FY${fy}-Earnings-Slides-web.pdf`,
    `${base}/ScriptSlides-${code}-${year}-Reg-G-FINAL.pdf`,
    `${base}/ScriptSlides-${code}-${year}-Reg-G-Final.pdf`,
    `${base}/ScriptSlides-${code}-${year}-Reg-G.pdf`,
  ];
}

export function pgFilingsCandidateUrls(fq: number, fy: number): string[] {
  const base = `${PG_Q4CDN_FINANCIALS}/${fy}/q${fq}`;
  const prev2 = String((fy - 1) % 100).padStart(2, "0");
  const yy2 = String(fy % 100).padStart(2, "0");
  return [
    `${base}/Q${fq}-FY${prev2}${yy2}-RELEASE-Final.pdf`,
    `${base}/Q${fq}-FY${prev2}${yy2}-RELEASE-FINAL.pdf`,
    `${base}/Q${fq}-FY${fy}-RELEASE-Final.pdf`,
    `${base}/Q${fq}-FY-${fy}-RELEASE-Final.pdf`,
    `${base}/Q${fq}-FY${prev2}${yy2}-Earnings-Release-Final.pdf`,
  ];
}

async function headPdfExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": "Mozilla/5.0" },
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

/**
 * PG only — resolve slides / earnings-release PDFs via cheap HEAD probes on known Q4 CDN paths.
 */
export async function applyIrSeedPgDocumentUrls(
  rows: StockEarningsHistoryRow[],
): Promise<StockEarningsHistoryRow[]> {
  const plans = rows.map((row) => {
    if (!row.reported) return { slides: [] as string[], filings: [] as string[] };
    const hasSlides = isDirectEarningsPdfUrl(row.secSlidesUrl);
    const hasFilings = isDirectEarningsPdfUrl(row.secFilingsUrl);
    if (hasSlides && hasFilings) return { slides: [] as string[], filings: [] as string[] };

    const p = parsePgFiscalQuarter(row);
    if (!p) return { slides: [] as string[], filings: [] as string[] };

    return {
      slides: hasSlides ? [] : pgSlidesCandidateUrls(p.fq, p.fy),
      filings: hasFilings ? [] : pgFilingsCandidateUrls(p.fq, p.fy),
    };
  });

  const unique = [...new Set(plans.flatMap((p) => [...p.slides, ...p.filings]))].slice(0, 80);
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headPdfExists(u))));

  return rows.map((row, i) => {
    const plan = plans[i]!;
    const slideHit = plan.slides.find((u) => ok.get(u)) ?? null;
    const filingHit = plan.filings.find((u) => ok.get(u)) ?? null;
    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings = filingHit ?? row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
