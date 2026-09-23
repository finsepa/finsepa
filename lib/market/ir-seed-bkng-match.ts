/**
 * Booking Holdings (BKNG) IR — calendar FY.
 * Slides = Quarterly Earnings Presentation; Filings = earnings press release PDF.
 * Never 10-Q / 10-K / transcript / prepared remarks / SEC HTML.
 * Hosts: s25.q4cdn.com/383369491, s201.q4cdn.com/865305287 (legacy).
 */

export type BkngQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const BKNG_Q4_SITE_IDS = ["/383369491/", "/865305287/"] as const;

export const BKNG_IR_PAGES = [
  "https://ir.bookingholdings.com/",
  "https://ir.bookingholdings.com/financials/quarterly-results/default.aspx",
] as const;

/** FinancialReport.svc catalog (Q1 2022 → Q2 2026). */
export const BKNG_KNOWN_QUARTER_DOCS: Readonly<Record<string, BkngQuarterDocs>> = {
  "Q2 2026": {
    slides:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2026/q2/BKNG-Quarterly-Earnings-Presentation-Q2-2026.pdf",
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2026/q2/Q2-26-BKNG-Earnings-Release-Final.pdf",
  },
  "Q1 2026": {
    slides:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2026/q1/BKNG-Quarterly-Earnings-Presentation-Q1-2026.pdf",
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2026/q1/Q1-2026-BKNG-Earnings-Release.pdf",
  },
  "Q4 2025": {
    slides:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2025/q4/BKNG-Quarterly-Earnings-Presentation-Q4-2025.pdf",
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2025/q4/Q4-25-BKNG-Earnings-Release.pdf",
  },
  "Q3 2025": {
    slides:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2025/q3/BKNG-Quarterly-Earnings-Presentation-Q3-2025.pdf",
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2025/q3/Q3-25-BKNG-Earnings-Release-Final.pdf",
  },
  "Q2 2025": {
    slides:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2025/q2/BKNG-Quarterly-Earnings-Presentation-Q2-2025.pdf",
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2025/q2/BKNG-Q2-2025-Earnings-Press-Release-7-29-25.pdf",
  },
  "Q1 2025": {
    slides:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2025/q1/BKNG-Quarterly-Earnings-Presentation-Q1-2025.pdf",
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2025/q1/BKNG-Q1-2025-Earnings-Press-Release.pdf",
  },
  "Q4 2024": {
    slides:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2024/q4/BKNG-Quarterly-Earnings-Presentation-Q4-2024.pdf",
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2024/q4/Q4-2024-BKNG-Earnings-Release.pdf",
  },
  "Q3 2024": {
    slides:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2024/q3/BKNG-Quarterly-Earnings-Presentation-Q3-2024.pdf",
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2024/q3/BKNG-Q3-2024-Earnings-Release.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2024/q2/BKNG-Q2-2024-Earnigs-Release.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2024/q1/BKNG-Q1-2024-Earnings-Release.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2023/q4/BKNG-Earnings-Release-Final.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2023/q3/BKNG-Q3-2023-Earnings-Release.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2023/q2/BKNG-Q2-2023-Earnings-Release.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2023/q1/Q1-2023-BKNG-Earnings-Release.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2022/q4/BKNG-Earnings-Release-Q4-2022.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2022/q3/BKNG-Earnings-Release-Q3-2022.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2022/q2/BKNG-Q2-2022-Press-Release.pdf",
  },
  "Q1 2022": {
    slides: null,
    filings:
      "https://s25.q4cdn.com/383369491/files/doc_financials/2022/q1/BKNG-Q1-2022-Press-Release.pdf",
  },
};

export function isBkngRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|prepared[-_\s]*remarks|webcast|quarterly[-_\s]*filing|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isBkngIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (isBkngRejected(url)) return false;
    if (host === "ir.bookingholdings.com" || host.endsWith(".bookingholdings.com")) return true;
    if (!(host.endsWith(".q4cdn.com") || host === "q4cdn.com")) return false;
    return BKNG_Q4_SITE_IDS.some((id) => u.pathname.includes(id));
  } catch {
    return false;
  }
}

export function mergeBkngKnownQuarterDocs(): Map<string, BkngQuarterDocs> {
  return new Map(Object.entries(BKNG_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
