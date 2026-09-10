import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  MS_IR_PAGES,
  mergeMsConstructedQuarterDocs,
  msEarningsReleaseUrl,
  msFinancialSupplementUrl,
  msStrategicUpdateUrl,
  parseMsEarningsHtml,
} from "@/lib/market/ir-seed-ms-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const HEAD_MS = 2500;
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
 * MS: Q4 Strategic Update (else financial supplement) as slides; earnings-release PDF as filings.
 * Never lock XLS, Fixed Income decks, or SEC HTML.
 */
export async function applyIrSeedMsDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) => r.reported && (!isDirectEarningsPdfUrl(r.secSlidesUrl) || !isDirectEarningsPdfUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  for (const page of MS_IR_PAGES) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const [label, docs] of parseMsEarningsHtml(html, page)) {
      const cur = parsed.get(label) ?? { slides: null, filings: null };
      parsed.set(label, { slides: cur.slides ?? docs.slides, filings: cur.filings ?? docs.filings });
    }
  }

  const labels = [
    ...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x))),
  ];
  const byLabel = mergeMsConstructedQuarterDocs(parsed, labels);

  const unique = [
    ...new Set(
      [...byLabel.values()].flatMap((d) => [d.slides, d.filings].filter((u): u is string => Boolean(u))),
    ),
  ];
  const extra = labels.flatMap((label) => {
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) return [];
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    return [msFinancialSupplementUrl(fq, fy), msStrategicUpdateUrl(fy), msEarningsReleaseUrl(fq, fy)];
  });
  const toHead = [...new Set([...unique, ...extra])].slice(0, 80);
  const ok = new Map<string, boolean>();
  await Promise.all(toHead.map(async (u) => ok.set(u, await headPdfExists(u))));

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const hit = byLabel.get(label);
    if (!hit) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const fq = m ? Number(m[1]) : 0;
    const fy = m ? Number(m[2]) : 0;
    const slideCandidates = [
      hit.slides,
      fq === 4 ? msStrategicUpdateUrl(fy) : null,
      msFinancialSupplementUrl(fq, fy),
    ].filter((u): u is string => Boolean(u) && ok.get(u) === true && isDirectEarningsPdfUrl(u));
    const filingCandidates = [hit.filings, msEarningsReleaseUrl(fq, fy)].filter(
      (u): u is string => Boolean(u) && ok.get(u) === true && isDirectEarningsPdfUrl(u),
    );
    const nextSlides =
      (isDirectEarningsPdfUrl(row.secSlidesUrl) ? row.secSlidesUrl : null) ?? slideCandidates[0] ?? row.secSlidesUrl;
    const nextFilings =
      (isDirectEarningsPdfUrl(row.secFilingsUrl) ? row.secFilingsUrl : null) ?? filingCandidates[0] ?? row.secFilingsUrl;
    if (nextSlides === nextFilings && nextFilings) {
      return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: row.secFilingsUrl };
    }
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
