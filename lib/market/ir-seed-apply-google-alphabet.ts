import "server-only";

import { parseNvidiaFiscalQuarterFromLabel } from "@/lib/market/ir-seed-apply-nvidia-q4";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const FETCH_MS = 12_000;

/** Alphabet IR PDFs on Q4 CDN (same host pattern as `abc.xyz/investor`). */
const ALPHABET_Q4_FINANCIALS = "https://s206.q4cdn.com/479360582/files/doc_financials";

const HREF_RE = /href\s*=\s*["']([^"']+)["']/gi;

function normalizeInvestorRoot(href: string): string {
  try {
    const u = new URL(href);
    const h = u.hostname.toLowerCase();
    if (h.endsWith("abc.xyz") || h.includes("withgoogle.com")) {
      return "https://abc.xyz/investor/";
    }
  } catch {
    /* ignore */
  }
  return "https://abc.xyz/investor/";
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
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

/**
 * Follow the company / IR URLs from fundamentals, scan HTML for an Alphabet investor link
 * (`abc.xyz/investor` or `investor.withgoogle.com`), and return a normalized IR root.
 * Best-effort only; defaults to `https://abc.xyz/investor/` when nothing matches.
 */
export async function resolveAlphabetInvestorLandingFromHub(hub: StockEarningsDocumentHub): Promise<string> {
  const seeds = [...new Set([hub.irWebsite, hub.companyWebsite, "https://abc.xyz/", "https://abc.xyz/investor/"].filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)))];

  for (const seed of seeds) {
    const html = await fetchHtml(seed);
    if (!html) continue;
    let m: RegExpExecArray | null;
    HREF_RE.lastIndex = 0;
    const base = new URL(seed);
    while ((m = HREF_RE.exec(html)) !== null) {
      const raw = m[1].replace(/&amp;/g, "&").trim();
      if (!raw || raw.startsWith("javascript:") || raw === "#") continue;
      let abs: URL;
      try {
        abs = new URL(raw, base);
      } catch {
        continue;
      }
      const host = abs.hostname.toLowerCase();
      const path = abs.pathname.toLowerCase();
      if ((host === "abc.xyz" || host.endsWith(".abc.xyz")) && path.includes("investor")) {
        return normalizeInvestorRoot(abs.href);
      }
      if (host.includes("withgoogle.com") && path.includes("investor")) {
        return normalizeInvestorRoot(abs.href);
      }
    }
  }

  return "https://abc.xyz/investor/";
}

async function headPdfOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { Accept: "application/pdf,*/*" },
      signal: AbortSignal.timeout(HEAD_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function alphabetSlidesCandidates(fiscalYear: number, fiscalQuarter: number): string[] {
  const fy = fiscalYear;
  const fq = fiscalQuarter;
  return [
    `${ALPHABET_Q4_FINANCIALS}/${fy}/q${fq}/${fy}q${fq}-alphabet-earnings-slides.pdf`,
    `${ALPHABET_Q4_FINANCIALS}/${fy}/q${fq}/${fy}Q${fq}-alphabet-earnings-slides.pdf`,
  ];
}

function alphabetFilingCandidates(fiscalYear: number, fiscalQuarter: number): string[] {
  const fy = fiscalYear;
  const fq = fiscalQuarter;
  if (fq === 4) {
    return [
      `${ALPHABET_Q4_FINANCIALS}/${fy}/q4/goog-10-k-${fy}.pdf`,
      `${ALPHABET_Q4_FINANCIALS}/${fy}/q4/GOOG-10-K-${fy}.pdf`,
    ];
  }
  return [
    `${ALPHABET_Q4_FINANCIALS}/${fy}/q${fq}/goog-10-q-q${fq}-${fy}.pdf`,
    `${ALPHABET_Q4_FINANCIALS}/${fy}/q${fq}/GOOG-10-Q-Q${fq}-${fy}.pdf`,
  ];
}

/**
 * GOOGL / GOOG only: discover Alphabet’s investor site from the profile website + IR URL, then
 * attach **Slides** (`…-earnings-slides.pdf` on q4cdn when published) and **Filings** (Form 10-Q / 10-K PDFs
 * on the same CDN) per `fiscalPeriodLabel` (`Qn YYYY`, calendar quarters for Alphabet).
 *
 * PDF locations are probed with HEAD (parallel). When a URL exists it overrides SEC 8-K PDFs for that row.
 */
export async function applyIrSeedGoogleAlphabetDocumentUrls(
  rows: StockEarningsHistoryRow[],
  hub: StockEarningsDocumentHub,
): Promise<StockEarningsHistoryRow[]> {
  await resolveAlphabetInvestorLandingFromHub(hub);

  const byRow = rows.map((row) => {
    const p = parseNvidiaFiscalQuarterFromLabel(row.fiscalPeriodLabel);
    if (!p) return { slides: [] as string[], filings: [] as string[] };
    return { slides: alphabetSlidesCandidates(p.fy, p.fq), filings: alphabetFilingCandidates(p.fy, p.fq) };
  });

  const unique = [...new Set(byRow.flatMap((x) => [...x.slides, ...x.filings]))];
  const ok = new Map<string, boolean>();
  await Promise.all(unique.map(async (url) => ok.set(url, await headPdfOk(url))));

  return rows.map((row, i) => {
    const { slides, filings } = byRow[i]!;
    const slideHit = slides.find((u) => ok.get(u));
    const filingHit = filings.find((u) => ok.get(u));

    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings = filingHit ?? row.secFilingsUrl;

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
