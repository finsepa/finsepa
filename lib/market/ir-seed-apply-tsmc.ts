import "server-only";

import { getSecEdgarUserAgent } from "@/lib/env/server";
import { normalizeSecCik } from "@/lib/market/earnings-report-external-links";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const FETCH_MS = 12_000;

const SEC_ORIGIN = "https://www.sec.gov";

function submissionsJsonUrl(cik10: string): string {
  return `https://data.sec.gov/submissions/CIK${cik10}.json`;
}

function accessionToFlat(accessionDashed: string): string {
  return accessionDashed.replace(/-/g, "");
}

function cikToNumericPathSegment(cik10: string): string {
  const n = parseInt(cik10.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? String(n) : cik10.replace(/^0+/, "") || "0";
}

function ymdToUtcDayNumber(ymd: string): number {
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  return Number.isFinite(t) ? Math.floor(t / 86400000) : NaN;
}

type SubmissionsRecent = {
  form: string[];
  filingDate: string[];
  accessionNumber: string[];
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
  if (!Array.isArray(form) || !Array.isArray(filingDate) || !Array.isArray(accessionNumber)) return null;
  return { form: form.map(String), filingDate: filingDate.map(String), accessionNumber: accessionNumber.map(String) };
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": getSecEdgarUserAgent(),
      },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function filingIndexHtmUrl(cikNumeric: string, accessionDashed: string): string {
  const flat = accessionToFlat(accessionDashed);
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNumeric}/${flat}/${accessionDashed}-index.htm`;
}

function scoreTsmSlideHref(href: string): number {
  const n = href.toLowerCase();
  if (!n.endsWith(".htm") && !n.endsWith(".html")) return -1;
  if (n.includes("-index.htm") || n.endsWith("index.htm") || n.endsWith("index.html")) return -1;
  if (n.includes("presentation")) return 1000;
  return 10;
}

function scoreTsmFilingHref(href: string): number {
  const n = href.toLowerCase();
  if (!n.endsWith(".htm") && !n.endsWith(".html")) return -1;
  if (n.includes("-index.htm") || n.endsWith("index.htm") || n.endsWith("index.html")) return -1;
  if (n.includes("withguidance")) return 900;
  if (n.includes("press") || n.includes("release") || n.includes("xfinal")) return 700;
  if (n.includes("6k")) return 600;
  return 20;
}

function parseSecIndexHrefs(html: string): string[] {
  const out: string[] = [];
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    out.push(raw);
  }
  return out;
}

function toAbsSecArchiveUrl(rawHref: string, cikNumeric: string, accessionFlat: string): string | null {
  const h = rawHref.trim();
  if (!h) return null;
  if (h.startsWith("http://") || h.startsWith("https://")) return h;
  if (h.startsWith("/Archives/")) return `${SEC_ORIGIN}${h}`;
  if (h.startsWith("/")) return `${SEC_ORIGIN}${h}`;
  if (h.includes("/") || h.startsWith("..")) return null;
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNumeric}/${accessionFlat}/${h}`;
}

function findBest6kAccessionNearReportDate(
  recent: SubmissionsRecent,
  reportYmd: string,
): { accessionNumber: string } | null {
  const targetDay = ymdToUtcDayNumber(reportYmd);
  if (!Number.isFinite(targetDay)) return null;

  let best: { accessionNumber: string; delta: number } | null = null;
  for (let i = 0; i < recent.form.length; i++) {
    const f = (recent.form[i] ?? "").trim().toUpperCase();
    if (f !== "6-K" && f !== "6-K/A") continue;
    const fd = recent.filingDate[i] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fd)) continue;
    const d = ymdToUtcDayNumber(fd);
    if (!Number.isFinite(d)) continue;
    const delta = Math.abs(d - targetDay);
    if (delta > 45) continue;
    const acc = recent.accessionNumber[i] ?? "";
    if (!acc) continue;
    if (!best || delta < best.delta) best = { accessionNumber: acc, delta };
  }
  return best ? { accessionNumber: best.accessionNumber } : null;
}

/**
 * TSM only:
 * - Slides: 6-K exhibit “presentation” HTML on sec.gov (no PDF companion).
 * - Filings: 6-K exhibit press release / “withguidance” HTML on sec.gov.
 *
 * These open via “Open in new tab” (in-app PDF preview is only for PDFs).
 */
export async function applyIrSeedTsmcDocumentUrls(
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const cik10 = normalizeSecCik(hub.cik) ?? "0001046179";
  const cikNum = cikToNumericPathSegment(cik10);

  const body = await fetchText(submissionsJsonUrl(cik10));
  if (!body) return rows;
  let root: unknown;
  try {
    root = JSON.parse(body) as unknown;
  } catch {
    return rows;
  }
  const recent = parseSubmissionsRecent(root);
  if (!recent) return rows;

  type RowPlan = { accession: string | null };
  const plans: RowPlan[] = rows.map((row) => {
    if (!row.reported || !row.reportDateYmd) return { accession: null };
    const hit = findBest6kAccessionNearReportDate(recent, row.reportDateYmd);
    return { accession: hit?.accessionNumber ?? null };
  });

  const uniqueAccessions = [...new Set(plans.map((p) => p.accession).filter((x): x is string => !!x))];
  const resolvedByAcc = new Map<string, { slides: string | null; filings: string | null }>();

  for (const acc of uniqueAccessions) {
    const flat = accessionToFlat(acc);
    const indexUrl = filingIndexHtmUrl(cikNum, acc);
    const html = await fetchText(indexUrl);
    if (!html) {
      resolvedByAcc.set(acc, { slides: null, filings: null });
      continue;
    }
    const hrefs = parseSecIndexHrefs(html);
    const abs = hrefs
      .map((h) => toAbsSecArchiveUrl(h, cikNum, flat))
      .filter((u): u is string => typeof u === "string" && u.includes("/Archives/edgar/data/"));

    const slides = [...abs].sort((a, b) => scoreTsmSlideHref(b) - scoreTsmSlideHref(a))[0] ?? null;
    const filings = [...abs].sort((a, b) => scoreTsmFilingHref(b) - scoreTsmFilingHref(a))[0] ?? null;
    resolvedByAcc.set(acc, { slides, filings });
  }

  return rows.map((row, i) => {
    const acc = plans[i]!.accession;
    if (!acc) return row;
    const resolved = resolvedByAcc.get(acc);
    const nextSlides = resolved?.slides ?? row.secSlidesUrl;
    const nextFilings = resolved?.filings ?? row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}

