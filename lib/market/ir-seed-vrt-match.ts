/**
 * VRT IR seed — 12-31.
 * Vertiv Holdings (VRT) calendar FY — CNQ replacement. Slides=Results Presentation; Filings=Earnings Release on s205.q4cdn.com/554782763. Q4 2024 slides-only (HTML press). Latest Q2 2026. Scope stats: 17 green / 1 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type VrtQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const VRT_IR_PAGES = [
  "https://investors.vertiv.com/",
] as const;

export const VRT_KNOWN_QUARTER_DOCS: Readonly<Record<string, VrtQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2022/q1/Vertiv-First-Quarter-2022-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2022/q1/Vertiv-First-Quarter-2022-Earnings-Release.pdf",
  },
  "Q2 2022": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2022/q2/Vertiv-Second-Quarter-2022-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2022/q2/Vertiv-Second-Quarter-2022-Earnings-Release.pdf",
  },
  "Q3 2022": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2022/q3/Vertiv-Third-Quarter-2022-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2022/q3/Vertiv-Third-Quarter-2022-Earnings-Release.pdf",
  },
  "Q4 2022": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2022/q4/Vertiv-Fourth-Quarter-and-Full-Year-2022-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2022/q4/Vertiv-Fourth-Quarter-and-Full-Year-2022-Earnings-Release.pdf",
  },
  "Q1 2023": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2023/q1/Vertiv-First-Quarter-2023-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2023/q1/Vertiv-First-Quarter-2023-Earnings-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2023/q2/Vertiv-Second-Quarter-2023-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2023/q2/Vertiv-Second-Quarter-2023-Earnings-Release.pdf",
  },
  "Q3 2023": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2023/q3/Vertiv-Third-Quarter-2023-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2023/q3/Vertiv-Third-Quarter-2023-Earnings-Release.pdf",
  },
  "Q4 2023": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2023/q4/Vertiv-Fourth-Quarter-and-Full-Year-2023-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2023/q4/Vertiv-Fourth-Quarter-and-Full-Year-2023-Earnings-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2024/q1/Vertiv-First-Quarter-2024-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2024/q1/Vertiv-First-Quarter-2024-Earnings-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2024/q2/Vertiv-Second-Quarter-2024-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2024/q2/Vertiv-Second-Quarter-2024-Earnings-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2024/q3/Vertiv-Third-Quarter-2024-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2024/q3/Vertiv-Third-Quarter-2024-Earnings-Release.pdf",
  },
  "Q4 2024": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2024/q4/Vertiv-Fourth-Quarter-2024-Results-Presentation.pdf",
    filings: null,
  },
  "Q1 2025": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2025/q1/Vertiv-First-Quarter-2025-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2025/q1/Vertiv-First-Quarter-2025-Earnings-Release.pdf",
  },
  "Q2 2025": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2025/q2/Vertiv-Second-Quarter-2025-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2025/q2/Vertiv-Second-Quarter-2025-Earnings-Release.pdf",
  },
  "Q3 2025": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2025/q3/Vertiv-Third-Quarter-2025-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2025/q3/Vertiv-Third-Quarter-2025-Earnings-Release.pdf",
  },
  "Q4 2025": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2025/q4/Vertiv_Fourth-Quarter-2025-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2025/q4/Vertiv_Fourth-Quarter-2025-Earnings-Release.pdf",
  },
  "Q1 2026": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2026/q1/Vertiv-First-Quarter-2026-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2026/q1/Vertiv-First-Quarter-2026-Earnings-Release.pdf",
  },
  "Q2 2026": {
    slides: "https://s205.q4cdn.com/554782763/files/doc_financials/2026/q2/Vertiv-Second-Quarter-2026-Results-Presentation.pdf",
    filings: "https://s205.q4cdn.com/554782763/files/doc_financials/2026/q2/Vertiv-Second-Quarter-2026-Earnings-Release.pdf",
  },
};

export function isVrtRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|esg|form.?10/i.test(n);
}

export function isVrtIrPdf(href: string | null | undefined): boolean {
  if (!href || isVrtRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s205.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/554782763/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeVrtKnownQuarterDocs(): Map<string, VrtQuarterDocs> {
  return new Map(Object.entries(VRT_KNOWN_QUARTER_DOCS));
}
