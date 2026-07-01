import "server-only";

import { getSecEdgarUserAgent } from "@/lib/env/server";
import { normalizeSecCik } from "@/lib/market/earnings-report-external-links";
import {
  applyRevenueUsdToHistoryRow,
  extractTotalRevenueUsdFromPressReleaseHtml,
  pickExhibit99PressReleaseHtmlUrl,
} from "@/lib/market/sec-earnings-press-release-revenue";
import {
  isDirectEarningsPdfUrl,
  isEarningsFilingsPreviewUrl,
  isSecEdgarExhibitHtmlUrl,
} from "@/lib/market/earnings-document-url";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const SEC_ORIGIN = "https://www.sec.gov";

/** SEC company submissions JSON (data.sec.gov). */
function submissionsJsonUrl(cik10: string): string {
  return `https://data.sec.gov/submissions/CIK${cik10}.json`;
}

function cikToNumericPathSegment(cik10: string): string {
  const n = parseInt(cik10.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? String(n) : cik10.replace(/^0+/, "") || "0";
}

function accessionToFlat(accessionDashed: string): string {
  return accessionDashed.replace(/-/g, "");
}

function ymdToUtcDayNumber(ymd: string): number {
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  return Number.isFinite(t) ? Math.floor(t / 86400000) : NaN;
}

type SubmissionsRecent = {
  form: string[];
  filingDate: string[];
  accessionNumber: string[];
  primaryDocument: string[];
};

function parseSubmissionsRecent(root: unknown): SubmissionsRecent | null {
  if (!root || typeof root !== "object") return null;
  const filings = (root as Record<string, unknown>).filings;
  if (!filings || typeof filings !== "object") return null;
  const recent = (filings as Record<string, unknown>).recent;
  if (!recent || typeof recent !== "object") return null;
  const r = recent as Record<string, unknown>;
  const form = r.form;
  const filingDate = r.filingDate;
  const accessionNumber = r.accessionNumber;
  const primaryDocument = r.primaryDocument;
  if (!Array.isArray(form) || !Array.isArray(filingDate) || !Array.isArray(accessionNumber) || !Array.isArray(primaryDocument)) {
    return null;
  }
  return {
    form: form.map(String),
    filingDate: filingDate.map(String),
    accessionNumber: accessionNumber.map(String),
    primaryDocument: primaryDocument.map(String),
  };
}

/** Best issuer-filed 8-K near the earnings report date (±45 filing days). */
export function findBestIssuer8kNearReportDate(
  recent: SubmissionsRecent,
  cik10: string,
  reportYmd: string,
): { accessionNumber: string; primaryDocument: string; filingDate: string } | null {
  const targetDay = ymdToUtcDayNumber(reportYmd);
  if (!Number.isFinite(targetDay)) return null;

  let best: { accessionNumber: string; primaryDocument: string; filingDate: string; delta: number } | null = null;

  for (let i = 0; i < recent.form.length; i++) {
    const form = recent.form[i]!.toUpperCase();
    if (form !== "8-K" && form !== "8-K/A") continue;
    const acc = recent.accessionNumber[i]!;
    if (!acc || !acc.startsWith(cik10)) continue;
    const fd = recent.filingDate[i]!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fd)) continue;
    const d = ymdToUtcDayNumber(fd);
    if (!Number.isFinite(d)) continue;
    const delta = Math.abs(d - targetDay);
    if (delta > 45) continue;
    if (!best || delta < best.delta) {
      best = {
        accessionNumber: acc,
        primaryDocument: recent.primaryDocument[i] ?? "",
        filingDate: fd,
        delta,
      };
    }
  }
  if (!best) return null;
  return {
    accessionNumber: best.accessionNumber,
    primaryDocument: best.primaryDocument,
    filingDate: best.filingDate,
  };
}

async function secFetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": getSecEdgarUserAgent(),
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export type ParsedFilingDoc = { url: string; file: string };

