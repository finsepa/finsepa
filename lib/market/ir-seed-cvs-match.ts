/**
 * CVS Health (CVS) IR — calendar FY.
 * Slides = Earnings Presentation; Filings = Earnings/Press Release.
 * Host: s206.q4cdn.com/752775519. Never Non-GAAP / transcript / 10-Q / SEC HTML.
 */

export type CvsQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const CVS_IR_PAGES = [
  "https://investors.cvshealth.com/investors/financials/quarterly-results/default.aspx",
  "https://investors.cvshealth.com/",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const CVS_KNOWN_QUARTER_DOCS: Readonly<Record<string, CvsQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2022/q1/Q1-2022-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2022/q1/Q1-2022-Press-Release.pdf",
  },
  "Q2 2022": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2022/q2/Q2-2022-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2022/q2/Q2-2022-Earnings-Press-Release.pdf",
  },
  "Q3 2022": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2022/q3/Q3-2022-Presentation-1.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2022/q3/Q3-2022-Earnings-Release-1.pdf",
  },
  "Q4 2022": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2022/q4/Q4-2022-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2022/q4/Q4-2022-Earnings-Release.pdf",
  },
  "Q1 2023": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2023/q1/Q1-2023-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2023/q1/CVS-Q1-2023-Earnings-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2023/q2/Q2-2023-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2023/q2/Q2-2023-Earnings-Release.pdf",
  },
  "Q3 2023": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2023/q3/Q3-2023-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2023/q3/Q3-2023-Earnings-Release.pdf",
  },
  "Q4 2023": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2023/q4/Q4-2023-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2023/q4/Q4-2023-Earnings-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2024/q1/Q1-2024-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2024/q1/Q1-2024-Earnings-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2024/q2/Q2-2024-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2024/q2/Q2-2024-Earnings-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2024/q3/Q3-2024-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2024/q3/Q3-2024-Earnings-Release.pdf",
  },
  "Q4 2024": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2024/q4/Q4-2024-Earnings-Presentation_.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2024/q4/Q4-2024-Earnings-Release.pdf",
  },
  "Q1 2025": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2025/q1/1Q-2025_Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2025/q1/Q1-2025-Earnings-Release.pdf",
  },
  "Q2 2025": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2025/q2/2Q-2025-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_downloads/2025/Q2-2025-Earnings-Release.pdf",
  },
  "Q3 2025": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2025/q3/3Q-2025-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2025/q3/Q3-2025-Earnings-Release-2.pdf",
  },
  "Q4 2025": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2025/q4/4Q-2025-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2025/q4/Q4-2025-Earnings-Release.pdf",
  },
  "Q1 2026": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2026/q1/1Q-2026-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2026/q1/v2/Q1-2026-Earnings-Release.pdf",
  },
  "Q2 2026": {
    slides: "https://s206.q4cdn.com/752775519/files/doc_financials/2026/q2/Q2-2026-Earnings-Presentation.pdf",
    filings: "https://s206.q4cdn.com/752775519/files/doc_financials/2026/q2/v2/Q2-2026-Earnings-Release.pdf",
  }
};

export function isCvsRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|non-?gaap|supplement|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isCvsIrPdf(href: string | null | undefined): boolean {
  if (!href || isCvsRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s206.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/752775519/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeCvsKnownQuarterDocs(): Map<string, CvsQuarterDocs> {
  return new Map(Object.entries(CVS_KNOWN_QUARTER_DOCS));
}
