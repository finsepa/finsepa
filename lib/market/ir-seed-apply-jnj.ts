//
//  ir-seed-apply-jnj.ts
//
//  J&J — HEAD-probe known q4cdn presentation / press-release name variants
//  (investor.jnj.com is Cloudflare-walled).
//

import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  jnjFilingsCandidateUrls,
  jnjKnownDocsForQuarter,
  jnjSlidesCandidateUrls,
} from "@/lib/market/ir-seed-jnj-candidates";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

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

/** JNJ only — resolve slides / press-release PDFs via cheap HEAD probes. */
export async function applyIrSeedJnjDocumentUrls(
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
      slides: hasSlides ? [] : jnjSlidesCandidateUrls(p.fq, p.fy),
      filings: hasFilings ? [] : jnjFilingsCandidateUrls(p.fq, p.fy),
    };
  });

  // ~15 candidates × ~18 quarters; keep room for Webcast / Draft / V2 name variants.
  const unique = [...new Set(plans.flatMap((p) => [...p.slides, ...p.filings]))].slice(0, 280);
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headPdfExists(u))));

  return rows.map((row, i) => {
    const plan = plans[i]!;
    const slideHit = plan.slides.find((u) => ok.get(u)) ?? null;
    const filingHit = plan.filings.find((u) => ok.get(u)) ?? null;
    const p = parseRowQuarter(row);
    const known = p ? jnjKnownDocsForQuarter(p.fq, p.fy) : undefined;
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
