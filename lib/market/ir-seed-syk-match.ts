/**
 * SYK IR seed — 12-31.
 * Stryker calendar FY. Hub investors.stryker.com (Q4 FinancialReport + Event feeds). Slides=null: no quarterly earnings deck in IR (events attach Press Release only; Investor Day / conference decks are not earnings slides; skip Change-in-Presentation.pdf). Filings=Press Release PDF under files/doc_financials/{year}/q{n}/ from Q1 2023→Q2 2026. Q1–Q4 2022: feed links HTML press-releases/news-details only (no PDF) — leave empty (red). Never 10-Q/10-K. Scope Q1 2022→Q2 2026. 0 green / 14 yellow / 4 red. Filings Range-GET %PDF. Ticker YELLOW.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type SykQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SYK_IR_PAGES = [
  "https://investors.stryker.com/",
] as const;

export const SYK_KNOWN_QUARTER_DOCS: Readonly<Record<string, SykQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: null,
    filings: null,
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: null,
    filings: null,
  },
  "Q1 2023": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2023/q1/Q1-23-Earnings-Press-Release-for-Website.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2023/q2/04/Q2-2023-Earnings-Press-Release-Final.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2023/q3/11/Q3-23-Earnings-Press-Release.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2023/q4/q4-23-earnings-press-release.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2024/q1/24-08.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2024/q2/24-11.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2024/q3/Q3-24-Earnings-Press-Release.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2024/q4/25-06-1.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2025/q1/Q1-25-Earnings-Press-Release.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2025/q2/25-19.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2025/q3/Q3-25-Earnings-Press-Release.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2025/q4/26-02.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2026/q1/Q1-26-Earnings-Press-Release.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://s22.q4cdn.com/857738142/files/doc_financials/2026/q2/Q2-26-Earnings-Press-Release-07-30-2026.pdf",
  }
};

export function isSykRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isSykIrPdf(href: string | null | undefined): boolean {
  if (!href || isSykRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s22.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/857738142/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeSykKnownQuarterDocs(): Map<string, SykQuarterDocs> {
  return new Map(Object.entries(SYK_KNOWN_QUARTER_DOCS));
}
