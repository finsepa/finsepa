import "server-only";

import { parseNvidiaFiscalQuarterFromLabel } from "@/lib/market/ir-seed-apply-nvidia-q4";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const FETCH_MS = 12_000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

type Q4CdnBase = {
  /** `https://sXX.q4cdn.com/NNNNNNNNN/files` */
  filesBase: string;
  /** `https://sXX.q4cdn.com/NNNNNNNNN/files/doc_financials` */
  financialsBase: string;
};

function extractQ4CdnBaseFromHtml(html: string): Q4CdnBase | null {
  // Prefer explicit `/files/` hits.
  const re = /https?:\/\/s\d+\.q4cdn\.com\/\d+\/files\b/gi;
  const m = html.match(re);
  const hit = m?.[0] ?? null;
  if (!hit) return null;
  const filesBase = hit.replace(/\/+$/, "");
  return { filesBase, financialsBase: `${filesBase}/doc_financials` };
}

function extractAbsolutePdfLinks(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return out;
  }

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const raw = (m[1] ?? "").replace(/&amp;/g, "&").trim();
    if (!raw || raw.startsWith("javascript:") || raw === "#") continue;
    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      continue;
    }
    if (!/\.pdf(\?|#|$)/i.test(abs.pathname + abs.search + abs.hash)) continue;
    out.push(abs.href.split("#")[0]!);
  }
  return [...new Set(out)];
}

function scoreSlidePdfName(file: string): number {
  const n = file.toLowerCase();
  if (!n.endsWith(".pdf")) return -1;
  if (/present|presentation|slides|deck|webslides/.test(n)) return 800;
  if (/supplement|operational|data/.test(n)) return 300;
  return 40;
}

function scoreFilingPdfName(file: string): number {
  const n = file.toLowerCase();
  if (!n.endsWith(".pdf")) return -1;
  if (/earnings[-_ ]?release|results|exhibit[-_ ]?99|ex[-_ ]?99|press[-_ ]?release|financial[-_ ]?results/.test(n))
    return 800;
  if (/10-?q|10-?k|form[-_ ]?10/.test(n)) return 600;
  return 30;
}

