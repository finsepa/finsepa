import "server-only";

import {
  extractQuarterLabeledEarningsDeckUrls,
  extractQuarterLabeledEarningsDeckPdfUrls,
  extractQuarterLabeledEarningsReleasePdfUrls,
  extractQuarterLabeledIrOverviewPresentationPdfUrls,
  extractQuarterLabeledSlidePresentationPdfUrls,
  fetchGcsWebEarningsEvents,
  gcsEventForReportDate,
  headPdfLikeUrl,
} from "@/lib/market/gcs-web-earnings-presentations";
import { earningsDeckLookupLabels } from "@/lib/market/earnings-deck-quarter-labels";
import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
  isSecEdgarEarningsReleaseExhibitHtml,
} from "@/lib/market/earnings-document-url";
import { buildCommonQuarterlyEarningsPages, buildIrSeedUrls } from "@/lib/market/ir-seed-hosts";
import { irSeedSlideRowCap } from "@/lib/market/ir-seed-limits";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const FETCH_MS = 12_000;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function buildComcastNewsReleaseUrl(fq: number, fy: number): string | null {
  const ord = ["1st", "2nd", "3rd", "4th"][fq - 1];
  if (!ord) return null;
  return `https://corporate.comcast.com/news-releases/news-release-details/comcast-reports-${ord}-quarter-${fy}-results`;
}

function parseFqFy(label: string | null): { fq: number; fy: number } | null {
  if (!label) return null;
  const m = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return null;
  return { fq: Number(m[1]), fy: Number(m[2]) };
}

function rowNeedsSlideResolution(row: StockEarningsHistoryRow): boolean {
  if (!row.reported) return false;
  if (!isEarningsSlidesPreviewUrl(row.secSlidesUrl)) return true;
  return (
    isSecEdgarEarningsReleaseExhibitHtml(row.secSlidesUrl) && !isDirectEarningsPdfUrl(row.secSlidesUrl)
  );
}

function rowNeedsFilingResolution(row: StockEarningsHistoryRow): boolean {
  if (!row.reported) return false;
  if (!isEarningsFilingsPreviewUrl(row.secFilingsUrl)) return true;
  return (
    isSecEdgarEarningsReleaseExhibitHtml(row.secFilingsUrl) && !isDirectEarningsPdfUrl(row.secFilingsUrl)
  );
}

/**
 * Q4 GCS-web JSON feeds and static-files HTML scraping for earnings presentations.
 * Runs for any ticker missing slide PDFs (Comcast / Micron-class issuers on static-files IR sites).
 */
