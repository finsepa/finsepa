//
//  ir-seed-apply-ma.ts
//
//  Mastercard — HEAD-probe the stable q4cdn Presentation / Release filenames.
//  Generic Q4 candidate fan-out hits the known-base HEAD probe cap before older
//  years (e.g. 2022) get probed; this dedicated path stays a handful of URLs/quarter.
//

import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import { maFilingsCandidates, maSlidesCandidates } from "@/lib/market/ir-seed-ma-match";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export { maFilingsCandidates, maFilingsUrl, maSlidesCandidates, maSlidesUrl } from "@/lib/market/ir-seed-ma-match";

const HEAD_MS = 2500;

function parseRowQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
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

/** MA only — resolve Mastercard Presentation / Release PDFs via cheap HEAD probes. */
export async function applyIrSeedMaDocumentUrls(
  rows: StockEarningsHistoryRow[],
): Promise<StockEarningsHistoryRow[]> {
  const plans = rows.map((row) => {
    if (!row.reported) return { slides: [] as string[], filings: [] as string[] };
    const hasSlides = isDirectEarningsPdfUrl(row.secSlidesUrl);
    const hasFilings = isDirectEarningsPdfUrl(row.secFilingsUrl);
    if (hasSlides && hasFilings) return { slides: [], filings: [] };

    const p = parseRowQuarter(row);
    if (!p) return { slides: [], filings: [] };

    return {
      slides: hasSlides ? [] : maSlidesCandidates(p.fq, p.fy),
      filings: hasFilings ? [] : maFilingsCandidates(p.fq, p.fy),
    };
  });

  const unique = [...new Set(plans.flatMap((p) => [...p.slides, ...p.filings]))];
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
