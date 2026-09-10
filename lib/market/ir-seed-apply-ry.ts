import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  RY_FY_END,
  mergeRyConstructedQuarterDocs,
  ryFilingsUrl,
  rySlidesUrl,
} from "@/lib/market/ir-seed-ry-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p =
    fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, RY_FY_END) ??
    fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
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
 * RY: quarterly slides as Slides; earnings-release PDF as Filings.
 * Never lock speech, pillar 3, strategic update, annual report, or XLS.
 */
export async function applyIrSeedRyDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) => r.reported && (!isDirectEarningsPdfUrl(r.secSlidesUrl) || !isDirectEarningsPdfUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeRyConstructedQuarterDocs(labels);
  const unique = [
    ...new Set([...byLabel.values()].flatMap((d) => [d.slides, d.filings].filter((u): u is string => Boolean(u)))),
  ].slice(0, 80);
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headPdfExists(u))));

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const fq = m ? Number(m[1]) : 0;
    const fy = m ? Number(m[2]) : 0;
    const slideCandidates = [byLabel.get(label)?.slides, m ? rySlidesUrl(fq, fy) : null].filter(
      (u): u is string => Boolean(u) && ok.get(u) === true && isDirectEarningsPdfUrl(u),
    );
    const filingCandidates = [byLabel.get(label)?.filings, m ? ryFilingsUrl(fq, fy) : null].filter(
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