export async function applyGcsWebPresentationUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
  options?: { preview?: boolean },
): Promise<StockEarningsHistoryRow[]> {
  const preview = options?.preview === true;
  const maxRows = irSeedSlideRowCap(preview);
  const ticker = listingTicker.trim().toUpperCase();

  const needingSlides = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => rowNeedsSlideResolution(row))
    .sort((a, b) => (b.row.reportDateYmd ?? "").localeCompare(a.row.reportDateYmd ?? ""))
    .slice(0, maxRows);

  const needingFilings = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => rowNeedsFilingResolution(row))
    .sort((a, b) => (b.row.reportDateYmd ?? "").localeCompare(a.row.reportDateYmd ?? ""))
    .slice(0, maxRows);

  if (needingSlides.length === 0 && needingFilings.length === 0) return rows;

  const seeds = buildIrSeedUrls(ticker, hub);
  const hosts = seeds.filter((u) => /^https?:\/\//i.test(u));

  const gcsOrigins = [...new Set(hosts.filter((h) => h.includes("gcs-web.com")))];
  const eventsByHost = new Map<string, Awaited<ReturnType<typeof fetchGcsWebEarningsEvents>>>();
  await Promise.all(
    gcsOrigins.map(async (origin) => {
      eventsByHost.set(origin, await fetchGcsWebEarningsEvents(origin));
    }),
  );

  const decksByQuarter = new Map<string, string>();
  const filingsByQuarter = new Map<string, string>();

  const htmlSeeds = [...new Set(hosts)];
  if (ticker === "CMCSA") {
    for (const { row } of needingSlides) {
      const p = parseFqFy(row.fiscalPeriodLabel);
      if (p) {
        const news = buildComcastNewsReleaseUrl(p.fq, p.fy);
        if (news) htmlSeeds.push(news);
      }
    }
  }

  const seedLimit = preview ? 2 : htmlSeeds.length;
  for (const seed of htmlSeeds.slice(0, seedLimit)) {
    for (const page of buildCommonQuarterlyEarningsPages(seed, preview)) {
      const html = await fetchHtml(page);
      if (!html) continue;
      for (const [label, url] of extractQuarterLabeledEarningsDeckUrls(html, page)) {
        if (!decksByQuarter.has(label)) decksByQuarter.set(label, url);
      }
      for (const [label, url] of extractQuarterLabeledSlidePresentationPdfUrls(html)) {
        if (!decksByQuarter.has(label)) decksByQuarter.set(label, url);
      }
      for (const [label, url] of extractQuarterLabeledIrOverviewPresentationPdfUrls(html, page)) {
        if (!decksByQuarter.has(label)) decksByQuarter.set(label, url);
      }
      for (const [label, url] of extractQuarterLabeledEarningsDeckPdfUrls(html, page)) {
        if (!decksByQuarter.has(label)) decksByQuarter.set(label, url);
      }
      for (const [label, url] of extractQuarterLabeledEarningsReleasePdfUrls(html, page)) {
        if (!filingsByQuarter.has(label)) filingsByQuarter.set(label, url);
      }
      if (preview && (decksByQuarter.size > 0 || filingsByQuarter.size > 0)) break;
    }
    if (preview && (decksByQuarter.size > 0 || filingsByQuarter.size > 0)) break;
  }

  const slideCandidateLists = needingSlides.map(({ row }) => {
    const candidates: string[] = [];
    const label = row.fiscalPeriodLabel?.trim();
    if (label) {
      for (const key of earningsDeckLookupLabels(label)) {
        const labeled = decksByQuarter.get(key);
        if (labeled) candidates.push(labeled);
      }
    }
    if (row.reportDateYmd) {
      for (const evs of eventsByHost.values()) {
        const hit = gcsEventForReportDate(evs, row.reportDateYmd);
        if (hit?.presentationUrl) candidates.push(hit.presentationUrl);
      }
    }
    return [...new Set(candidates)];
  });

  const filingCandidateLists = needingFilings.map(({ row }) => {
    const candidates: string[] = [];
    const label = row.fiscalPeriodLabel?.trim();
    if (label) {
      for (const key of earningsDeckLookupLabels(label)) {
        const labeled = filingsByQuarter.get(key);
        if (labeled) candidates.push(labeled);
      }
    }
    return [...new Set(candidates)];
  });

  const unique = [
    ...new Set([...slideCandidateLists.flat(), ...filingCandidateLists.flat()]),
  ].slice(0, preview ? 12 : 48);
  const resolved = new Map<string, string | null>();
  await Promise.all(unique.map(async (u) => resolved.set(u, await headPdfLikeUrl(u))));

  return rows.map((row, i) => {
    const slideNeed = needingSlides.find((n) => n.idx === i);
    const filingNeed = needingFilings.find((n) => n.idx === i);
    if (!slideNeed && !filingNeed) return row;

    let nextSlides = row.secSlidesUrl;
    let nextFilings = row.secFilingsUrl;

    if (slideNeed) {
      const listIdx = needingSlides.findIndex((n) => n.idx === i);
      const list = slideCandidateLists[listIdx] ?? [];
      const hit = list.map((u) => resolved.get(u) ?? null).find((u): u is string => !!u) ?? null;
      if (hit) nextSlides = hit;
    }

    if (filingNeed) {
      const listIdx = needingFilings.findIndex((n) => n.idx === i);
      const list = filingCandidateLists[listIdx] ?? [];
      const hit = list.map((u) => resolved.get(u) ?? null).find((u): u is string => !!u) ?? null;
      if (hit) nextFilings = hit;
    }

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
