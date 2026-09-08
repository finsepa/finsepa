//
//  ir-seed-apply-tesla.ts
//
//  Tesla shareholder Update PDFs (Slides) + Form 10-Q / 10-K HTML (Filings).
//  Cloudinary through Q2 2025; assets-ir.tesla.com after that (HEAD 403s, overlay without probe).
//

import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  teslaCloudinaryUpdateUrl,
  teslaKnownDocsForQuarter,
} from "@/lib/market/ir-seed-tesla-catalog";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;

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
    if (ct.includes("text/html") || ct.includes("image/gif")) return false;
    return true;
  } catch {
    return false;
  }
}

function parseRowQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
}

/** TSLA — Cloudinary HEAD + known assets-ir / 10-Q overlay. */
export async function applyIrSeedTeslaDocumentUrls(
  rows: StockEarningsHistoryRow[],
): Promise<StockEarningsHistoryRow[]> {
  const plans = rows.map((row) => {
    if (!row.reported || isEarningsSlidesPreviewUrl(row.secSlidesUrl)) return null;
    const p = parseRowQuarter(row);
    if (!p) return null;
    return teslaCloudinaryUpdateUrl(p.fq, p.fy);
  });

  const unique = [...new Set(plans.filter((u): u is string => Boolean(u)))];
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headPdfExists(u))));

  return rows.map((row, i) => {
    if (!row.reported) return row;
    const p = parseRowQuarter(row);
    const known = p ? teslaKnownDocsForQuarter(p.fq, p.fy) : undefined;
    const cand = plans[i];
    const nextSlides =
      (isEarningsSlidesPreviewUrl(row.secSlidesUrl) ? row.secSlidesUrl : null) ??
      (cand && ok.get(cand) ? cand : null) ??
      (known?.slides && isDirectEarningsPdfUrl(known.slides) ? known.slides : null) ??
      row.secSlidesUrl;
    const nextFilings =
      (isEarningsFilingsPreviewUrl(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
      (known?.filings && isEarningsFilingsPreviewUrl(known.filings) ? known.filings : null) ??
      row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
