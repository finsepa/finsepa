/**
 * HCA IR seed — 12-31.
 * HCA Healthcare calendar FY. Filings-only press on s23.q4cdn.com/949900249 (no quarterly decks). Latest Q2 2026. Scope stats: 0 green / 18 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type HcaQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const HCA_IR_PAGES = [
  "https://investor.hcahealthcare.com/",
] as const;

export const HCA_KNOWN_QUARTER_DOCS: Readonly<Record<string, HcaQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2022/q1/PR_HCA-Reports-1Q-2022-Results.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2022/q2/PR_HCA-Reports-2Q-2022-Results.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2022/q3/PR_HCA-Reports-3Q-2022-Results.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2022/q4/PR_HCA-Reports-4Q-2022-Results.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2023/q1/PR_HCA-Reports-1Q-Results.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2023/q2/PR_HCA_Reports_2Q_2023_Results.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2023/q3/PR_HCA-Reports-3Q-2023-Results.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2023/q4/FINAL-PR_HCA-Reports-4Q-2023-Results.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2024/q1/FINAL-PR_HCA-Reports-1Q-2024-Results.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2024/q2/FINAL-PR_HCA-Reports-2Q-2024-Results.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2024/q3/FINAL-PR_HCA-Reports-3Q-2024-Results.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2024/q4/FINAL-PR_HCA-Reports-4Q-2024-Results.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2025/q1/FINAL-PR_HCA-Reports-1Q-2025-Results.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2025/q2/FINAL-PR_HCA-Reports-2Q-2025-Results.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2025/q3/FINAL-PR_HCA-Reports-3Q-2025-Results.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2025/q4/FINAL-PR_HCA-Reports-4Q-2025-Results.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/doc_financials/2026/q1/FINAL-PR_HCA-Reports-1Q-2026-Results.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://s23.q4cdn.com/949900249/files/content_files/FINAL-PR_HCA-Reports-2Q-2026-Results.pdf",
  },
};

export function isHcaRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isHcaIrPdf(href: string | null | undefined): boolean {
  if (!href || isHcaRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s23.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/949900249/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeHcaKnownQuarterDocs(): Map<string, HcaQuarterDocs> {
  return new Map(Object.entries(HCA_KNOWN_QUARTER_DOCS));
}
