import "server-only";

import { parseNvidiaFiscalQuarterFromLabel } from "@/lib/market/ir-seed-apply-nvidia-q4";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

const VISA_IR_FILES = "https://investor.visa.com/files/doc_financials";

function quarterOrdinalWord(fq: 1 | 2 | 3 | 4): "First" | "Second" | "Third" | "Fourth" {
  return fq === 1 ? "First" : fq === 2 ? "Second" : fq === 3 ? "Third" : "Fourth";
}

function visaSlidesCandidates(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  const base = `${VISA_IR_FILES}/${fy}/q${fq}`;
  const ord = quarterOrdinalWord(fq);
  return [
    `${base}/Visa-Inc-${ord}-Quarter-${fy}-Financial-Results-Presentation.pdf`,
    // Some older quarters used “Fiscal” prefix; cheap to probe.
    `${base}/Visa-Inc-Fiscal-${ord}-Quarter-${fy}-Financial-Results-Presentation.pdf`,
  ];
}

function visaFilingsCandidates(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  const base = `${VISA_IR_FILES}/${fy}/q${fq}`;
  return [
    `${base}/Q${fq}-${fy}-Earnings-Release_vF.pdf`,
    `${base}/Q${fq}-${fy}-Earnings-Release.pdf`,
    `${base}/Q${fq}-${fy}-Earnings-Release_vF1.pdf`,
  ];
}

async function headResolvePdfUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*" },
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
 * - Slides: Visa “Financial Results Presentation” PDF on investor.visa.com.
 * - Filings: Visa “Earnings Release” PDF (`Q{q}-{fy}-Earnings-Release_vF.pdf`).
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

