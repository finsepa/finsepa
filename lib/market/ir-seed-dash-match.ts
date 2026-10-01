/**
 * DASH IR seed — 12-31.
 * DoorDash calendar FY. Slides=Shareholder Letter (Ex.99.2); Filings=Earnings Press Release on s22.q4cdn.com/280253921. Q1–Q2 2022 slides-only (no press PDF on CDN). Q1–Q3 2024 and Q1–Q3 2025 + Q1–Q2 2026 filings-only (shareholder letter PDF not on current CDN paths). Reject Financials/Financial-Statements tables / transcripts / 10-Q. Range-GET %PDF verified. Scope: 8g / 10y / 0r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type DashQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const DASH_IR_PAGES = [
  "https://ir.doordash.com/financials/quarterly-results/default.aspx",
] as const;

export const DASH_KNOWN_QUARTER_DOCS: Readonly<Record<string, DashQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2022/q1/DASH-Q1-2022-Shareholder-Letter_FINAL.pdf",
    filings: null,
  },
  "Q2 2022": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2022/q2/DASH-Q2-2022-Shareholder-Letter_FINAL.pdf",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2022/q3/DASH-Q3-2022-Shareholder-Letter_FINAL.pdf",
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2022/q3/DASH-Q3-2022_Earnings-Press-Release_FINAL.pdf",
  },
  "Q4 2022": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2022/q4/DASH_Q4-2022-Shareholder-Letter_FINAL.pdf",
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2022/q4/DASH_Q4-2022-Earnings-Press-Release_FINAL.pdf",
  },
  "Q1 2023": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2023/q1/DASH-Q1-2023_Shareholder-Letter.pdf",
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2023/q1/DASH-Q1-2023_Earnings-Press-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2023/q2/DASH-Q2-2023_Shareholder-Letter.pdf",
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2023/q2/DASH-Q2-23_Earnings-Press-Release.pdf",
  },
  "Q3 2023": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2023/q3/DASH-Q3-23-Shareholder-Letter.pdf",
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2023/q3/DASH-Q3-23-Earnings-Press-Release.pdf",
  },
  "Q4 2023": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2023/q4/DASH-Q4-23-Shareholder-Letter.pdf",
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2023/q4/DASH-Q4-23-Earnings-Press-Release.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2024/q1/DASH-Q1-24-Earnings-Press-Release.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2024/q2/DASH-Q2-24-Earnings-Press-Release.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2024/q3/DASH-Q3-2024-Ex-99-1-Press-release.pdf",
  },
  "Q4 2024": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2024/q4/DASH-Q4-2024-Ex-99-2-Shareholder-letter.pdf",
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2024/q4/DASH-Q4-2024-Ex-99-1-Press-release.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2025/q1/Q1-2025-Earnings-Press-Release.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2025/q2/Q2-2025-Earnings-Press-Release.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2025/q3/Q3-2025-Earnings-Press-Release.pdf",
  },
  "Q4 2025": {
    slides: "https://s22.q4cdn.com/280253921/files/doc_financials/2025/q4/Q4-2025-Shareholder-Letter.pdf",
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2025/q4/Q4-2025-Earnings-Press-Release.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2026/q1/Q1-2026-Earnings-Press-Release.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://s22.q4cdn.com/280253921/files/doc_financials/2026/q2/Q2-2026-Earnings-Press-Release.pdf",
  },
};

export function isDashRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isDashIrPdf(href: string | null | undefined): boolean {
  if (!href || isDashRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s22.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/280253921/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeDashKnownQuarterDocs(): Map<string, DashQuarterDocs> {
  return new Map(Object.entries(DASH_KNOWN_QUARTER_DOCS));
}
