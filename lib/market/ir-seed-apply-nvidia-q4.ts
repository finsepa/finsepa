import "server-only";

import { nvidiaQ4cdnFilingPdfUrl } from "@/lib/market/nvidia-q4cdn-filing-pdfs";
import { nvidiaQuarterlyPresentationCandidateUrls } from "@/lib/market/nvidia-q4cdn-presentation-pdfs";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

/** Earnings table label like `Q2 2026` (fiscal quarter + fiscal year in UI). */
export function parseNvidiaFiscalQuarterFromLabel(label: string | null): { fq: number; fy: number } | null {
  if (!label) return null;
  const m = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return null;
  const fq = Number(m[1]);
  const fy = Number(m[2]);
  if (!Number.isFinite(fq) || fq < 1 || fq > 4) return null;
  if (!Number.isFinite(fy) || fy < 2000 || fy > 2100) return null;
  return { fq, fy };
}

async function headPdfExists(url: string): Promise<boolean> {
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
 * Fills `secSlidesUrl` with NVIDIA’s q4cdn quarterly presentation when any known candidate returns OK (HEAD),
 * and `secFilingsUrl` with the matching q4cdn Form 10-Q / 10-K PDF for fiscal FY2023–FY2026 when known.
 * Does not scrape `investor.nvidia.com`. Tries `doc_presentations` paths for quarters where the
 * `doc_financials/…/Quarterly-Presentation-FINAL.pdf` name did not exist yet. When an IR deck is found,
 * it replaces prior `secSlidesUrl` (including SEC 8-K exhibit PDFs) so Slides match IR quarterly decks.
 * Filing URLs override prior `secFilingsUrl` for mapped quarters. Curated rows still win last.
 */
export async function applyIrSeedNvidiaPresentationUrls(
  rows: StockEarningsHistoryRow[],
): Promise<StockEarningsHistoryRow[]> {
  const candidateListsByIndex: (string[] | null)[] = rows.map((row) => {
    const p = parseNvidiaFiscalQuarterFromLabel(row.fiscalPeriodLabel);
    if (!p) return null;
    return nvidiaQuarterlyPresentationCandidateUrls(p.fq, p.fy);
  });

  const unique = [...new Set(candidateListsByIndex.flat().filter((u): u is string => Boolean(u)))];
  const ok = new Map<string, boolean>();
  await Promise.all(
    unique.map(async (url) => {
      ok.set(url, await headPdfExists(url));
    }),
  );

  return rows.map((row, i) => {
    const p = parseNvidiaFiscalQuarterFromLabel(row.fiscalPeriodLabel);
    const filingUrl = p ? nvidiaQ4cdnFilingPdfUrl(p.fy, p.fq) : null;

    const list = candidateListsByIndex[i];
    const irSlide = list ? list.find((u) => ok.get(u)) : undefined;
    const nextSlides = irSlide ?? row.secSlidesUrl;
    const nextFilings = filingUrl ?? row.secFilingsUrl;

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
