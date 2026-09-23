/**
 * ADP IR seed — 06-30.
 * ADP June 30 FY (not calendar). Labels = issuer fiscal Q1–Q4 (Q1 ends Sep 30, Q2 Dec 31, Q3 Mar 31, Q4 Jun 30). Hub: investors.adp.com FinancialReport.svc. PDF host: s205.q4cdn.com/887941133. Slides = DocumentCategory presentation (*Earnings-Deck* / *Earnings-Presentation*). Filings = DocumentCategory news (*Earnings-Release*). Scope Q1 2022→Q4 2026 (20 green / 0 yellow / 0 red). Rejected transcript / infographic / 10-Q / 10-K / Cloudfront SEC mirrors. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type AdpQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ADP_IR_PAGES = [
  "https://investors.adp.com/financials/quarterly-results/default.aspx",
] as const;

export const ADP_KNOWN_QUARTER_DOCS: Readonly<Record<string, AdpQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2022/q1/1Q22-ADP-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2022/q1/1Q22-ADP-Earnings-Release.pdf",
  },
  "Q2 2022": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2022/q2/ADP-2Q22-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2022/q2/ADP-2Q22-Earnings-Release.pdf",
  },
  "Q3 2022": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2022/q3/ADP-3Q22-Earnings-Presentation.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2022/q3/ADP-3Q22-Earnings-Release.pdf",
  },
  "Q4 2022": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2022/q4/ADP-4Q22-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2022/q4/ADP-4Q22-Earnings-Release.pdf",
  },
  "Q1 2023": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2023/q1/ADP-1Q23-Earnings-Presentation.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2023/q1/ADP-1Q23-Earnings-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2023/q2/ADP-2Q23-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2023/q2/ADP-2Q23-Earnings-Release.pdf",
  },
  "Q3 2023": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2023/q3/ADP-3Q23-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2023/q3/ADP-3Q23-Earnings-Release.pdf",
  },
  "Q4 2023": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2023/q4/ADP-4Q23-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2023/q4/ADP-4Q23-Earnings-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2024/q1/ADP-1Q24-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2024/q1/ADP-1Q24-Earnings-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2024/q2/ADP-2Q24-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2024/q2/ADP-2Q24-Earnings-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2024/q3/ADP-3Q24-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2024/q3/ADP-3Q24-Earnings-Release.pdf",
  },
  "Q4 2024": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2024/q4/ADP-4Q24-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2024/q4/ADP-4Q24-Earnings-Release.pdf",
  },
  "Q1 2025": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2025/q1/ADP-1Q25-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2025/q1/ADP-1Q25-Earnings-Release.pdf",
  },
  "Q2 2025": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2025/q2/ADP-2Q25-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2025/q2/ADP-2Q25-Earnings-Release.pdf",
  },
  "Q3 2025": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2025/q3/ADP-3Q25-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2025/q3/ADP-3Q25-Earnings-Release.pdf",
  },
  "Q4 2025": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2025/q4/ADP-_-4Q25-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2025/q4/ADP-4Q25-Earnings-Release.pdf",
  },
  "Q1 2026": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2026/q1/ADP-1Q26-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2026/q1/ADP-1Q26-Earnings-Release.pdf",
  },
  "Q2 2026": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2026/q2/ADP-2Q26-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2026/q2/ADP-2Q26-Earnings-Release.pdf",
  },
  "Q3 2026": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2026/q3/ADP-3Q26-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2026/q3/ADP-3Q26-Earnings-Release.pdf",
  },
  "Q4 2026": {
    slides: "https://s205.q4cdn.com/887941133/files/doc_financials/2026/q4/ADP-4Q26-Earnings-Deck.pdf",
    filings: "https://s205.q4cdn.com/887941133/files/doc_financials/2026/q4/ADP-4Q26-Earnings-Release.pdf",
  }
};

export function isAdpRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|prepared.?remarks|form.?6-?k|20-?f|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n) || /infographic/i.test(n);
}

export function isAdpIrPdf(href: string | null | undefined): boolean {
  if (!href || isAdpRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s205.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/887941133/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAdpKnownQuarterDocs(): Map<string, AdpQuarterDocs> {
  return new Map(Object.entries(ADP_KNOWN_QUARTER_DOCS));
}
