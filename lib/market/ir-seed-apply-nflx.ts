import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  fiscalQuarterFromLabel,
  fiscalQuarterFromPeriodEndYmd,
} from "@/lib/market/fiscal-quarter-label";
import {
  mergeNflxKnownQuarterDocs,
  nflxShareholderLetterCandidates,
} from "@/lib/market/ir-seed-nflx-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = fiscalQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd, null) ?? fiscalQuarterFromLabel(row.fiscalPeriodLabel);
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
 * NFLX: Letter to Shareholders as filings. No quarterly deck — leave Slides empty.
 * Never lock transcripts or SEC HTML as Slides.
 */
export async function applyIrSeedNflxDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && (!isDirectEarningsPdfUrl(r.secFilingsUrl) || r.secSlidesUrl));
  if (!needs) return rows;

  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeNflxKnownQuarterDocs(new Map());
  const extra = labels.flatMap((label) => {
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) return [];
    return nflxShareholderLetterCandidates(Number(m[1]), Number(m[2]));
  });
  const unique = [
    ...new Set(
      [...byLabel.values()].flatMap((d) => (d.filings ? [d.filings] : [])).concat(extra),
    ),
  ].slice(0, 80);
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (u) => ok.set(u, await headPdfExists(u))));

  return rows.map((row) => {
    if (!row.reported) return row;
    const label = rowLabel(row);
    if (!label) return row;
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    const candidates = [
      byLabel.get(label)?.filings,
      ...(m ? nflxShareholderLetterCandidates(Number(m[1]), Number(m[2])) : []),
    ].filter((u): u is string => typeof u === "string" && ok.get(u) === true && isDirectEarningsPdfUrl(u));
    const nextFilings =
      (isDirectEarningsPdfUrl(row.secFilingsUrl) ? row.secFilingsUrl : null) ?? candidates[0] ?? row.secFilingsUrl;
    if (nextFilings === row.secFilingsUrl && row.secSlidesUrl == null) return row;
    return { ...row, secSlidesUrl: null, secFilingsUrl: nextFilings };
  });
}
