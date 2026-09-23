/**
 * TT IR seed — 12-31.
 * Trane Technologies calendar FY. Slides=Earnings Deck/Presentation; Filings=Earnings Release on s2.q4cdn.com/950394465. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type TtQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const TT_IR_PAGES = [
  "https://investors.tranetechnologies.com/",
] as const;

export const TT_KNOWN_QUARTER_DOCS: Readonly<Record<string, TtQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2022/q1/Q1-2022-Earnings-Deck-FINAL.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2022/q1/Exhibit-99.1-Q1-2022-Earnings-Release.pdf",
  },
  "Q2 2022": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2022/q2/Q2-2022-Earnings-Deck-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2022/q2/Q2-2022-Earnings-Release-Final.pdf",
  },
  "Q3 2022": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2022/q3/Q3-2022-Earnings-Deck-FINAL-11.1.22.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2022/q3/Q3-2022-Earnings-Release-11.1.22-FINAL.pdf",
  },
  "Q4 2022": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2022/q4/Q4-2022-Earnings-Deck-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2022/q4/Q4-2022-Earnings-Release-Final.pdf",
  },
  "Q1 2023": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2023/q1/Q1-2023-Earnings-Deck-Final-05-01-23.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2023/q1/Q1-2023-Earnings-Release-FINAL-05-02-23.pdf",
  },
  "Q2 2023": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2023/q2/Q2-2023-Earnings-Deck-Final-08-01-23-FINAL.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2023/q2/Q2-2023-Earnings-Release-8-01-23-FINAL.pdf",
  },
  "Q3 2023": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2023/q3/Q3-2023-Earnings-Deck-10-30-23-FINAL.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2023/q3/Q3-2023-Earnings-Release-Final.pdf",
  },
  "Q4 2023": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2023/q4/Q4-2023-Earnings-Deck.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2023/q4/Q4-2023-Earnings-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2024/q1/Q1-2024-Earnings-Deck-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2024/q1/Q1-2024-Earnings-Release-FINAL.pdf",
  },
  "Q2 2024": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2024/q2/Q2-2024-Earnings-Deck-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2024/q2/Q2-2024-Earnings-Release-Final.pdf",
  },
  "Q3 2024": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2024/q3/Q3-2024-Earnings-Deck-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2024/q3/Q3-2024-Earnings-Release-Final.pdf",
  },
  "Q4 2024": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2024/q4/Q4-2024-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2024/q4/Q4-2024-Earnings-Release-Final.pdf",
  },
  "Q1 2025": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2025/q1/Q1-2025-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2025/q1/Q1-2025-Earnings-Release-Final.pdf",
  },
  "Q2 2025": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2025/q2/Q2-2025-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2025/q2/Q2-2025-Earnings-Release-Final.pdf",
  },
  "Q3 2025": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2025/q3/Q3-2025-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2025/q3/Q3-2025-Earnings-Release-Final.pdf",
  },
  "Q4 2025": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2025/q4/v2/Q4-2025-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2025/q4/Q4-2025-Earnings-Release-Final.pdf",
  },
  "Q1 2026": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2026/q1/Q1-2026-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2026/q1/Q1-2026-Earnings-Release-Final.pdf",
  },
  "Q2 2026": {
    slides: "https://s2.q4cdn.com/950394465/files/doc_financials/2026/q2/Q2-2026-Earnings-Presentation-Final.pdf",
    filings: "https://s2.q4cdn.com/950394465/files/doc_financials/2026/q2/Q2-2026-Earnings-Release-Final.pdf",
  },
};

export function isTtRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isTtIrPdf(href: string | null | undefined): boolean {
  if (!href || isTtRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s2.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/950394465/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeTtKnownQuarterDocs(): Map<string, TtQuarterDocs> {
  return new Map(Object.entries(TT_KNOWN_QUARTER_DOCS));
}
