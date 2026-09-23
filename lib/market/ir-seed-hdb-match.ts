/**
 * HDFC Bank ADR (HDB) IR — FY ends 03-31.
 * Slides = earnings-presentation.pdf; Filings = press-release*.pdf.
 * Host: www.hdfc.bank.in / hdfcbank.com. Never transcript / key-parameters / SEC HTML.
 */

export type HdbQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const HDB_FY_END = "03-31";

export const HDB_IR_PAGES = [
  "https://www.hdfc.bank.in/about-us/investor-relations",
  "https://www.hdfc.bank.in/about-us/investor-relations/financial-results",
] as const;

/** Catalog Q1 2022 → Q1 2027 (issuer March FY). Solid from Q1 2024. */
export const HDB_KNOWN_QUARTER_DOCS: Readonly<Record<string, HdbQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2021-2022/quarter-1/press-release-to-announce-financial-results-for-quarter-ended-june-30--2021.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: null,
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: null,
    filings: null,
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2022-2023/quarter-1/press-release-to-announce-financial-results-for-quarter-ended-june-30--2022.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: null,
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: null,
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2022-2023/quarter-4/press-release-to-announce-financial-results-for-the-quarter-and-year-ended-march-31--2023.pdf",
  },
  "Q1 2024": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2023-2024/quarter-1/q1fy24-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2023-2024/quarter-1/press-release-to-announce-financial-results-for-the-quarter-ended-june-30--2023.pdf",
  },
  "Q2 2024": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2023-2024/quarter-2/q2fy24-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2023-2024/quarter-2/press-release-to-announce-financial-results-for-the-quarter-and-half-year-ended-september-30--2023.pdf",
  },
  "Q3 2024": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2023-2024/quarter-3/q3fy24-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2023-2024/quarter-3/press-release-to-announce-financial-results-for-the-quarter-and-nine-months-ended-december-31--2023.pdf",
  },
  "Q4 2024": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2023-2024/quarter-4/q4fy24-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2023-2024/quarter-4/press-release-to-announce-financial-results-for-the-quarter-and-year-ended-march-31--2024.pdf",
  },
  "Q1 2025": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-1/Q1FY25%20Earnings%20Presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-1/press-release-to-announce-financial-results-for-the-quarter-ended-june-30-2024.pdf",
  },
  "Q2 2025": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-2/Q2FY25-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-2/press-release-quarter-and-half-year-ended.pdf",
  },
  "Q3 2025": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-3/Q3FY25-Earnings-Presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-3/Press-Release-to-announce-Financial-Results-for-the-quarter-and-nine-months-ended-December-31-2024.pdf",
  },
  "Q4 2025": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-4/q4fy25-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-4/press-release-to-announce-financial-results-for-the-quarter-and-year-ended-march-31-2025.pdf",
  },
  "Q1 2026": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-1/q1fy26-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-1/press-release-june-2025.pdf",
  },
  "Q2 2026": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-2/q2fy26-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-2/press-release-september-2025.pdf",
  },
  "Q3 2026": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-3/Q3FY26-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-3/press-release-december-2025.pdf",
  },
  "Q4 2026": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-4/q4fy26-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-4/press-release-march-2026.pdf",
  },
  "Q1 2027": {
    slides: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2026-2027/quarter-1/q1fy27-earnings-presentation.pdf",
    filings: "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2026-2027/quarter-1/press-release-june-2026.pdf",
  },
};

export function isHdbRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|key-parameters|analyst-invite|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isHdbIrPdf(href: string | null | undefined): boolean {
  if (!href || isHdbRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.hdfc.bank.in" || host === "hdfc.bank.in" || host.endsWith(".hdfcbank.com") || host === "www.hdfcbank.com")) {
      return false;
    }
    return u.pathname.includes("/content/dam/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeHdbKnownQuarterDocs(): Map<string, HdbQuarterDocs> {
  return new Map(Object.entries(HDB_KNOWN_QUARTER_DOCS));
}
