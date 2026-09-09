import "server-only";

import { getSecEdgarUserAgent } from "@/lib/env/server";
import { normalizeSecCik } from "@/lib/market/earnings-report-external-links";
import {
  applyRevenueUsdToHistoryRow,
  extractTotalRevenueUsdFromPressReleaseHtml,
  pickExhibit99PressReleaseHtmlUrl,
  pickExhibit99PresentationHtmlUrl,
} from "@/lib/market/sec-earnings-press-release-revenue";
import {
  isEarningsFilingsPreviewUrl,
  isEarningsSlidesPreviewUrl,
  isSecEdgarExhibitHtmlUrl,
  isSecEdgarPresentationExhibitHtml,
} from "@/lib/market/earnings-document-url";
import { resolveSecEarningsCik } from "@/lib/market/sec-earnings-cik";
import {
  form10KindFromForm,
  matchEarningsForm10High,
  resolveEarningsAnnouncementYmd,
  resolveEarningsEightKMatch,
  type SecSubmissionsFiling,
} from "@/lib/market/sec-earnings-reports-match";
import type { StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const SEC_ORIGIN = "https://www.sec.gov";

export type SecFetchCounters = {
  http: number;
  submissionsFileChunks: number;
};

const secFetchCounters: SecFetchCounters = { http: 0, submissionsFileChunks: 0 };

export function resetSecFetchCounters(): void {
  secFetchCounters.http = 0;
  secFetchCounters.submissionsFileChunks = 0;
}

export function getSecFetchCounters(): SecFetchCounters {
  return { ...secFetchCounters };
}

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
  reportDate: string[];
  items: string[];
};

function parseSubmissionsColumnar(r: Record<string, unknown>): SubmissionsRecent | null {
  const form = r.form;
  const filingDate = r.filingDate;
  const accessionNumber = r.accessionNumber;
  const primaryDocument = r.primaryDocument;
  if (!Array.isArray(form) || !Array.isArray(filingDate) || !Array.isArray(accessionNumber) || !Array.isArray(primaryDocument)) {
    return null;
  }
  const n = form.length;
  const pad = (arr: unknown, fallback: string) =>
    Array.isArray(arr) ? arr.map((x) => String(x ?? fallback)) : form.map(() => fallback);
  return {
    form: form.map(String),
    filingDate: filingDate.map(String),
    accessionNumber: accessionNumber.map(String),
    primaryDocument: primaryDocument.map(String),
    reportDate: pad(r.reportDate, "").slice(0, n),
    items: pad(r.items, "").slice(0, n),
  };
}

export function parseSubmissionsRecent(root: unknown): SubmissionsRecent | null {
  if (!root || typeof root !== "object") return null;
  const filings = (root as Record<string, unknown>).filings;
  if (!filings || typeof filings !== "object") return null;
  const recent = (filings as Record<string, unknown>).recent;
  if (!recent || typeof recent !== "object") return null;
  return parseSubmissionsColumnar(recent as Record<string, unknown>);
}

function scoreEarningsFilingPrimaryDocument(file: string): number {
  const n = file.toLowerCase();
  if (/results\.htm|interimreport|earnings|fnvq\d|fnvfy\d/i.test(n)) return 120;
  if (/ex[-_.]?99|exhibit[-_.]?99/i.test(n)) return 100;
  if (/press|result/i.test(n)) return 60;
  if (/prcov|bb\d{6,}pr/i.test(n)) return -80;
  return 0;
}

