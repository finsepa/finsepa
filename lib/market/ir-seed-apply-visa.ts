import "server-only";

import { parseNvidiaFiscalQuarterFromLabel } from "@/lib/market/ir-seed-apply-nvidia-q4";
import { visaFilingsCandidates, visaSlidesCandidates } from "@/lib/market/ir-seed-visa-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

export { visaFilingsCandidates, visaSlidesCandidates } from "@/lib/market/ir-seed-visa-match";

const HEAD_MS = 2500;

async function headResolvePdfUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        Accept: "application/pdf,*/*",
        "User-Agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("text/html")) return null;
    const final = res.url || url;
    if (!/\.pdf(\?|$)/i.test(final)) return null;
    return final;
  } catch {
    return null;
  }
}

/**
 * V only:
 * - Slides: Visa “Financial Results Presentation” / earnings deck PDF on q4cdn.
 * - Filings: Visa “Earnings Release” PDF (`Q{q}-{fy}-Earnings-Release*.pdf`).
 */
export async function applyIrSeedVisaDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byRow = rows.map((row) => {
    const p = parseNvidiaFiscalQuarterFromLabel(row.fiscalPeriodLabel);
    if (!p) return { slides: [] as string[], filings: [] as string[] };
    const fq = p.fq as 1 | 2 | 3 | 4;
    const fy = p.fy;
    return { slides: visaSlidesCandidates(fy, fq), filings: visaFilingsCandidates(fy, fq) };
  });

  const unique = [...new Set(byRow.flatMap((x) => [...x.slides, ...x.filings]))];
  const resolved = new Map<string, string | null>();
  await Promise.all(unique.map(async (u) => resolved.set(u, await headResolvePdfUrl(u))));

  return rows.map((row, i) => {
    const { slides, filings } = byRow[i]!;
    const slideHit = slides.map((u) => resolved.get(u) ?? null).find((u): u is string => !!u) ?? null;
    const filingHit = filings.map((u) => resolved.get(u) ?? null).find((u): u is string => !!u) ?? null;
    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings = filingHit ?? row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
