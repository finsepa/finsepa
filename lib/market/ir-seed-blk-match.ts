/**
 * BlackRock (BLK) IR — calendar FY.
 * Slides = Earnings Release Supplement; Filings = Earnings Release PDF.
 * Host: s24.q4cdn.com/856567660 (never SEC HTML / investor-day decks).
 */

export type BlkQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const BLK_CDN = "https://s24.q4cdn.com/856567660/files/doc_financials";

function doc(fy: number, fq: number, name: string): string {
  return `${BLK_CDN}/${fy}/Q${fq}/${name}`;
}

export const BLK_IR_PAGES = [
  "https://ir.blackrock.com/financials/quarterly-results/default.aspx",
  "https://ir.blackrock.com/",
  "https://www.blackrock.com/corporate/investor-relations",
] as const;

/** HTTP-verified Supplement (Slides) + Release (Filings). Naming varies (Earning vs Earnings). */
export const BLK_KNOWN_QUARTER_DOCS: Readonly<Record<string, BlkQuarterDocs>> = {
  "Q2 2026": {
    slides: doc(2026, 2, "BLK-2Q26-Earnings-Supplement.pdf"),
    filings: doc(2026, 2, "BLK-2Q26-Earnings-Release.pdf"),
  },
  "Q1 2026": {
    slides: doc(2026, 1, "BLK-1Q26-Earnings-Supplement.pdf"),
    filings: doc(2026, 1, "BLK-1Q26-Earnings-Release.pdf"),
  },
  "Q4 2025": {
    slides: doc(2025, 4, "BLK-4Q25-Earnings-Supplement.pdf"),
    filings: doc(2025, 4, "BLK-4Q25-Earnings-Release.pdf"),
  },
  "Q3 2025": {
    slides: doc(2025, 3, "BLK-3Q25-Earnings-Supplement.pdf"),
    filings: doc(2025, 3, "BLK-3Q25-Earnings-Release.pdf"),
  },
  "Q2 2025": {
    slides: doc(2025, 2, "BLK-2Q25-Earnings-Supplement.pdf"),
    filings: doc(2025, 2, "BLK-2Q25-Earnings-Release.pdf"),
  },
  "Q1 2025": {
    slides: doc(2025, 1, "BLK-1Q25-Earnings-Supplement.pdf"),
    filings: doc(2025, 1, "BLK-1Q25-Earning-Release.pdf"),
  },
  "Q4 2024": {
    slides: doc(2024, 4, "BLK-4Q24-Earnings-Supplement.pdf"),
    filings: doc(2024, 4, "BLK-4Q24-Earning-Release.pdf"),
  },
  "Q3 2024": {
    slides: doc(2024, 3, "BLK-3Q24-Earnings-Supplement.pdf"),
    filings: doc(2024, 3, "BLK-3Q24-Earning-Release.pdf"),
  },
  "Q2 2024": {
    slides: doc(2024, 2, "BLK-2Q24-Earnings-Supplement.pdf"),
    filings: doc(2024, 2, "BLK-2Q24-Earning-Release.pdf"),
  },
  "Q1 2024": {
    slides: doc(2024, 1, "BLK-1Q24-Earnings-Supplement.pdf"),
    filings: doc(2024, 1, "BLK-1Q24-Earnings-Release.pdf"),
  },
  "Q4 2023": {
    slides: doc(2023, 4, "BLK-4Q23-Earnings-Supplement.pdf"),
    filings: doc(2023, 4, "BLK-4Q23-Earnings-Release.pdf"),
  },
  "Q3 2023": {
    slides: doc(2023, 3, "BLK-3Q23-Earnings-Supplement.pdf"),
    filings: doc(2023, 3, "BLK-3Q23-Earnings-Release.pdf"),
  },
  "Q2 2023": {
    slides: doc(2023, 2, "BLK-2Q23-Earnings-Supplement.pdf"),
    filings: doc(2023, 2, "BLK-2Q23-Earnings-Release.pdf"),
  },
  "Q1 2023": {
    slides: doc(2023, 1, "BLK-1Q23-Earnings-Supplement.pdf"),
    filings: doc(2023, 1, "BLK-1Q23-Earnings-Release.pdf"),
  },
  "Q4 2022": {
    slides: doc(2022, 4, "BLK-4Q22-Earnings-Supplement.pdf"),
    filings: doc(2022, 4, "BLK-4Q22-Earnings-Release.pdf"),
  },
  "Q3 2022": {
    slides: doc(2022, 3, "BLK-3Q22-Earnings-Supplement.pdf"),
    filings: doc(2022, 3, "BLK-3Q22-Earnings-Release.pdf"),
  },
  "Q2 2022": {
    slides: doc(2022, 2, "BLK-2Q22-Earnings-Supplement.pdf"),
    filings: doc(2022, 2, "BLK-2Q22-Earnings-Release.pdf"),
  },
  "Q1 2022": {
    slides: doc(2022, 1, "BLK-1Q22-Earnings-Supplement.pdf"),
    filings: doc(2022, 1, "BLK-1Q22-Earnings-Release.pdf"),
  },
};

export function isBlkRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|transcript|investor[-_\s]*day|proxy|\.xls/i.test(n);
}

export function isBlkIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "s24.q4cdn.com" || u.hostname.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/856567660/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return /earnings[-_]?supplement|earning[s]?[-_]?release/i.test(u.pathname) && !isBlkRejected(url);
  } catch {
    return false;
  }
}

export function mergeBlkKnownQuarterDocs(): Map<string, BlkQuarterDocs> {
  return new Map(Object.entries(BLK_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
