import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  merckEventPageUrls,
  merckFilingsCandidates,
  merckSlidesCandidates,
  mergeMerckKnownQuarterDocs,
  parseMerckEarningsHtml,
} from "@/lib/market/ir-seed-merck-match";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const HEAD_MS = 2500;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const fromLabel = row.fiscalPeriodLabel?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (fromLabel) return `Q${fromLabel[1]} ${fromLabel[2]}`;
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  return p ? `Q${p.fq} ${p.fy}` : null;
}

function parseRowQuarter(row: StockEarningsHistoryRow): { fq: number; fy: number } | null {
  return fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
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

async function headPdfExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": UA },
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

/**
 * MRK: merck.com presentation PDF as slides, earnings announcement / news-release PDF as filings.
 * Never lock SEC HTML when an IR PDF exists.
 */
export async function applyIrSeedMerckDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) => r.reported && (!isDirectEarningsPdfUrl(r.secSlidesUrl) || !isDirectEarningsPdfUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const pages = [
    "https://www.merck.com/investor-relations/",
    ...[...new Set(rows.flatMap((r) => {
      const p = parseRowQuarter(r);
      return p ? merckEventPageUrls(p.fq, p.fy) : [];
    }))],
  ];
  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  for (const page of pages) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const [label, docs] of parseMerckEarningsHtml(html)) {
      const cur = parsed.get(label) ?? { slides: null, filings: null };
      parsed.set(label, {
        slides: cur.slides ?? docs.slides,
        filings: cur.filings ?? docs.filings,
      });
    }
  }
  const byLabel = mergeMerckKnownQuarterDocs(parsed);

  const plans = rows.map((row) => {
    if (!row.reported) return { slides: [] as string[], filings: [] as string[] };
    const p = parseRowQuarter(row);
    if (!p) return { slides: [] as string[], filings: [] as string[] };
    return {
      slides: isDirectEarningsPdfUrl(row.secSlidesUrl) ? [] : merckSlidesCandidates(p.fq, p.fy),
      filings: isDirectEarningsPdfUrl(row.secFilingsUrl) ? [] : merckFilingsCandidates(p.fq, p.fy),
    };
  });
  const unique = [...new Set(plans.flatMap((p) => [...p.slides, ...p.filings]))];
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headPdfExists(u))));

  return rows.map((row, i) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    const hit = label ? byLabel.get(label) : undefined;
    const plan = plans[i]!;
    const slideHit = plan.slides.find((u) => ok.get(u)) ?? null;
    const filingHit = plan.filings.find((u) => ok.get(u)) ?? null;
    const nextSlides =
      (isDirectEarningsPdfUrl(row.secSlidesUrl) ? row.secSlidesUrl : null) ??
      hit?.slides ??
      slideHit ??
      row.secSlidesUrl;
    const nextFilings =
      (isDirectEarningsPdfUrl(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
      hit?.filings ??
      filingHit ??
      row.secFilingsUrl;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: row.secFilingsUrl };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
