/**
 * Amphenol (APH) IR — calendar FY.
 * Issuer publishes earnings press-release PDFs on q4cdn; no dedicated quarterly earnings
 * slide decks (general investor presentations are not quarter earnings decks — leave Slides empty).
 * Filings = PR Results PDF. Never 10-Q / SEC HTML / investor-day decks as Slides.
 */

export type AphQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const APH_CDN = "https://s21.q4cdn.com/564806605/files/doc_financials";

function pr(fy: number, fq: number, name: string): string {
  return `${APH_CDN}/${fy}/q${fq}/${name}`;
}

export const APH_IR_PAGES = [
  "https://investors.amphenol.com/financials/quarterly-and-annual-reports/default.aspx",
  "https://investors.amphenol.com/",
] as const;

/** HTTP-verified earnings press PDFs. Slides stay null — issuer does not publish quarterly decks. */
export const APH_KNOWN_QUARTER_DOCS: Readonly<Record<string, AphQuarterDocs>> = {
  "Q2 2026": { slides: null, filings: pr(2026, 2, "2026_07_29-PR-2Q-2026-Results.pdf") },
  "Q1 2026": { slides: null, filings: pr(2026, 1, "2026_04_29-PR-1Q-2026-Results.pdf") },
  "Q4 2025": { slides: null, filings: pr(2025, 4, "Press-Release-Q4-2025.pdf") },
  "Q3 2025": { slides: null, filings: pr(2025, 3, "2025_10_22-PR-3Q-results-and-dividend-raise.pdf") },
  "Q2 2025": { slides: null, filings: pr(2025, 2, "2025_07_23-PR-2Q-2025-Results.pdf") },
  "Q1 2025": { slides: null, filings: pr(2025, 1, "2025_04_23-PR-1Q-2025-Results.pdf") },
  "Q4 2024": { slides: null, filings: pr(2024, 4, "2025_01_22-PR-4Q-2024-Results.pdf") },
  "Q3 2024": { slides: null, filings: pr(2024, 3, "2024_10_23-PR-3Q-2024-Results.pdf") },
  "Q2 2024": {
    slides: null,
    filings: pr(2024, 2, "2024_07_24-PR-2Q-2024-Results-and-Dividend-raise.pdf"),
  },
  "Q1 2024": {
    slides: null,
    filings: pr(2024, 1, "2024_04_24-PR-1Q-2024-Results-and-Buyback.pdf"),
  },
  "Q4 2023": { slides: null, filings: pr(2023, 4, "2024_01_24-PR-4Q-2023-Results.pdf") },
  // Issuer typo in filename (3Q-2022) — verified 200 for Q3 2023.
  "Q3 2023": {
    slides: null,
    filings: pr(2023, 3, "2023_10_25-PR-3Q-2022-Results-and-Dividend-increase.pdf"),
  },
  "Q2 2023": { slides: null, filings: pr(2023, 2, "2023_07_26-PR-2Q-2023-Results.pdf") },
  "Q1 2023": { slides: null, filings: pr(2023, 1, "2023_04_26-PR-1Q-2023-Results.pdf") },
  "Q4 2022": { slides: null, filings: pr(2022, 4, "2023_01_25-PR-4Q-2022-Results.pdf") },
  "Q3 2022": {
    slides: null,
    filings: pr(2022, 3, "2022_10_26-PR-3Q-2022-Results-and-Dividend-increase.pdf"),
  },
  "Q2 2022": { slides: null, filings: pr(2022, 2, "2022_07_27-PR-2Q-2022-Results.pdf") },
  "Q1 2022": { slides: null, filings: pr(2022, 1, "2022_04_27-PR-1Q-2022-Results.pdf") },
};

export function isAphRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return (
    /sec\.gov|10-?q|10-?k|8-?k|investor[-_\s]*presentation|annual[-_\s]*report|proxy|\.xls/i.test(
      n,
    )
  );
}

export function isAphIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "s21.q4cdn.com" || u.hostname.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/564806605/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    // Earnings press PDFs only (not 10-Q / annual / investor-day decks).
    const path = u.pathname.toLowerCase();
    if (/10q|annual|investor[-_]?presentation|proxy/i.test(path)) return false;
    return /pr-.*results|press-release-q\d/i.test(path) && !isAphRejected(url);
  } catch {
    return false;
  }
}

export function mergeAphKnownQuarterDocs(): Map<string, AphQuarterDocs> {
  return new Map(Object.entries(APH_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
