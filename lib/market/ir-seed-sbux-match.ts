/**
 * SBUX IR seed — late September (fiscal year ends ~Sep 28–30; not calendar).
 * Starbucks Sept FY (IR labels Q1–Q4 FY). Hub FinancialReport.svc. Slides=DocumentCategory presentation (Earnings at a Glance). Filings=DocumentCategory news (Earnings Release). Ignore transcript/10-Q/10-K. Scope Q1 FY2022→Q3 FY2026 (Q4 FY2026 not yet; ~Oct 29 2026). Q1–Q3 FY2022 lack glance decks (filings-only yellow). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type SbuxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SBUX_IR_PAGES = [
  "https://investor.starbucks.com/financials/quarterly-results/default.aspx",
] as const;

export const SBUX_KNOWN_QUARTER_DOCS: Readonly<Record<string, SbuxQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2022/q1/Q1-FY22-Earnings-Release_2-1-22_Final.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2022/q2/Q2-FY22-Earnings-Release-5_3_2022-Final.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2022/q3/Q3-FY22-Earnings-Release-Final-to-Q4.pdf",
  },
  "Q4 2022": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2022/q4/Q4-22-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2022/q4/Q4-FY22-Earnings-Release-Final-11-3-2022.pdf",
  },
  "Q1 2023": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2023/q1/q1-23-earning-by-glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2023/q1/1Q23-Earnings-Release-Final-2-2.pdf",
  },
  "Q2 2023": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2023/q2/Q2-Fiscal-2023-Earnings-at-a-Glance_Final.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2023/q2/2Q23-Final-Earnings-Release-5-2-23.pdf",
  },
  "Q3 2023": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2023/q3/Q3-Fiscal-2023-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2023/q3/3Q23-Earnings-Release-Final-8-1-23.pdf",
  },
  "Q4 2023": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2023/q4/Q423-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2023/q4/4Q23-Earnings-Release-Final-11-1-23.pdf",
  },
  "Q1 2024": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2024/q1/Q1-FY24-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2024/q1/1Q24-Earnings-Release-Final-1-30-24.pdf",
  },
  "Q2 2024": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2024/q2/Q2-FY24-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2024/q2/2Q24-Earnings-Release-Final-4-30-24.pdf",
  },
  "Q3 2024": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2024/q3/Q3-FY24-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2024/q3/3Q24-Earnings-Release-Final-7-30-24.pdf",
  },
  "Q4 2024": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2024/q4/Q4-and-Full-FY24-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2024/q4/Q4-and-Full-FY24-Earnings-Release-Final-10-30-24.pdf",
  },
  "Q1 2025": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2025/q1/Q1-FY25-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2025/q1/SBUX-12-29-2024-Exhibit-99-1.pdf",
  },
  "Q2 2025": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2025/q2/Q2-FY25-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2025/q2/SBUX-3-30-2025-Exhibit-99-1.pdf",
  },
  "Q3 2025": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2025/q3/Q3-FY25-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2025/q3/SBUX-06-29-2025-Exhibit-99-1-1.pdf",
  },
  "Q4 2025": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2025/q4/Q4-and-Full-FY25-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2025/q4/SBUX-09-28-2025-Exhibit-99-1.pdf",
  },
  "Q1 2026": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2026/q1/Q1-FY26-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2026/q1/SBUX-12-28-2025-Earnings-Release-Exhibit-99-1-6pm.pdf",
  },
  "Q2 2026": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2026/q2/Q2-FY26-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2026/q2/2Q26-Earnings-Release-Final.pdf",
  },
  "Q3 2026": {
    slides: "https://s203.q4cdn.com/326826266/files/doc_financials/2026/q3/Q3-FY26-Earnings-at-a-Glance.pdf",
    filings: "https://s203.q4cdn.com/326826266/files/doc_financials/2026/q3/3Q26-Earnings-Release-2026-07-29-FINAL.pdf",
  }
};

export function isSbuxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isSbuxIrPdf(href: string | null | undefined): boolean {
  if (!href || isSbuxRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s203.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/326826266/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeSbuxKnownQuarterDocs(): Map<string, SbuxQuarterDocs> {
  return new Map(Object.entries(SBUX_KNOWN_QUARTER_DOCS));
}
