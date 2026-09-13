/**
 * McDonald's (MCD) IR — calendar FY.
 * Issuer publishes earnings RELEASE PDFs on corporate.mcdonalds.com DAM; no dedicated
 * quarterly earnings slide decks → Slides stay null. Filings = Exhibit 99.1 / Earnings Release PDF.
 * Never SEC HTML / 10-Q / investor-day decks as Slides.
 */

export type McdQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const MCD_DAM = "https://corporate.mcdonalds.com/content/dam/sites/corp/nfl/pdf";

/** Prefer literal path segments already percent-encoded on the IR site. */
function dam(pathFile: string): string {
  return `${MCD_DAM}/${pathFile}`;
}

export const MCD_IR_PAGES = [
  "https://corporate.mcdonalds.com/corpmcd/investors/financial-information.html",
  "https://corporate.mcdonalds.com/corpmcd/our-stories/article/Q2-2026-results.html",
] as const;

/**
 * Catalog from corporate.mcdonalds.com Financial Information → Earnings Releases
 * (cross-checked against Qn-YYYY-results article PDF hrefs when present).
 * Slides always null — issuer does not publish quarterly earnings decks.
 */
export const MCD_KNOWN_QUARTER_DOCS: Readonly<Record<string, McdQuarterDocs>> = {
  "Q2 2026": {
    slides: null,
    filings: dam("MCD%20Q226%20Earnings%20Release%20-%20Exhibit%2099.1.pdf"),
  },
  "Q1 2026": {
    slides: null,
    filings: dam("Q1%202026%20Exhibit%2099.1%20-%203.31.26.pdf"),
  },
  "Q4 2025": {
    slides: null,
    filings: dam("MCD%20Q4-25%20-%20Exhibit%2099.1%20-%20vF.pdf"),
  },
  "Q3 2025": {
    slides: null,
    filings: dam("2025%20Q3%20Earnings%20Release.pdf"),
  },
  "Q2 2025": {
    slides: null,
    filings: dam("2025%20Q2%20Earnings%20Release.pdf"),
  },
  "Q1 2025": {
    slides: null,
    filings: dam("Q1_25_Earnings_Release.pdf"),
  },
  "Q4 2024": {
    slides: null,
    filings: dam("MCD-Q4-24-Earnings-Release.pdf"),
  },
  "Q3 2024": {
    slides: null,
    filings: dam("Q3_24_Earnings_Release.pdf"),
  },
  "Q2 2024": {
    slides: null,
    filings: dam("MCD%20-%20Q2-24%20Earnings%20Release.pdf"),
  },
  "Q1 2024": {
    slides: null,
    filings: dam("Exhibit%2099.1%20-%20Q1-24.pdf"),
  },
  "Q4 2023": {
    slides: null,
    filings: dam("Exhibit%2099.1%20-%20Q4-23.pdf"),
  },
  "Q3 2023": {
    slides: null,
    filings: dam("Exhibit%2099.1%20-%209.30.2023.pdf"),
  },
  "Q2 2023": {
    slides: null,
    filings: dam("Exhibit%2099.1%20-%206.30.2023.pdf"),
  },
  "Q1 2023": {
    slides: null,
    filings: dam("Q1%202023%20Earnings%20Release%2099.1.pdf"),
  },
  "Q4 2022": {
    slides: null,
    filings: dam("Q4%202022%20Earnings%20Release%2099.1.pdf"),
  },
  "Q3 2022": {
    slides: null,
    filings: dam("Exhibit%2099.1%20-%209.30.22.pdf"),
  },
  "Q2 2022": {
    slides: null,
    filings: dam("Q2%202022%20Earnings%20Release.pdf"),
  },
  "Q1 2022": {
    slides: null,
    filings: dam("Q1%202022%20Earnings%20Release%2099.1.pdf"),
  },
};

export function isMcdRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return (
    /sec\.gov|10-?q|10-?k|8-?k|investor[-_\s]*presentation|annual[-_\s]*report|proxy|dividend|systemwide|\.xls/i.test(
      n,
    )
  );
}

export function isMcdIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (!(h === "corporate.mcdonalds.com" || h === "mcdonalds.com" || h.endsWith(".mcdonalds.com"))) {
      return false;
    }
    if (!u.pathname.includes("/content/dam/sites/corp/nfl/pdf/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    const path = decodeURIComponent(u.pathname).toLowerCase();
    if (/dividend|systemwide|annual|proxy|10q|10-k/i.test(path)) return false;
    return (
      (/earnings[-_\s]?release|exhibit\s*99\.1|99\.1/i.test(path) || /mcd.*q\d/i.test(path)) &&
      !isMcdRejected(url)
    );
  } catch {
    return false;
  }
}

export function mergeMcdKnownQuarterDocs(): Map<string, McdQuarterDocs> {
  return new Map(Object.entries(MCD_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
