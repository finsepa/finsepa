import "server-only";

import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
} from "@/lib/market/earnings-document-url";
import {
  TSMC_IR_QUARTER_DOCS,
  tsmcFilingsUrlFromPackage,
  type TsmcQuarterDocs,
} from "@/lib/market/ir-seed-tsmc-catalog";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

function fiscalEnd(docs: TsmcQuarterDocs): string {
  const ends: Record<number, string> = {
    1: `${docs.fy}-03-31`,
    2: `${docs.fy}-06-30`,
    3: `${docs.fy}-09-30`,
    4: `${docs.fy}-12-31`,
  };
  return ends[docs.fq]!;
}

function tsmcDocsByPeriodEnd(): Map<string, TsmcQuarterDocs> {
  const m = new Map<string, TsmcQuarterDocs>();
  for (const docs of TSMC_IR_QUARTER_DOCS) m.set(fiscalEnd(docs), docs);
  return m;
}

/**
 * TSM: curated investor.tsmc.com encrypt_file PDFs (Presentation + Earnings Release).
 * Cloudflare blocks live `/api/ir-pdf` fetches — preview uses vault-hosted mirrors in
 * `earnings-ir-docs`. Seed still fills first-party IR URLs for open/lock workflows.
 */
export async function applyIrSeedTsmcDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const byEnd = tsmcDocsByPeriodEnd();
  if (byEnd.size === 0) return rows;

  return rows.map((row) => {
    if (!row.reported) return row;
    const end = row.fiscalPeriodEndYmd?.trim();
    if (!end) return row;
    const docs = byEnd.get(end);
    if (!docs) return row;

    const slides = docs.slides ?? null;
    const filings = tsmcFilingsUrlFromPackage(docs);

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;

    // Prefer IR PDFs over SEC exhibit HTML leftovers from the temporary CF workaround.
    if (slides && isDirectEarningsPdfUrl(slides)) {
      if (!isEarningsSlidesPreviewUrl(nextSlides) || /sec\.gov/i.test(nextSlides ?? "")) {
        nextSlides = slides;
      }
    }
    if (filings && isDirectEarningsPdfUrl(filings)) {
      if (!isEarningsFilingsPreviewUrl(nextFilings) || /sec\.gov/i.test(nextFilings ?? "")) {
        nextFilings = filings;
      }
    }

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
