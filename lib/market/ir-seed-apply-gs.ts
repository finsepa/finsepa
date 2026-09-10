import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  gsFilingsUrl,
  gsSlidesUrl,
  mergeGsConstructedQuarterDocs,
} from "@/lib/market/ir-seed-gs-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const GET_MS = 4000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

/** goldmansachs.com HEAD returns an HTML viewer; CloudFront Range GET is the real PDF. */
async function getPdfExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "application/pdf,*/*",
        Range: "bytes=0-7",
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(GET_MS),
    });
    if (!(res.ok || res.status === 206)) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.subarray(0, 4).toString("utf8") === "%PDF";
  } catch {
    return false;
  }
}

/**
 * GS: earnings-results presentation as slides; earnings-results PDF as filings.
 * Never lock 10-K, proxy, or fixed-income fact sheets.
 */
export async function applyIrSeedGsDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some(
    (r) => r.reported && (!isDirectEarningsPdfUrl(r.secSlidesUrl) || !isDirectEarningsPdfUrl(r.secFilingsUrl)),
  );
  if (!needs) return rows;

  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeGsConstructedQuarterDocs(labels);
  const unique = [
    ...new Set([...byLabel.values()].flatMap((d) => [d.slides, d.filings].filter((u): u is string => Boolean(u)))),
  ].slice(0, 80);
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await getPdfExists(u))));

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const fq = m ? Number(m[1]) : 0;
    const fy = m ? Number(m[2]) : 0;
    const slideCandidates = [byLabel.get(label)?.slides, m ? gsSlidesUrl(fq, fy) : null].filter(
      (u): u is string => typeof u === "string" && ok.get(u) === true && isDirectEarningsPdfUrl(u),
    );
    const filingCandidates = [byLabel.get(label)?.filings, m ? gsFilingsUrl(fq, fy) : null].filter(
      (u): u is string => typeof u === "string" && ok.get(u) === true && isDirectEarningsPdfUrl(u),
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
