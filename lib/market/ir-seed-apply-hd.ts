import "server-only";

import { isDirectEarningsPdfUrl } from "@/lib/market/earnings-document-url";
import {
  HD_IR_PAGES,
  hdIrQuarterFromPeriodEndYmd,
  hdPressReleaseUrl,
  labelFromHdPressHref,
  mergeHdConstructedQuarterDocs,
  parseHdQuarterlyEarningsHtml,
} from "@/lib/market/ir-seed-hd-match";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;
const HEAD_MS = 2500;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function rowLabel(row: StockEarningsHistoryRow): string | null {
  const p = hdIrQuarterFromPeriodEndYmd(row.fiscalPeriodEndYmd);
  if (!p) return null;
  return `Q${p.fq} ${p.fy}`;
}

function isMatchingHdPressPdf(url: string | null | undefined, row: StockEarningsHistoryRow): boolean {
  if (!url || !/homedepot\.com/i.test(url)) return false;
  if (!/press-release\/q[1-4]-\d{4}-earnings?-release\.pdf/i.test(url)) return false;
  const label = labelFromHdPressHref(url);
  return Boolean(label && label === rowLabel(row));
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
 * HD: earnings-release PDF as filings. No quarterly deck — leave Slides empty.
 * Never lock 10-Q, transcripts, infographics, or Investor Conference decks.
 */
export async function applyIrSeedHdDocumentUrls(
  rows: StockEarningsHistoryRow[],
  _hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const needs = rows.some((r) => r.reported && (!isMatchingHdPressPdf(r.secFilingsUrl, r) || r.secSlidesUrl));
  if (!needs) return rows;

  const parsed = new Map<string, { slides: string | null; filings: string | null }>();
  for (const page of HD_IR_PAGES) {
    const html = await fetchHtml(page);
    if (!html) continue;
    for (const [label, docs] of parseHdQuarterlyEarningsHtml(html, page)) {
      const cur = parsed.get(label) ?? { slides: null, filings: null };
      parsed.set(label, { slides: null, filings: cur.filings ?? docs.filings });
    }
  }
  const labels = [...new Set(rows.map(rowLabel).filter((x): x is string => Boolean(x)))];
  const byLabel = mergeHdConstructedQuarterDocs(parsed, labels);
  const unique = [
    ...new Set([...byLabel.values()].flatMap((d) => (d.filings ? [d.filings] : []))),
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
      m ? hdPressReleaseUrl(Number(m[1]), Number(m[2])) : null,
    ].filter((u): u is string => Boolean(u) && ok.get(u) === true && isDirectEarningsPdfUrl(u));
    const nextFilings =
      (isMatchingHdPressPdf(row.secFilingsUrl, row) ? row.secFilingsUrl : null) ??
      candidates[0] ??
      row.secFilingsUrl;
    if (nextFilings === row.secFilingsUrl && row.secSlidesUrl == null) return row;
    return { ...row, secSlidesUrl: null, secFilingsUrl: nextFilings };
  });
}