/** Best issuer-filed 8-K / 6-K near the earnings report date (±45 filing days). */
export function findBestIssuer8kNearReportDate(
  recent: SubmissionsRecent,
  cik10: string,
  reportYmd: string,
): { accessionNumber: string; primaryDocument: string; filingDate: string } | null {
  const targetDay = ymdToUtcDayNumber(reportYmd);
  if (!Number.isFinite(targetDay)) return null;

  let best: {
    accessionNumber: string;
    primaryDocument: string;
    filingDate: string;
    rank: number;
  } | null = null;

  for (let i = 0; i < recent.form.length; i++) {
    const form = recent.form[i]!.toUpperCase();
    if (form !== "8-K" && form !== "8-K/A" && form !== "6-K" && form !== "6-K/A") continue;
    const acc = recent.accessionNumber[i]!;
    if (!acc) continue;
    const fd = recent.filingDate[i]!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fd)) continue;
    const d = ymdToUtcDayNumber(fd);
    if (!Number.isFinite(d)) continue;
    const delta = Math.abs(d - targetDay);
    if (delta > 45) continue;
    const primaryDocument = recent.primaryDocument[i] ?? "";
    const rank = scoreEarningsFilingPrimaryDocument(primaryDocument) * 20 - delta;
    if (!best || rank > best.rank) {
      best = { accessionNumber: acc, primaryDocument, filingDate: fd, rank };
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
  secFetchCounters.http += 1;
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
  // Prefer true decks / Exhibit 99.2 — never treat 99.1 press releases as slides.
  if (/slide|slides|present|presentation|deck|webslides/i.test(n)) return 800;
  if (/ex-?99\.?2|exhibit[-_.]?99[-_.]?2|ex992/i.test(n)) return 700;
  if (
    /ex-?99\.?1|exhibit[-_.]?99[-_.]?1|ex991|earnings?[-_]?release|press[-_]?releas/i.test(n) &&
    !/slide|present|deck/i.test(n)
  ) {
    return -1;
  }
  if (/investor|result|q\d+fy|fy\d+q/i.test(n)) return 200;
  if (/ex-?9[0-1]|exhibit|graphic|g\d+.*\.pdf/i.test(n)) return 100;
  return 40;
}

function scoreFilingPdfName(file: string): number {
  const n = file.toLowerCase();
  if (!/\.pdf$/i.test(n)) return -1;
  // Prefer releases / 99.1; demote pure presentation decks so they stay slides-only.
  if (/slide|slides|present|presentation|deck|webslides/i.test(n) && !/release|ex-?99\.?1|exhibit[-_.]?99[-_.]?1/i.test(n)) {
    return 80;
  }
  if (/earnings?[-_]?release|press[-_]?releas|ex-?99\.?1|exhibit[-_.]?99[-_.]?1|ex991|financial[-_]?results/i.test(n)) {
    return 800;
  }
  if (/10-?q|10-?k|annual|quarter|financial|complete|report|8-?k|8k|filing|ex99|10q|10k/i.test(n)) {
    return 500;
  }
  if (/ex-?9|exhibit|graphic|table/i.test(n)) return 200;
  return 30;
}

/**
 * Pick up to two distinct `https://www.sec.gov/Archives/.../*.pdf` URLs.
 * Slides require a presentation-like name (score ≥ 500); press-release-only 8-Ks leave slides null.
 */
