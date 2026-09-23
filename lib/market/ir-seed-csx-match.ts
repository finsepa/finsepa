/**
 * CSX IR seed — 12-31.
 * CSX calendar FY. Slides=Earnings Presentation; Filings=Quarterly Financial Report (QFR/operating results) on s2.q4cdn.com/859568992 — earnings press pages are HTML/GlobeNewswire only (no lockable press PDF). Reject 10-Q/10-K. Scope: 18g / 0y / 0r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type CsxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const CSX_IR_PAGES = [
  "https://investors.csx.com/financials/quarterly-results/default.aspx",
] as const;

export const CSX_KNOWN_QUARTER_DOCS: Readonly<Record<string, CsxQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2022/q1/CSX-Q1-2022-Earnings-Presentation_FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2022/q1/Q1-2022-QFR-Final-Draft.pdf",
  },
  "Q2 2022": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2022/q2/CSX-Q2-2022-Earnings-Presentation_FINAL_rev2.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2022/q2/Q2-2022-QFR-Final-Draft.pdf",
  },
  "Q3 2022": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2022/q3/CSX-Q3-2022-Earnings-Presentation_FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2022/q3/Q3-2022-QFR-Final-v2.pdf",
  },
  "Q4 2022": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2022/q4/4Q22-Earnings-Presentation_FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2022/q4/Q4-2022-QFR_FINAL.pdf",
  },
  "Q1 2023": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2023/q1/CSX-1Q23-Earnings-Presentation-FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2023/q1/Q1-2023-QFR-FINAL.pdf",
  },
  "Q2 2023": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2023/q2/CSX-2Q23-Earnings-Presentation-FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2023/q2/Q2-2023-QFR-Final.pdf",
  },
  "Q3 2023": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2023/q3/CSX-3Q23-Earnings-Presentation-FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2023/q3/Q3-2023-QFR-Final.pdf",
  },
  "Q4 2023": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2023/q4/CSX-4Q23-Earnings-Presentation-FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2023/q4/4Q-2023-QFR-Final.pdf",
  },
  "Q1 2024": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2024/q1/CSX-1Q24-Earnings-Presentation-FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2024/q1/Q1-2024-QFR-Final.pdf",
  },
  "Q2 2024": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2024/q2/CSX-2Q24-Earnings-Presentation-FINAL.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2024/q2/Q2-2024-QFR-Final.pdf",
  },
  "Q3 2024": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2024/q3/CSX-3Q24-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2024/q3/Q3-2024-QFR-FINAL.pdf",
  },
  "Q4 2024": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2024/q4/CSX-4Q24-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2024/q4/Q4-2024-QFR-FINAL.pdf",
  },
  "Q1 2025": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2025/q1/CSX-1Q25-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2025/q1/Q1-2025-QFR-Final.pdf",
  },
  "Q2 2025": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2025/q2/CSX-2Q25-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2025/q2/Q2-2025-QFR-Final.pdf",
  },
  "Q3 2025": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2025/q3/CSX-3Q25-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2025/q3/Q3-2025-QFR-Final.pdf",
  },
  "Q4 2025": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2025/q4/CSX-4Q25-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2025/q4/Q4-2025-QFR-Final.pdf",
  },
  "Q1 2026": {
    slides: "https://s2.q4cdn.com/859568992/files/doc_financials/2026/q1/CSX-1Q26-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/doc_financials/2026/q1/Q1-2026-QFR-Final.pdf",
  },
  "Q2 2026": {
    slides: "https://s2.q4cdn.com/859568992/files/content_files/CSX-2Q26-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/859568992/files/content_files/Q2-2026-QFR-Final.pdf",
  },
};

export function isCsxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isCsxIrPdf(href: string | null | undefined): boolean {
  if (!href || isCsxRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s2.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/859568992/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeCsxKnownQuarterDocs(): Map<string, CsxQuarterDocs> {
  return new Map(Object.entries(CSX_KNOWN_QUARTER_DOCS));
}
