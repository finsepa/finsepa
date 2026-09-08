//
//  ir-seed-apply-orcl.ts
//
//  Oracle — HEAD-probe known q4cdn press-release + presentation paths
//  (investor.oracle.com is Cloudflare-walled). FY ends May 31.
//

import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  orclFilingsCandidateUrls,
  orclKnownDocsForQuarter,
  orclSlidesCandidateUrls,
} from "@/lib/market/ir-seed-orcl-candidates";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const ORCL_FY_END = "05-31";

function parseRowQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return (
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, ORCL_FY_END) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel)
  );
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
    return /\.pdf(\?|$)/i.test(res.url || url);
  } catch {
    return false;
  }
}

export async function applyIrSeedOrclDocumentUrls(
  rows: StockEarningsHistoryRow[],
): Promise<StockEarningsHistoryRow[]> {
  const plans = rows.map((row) => {
    if (!row.reported) return { slides: [] as string[], filings: [] as string[] };
    const hasSlides = isDirectEarningsPdfUrl(row.secSlidesUrl);
    const hasFilings = isDirectEarningsPdfUrl(row.secFilingsUrl);
    if (hasSlides && hasFilings) return { slides: [] as string[], filings: [] as string[] };
    const p = parseRowQuarter(row);
    if (!p) return { slides: [] as string[], filings: [] as string[] };
    return {
      slides: hasSlides ? [] : orclSlidesCandidateUrls(p.fq, p.fy),
      filings: hasFilings ? [] : orclFilingsCandidateUrls(p.fq, p.fy),
    };
  });

  const unique = [...new Set(plans.flatMap((p) => [...p.slides, ...p.filings]))].slice(0, 220);
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headPdfExists(u))));

  return rows.map((row, i) => {
    const plan = plans[i]!;
    const slideHit = plan.slides.find((u) => ok.get(u)) ?? null;
    const filingHit = plan.filings.find((u) => ok.get(u)) ?? null;
    const p = parseRowQuarter(row);
    const known = p ? orclKnownDocsForQuarter(p.fq, p.fy) : undefined;
    const nextSlides =
      (isDirectEarningsPdfUrl(row.secSlidesUrl) ? row.secSlidesUrl : null) ??
      slideHit ??
      (known?.slides && isDirectEarningsPdfUrl(known.slides) ? known.slides : null) ??
      row.secSlidesUrl;
    const nextFilings =
      (isDirectEarningsPdfUrl(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
      filingHit ??
      (known?.filings && isDirectEarningsPdfUrl(known.filings) ? known.filings : null) ??
      row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
