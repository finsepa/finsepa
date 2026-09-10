import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  PM_IR_PAGES,
  PM_KNOWN_QUARTER_DOCS,
  mergePmKnownQuarterDocs,
  parsePmEarningsHtml,
  pmEarningsPageUrls,
} from "@/lib/market/ir-seed-pm-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
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
 * PM: earnings presentation as slides; press-release PDF as filings.
 * GCS static-files often 403 from this host — catalog still locks issuer URLs.
 * Never lock script, webcast advisory, glossary, or Investor Day.
 */
export async function applyIrSeedPmDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) => r.reported && (!isDirectEarningsPdfUrl(r.secSlidesUrl) || !isDirectEarningsPdfUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const missingPages = labels.flatMap((label) => {
    if (PM_KNOWN_QUARTER_DOCS[label]) return [];
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) return [];
    return pmEarningsPageUrls(Number(m[1]), Number(m[2]));
  });
  const pages = [...new Set([...PM_IR_PAGES, ...missingPages])].slice(0, 16);
  for (const page of pages) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const [label, docs] of parsePmEarningsHtml(html, page)) {
      const cur = parsed.get(label) ?? { slides: null, filings: null };
      parsed.set(label, {
        slides: cur.slides ?? docs.slides,
        filings: cur.filings ?? docs.filings,
      });
    }
  }
  const byLabel = mergePmKnownQuarterDocs(parsed);

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    if (!hit) return row;
    const nextSlides =
      (isDirectEarningsPdfUrl(row.secSlidesUrl) ? row.secSlidesUrl : null) ??
      (hit.slides && isDirectEarningsPdfUrl(hit.slides) ? hit.slides : null) ??
      row.secSlidesUrl;
    const nextFilings =
      (isDirectEarningsPdfUrl(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
      (hit.filings && isDirectEarningsPdfUrl(hit.filings) ? hit.filings : null) ??
      row.secFilingsUrl;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: row.secFilingsUrl };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
