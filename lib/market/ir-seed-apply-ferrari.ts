import "server-only";

import { ferrariPresentationCandidateUrls } from "@/lib/market/ferrari-cdn-earnings-pdfs";
import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import { fiscalQuarterFromLabel, fiscalQuarterFromPeriodEndYmd } from "@/lib/market/fiscal-quarter-label";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

async function headPdfExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*" },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("text/html")) return false;
    return true;
  } catch {
    return false;
  }
}

function parseRowQuarter(
  row: StockEarningsHistoryRow,
  fyEndMonthDay: string | null,
): { fq: number; fy: number } | null {
  const fromYmd = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, fyEndMonthDay);
  if (fromYmd) return fromYmd;
  return fiscalQuarterFromLabel(row.fiscalPeriodLabel);
}

/** HEAD-probe Ferrari `cdn.ferrari.com` quarterly presentation PDFs (foreign issuer; no 8-K decks). */
export async function applyIrSeedFerrariPresentationUrls(
  rows: StockEarningsHistoryRow[],
  options?: { fyEndMonthDay?: string | null; preview?: boolean },
): Promise<StockEarningsHistoryRow[]> {
  const fyEndMonthDay = options?.fyEndMonthDay ?? null;
  const maxRows = options?.preview ? 2 : 12;

  const needingIdx = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => row.reported && !isDirectEarningsPdfUrl(row.secSlidesUrl))
    .sort((a, b) => (b.row.reportDateYmd ?? "").localeCompare(a.row.reportDateYmd ?? ""))
    .slice(0, maxRows)
    .map((x) => x.idx);

  const candidateListsByIndex = rows.map((row, idx) => {
    if (!needingIdx.includes(idx)) return null;
    const p = parseRowQuarter(row, fyEndMonthDay);
    if (!p || !row.reportDateYmd) return null;
    return ferrariPresentationCandidateUrls(row.reportDateYmd, p.fq, p.fy);
  });

  const unique = [...new Set(candidateListsByIndex.flat().filter((u): u is string => Boolean(u)))];
  const ok = new Map<string, boolean>();
  await Promise.all(
    unique.map(async (url) => {
      ok.set(url, await headPdfExists(url));
    }),
  );

  return rows.map((row, i) => {
    const list = candidateListsByIndex[i];
    if (!list) return row;
    const hit = list.find((u) => ok.get(u));
    if (!hit) return row;
    return { ...row, secSlidesUrl: hit };
  });
}
