/**
 * Gilead (GILD) IR — calendar FY.
 * Slides = Earnings Presentation; Filings = Earnings Press Release PDF.
 * Never prepared remarks / transcript / supplementary / resource book / 10-Q / 10-K / SEC HTML.
 * Catalog from investors.gilead.com FinancialReport JSON feed (CDN s29.q4cdn.com/585078350).
 */

export type GildQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const Q4 = "https://s29.q4cdn.com/585078350/files/doc_financials";

function q4(path: string): string {
  return `${Q4}/${path}`;
}

export const GILD_IR_PAGES = [
  "https://investors.gilead.com/financials/quarterly-results/",
] as const;

/** HEAD-verified from FinancialReport.svc feed (Q1 2022 → Q2 2026). */
export const GILD_KNOWN_QUARTER_DOCS: Readonly<Record<string, GildQuarterDocs>> = {
  "Q2 2026": {
    slides: q4("2026/q2/GILD-Q226-Earnings-Presentation-4-August-2026.pdf"),
    filings: q4("2026/q2/GILD-Q226-Earnings-Press-Release-4-August-2026.pdf"),
  },
  "Q1 2026": {
    slides: q4("2026/q1/v2/GILD-Q126-Earnings-Presentation-7-May-2026.pdf"),
    filings: q4("2026/q1/GILD-Q126-Earnings-Press-Release-7-May-2026.pdf"),
  },
  "Q4 2025": {
    slides: q4("2025/q4/GILD-Q4-FY25-Earnings-Presentation-10-February-2026.pdf"),
    filings: q4("2025/q4/GILD-Q425-FY25-Earnings-Press-Release-10-February-2026.pdf"),
  },
  "Q3 2025": {
    slides: q4("2025/q3/GILD-Q325-Earnings-Presentation-30-October-2025.pdf"),
    filings:
      "https://investors.gilead.com/files/doc_financials/2025/q3/GILD-Q325-Earnings-Press-Release-30-October-2025.pdf",
  },
  "Q2 2025": {
    slides: q4("2025/q2/GILD-Q225-Earnings-Presentation-7-August-2025.pdf"),
    filings: q4("2025/q2/GILD-Q225-Earnings-Press-Release-7-August-2025.pdf"),
  },
  "Q1 2025": {
    slides: q4("2025/q1/v2/GILD-Q125-Earnings-Presentation-24-April-2025.pdf"),
    filings: q4("2025/q1/GILD-Q125-Earnings-Press-Release-24-April-2025.pdf"),
  },
  "Q4 2024": {
    slides: q4("2024/q4/v5/GILD-Q424-Earnings-Presentation-11-February-2025-1.pdf"),
    filings: q4("2024/q4/v5/GILD-Q424-Earnings-Press-Release-11-February-2025.pdf"),
  },
  "Q3 2024": {
    slides: q4("2024/q3/v2/GILD-Q324-Earnings-Presentation-6-November-2024.pdf"),
    filings: q4("2024/q3/GILD-Q324-Earnings-Press-Release-6-November-2024.pdf"),
  },
  "Q2 2024": {
    slides: q4("2024/q2/GILD-Q224-Earnings-Presentation-8-August-2024.pdf"),
    filings: q4("2024/q2/GILD-Q224-Earnings-Press-Release-8-August-2024.pdf"),
  },
  "Q1 2024": {
    slides: q4("2024/q1/GILD-Q124-Earnings-Presentation-25-April-2024.pdf"),
    filings: q4("2024/q1/GILD-Q124-Earnings-Press-Release-25-April-2024.pdf"),
  },
  "Q4 2023": {
    slides: q4("2023/q4/GILD-Q423-Earnings-Presentation-6-February-2024.pdf"),
    filings: q4("2023/q4/GILD-Q423-Earnings-Press-Release-6-February-2024.pdf"),
  },
  "Q3 2023": {
    slides: q4("2023/q3/GILD-Q323-Earnings-Presentation-7-November-2023.pdf"),
    filings: q4("2023/q3/GILD-Q323-Earnings-Press-Release-7-November-2023.pdf"),
  },
  "Q2 2023": {
    slides: q4("2023/q2/GILD-Q223-Earnings-Presentation-3-August-2023-1.pdf"),
    filings: q4("2023/q2/GILD-Q223-Earnings-Press-Release-3-August-2023-1.pdf"),
  },
  "Q1 2023": {
    slides: q4("2023/q1/GILD-Q123-Earnings-Presentation-27-April-2023.pdf"),
    filings: q4("2023/q1/GILD-Q123-Earnings-Press-Release-27-April-2023.pdf"),
  },
  "Q4 2022": {
    slides: q4("2022/q4/GILD-Q4-FY22-Earnings-Presentation-2-February-2023_B.pdf"),
    filings: q4("2022/q4/GILD-Q4-FY22-Earnings-Press-Release-2-February-2023.pdf"),
  },
  "Q3 2022": {
    slides: q4("2022/q3/GILD-Q322-Earnings-Presentation-31-October-2022.pdf"),
    filings: q4("2022/q3/GILD-Q322-Earnings-Press-Release-27-October-2022.pdf"),
  },
  "Q2 2022": {
    slides: q4("2022/q2/v1/Gilead-Sciences-Q222-Earnings-Presentation-2-August-2022.pdf"),
    filings: q4("2022/q2/Gilead-Sciences-Q222-Earnings-Press-Release-2-August-2022.pdf"),
  },
  "Q1 2022": {
    slides: q4("2022/q1/GILD-Q122-Earnings-Presentation-29-April-2022.pdf"),
    filings: q4("2022/q1/GILD-Q122-Earnings-Release-28-April-2022.pdf"),
  },
};

export function isGildRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|prepared[-_\s]?remarks|transcript|supplementar|resource[-_\s]?book|summary[-_\s]?of[-_\s]?remarks|10-?q|10-?k|8-?k|webcast/i.test(
    n,
  );
}

export function isGildIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const okHost =
      host === "s29.q4cdn.com" ||
      host.endsWith(".q4cdn.com") ||
      host === "investors.gilead.com" ||
      host.endsWith(".gilead.com");
    if (!okHost) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (!u.pathname.includes("/doc_financials/")) return false;
    return !isGildRejected(url);
  } catch {
    return false;
  }
}

export function mergeGildKnownQuarterDocs(): Map<string, GildQuarterDocs> {
  return new Map(Object.entries(GILD_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