function filingDirectoryBase(cikNumeric: string, accessionFlat: string): string {
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNumeric}/${accessionFlat}/`;
}

/** Unescape common HTML entities in href targets (SEC pages use &amp;). */
function decodeSecHref(s: string): string {
  return s.split("&amp;").join("&").split("&#38;").join("&");
}

/**
 * Every direct `.pdf` URL we can find in a filing `index.htm` (full paths, /Archives, and relative `file.pdf`).
 * This is the only way to open native browser PDF preview for these filings.
 */
export function parseFilingIndexPdfLinks(html: string, cikNumeric: string, accessionFlat: string): ParsedFilingDoc[] {
  const htmlNorm = decodeSecHref(html);
  const seen = new Set<string>();
  const out: ParsedFilingDoc[] = [];
  const base = filingDirectoryBase(cikNumeric, accessionFlat);
  const add = (rawUrl: string) => {
    if (!/\.pdf$/i.test(rawUrl)) return;
    const abs = rawUrl.startsWith("http")
      ? rawUrl
      : rawUrl.startsWith("/")
        ? `${SEC_ORIGIN}${rawUrl}`
        : base + rawUrl.replace(/^\//, "");
    if (seen.has(abs)) return;
    seen.add(abs);
    const file = decodeURIComponent(abs.split("/").pop()?.split("?")[0] ?? "");
    if (!file || !/\.pdf$/i.test(file)) return;
    out.push({ url: abs, file });
  };

  const hrefRe =
    /href=['"]((?:https?:\/\/www\.sec\.gov)?\/Archives\/edgar\/data\/[0-9A-Za-z\/_.,~%-]+\.pdf[^'"]*)['"]/gi;
  for (const m of htmlNorm.matchAll(hrefRe)) {
    let u = m[1]!
      .replace(/^https?:\/\/www\.sec\.gov/i, "")
      .replace(/^\s+/, "");
    if (!u.startsWith("/")) u = `/${u}`;
    add(u);
  }

  for (const m of htmlNorm.matchAll(/href=['"]([^'"]+\.pdf)['"]/gi)) {
    const s = m[1]!.split("#")[0] ?? "";
    if (s.toLowerCase().endsWith("index.pdf")) continue;
    if (s.startsWith("http://") || s.startsWith("https://")) {
      if (/sec\.gov\/Archives\/edgar\/data\//i.test(s)) add(s);
      continue;
    }
    if (s.startsWith("/Archives/")) add(s);
    else if (s.includes("/") || s.startsWith("..") || s.startsWith("//")) {
      /* skip static asset paths */
    } else {
      add(s);
    }
  }

  const loose = /(https?:\/\/www\.sec\.gov\/Archives\/edgar\/data\/[0-9]+\/[0-9A-Za-z0-9]+\/[^"'\s<>()]{1,200}\.pdf)/gi;
  for (const m of htmlNorm.matchAll(loose)) {
    add(m[1]!);
  }
  return out;
}

function scoreSlidePdfName(file: string): number {
  const n = file.toLowerCase();
  if (!/\.pdf$/i.test(n)) return -1;
  if (/ex-?99|exhibit.?99|ex99|slide|present|decks|deck|earnings?release|investor|result|q\d+fy|fy\d+q/i.test(n)) return 500;
  if (/ex-?9[0-1]|exhibit|graphic|g\d+.*\.pdf/i.test(n)) return 200;
  if (/8k|8-?k|press|releas/i.test(n)) return 100;
  return 40;
}

function scoreFilingPdfName(file: string): number {
  const n = file.toLowerCase();
  if (!/\.pdf$/i.test(n)) return -1;
  if (/10-?q|10-?k|annual|quarter|financial|complete|q\d+fy|fy\d+|report|8-?k|8k|filing|ex99|earnings|releas|10q|10k/i.test(
    n,
  ))
    return 500;
  if (/ex-?9|exhibit|graphic|table/i.test(n)) return 200;
  return 30;
}

/**
 * Pick up to two distinct `https://www.sec.gov/Archives/.../*.pdf` URLs.
 * The browser will open them with native PDF preview. When a filing is HTML-only, both stay null.
 */
