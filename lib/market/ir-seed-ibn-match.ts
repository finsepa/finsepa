/**
 * IBN IR seed — 03-31.
 * ICICI Bank Ltd ADR (IBN) March FY. Slides=Investor Presentation; Filings=Performance Review/PR1 on icici.bank.in. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type IbnQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const IBN_IR_PAGES = [
  "https://www.icici.bank.in/about-us/qfr",
] as const;

export const IBN_KNOWN_QUARTER_DOCS: Readonly<Record<string, IbnQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2022/2021_04_Q1-2022_Investor_presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2022/2021_04_Q1-2022_PR1.pdf",
  },
  "Q2 2022": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/managed-assets/docs/investor/quarterly-financial-results/2021/ICICI-Bank-Investor-Presentation-on-Performance.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/managed-assets/docs/investor/quarterly-financial-results/2021/ICICI-Bank-Performance-Review-Quarter-ended-September-2021.pdf",
  },
  "Q3 2022": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2022/2022-1-Q3-2022-Investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2022/2022-01-Q3-2022-PR1.pdf",
  },
  "Q4 2022": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2022/2022_04_Q4-2022_Investor_presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2022/2022_04_Q4-2022_PR1.pdf",
  },
  "Q1 2023": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2023/2022_07_Q1-2023_Investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2023/2022_07_Q1-2023_PR1.pdf",
  },
  "Q2 2023": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2023/2022_10_Q2-2023_Investor_presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2023/2022_10_Q2-2023_PR1.pdf",
  },
  "Q3 2023": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2023/2023_01_Q3-2023_Investor_presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2023/2023_01_Q3-2023_PR1.pdf",
  },
  "Q4 2023": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2023/2023_04_q4-2023_investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/images/about-us/investor/quarterly-financial-results/2023/2023_04_pr1_q4-2023.pdf",
  },
  "Q1 2024": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2023/2023_07_q1-2024_investor_presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2023/2023_07_q1-2024_pr1.pdf",
  },
  "Q2 2024": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2023-1-q2-2024-investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2023_10_pr1_q2-2024.pdf",
  },
  "Q3 2024": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2024_01_q3-2024_investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2024_01_pr1_q3-2024.pdf",
  },
  "Q4 2024": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2024_04_q4-2024_investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2024_04_pr1_q4-2024.pdf",
  },
  "Q1 2025": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2024-investor-presentation-for-quarter-ended-june-30-2024-icici-bank.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2024-financial-results-for-quarter-ended-june-30-2024-icici-bank.pdf",
  },
  "Q2 2025": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/2024-10-q2-2025-investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2024/icici-bank-performance-review-quarter-ended-september-30-2024.pdf",
  },
  "Q3 2025": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2025/2025-01-q3-2025-investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2025/icici-bank-performance-review-for-quarter-ended-december-31-2024.pdf",
  },
  "Q4 2025": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2025/2025-04-Q4-2025-investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2025/2025-04-press-release-q4-2025.pdf",
  },
  "Q1 2026": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2026/2025-07-q1-2026-investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2026/ICICI-Bank-Financial-Results-for-quarter-ended-June-30-2025.pdf",
  },
  "Q2 2026": {
    slides: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2026/2025_10_Q2-2026_investor-presentation.pdf",
    filings: "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/about-us/2026/performance-review-for-quarter-ended-september-30-2025.pdf",
  },
};

export function isIbnRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|annual.?report|basel|pillar|sustainab|esg/i.test(n);
}

export function isIbnIrPdf(href: string | null | undefined): boolean {
  if (!href || isIbnRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.icici.bank.in" || host.endsWith(".icici.bank.in") || host === "www.icicibank.com" || host.endsWith(".icicibank.com"))) return false;
    if (!(u.pathname.includes("/content/dam/") || u.pathname.includes("/managed-assets/") || u.pathname.includes("/investor/") || u.pathname.includes("/about-us/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeIbnKnownQuarterDocs(): Map<string, IbnQuarterDocs> {
  return new Map(Object.entries(IBN_KNOWN_QUARTER_DOCS));
}
