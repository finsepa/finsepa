/**
 * Deere (DE) IR — issuer FY ends ~29 Oct (`DE_FY_END`).
 * Slides = Earnings Call Slides/Presentation on q4cdn; Filings = News Release on q4cdn
 * when present, else deere.com/assets news PDF. Never transcript / SEC HTML.
 */

export type DeQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Approximate fiscal year-end (Deere FY ends late October). */
export const DE_FY_END = "10-29";

const DE_CDN = "https://s22.q4cdn.com/253594569/files/doc_financials";
const DEERE_NEWS = "https://www.deere.com/assets/pdfs/common/news";

function q4(fy: number, fq: number, name: string): string {
  return `${DE_CDN}/${fy}/q${fq}/${name}`;
}

/** deere.com news path: deere-{q}q{yy}-earnings-release.pdf */
function deereNews(fq: number, fy: number): string {
  const yy = String(fy).slice(-2);
  return `${DEERE_NEWS}/deere-${fq}q${yy}-earnings-release.pdf`;
}

export const DE_IR_PAGES = [
  "https://investor.deere.com/",
  "https://investor.deere.com/financials/quarterly-results/default.aspx",
] as const;

/**
 * Catalog from q4cdn doc_financials + deere.com news fallbacks.
 * Keys are issuer fiscal labels. Q1 2025 / Q2 2024 slides and all 2022 filings null (not found / 404).
 */
export const DE_KNOWN_QUARTER_DOCS: Readonly<Record<string, DeQuarterDocs>> = {
  "Q3 2026": {
    slides: q4(2026, 3, "DE-3Q26-Earnings-Call-Slides.pdf"),
    filings: q4(2026, 3, "DE-3Q26-News-Release.pdf"),
  },
  "Q2 2026": {
    slides: q4(2026, 2, "DE-2Q26-Earnings-Call-Slides.pdf"),
    filings: q4(2026, 2, "DE-2Q26-News-Release.pdf"),
  },
  "Q1 2026": {
    slides: q4(2026, 1, "DE-1Q26-Earnings-Call-Slides.pdf"),
    filings: q4(2026, 1, "DE-1Q26-News-Release.pdf"),
  },
  "Q4 2025": {
    slides: q4(2025, 4, "DE-4Q25-Earnings-Call-Slides.pdf"),
    filings: q4(2025, 4, "DE-Q425-News-Release.pdf"),
  },
  "Q3 2025": {
    slides: q4(2025, 3, "DE-3Q25-Earnings-Call-Slides.pdf"),
    filings: q4(2025, 3, "DE-3Q25-News-Release.pdf"),
  },
  "Q2 2025": {
    slides: q4(2025, 2, "DE-2Q25-Earnings-Call-Slides_Final.pdf"),
    filings: q4(2025, 2, "DE-2Q25-News-Release.pdf"),
  },
  "Q1 2025": {
    slides: null,
    filings: q4(2025, 1, "DE-1Q25-News-Release.pdf"),
  },
  "Q4 2024": {
    slides: q4(2024, 4, "DE-4Q24-Earnings-Call-Presentation.pdf"),
    filings: q4(2024, 4, "DE-4Q24-News-Release.pdf"),
  },
  "Q3 2024": {
    slides: q4(2024, 3, "DE-3Q24-Earnings-Call-Presentation.pdf"),
    filings: q4(2024, 3, "DE-3Q24-News-Release.pdf"),
  },
  "Q2 2024": {
    slides: null,
    filings: q4(2024, 2, "DE-2Q24-News-Release.pdf"),
  },
  "Q1 2024": {
    slides: q4(2024, 1, "DE-1Q24-Earnings-Call-Presentation.pdf"),
    filings: q4(2024, 1, "DE-1Q24-News-Release.pdf"),
  },
  "Q4 2023": {
    slides: q4(2023, 4, "DE-4Q23-Earnings-Call-Presentation.pdf"),
    filings: q4(2023, 4, "DE-4Q23-News-Release.pdf"),
  },
  "Q3 2023": {
    slides: q4(2023, 3, "DE-3Q23-Earnings-Call-Presentation.pdf"),
    filings: deereNews(3, 2023),
  },
  "Q2 2023": {
    slides: q4(2023, 2, "DE-2Q23-Earnings-Call-Presentation.pdf"),
    filings: deereNews(2, 2023),
  },
  "Q1 2023": {
    slides: q4(2023, 1, "DE-1Q23-Earnings-Call-Presentation.pdf"),
    filings: deereNews(1, 2023),
  },
  "Q4 2022": {
    slides: q4(2022, 4, "DE-4Q22-Earnings-Call-Presentation.pdf"),
    filings: null,
  },
  "Q3 2022": {
    slides: q4(2022, 3, "DE-3Q22-Earnings-Call-Presentation.pdf"),
    filings: null,
  },
  "Q2 2022": {
    slides: q4(2022, 2, "DE-2Q22-Earnings-Call-Presentation.pdf"),
    filings: null,
  },
  "Q1 2022": {
    slides: q4(2022, 1, "DE-1Q22-Earnings-Call-Presentation.pdf"),
    filings: null,
  },
};

export function isDeRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|10-?q|10-?k|8-?k/i.test(n);
}

export function isDeIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (u.hostname === "s22.q4cdn.com" || u.hostname.endsWith(".q4cdn.com")) {
      return u.pathname.includes("/253594569/") && !isDeRejected(url);
    }
    if (u.hostname === "www.deere.com" || u.hostname === "deere.com") {
      return (
        u.pathname.includes("/assets/pdfs/common/news/") &&
        /earnings-release/i.test(u.pathname) &&
        !isDeRejected(url)
      );
    }
    return false;
  } catch {
    return false;
  }
}

export function mergeDeKnownQuarterDocs(): Map<string, DeQuarterDocs> {
  return new Map(Object.entries(DE_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
