/**
 * ABNB IR seed — 12-31.
 * Airbnb calendar FY. Slides=Shareholder Letter on s26.q4cdn.com/656283129; Filings empty (HTML press only). Latest Q2 2026. Scope stats: 0 green / 18 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type AbnbQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ABNB_IR_PAGES = [
  "https://investors.airbnb.com/",
] as const;

export const ABNB_KNOWN_QUARTER_DOCS: Readonly<Record<string, AbnbQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2022/q1/Airbnb_Q1-2022-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q2 2022": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2022/q2/Airbnb_Q2-2022-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2022/q3/Airbnb_Q3-2022-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q4 2022": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2022/q4/Airbnb_Q4-2022-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2023/q1/Airbnb_Q1-2023-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2023/q2/Airbnb_Q2-2023-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2023/q3/Airbnb_Q3-2023-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q4 2023": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2023/q4/Airbnb_Q4-2023-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q1 2024": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2024/q1/Airbnb_Q1-2024-Shareholder-Letter_Final-1.pdf",
    filings: null,
  },
  "Q2 2024": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2024/q2/Airbnb_Q2-2024-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q3 2024": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2024/q3/Airbnb_Q3-2024-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q4 2024": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2024/q4/Airbnb_Q4-2024-Shareholder-Letter_Final.pdf",
    filings: null,
  },
  "Q1 2025": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2025/q1/Airbnb_Q1-2025-Shareholder-Letter.pdf",
    filings: null,
  },
  "Q2 2025": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2025/q2/Airbnb_Q2-2025-Shareholder-Letter.pdf",
    filings: null,
  },
  "Q3 2025": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2025/q3/v2/Airbnb_Q3-2025-Shareholder-Letter.pdf",
    filings: null,
  },
  "Q4 2025": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2025/q4/Airbnb_Q4-2025-Shareholder-Letter-Final.pdf",
    filings: null,
  },
  "Q1 2026": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2026/q1/Airbnb_Q1-2026-Shareholder-Letter-FINAL.pdf",
    filings: null,
  },
  "Q2 2026": {
    slides: "https://s26.q4cdn.com/656283129/files/doc_financials/2026/q2/v2/Airbnb-Q2-2026-Shareholder-Letter.pdf",
    filings: null,
  },
};

export function isAbnbRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|10-?q|10-?k|form.?10|webcast|transcript/i.test(n);
}

export function isAbnbIrPdf(href: string | null | undefined): boolean {
  if (!href || isAbnbRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s26.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!(u.pathname.includes("/656283129/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAbnbKnownQuarterDocs(): Map<string, AbnbQuarterDocs> {
  return new Map(Object.entries(ABNB_KNOWN_QUARTER_DOCS));
}