export function pickEarningsSlideAndFilingPdfs(pdfs: ParsedFilingDoc[]): { slides: string | null; filings: string | null } {
  if (pdfs.length === 0) return { slides: null, filings: null };
  const slideRanked = [...pdfs]
    .map((d) => ({ d, s: scoreSlidePdfName(d.file) }))
    .filter((x) => x.s >= 500)
    .sort((a, b) => b.s - a.s);
  const filingRanked = [...pdfs]
    .map((d) => ({ d, s: scoreFilingPdfName(d.file) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);

  const slides = slideRanked[0]?.d.url ?? null;
  const primaryFiling = filingRanked[0]?.d.url ?? null;
  if (!slides && !primaryFiling) return { slides: null, filings: null };
  if (slides && primaryFiling && primaryFiling !== slides) {
    return { slides, filings: primaryFiling };
  }
  if (slides && !primaryFiling) {
    const other = pdfs.find((d) => d.url !== slides);
    return { slides, filings: other ? other.url : null };
  }
  return { slides: null, filings: primaryFiling };
}

function filingIndexHtmUrl(cikNumeric: string, accessionDashed: string): string {
  const flat = accessionToFlat(accessionDashed);
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNumeric}/${flat}/${accessionDashed}-index.htm`;
}

/** Issuer-filed Form 8-K body HTML (e.g. Coinbase `coin-20260507.htm`) when no Exhibit 99.1 press release exists. */
function issuerPrimary8kBodyHtmlUrl(
  primaryDocument: string,
  cikNumeric: string,
  accessionFlat: string,
): string | null {
  const file = primaryDocument.trim();
  if (!file || !/\.htm$/i.test(file) || /index\.htm$/i.test(file)) return null;
  if (/^R\d+\.htm$/i.test(file)) return null;
  return `${filingDirectoryBase(cikNumeric, accessionFlat)}${file}`;
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
      isEarningsSlidesPreviewUrl(row.secSlidesUrl) &&
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
    if (!isEarningsSlidesPreviewUrl(row.secSlidesUrl)) {
      if (slides) row.secSlidesUrl = slides;
      else {
        const slidesHtml = pickExhibit99PresentationHtmlUrl(html, cikNum, flat);
        if (slidesHtml) row.secSlidesUrl = slidesHtml;
      }
    }
    if (
      !isEarningsFilingsPreviewUrl(row.secFilingsUrl) ||
      isSecEdgarPresentationExhibitHtml(row.secFilingsUrl)
    ) {
      if (filings && filings !== row.secSlidesUrl) {
        row.secFilingsUrl = filings;
      } else {
        const exhibitHtml = pickExhibit99PressReleaseHtmlUrl(html, cikNum, flat);
        if (exhibitHtml && exhibitHtml !== row.secSlidesUrl) row.secFilingsUrl = exhibitHtml;
        else {
          const primary8k = issuerPrimary8kBodyHtmlUrl(m.primaryDocument, cikNum, flat);
          if (primary8k && primary8k !== row.secSlidesUrl) row.secFilingsUrl = primary8k;
        }
      }
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

  // Avoid a submissions.json round-trip when EODHD already has revenue for reported rows.
  const needsRevenue = rows.some(
    (r) => r.reported && r.revenueActualUsd == null && Boolean(r.reportDateYmd),
  );
  if (!needsRevenue) return rows;

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

const FILES_CHUNK_DELAY_MS = 80;

type SubmissionsFileChunk = {
  name?: string;
  filingFrom?: string;
  filingTo?: string;
};

function columnarToFilings(col: SubmissionsRecent): SecSubmissionsFiling[] {
  const out: SecSubmissionsFiling[] = [];
  for (let i = 0; i < col.form.length; i++) {
    const acc = col.accessionNumber[i]?.trim();
    if (!acc) continue;
    out.push({
      form: String(col.form[i] ?? "").toUpperCase(),
      filingDate: String(col.filingDate[i] ?? ""),
      reportDate: String(col.reportDate[i] ?? ""),
      accessionNumber: acc,
      primaryDocument: String(col.primaryDocument[i] ?? ""),
      items: String(col.items[i] ?? ""),
    });
  }
  return out;
}

function chunkOverlapsRange(chunk: SubmissionsFileChunk, fromYmd: string, toYmd: string): boolean {
  const from = chunk.filingFrom;
  const to = chunk.filingTo;
  if (!from || !to) return true;
  return to >= fromYmd && from <= toYmd;
}

function parseSubmissionsFilesList(root: unknown): SubmissionsFileChunk[] {
  if (!root || typeof root !== "object") return [];
  const filings = (root as Record<string, unknown>).filings;
  if (!filings || typeof filings !== "object") return [];
  const files = (filings as Record<string, unknown>).files;
  if (!Array.isArray(files)) return [];
  const out: SubmissionsFileChunk[] = [];
  for (const raw of files) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    out.push({
      name: typeof o.name === "string" ? o.name : undefined,
      filingFrom: typeof o.filingFrom === "string" ? o.filingFrom : undefined,
      filingTo: typeof o.filingTo === "string" ? o.filingTo : undefined,
    });
  }
  return out;
}

function mergeFilingsByAccession(into: Map<string, SecSubmissionsFiling>, extra: SecSubmissionsFiling[]): void {
  for (const f of extra) {
    if (!into.has(f.accessionNumber)) into.set(f.accessionNumber, f);
  }
}

/**
 * Load `filings.recent` plus `filings.files` chunks that overlap the needed date window.
 * Required for high-volume filers (e.g. JPM) whose recent array is a 424B2 flood.
 */
export async function loadSecSubmissionsFilings(
  cik10: string,
  fromYmd: string,
  toYmd: string,
): Promise<SecSubmissionsFiling[]> {
  const body = await secFetchText(submissionsJsonUrl(cik10));
  if (!body) return [];
  let root: unknown;
  try {
    root = JSON.parse(body) as unknown;
  } catch {
    return [];
  }

  const byAcc = new Map<string, SecSubmissionsFiling>();
  const recent = parseSubmissionsRecent(root);
  if (recent) mergeFilingsByAccession(byAcc, columnarToFilings(recent));

  const windowFrom = fromYmd || "2000-01-01";
  const windowTo = toYmd || "9999-12-31";
  for (const chunk of parseSubmissionsFilesList(root)) {
    const name = chunk.name?.trim();
    if (!name) continue;
    if (!chunkOverlapsRange(chunk, windowFrom, windowTo)) continue;
    secFetchCounters.submissionsFileChunks += 1;
    await sleep(FILES_CHUNK_DELAY_MS);
    const chunkBody = await secFetchText(`https://data.sec.gov/submissions/${name}`);
    if (!chunkBody) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(chunkBody) as unknown;
    } catch {
      continue;
    }
    const col =
      parseSubmissionsRecent(payload) ??
      (payload && typeof payload === "object"
        ? parseSubmissionsColumnar(payload as Record<string, unknown>)
        : null);
    if (col) mergeFilingsByAccession(byAcc, columnarToFilings(col));
  }

  return [...byAcc.values()];
}

