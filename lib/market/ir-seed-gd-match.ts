/**
 * GD IR seed — 12-31.
 * General Dynamics calendar FY. Slides=Highlights/Outlook; Filings=Exhibit 99.1/press on s22.q4cdn.com/891946778. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type GdQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const GD_IR_PAGES = [
  "https://investorrelations.gd.com/",
] as const;

export const GD_KNOWN_QUARTER_DOCS: Readonly<Record<string, GdQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2022/q1/GD_1Q22_Earnings_Highlights-FINAL.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2022/q1/General-Dynamics-Reports-First-Quarter-2022-Financial-Results.pdf",
  },
  "Q2 2022": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2022/q2/new/GD_2Q22_Earnings_Highlights-Outlook-Final.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2022/q2/General-Dynamics-Reports-Second-Quarter-2022-Financial-Results.pdf",
  },
  "Q3 2022": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2022/q3/GD-3Q22-Highlights-Final.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2022/q3/General-Dynamics-Reports-Third-Quarter-2022-Financial-Results.pdf",
  },
  "Q4 2022": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2022/q4/GD-4Q-and-Full-Year-2022-Highlights-Outlook-Final.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2022/q4/General-Dynamics-Reports-Q4-and-Full-Year-2022-Results-Final.pdf",
  },
  "Q1 2023": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2023/q1/GD-First-Quarter-2023-Highlights.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2023/q1/GD-Reports-First-Quarter-2023-Financial-Results.pdf",
  },
  "Q2 2023": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2023/q2/GD-2Q-2023-Highlights-and-Outlook-Final.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2023/q2/GD-Reports-Q2-2023-Results-Final.pdf",
  },
  "Q3 2023": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2023/q3/GD-3Q-2023-Highlights.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2023/q3/General-Dynamics-Reports-Third-Quarter-2023-Financial-Results.pdf",
  },
  "Q4 2023": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2023/q4/GD-4Q-and-Full-Year-2023-Highlights-Outlook.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2023/q4/GD-2023-12-31-Exhibit-99-1-Final-as-filed-Milestone-January-23-0439-pm.pdf",
  },
  "Q1 2024": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2024/q1/GD-1Q-2024-Highlights-Final.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2024/q1/GD-2024-03-31-Exhibit-99-1_04-22-24_03-07pm.pdf",
  },
  "Q2 2024": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2024/q2/GD-2Q-2024-Highlights-Outlook.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2024/q2/GD-2024_Exhibit-99-1_FINAL.pdf",
  },
  "Q3 2024": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2024/q3/GD-3Q-2024-Highlights-and-Outlook-Update.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2024/q3/GD-2024-09-29-Exhibit-99-1.pdf",
  },
  "Q4 2024": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2024/q4/GD-4Q-and-Full-Year-2024-Highlights-Outlook.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2024/q4/GD-4Q-Press-Release.pdf",
  },
  "Q1 2025": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2025/q1/GD-1Q-2025-Highlights.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2025/q1/GD-2025-03-30-Exhibit-99-1.pdf",
  },
  "Q2 2025": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_presentations/GD-2Q-2025-Highlights-Outlook.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2025/q2/GD-2025-06-29-Exhibit-99-1.pdf",
  },
  "Q3 2025": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2025/q3/GD-3Q-2025-Highlights-Outlook.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2025/q3/GD-2025-09-28-Exhibit-99-1.pdf",
  },
  "Q4 2025": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2025/q4/2025-Highlights-Outlook.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2025/q4/GD-2025-12-31-Exhibit-99-1-Final.pdf",
  },
  "Q1 2026": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2026/q1/1Q26-Highlights-Final.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2026/q1/GD-2026-04-05-Exhibit-99-1.pdf",
  },
  "Q2 2026": {
    slides: "https://s22.q4cdn.com/891946778/files/doc_financials/2026/q2/2Q26-Highlights-and-Outlook.pdf",
    filings: "https://s22.q4cdn.com/891946778/files/doc_financials/2026/q2/GD-2026-07-05-Exhibit-99-1.pdf",
  },
};

export function isGdRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isGdIrPdf(href: string | null | undefined): boolean {
  if (!href || isGdRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s22.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/891946778/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeGdKnownQuarterDocs(): Map<string, GdQuarterDocs> {
  return new Map(Object.entries(GD_KNOWN_QUARTER_DOCS));
}
