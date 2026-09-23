/**
 * Bristol Myers Squibb (BMY) IR — calendar FY.
 * Slides = earnings presentation; Filings = earnings release / press release PDF.
 * Never 10-Q / 10-K / transcript / statistics / SEC HTML.
 * Host: www.bms.com + s21.q4cdn.com/104148044.
 */

export type BmyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BMY_IR_PAGES = [
  "https://www.bms.com/investors/",
  "https://www.bms.com/investors/financial-reporting/quarterly-results.html",
] as const;

/** FinancialReport.svc catalog (Q1 2022 → Q2 2026). */
export const BMY_KNOWN_QUARTER_DOCS: Readonly<Record<string, BmyQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2026/BMY-2026-Q2-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2026/ghBMY-Q2-2026-Earnings-Press-Release.pdf",
  },
  "Q1 2026": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2026/BMY-2026-Q1-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2026/BMY-Q1-2026-Earnings-Press-Release.pdf",
  },
  "Q4 2025": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2025/BMY-2025-Q4-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2025/BMY-Q4-2025-Earnings-Press-Release.pdf",
  },
  "Q3 2025": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2025/BMY-2025-Q3-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2025/BMY-Q3-2025-Earnings-Press-Release.pdf",
  },
  "Q2 2025": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2025/BMY-2025-Q2-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2025/BMY-Q2-2025-Earnings-Press-Release.pdf",
  },
  "Q1 2025": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2025/BMY-2025-Q1-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2025/BMY-Q12025-Earnings-Press-Release.pdf",
  },
  "Q4 2024": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2024/BMY-2024-Q4-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2024/BMY-Q42024-Earnings-Press-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2024/BMY-2024-Q3-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2024/BMY-Q32024-Earnings-Press-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2024/BMY-2024-Q2-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2024/BMY-Q22024-Earnings-Press-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2024/BMY-2024-Q1-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2024/BMY-Q12024-Earnings-Press-Release.pdf",
  },
  "Q4 2023": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2023/BMY-2023-Q4-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2023/BMY-Q42023-Earnings-Press-Release.pdf",
  },
  "Q3 2023": {
    slides: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_presentations/2023/BMY-2023-Q3-Results-Investor-Presentation.pdf",
    filings: "https://www.bms.com/assets/bms/us/en-us/pdf/investor-info/doc_financials/quarterly_reports/2023/BMY-Q32023-Earnings-Press-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s21.q4cdn.com/104148044/files/doc_presentations/2023/BMY-2023-Q2-Results-Investor-Presentation-pdf.pdf",
    filings: "https://s21.q4cdn.com/104148044/files/doc_financials/quarterly_reports/2023/BMY-Q22023-Earnings-Press-Release.pdf",
  },
  "Q1 2023": {
    slides: "https://s21.q4cdn.com/104148044/files/doc_presentations/2023/BMY-2023-Q1-Results-Presentation.pdf",
    filings: "https://s21.q4cdn.com/104148044/files/doc_financials/quarterly_reports/2023/BMY-Q12023-Earnings-Press-Release.pdf",
  },
  "Q4 2022": {
    slides: "https://s21.q4cdn.com/104148044/files/doc_presentations/2022/BMY-Q4-2022-Results-Presentation.pdf",
    filings: "https://s21.q4cdn.com/104148044/files/doc_financials/quarterly_reports/2022/BMY-Q42022-Earnings-Release.pdf",
  },
  "Q3 2022": {
    slides: "https://s21.q4cdn.com/104148044/files/doc_presentations/2022/BMY-2022-Q3-Results-Investor-Presentation-Appendix.pdf",
    filings: "https://s21.q4cdn.com/104148044/files/doc_financials/quarterly_reports/2022/BMY-Q32022-Earnings-Release.pdf",
  },
  "Q2 2022": {
    slides: "https://s21.q4cdn.com/104148044/files/doc_presentations/2022/BMY-2022-Q2-Results-Investor-Presentation.pdf",
    filings: "https://s21.q4cdn.com/104148044/files/doc_financials/quarterly_reports/2022/BMY-Q22022-Earnings-Press-Release.pdf",
  },
  "Q1 2022": {
    slides: "https://s21.q4cdn.com/104148044/files/doc_presentations/2022/BMY-2022-Q1-Results-Investor-Presentation.pdf",
    filings: "https://s21.q4cdn.com/104148044/files/doc_financials/quarterly_reports/2022/BMY-Q12022-Earnings-Press-Release.pdf",
  },
};

export function isBmyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|prepared[-_\s]*remarks|webcast|preliminary|acquired[-_\s]*ipr|licensing[-_\s]*income|financial[-_\s]*report|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isBmyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const okHost =
      host === "www.bms.com" ||
      host.endsWith(".bms.com") ||
      (host.endsWith(".q4cdn.com") && u.pathname.includes("/104148044/"));
    if (!okHost) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isBmyRejected(url);
  } catch {
    return false;
  }
}

export function mergeBmyKnownQuarterDocs(): Map<string, BmyQuarterDocs> {
  return new Map(Object.entries(BMY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
