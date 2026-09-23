/**
 * SPOT IR seed — 12-31.
 * Spotify Technology SA — calendar FY. Hub: investors.spotify.com FinancialReport.svc. PDF host: s29.q4cdn.com/175625835. Slides = Shareholder Deck (Q2 2022+) / Shareholder Letter (Q1 2022) — Spotify's primary earnings presentation/update. Filings empty — no separate press/earnings-release PDF on IR (deck is the results document). Scope Q1 2022→Q2 2026 (0 green / 18 yellow / 0 red — slides-only yellow). Rejected Financial Statements / Form 6-K / 20-F / Prepared Remarks / webcast. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type SpotQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SPOT_IR_PAGES = [
  "https://investors.spotify.com/financials/default.aspx",
] as const;

export const SPOT_KNOWN_QUARTER_DOCS: Readonly<Record<string, SpotQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2022/q1/Shareholder-Letter-Q1-2022_FINAL.pdf",
    filings: null,
  },
  "Q2 2022": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_presentation/Q2-2022-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2022/q3/Q3-2022-Shareholder-Deck-FINAL-LOCKED.pdf",
    filings: null,
  },
  "Q4 2022": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2022/q4/Shareholder-Deck-Q4-2022-FINAL.pdf",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2023/Shareholder-Deck-Q1-2023-FINAL.pdf",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2023/q2/Shareholder-Deck-Q2-2023-FINAL.pdf",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2023/q3/Shareholder-Deck-Q3-2023-FINAL.pdf",
    filings: null,
  },
  "Q4 2023": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2023/q4/Shareholder-Deck-Q4-2023-FINAL.pdf",
    filings: null,
  },
  "Q1 2024": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2024/q1/Q1-2024-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q2 2024": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2024/q2/Q2-2024-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q3 2024": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2024/q3/Q3-2024-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q4 2024": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2024/q4/Q4-2024-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q1 2025": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2025/q1/Q1-2025-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q2 2025": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2025/q2/Q2-2025-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q3 2025": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2025/q3/Q3-2025-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q4 2025": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2025/q4/Q4-2025-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q1 2026": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2026/q1/Q1-2026-Shareholder-Deck-FINAL.pdf",
    filings: null,
  },
  "Q2 2026": {
    slides: "https://s29.q4cdn.com/175625835/files/doc_financials/2026/q2/Q2-2026-Shareholder-Deck-FINAL.pdf",
    filings: null,
  }
};

export function isSpotRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|prepared.?remarks|form.?6-?k|20-?f|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n) || /financial.?statements|prepared.?remarks/i.test(n);
}

export function isSpotIrPdf(href: string | null | undefined): boolean {
  if (!href || isSpotRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s29.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/175625835/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeSpotKnownQuarterDocs(): Map<string, SpotQuarterDocs> {
  return new Map(Object.entries(SPOT_KNOWN_QUARTER_DOCS));
}
