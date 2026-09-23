/**
 * Corning (GLW) IR — calendar FY.
 * Slides = earnings presentation; Filings = earnings release / press release PDF.
 * Never 10-Q / 10-K / transcript / statistics / SEC HTML.
 * Host: s203.q4cdn.com/212458750.
 */

export type GlwQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const GLW_IR_PAGES = [
  "https://investor.corning.com/",
  "https://investor.corning.com/financials/quarterly-results/default.aspx",
] as const;

/** FinancialReport.svc catalog (Q1 2022 → Q2 2026). */
export const GLW_KNOWN_QUARTER_DOCS: Readonly<Record<string, GlwQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2026/q2/2026-07-28-Second-Quarter-Earnings-Call-Presentation-with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2026/q2/Corning-Incorporated-Second-Quarter-2026-Earnings-Release-with-Financials-2026-07-28.pdf",
  },
  "Q1 2026": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2026/q1/2026-04-28-First-Quarter-Earnings-Call-Presentation-with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2026/q1/Corning-Incorporated-First-Quarter-2026-Earnings-Release-with-Financials-2026-04-28.pdf",
  },
  "Q4 2025": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2025/q4/2026-01-28-Fourth-Quarter-and-Full-Year-Earnings-Call-Presentation-with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2025/q4/Corning-Incorporated-Fourth-Quarter-2025-Earnings-Release-with-Financials-2026-01-28.pdf",
  },
  "Q3 2025": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2025/q3/2025-10-28-Third-Quarter-Earnings-Call-Presentation-with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2025/q3/Corning-Incorporated-Third-Quarter-2025-Earnings-Release-with-Financials-2025-10-28.pdf",
  },
  "Q2 2025": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2025/q2/2025-07-29-Second-Quarter-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2025/q2/Second-Quarter-2025-Earnings-Release-with-Financials-2025-07-29.pdf",
  },
  "Q1 2025": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2025/q1/2025-04-29-First-Quarter-Earnings-Call-Presentation-with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2025/q1/First-Quarter-2025-Earnings-Release-with-Financials-2025-04-29.pdf",
  },
  "Q4 2024": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2024/q4/2025-01-29-Fourth-Quarter-and-Full-Year-Earnings-Call-Presentation-with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2024/q4/Fourth-Quarter-2024-Earnings-Release-with-Financials-2025-01-29.pdf",
  },
  "Q3 2024": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2024/q3/30/2024-10-29-Q3-2024-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2024/q3/Third-Quarter-2024-Earnings-Release-with-Financials-2024-10-29.pdf",
  },
  "Q2 2024": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2024/q2/2024-07-30-Q2-2024-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2024/q2/Second-Quarter-2024-Earnings-with-Financials-2024-07-30.pdf",
  },
  "Q1 2024": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2024/q1/2024-04-30-Q1-2024-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2024/q1/First-Quarter-2024-Earnings-Release-with-Financials-2024-04-30.pdf",
  },
  "Q4 2023": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2023/q4/2024-01-30-Q4-2023-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2023/q4/Fourth-Quarter-and-Full-Year-2023-Earnings-Release-with-Financials-2024-01-30.pdf",
  },
  "Q3 2023": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2023/q3/2023-10-24-Q3-2023-Earnings-Call-Presentation.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2023/q3/Third-Quarter-2023-Earnings-Press-Release-with-Financials-2023-10-24.pdf",
  },
  "Q2 2023": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2023/q2/2023-07-25-Second-Quarter-2023-Earnings-Conference-Call.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2023/q2/2023-07-25-Second_Quarter_2023_Earnings_Press_Release-with-Financials.pdf",
  },
  "Q1 2023": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2023/q1/2023-04-25-Q1-2023-Earnings-Slides_FINAL-with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2023/q1/2023-04-25-First-Quarter_Earnings-Press-Release_FINAL-with-Financials.pdf",
  },
  "Q4 2022": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2022/q4/2023-01-31-Q4_2022-Earnings-Slides_FINAL-with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2022/q4/2023-01-31_Fourth-Quarter_and_Full-Year_2022_Earnings_Press-Release-FINAL.pdf",
  },
  "Q3 2022": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2022/q3/2022-10-25-Q3_2022-Earnings-Slides_FINAL_with-Appendix.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2022/q3/2022-10-25-Q3-PR-FINAL-w_financials.pdf",
  },
  "Q2 2022": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2022/q2/2022-07-26-Q2_2022-Earnings-Slides_FINAL-for-Distribution.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2022/q2/2022-07-26_SecondQuarterEarnings_Final_with_Financials.pdf",
  },
  "Q1 2022": {
    slides: "https://s203.q4cdn.com/212458750/files/doc_financials/2022/q1/2022-04-26-Q1_2022-Earnings-Slide-FINAL-for-Distribution.pdf",
    filings: "https://s203.q4cdn.com/212458750/files/doc_financials/2022/q1/2022-04-25_Q1_22_Release_FINAL_with_financials.pdf",
  },
};

export function isGlwRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  if (
    /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|prepared[-_\s]*remarks|webcast|reconciliation|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
      n,
    )
  ) {
    return true;
  }
  // Standalone quarterly financials PDF (not the earnings release bundle).
  if (/financials/i.test(n) && !/earnings-release/i.test(n)) return true;
  return false;
}

export function isGlwIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "s203.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/212458750/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isGlwRejected(url);
  } catch {
    return false;
  }
}

export function mergeGlwKnownQuarterDocs(): Map<string, GlwQuarterDocs> {
  return new Map(Object.entries(GLW_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
