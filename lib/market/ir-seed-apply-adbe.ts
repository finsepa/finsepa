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
  ADBE_FY_END,
  ADBE_IR_PAGES,
  adbeDocsByPeriodEnd,
  mergeAdbeKnownQuarterDocs,
  parseAdbeFinancialDocumentsHtml,
} from "@/lib/market/ir-seed-adbe-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, ADBE_FY_END) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/html", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * ADBE: IR "Earnings script and slides" → Slides; press-release PDF → Filings.
 * Catalog + live parse of financial-documents.html. Never lock transcripts/SEC HTML.
 */
export async function applyIrSeedAdbeDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) =>
      r.reported &&
      (!isEarningsSlidesPreviewUrl(r.secSlidesUrl) ||
        !isEarningsFilingsPreviewUrl(r.secFilingsUrl) ||
        /transcript/i.test(r.secSlidesUrl ?? "") ||
        /sec\.gov/i.test(r.secSlidesUrl ?? "")),
  );
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  for (const page of ADBE_IR_PAGES) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const [label, docs] of parseAdbeFinancialDocumentsHtml(html, page)) {
      const cur = parsed.get(label) ?? { slides: null, filings: null };
      parsed.set(label, {
        slides: cur.slides ?? docs.slides,
        filings: cur.filings ?? docs.filings,
      });
    }
  }
  const byLabel = mergeAdbeKnownQuarterDocs(parsed);
  const byEnd = adbeDocsByPeriodEnd();

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    const docs =
      (row.fiscalPeriodEndYmd ? byEnd.get(row.fiscalPeriodEndYmd) : null) ??
      (label ? byLabel.get(label) : null);
    if (!docs) return row;

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;

    const slidesBad =
      !isEarningsSlidesPreviewUrl(nextSlides) ||
      /transcript/i.test(nextSlides ?? "") ||
      /sec\.gov/i.test(nextSlides ?? "");
    if (slidesBad && docs.slides && isDirectEarningsPdfUrl(docs.slides)) {
      nextSlides = docs.slides;
    }

    const filingsBad =
      !isEarningsFilingsPreviewUrl(nextFilings) || /sec\.gov/i.test(nextFilings ?? "");
    if (filingsBad && docs.filings && isDirectEarningsPdfUrl(docs.filings)) {
      nextFilings = docs.filings;
    }

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