export function pickEarningsSlideAndFilingPdfs(pdfs: ParsedFilingDoc[]): { slides: string | null; filings: string | null } {
  if (pdfs.length === 0) return { slides: null, filings: null };
  const slideRanked = [...pdfs]
    .map((d) => ({ d, s: scoreSlidePdfName(d.file) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  const filingRanked = [...pdfs]
    .map((d) => ({ d, s: scoreFilingPdfName(d.file) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);

  const slides = slideRanked[0]!.d.url;
  const primaryFiling = filingRanked[0]!.d.url;
  if (primaryFiling !== slides) {
    return { slides, filings: primaryFiling };
  }
  const other = pdfs.find((d) => d.url !== slides);
  return { slides, filings: other ? other.url : slides };
}

function filingIndexHtmUrl(cikNumeric: string, accessionDashed: string): string {
  const flat = accessionToFlat(accessionDashed);
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNumeric}/${flat}/${accessionDashed}-index.htm`;
}

const MAX_INDEX_FETCHES = 24;
const INDEX_FETCH_DELAY_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Resolves `secSlidesUrl` / `secFilingsUrl` to **direct `*.pdf` URLs on sec.gov** when the Form 8-K
 * index lists PDF exhibits (browser native preview). If a filing is HTML-only, both stay null
 * and the client falls back to generic SEC browse links.
 */
export async function enrichEarningsHistoryWithSecDocuments(
  rows: StockEarningsHistoryRow[],
  cikRaw: string | null,
  options?: { maxRows?: number; maxIndexFetches?: number },
): Promise<StockEarningsHistoryRow[]> {
  const cik10 = normalizeSecCik(cikRaw);
  if (!cik10) return rows;

  const body = await secFetchText(submissionsJsonUrl(cik10));
  if (!body) return rows;
  let root: unknown;
  try {
    root = JSON.parse(body) as unknown;
  } catch {
    return rows;
  }

  const recent = parseSubmissionsRecent(root);
  if (!recent) return rows;

  const cikNum = cikToNumericPathSegment(cik10);

  type RowMatch = { idx: number; accession: string; primaryDocument: string };
  const matches: RowMatch[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.reported || !row.reportDateYmd) continue;
    if (
      isDirectEarningsPdfUrl(row.secSlidesUrl) &&
      isEarningsFilingsPreviewUrl(row.secFilingsUrl)
    ) {
      continue;
    }
    const hit = findBestIssuer8kNearReportDate(recent, cik10, row.reportDateYmd);
    if (!hit) continue;
    matches.push({ idx: i, accession: hit.accessionNumber, primaryDocument: hit.primaryDocument });
  }

  let activeMatches = matches;
  if (options?.maxRows != null && options.maxRows > 0) {
    const keep = new Set(
      [...matches]
        .sort((a, b) =>
          (rows[b.idx]!.reportDateYmd ?? "").localeCompare(rows[a.idx]!.reportDateYmd ?? ""),
        )
        .slice(0, options.maxRows)
        .map((m) => m.idx),
    );
    activeMatches = matches.filter((m) => keep.has(m.idx));
  }

  const uniqueAccessions = [...new Set(activeMatches.map((m) => m.accession))];
  const maxFetches = options?.maxIndexFetches ?? MAX_INDEX_FETCHES;
  const toFetch = uniqueAccessions.slice(0, maxFetches);
  const cache = new Map<string, { html: string | null }>();

  for (const acc of toFetch) {
    const url = filingIndexHtmUrl(cikNum, acc);
    const html = await secFetchText(url);
    cache.set(acc, { html });
    await sleep(INDEX_FETCH_DELAY_MS);
  }

  const next = rows.map((r) => ({ ...r }));
  const revenueExhibits: { idx: number; url: string }[] = [];

  for (const m of activeMatches) {
    const row = next[m.idx]!;
    const cached = cache.get(m.accession);
    const html = cached?.html;
    if (!html) continue;

    const flat = accessionToFlat(m.accession);
    const pdfs = parseFilingIndexPdfLinks(html, cikNum, flat);
    if (m.primaryDocument && /\.pdf$/i.test(m.primaryDocument)) {
      const u = `${SEC_ORIGIN}/Archives/edgar/data/${cikNum}/${flat}/${m.primaryDocument}`;
      if (!pdfs.some((p) => p.url === u)) {
        pdfs.unshift({ url: u, file: m.primaryDocument });
      }
    }
    const { slides, filings } = pickEarningsSlideAndFilingPdfs(pdfs);
    if (slides) row.secSlidesUrl = slides;
    if (filings) {
      row.secFilingsUrl = filings;
    } else {
      const exhibitHtml = pickExhibit99PressReleaseHtmlUrl(html, cikNum, flat);
      if (exhibitHtml) row.secFilingsUrl = exhibitHtml;
    }

    if (row.reported && row.revenueActualUsd == null) {
      const exhibitUrl =
        isSecEdgarExhibitHtmlUrl(row.secFilingsUrl)
          ? row.secFilingsUrl
          : pickExhibit99PressReleaseHtmlUrl(html, cikNum, flat);
      if (exhibitUrl) revenueExhibits.push({ idx: m.idx, url: exhibitUrl });
    }
  }

  for (const { idx, url } of revenueExhibits) {
    const exHtml = await secFetchText(url);
    await sleep(INDEX_FETCH_DELAY_MS);
    const rev = exHtml ? extractTotalRevenueUsdFromPressReleaseHtml(exHtml) : null;
    if (rev != null) next[idx] = applyRevenueUsdToHistoryRow(next[idx]!, rev);
  }

  return next;
}

/**
 * When EODHD ships `epsActual` before quarterly income statements / revenue fields, parse
 * Exhibit 99.1 press releases from the nearest Form 8-K. Used in preview mode (no PDF crawl).
 */
export async function enrichReportedHistoryRevenueFromSec8k(
  rows: StockEarningsHistoryRow[],
  cikRaw: string | null,
  options?: { maxRows?: number },
): Promise<StockEarningsHistoryRow[]> {
  const cik10 = normalizeSecCik(cikRaw);
  if (!cik10) return rows;

  const body = await secFetchText(submissionsJsonUrl(cik10));
  if (!body) return rows;
  let root: unknown;
  try {
    root = JSON.parse(body) as unknown;
  } catch {
    return rows;
  }

  const recent = parseSubmissionsRecent(root);
  if (!recent) return rows;

  const cikNum = cikToNumericPathSegment(cik10);
  const maxRows = options?.maxRows ?? 2;
  const next = rows.map((r) => ({ ...r }));
  let enriched = 0;

  for (let i = 0; i < next.length; i++) {
    if (enriched >= maxRows) break;
    const row = next[i]!;
    if (!row.reported || row.revenueActualUsd != null || !row.reportDateYmd) continue;

    const hit = findBestIssuer8kNearReportDate(recent, cik10, row.reportDateYmd);
    if (!hit) continue;

    const flat = accessionToFlat(hit.accessionNumber);
    const indexHtml = await secFetchText(filingIndexHtmUrl(cikNum, hit.accessionNumber));
    await sleep(INDEX_FETCH_DELAY_MS);
    if (!indexHtml) continue;

    const exhibitUrl = pickExhibit99PressReleaseHtmlUrl(indexHtml, cikNum, flat);
    if (!exhibitUrl) continue;

    const exHtml = await secFetchText(exhibitUrl);
    await sleep(INDEX_FETCH_DELAY_MS);
    const rev = exHtml ? extractTotalRevenueUsdFromPressReleaseHtml(exHtml) : null;
    if (rev == null) continue;

    next[i] = applyRevenueUsdToHistoryRow(row, rev);
    enriched += 1;
  }

  return next;
}