function pickBestPdfFromList(urls: string[], score: (file: string) => number): string | null {
  const ranked = urls
    .map((u) => ({ u, s: score(decodeURIComponent(u.split("/").pop()?.split("?")[0] ?? "")) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.u ?? null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("text/html") && !ct.toLowerCase().includes("application/xhtml")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function headResolvePdfUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*", "User-Agent": UA },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    // Some issuers return HTML error pages with 200; avoid those.
    if (ct.includes("text/html")) return null;
    const final = res.url || url;
    if (!/\.pdf(\?|$)/i.test(final)) return null;
    return final;
  } catch {
    return null;
  }
}

function domainFromCompanyWebsite(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = host.split(".").filter(Boolean);
    if (parts.length < 2) return null;
    // naive eTLD+1 fallback (good enough for most US issuer domains)
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

function buildIrSeedUrls(hub: StockEarningsDocumentHub): string[] {
  const out: string[] = [];
  if (hub.irWebsite && /^https?:\/\//i.test(hub.irWebsite)) out.push(hub.irWebsite);
  if (hub.companyWebsite && /^https?:\/\//i.test(hub.companyWebsite)) out.push(hub.companyWebsite);

  const root = domainFromCompanyWebsite(hub.companyWebsite);
  if (root) {
    out.push(`https://investor.${root}/`);
    out.push(`https://ir.${root}/`);
    out.push(`https://investors.${root}/`);
    out.push(`https://${root}/investor-relations/`);
    out.push(`https://${root}/investors/`);
  }
  return [...new Set(out)];
}

function buildCommonQuarterlyEarningsPages(seed: string): string[] {
  let u: URL | null = null;
  try {
    u = new URL(seed);
  } catch {
    return [];
  }
  const origin = u.origin;
  return [
    seed,
    `${origin}/financial-information/quarterly-earnings/`,
    `${origin}/financials/`,
    `${origin}/quarterly-results/`,
    `${origin}/events-and-presentations/`,
  ];
}

function genericSlidesCandidates(base: Q4CdnBase, fy: number, fq: number): string[] {
  const qDir = `${base.financialsBase}/${fy}/q${fq}`;
  return [
    `${qDir}/Earnings-Presentation-Q${fq}-${fy}.pdf`,
    `${qDir}/Earnings-Presentation-Q${fq}-${fy}-FINAL.pdf`,
    `${qDir}/Earnings-Presentation-Q${fq}-${fy}-Final.pdf`,
    `${qDir}/Webslides_Q${fq}${String(fy % 100).padStart(2, "0")}.pdf`,
    `${qDir}/Webslides_Q${fq}${String(fy % 100).padStart(2, "0")}-FINAL.pdf`,
    `${qDir}/Webslides_Q${fq}${String(fy % 100).padStart(2, "0")}_Final.pdf`,
  ];
}

function genericFilingsCandidates(base: Q4CdnBase, sym: string, fy: number, fq: number): string[] {
  const qDir = `${base.financialsBase}/${fy}/q${fq}`;
  const s = sym.trim().toUpperCase();
  return [
    `${qDir}/${s}-Q${fq}-${fy}-Earnings-Release.pdf`,
    `${qDir}/${s}-Q${fq}-${fy}-Earnings-Release-FINAL.pdf`,
    `${qDir}/${s}-Q${fq}-${fy}-Earnings-Release-Final.pdf`,
    `${qDir}/${s}-Q${fq}-${fy}-Earnings-Release_FINAL.pdf`,
    `${qDir}/${s}-Q${fq}-${fy}-Earnings-Release_Final.pdf`,
    // Exhibit 99.1 / press release style
    `${qDir}/${s}-Exhibit-99-1.pdf`,
  ];
}

/**
 * Best-effort for any Q4 Inc. investor site:
 * - Discover `sXX.q4cdn.com/NNNNNNNNN/files` from IR HTML.
 * - Probe common slide/release filename patterns for the fiscal quarter label (e.g. `Q3 2025`).
 */
export async function applyIrSeedGenericQ4DocumentUrls(
  listingTicker: string,
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  const seeds = buildIrSeedUrls(hub).filter((u) => /^https?:\/\//i.test(u));
  if (seeds.length === 0) return rows;

  let base: Q4CdnBase | null = null;
  const pdfLinksBySeed = new Map<string, string[]>();
  for (const seed of seeds) {
    // Try the seed plus a few common “quarterly earnings” landing pages.
    for (const page of buildCommonQuarterlyEarningsPages(seed)) {
      const html = await fetchHtml(page);
      if (!html) continue;
      const pdfs = extractAbsolutePdfLinks(html, page);
      if (pdfs.length > 0) {
        const prev = pdfLinksBySeed.get(seed) ?? [];
        pdfLinksBySeed.set(seed, [...new Set([...prev, ...pdfs])]);
      }
      if (!base) {
        base = extractQ4CdnBaseFromHtml(html);
      }
      if (base) break;
    }
    if (base) break;
  }
  if (!base) return rows;

  const pdfLinks = [...new Set(Array.from(pdfLinksBySeed.values()).flat())];

  const byRow = rows.map((row) => {
    const p = parseNvidiaFiscalQuarterFromLabel(row.fiscalPeriodLabel);
    if (!p) return { slides: [] as string[], filings: [] as string[] };
    const slides = genericSlidesCandidates(base!, p.fy, p.fq);
    const filings = genericFilingsCandidates(base!, listingTicker, p.fy, p.fq);

    // If the IR page already exposed PDFs in the right `doc_financials/{fy}/q{fq}` folder, prefer them.
    const qDir = `${base!.financialsBase}/${p.fy}/q${p.fq}/`;
    const inQuarterDir = pdfLinks.filter((u) => u.startsWith(qDir));
    const slideFromIr = pickBestPdfFromList(inQuarterDir, scoreSlidePdfName);
    const filingFromIr = pickBestPdfFromList(inQuarterDir, scoreFilingPdfName);

    const slidesAll = slideFromIr ? [slideFromIr, ...slides] : slides;
    const filingsAll = filingFromIr ? [filingFromIr, ...filings] : filings;
    return { slides: slidesAll, filings: filingsAll };
  });

  const unique = [...new Set(byRow.flatMap((x) => [...x.slides, ...x.filings]))].slice(0, 180);
  const resolved = new Map<string, string | null>();
  await Promise.all(unique.map(async (u) => resolved.set(u, await headResolvePdfUrl(u))));

  return rows.map((row, i) => {
    const { slides, filings } = byRow[i]!;
    const slideHit = slides.map((u) => resolved.get(u) ?? null).find((u): u is string => !!u) ?? null;
    const filingHit = filings.map((u) => resolved.get(u) ?? null).find((u): u is string => !!u) ?? null;
    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings = filingHit ?? row.secFilingsUrl;
    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}