export function secArchivesPrimaryDocumentUrl(
  cik10: string,
  accessionNumber: string,
  primaryDocument: string,
): string | null {
  const cikNum = cikToNumericPathSegment(cik10);
  const flat = accessionToFlat(accessionNumber);
  const file = primaryDocument.trim().replace(/^\//, "");
  if (!cikNum || !flat) return null;
  if (!file) return `${SEC_ORIGIN}/Archives/edgar/data/${cikNum}/${flat}/${accessionNumber}-index.htm`;
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNum}/${flat}/${file}`;
}

function reportedRowNeedsSecReports(row: StockEarningsHistoryRow): boolean {
  if (!row.reported) return false;
  return !row.eightKUrl || !row.form10Url;
}

/**
 * HIGH-only 8-K (Item 2.02) + 10-Q/10-K reportDate matching.
 * Does not use the ±45-day date-only 8-K picker. Does not write into IR vault fields.
 */
export async function enrichEarningsHistoryWithSecReports(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  fundamentalsCik: string | null,
  announcementByPeriodEnd: ReadonlyMap<string, string>,
  options?: { replaceExisting?: boolean },
): Promise<StockEarningsHistoryRow[]> {
  const cik10 = resolveSecEarningsCik(listingTicker, fundamentalsCik);
  if (!cik10) return rows;

  const replaceExisting = Boolean(options?.replaceExisting);
  const needIdx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.reported) continue;
    if (replaceExisting || reportedRowNeedsSecReports(row)) needIdx.push(i);
  }
  if (needIdx.length === 0) return rows;

  const ymds: string[] = [];
  for (const i of needIdx) {
    const row = rows[i]!;
    if (row.fiscalPeriodEndYmd) ymds.push(row.fiscalPeriodEndYmd);
    if (row.reportDateYmd) ymds.push(row.reportDateYmd);
  }
  ymds.sort();
  const fromYmd = ymds[0] ? addDaysUtcYmd(ymds[0], -40) ?? ymds[0] : "2020-01-01";
  const toYmd = ymds[ymds.length - 1] ? addDaysUtcYmd(ymds[ymds.length - 1]!, 14) ?? ymds[ymds.length - 1]! : "2099-12-31";

  const filings = await loadSecSubmissionsFilings(cik10, fromYmd, toYmd);
  if (filings.length === 0) return rows;

  const next = rows.map((r) => ({ ...r }));
  for (const i of needIdx) {
    const row = next[i]!;
    const announcement = resolveEarningsAnnouncementYmd({
      fiscalPeriodEndYmd: row.fiscalPeriodEndYmd,
      historyReportDateYmd: row.reportDateYmd,
      calendarByPeriodEnd: announcementByPeriodEnd,
    });

    const form10 = matchEarningsForm10High(filings, row.fiscalPeriodEndYmd);
    if (replaceExisting || !row.form10Url) {
      if (form10.grade === "HIGH") {
        const url = secArchivesPrimaryDocumentUrl(cik10, form10.pick.accessionNumber, form10.pick.primaryDocument);
        const kind = form10KindFromForm(form10.pick.form);
        if (url && kind) {
          row.form10Url = url;
          row.form10Kind = kind;
        } else if (replaceExisting) {
          row.form10Url = null;
          row.form10Kind = null;
        }
      } else if (replaceExisting) {
        row.form10Url = null;
        row.form10Kind = null;
      }
    }

    if (replaceExisting || !row.eightKUrl) {
      const eight = resolveEarningsEightKMatch(filings, {
        announcementYmd: announcement,
        fiscalPeriodEndYmd: row.fiscalPeriodEndYmd,
        form10FilingYmd: form10.grade === "HIGH" ? form10.pick.filingDate : null,
        calendarByPeriodEnd: announcementByPeriodEnd,
      });
      if (eight.grade === "HIGH") {
        const url = secArchivesPrimaryDocumentUrl(cik10, eight.pick.accessionNumber, eight.pick.primaryDocument);
        row.eightKUrl = url;
      } else if (replaceExisting) {
        row.eightKUrl = null;
      }
    }
  }

  return next;
}

function addDaysUtcYmd(ymd: string, deltaDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
