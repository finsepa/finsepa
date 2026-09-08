import "server-only";

import { parseNvidiaFiscalQuarterFromLabel } from "@/lib/market/ir-seed-apply-nvidia-q4";
import {
  alphabetFilingCandidates,
  alphabetKnownFilingUrl,
  alphabetSlidesCandidates,
} from "@/lib/market/ir-seed-google-alphabet-match";
import { isEarningsFilingsPreviewUrl } from "@/lib/market/earnings-document-url";
import type { StockEarningsDocumentHub, StockEarningsHistoryRow } from "@/lib/market/stock-earnings-types";

const HEAD_MS = 2500;
const FETCH_MS = 12_000;

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

/**
 * GOOGL / GOOG only: discover Alphabet’s investor site from the profile website + IR URL, then
 * attach **Slides** (`…-earnings-slides.pdf` on q4cdn when published, else earnings-release PDF)
 * and **Filings** (Form 10-Q / 10-K PDFs on the same CDN) per `fiscalPeriodLabel`.
 *
 * Never assign the same earnings-release PDF to both slots. PDF locations are probed with HEAD;
 * GET-verified known 10-Q filenames overlay when HEAD 404s.
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
    const p = parseNvidiaFiscalQuarterFromLabel(row.fiscalPeriodLabel);
    const { slides, filings } = byRow[i]!;
    const slideHit = slides.find((u) => ok.get(u));
    const filingHit = filings.find((u) => ok.get(u) && u !== slideHit);
    const knownFiling = p ? alphabetKnownFilingUrl(p.fy, p.fq) : undefined;

    const nextSlides = slideHit ?? row.secSlidesUrl;
    const nextFilings =
      filingHit ??
      (isEarningsFilingsPreviewUrl(row.secFilingsUrl) ? row.secFilingsUrl : null) ??
      (knownFiling && knownFiling !== nextSlides ? knownFiling : null) ??
      row.secFilingsUrl;

    if (nextSlides === row.secSlidesUrl && nextFilings === row.secFilingsUrl) return row;
    return { ...row, secSlidesUrl: nextSlides, secFilingsUrl: nextFilings };
  });
}
