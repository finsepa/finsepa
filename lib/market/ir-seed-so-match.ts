/**
 * SO IR seed — 12-31.
 * Southern Company calendar FY. Slides=earnings call presentation; Filings=press release on s27.q4cdn.com/273397814. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type SoQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SO_IR_PAGES = [
  "https://investor.southerncompany.com/",
] as const;

export const SO_KNOWN_QUARTER_DOCS: Readonly<Record<string, SoQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2022/q1/SO-2022-Q1-Earnings-Call-FINAL.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2022/q1/1Q22-Earnings-Press-Release-FINAL.pdf",
  },
  "Q2 2022": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2022/q2/SO-2022-Q2-Earnings-Call-FINAL.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2022/q2/2Q22-Earnings-Press-Release-FINAL.pdf",
  },
  "Q3 2022": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2022/q3/SO-2022-Q3-Earnings-Call-vF2.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2022/q3/Earnings-Release-Q3-2022-IR.pdf",
  },
  "Q4 2022": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2022/q4/SO-2022-Q4-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2022/q4/Earnings-Release-Q4-2022-IR.pdf",
  },
  "Q1 2023": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2023/q1/SO-2023-Q1-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2023/q1/1Q23-Earnings-Press-Release-FINAL-003.pdf",
  },
  "Q2 2023": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2023/q2/SO-2023-Q2-Earnings-Call-vF.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2023/q2/2Q23-Earnings-Press-Release-FINAL.pdf",
  },
  "Q3 2023": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2023/q3/Q3/SO-2023-Q3-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2023/q3/3Q23-Earnings-Press-Release-FINAL.pdf",
  },
  "Q4 2023": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2023/q4/SO-2023-Q4-Earnings-Call-vF-2.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2023/q4/4Q23-Earnings-Press-Release-FINAL.pdf",
  },
  "Q1 2024": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2024/q1/SO-2024-Q1-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2024/q1/Earnings-Press-Release-1Q24-FINAL-Revised.pdf",
  },
  "Q2 2024": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2024/q2/SO-2024-Q2-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2024/q2/Earnings-Press-Release-2Q24-FINAL.pdf",
  },
  "Q3 2024": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2024/q3/v4/SO-2024-Q3-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2024/q3/Earnings-Press-Release-3Q24-Final.pdf",
  },
  "Q4 2024": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2024/q4/SO-2024-Q4-Earnings-Call-Slides-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2024/q4/Press-Release-Q4-2024-FINAL-2-20-25.pdf",
  },
  "Q1 2025": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2025/q1/SO-2025-Q1-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2025/q1/Final-Press-Release-Q1-2025-Draft-4-30-25.pdf",
  },
  "Q2 2025": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2025/q2/SO-2025-Q2-Earnings-Call-FINAL.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2025/q2/Press-Release-Q2-2025-Draft.pdf",
  },
  "Q3 2025": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2025/q3/SO-2025-Q3-Earnings-Call-FINAL.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2025/q3/Press-Release-Q3-2025-FINAL-003.pdf",
  },
  "Q4 2025": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2025/q4/SO-2025-Q4-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2025/q4/Press-Release-Q4-2025-Draft-2-18-26-FINAL-002.pdf",
  },
  "Q1 2026": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2026/q1/SO-2026-Q1-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2026/q1/Press-Release-Q1-Earnings-2026-FINAL.pdf",
  },
  "Q2 2026": {
    slides: "https://s27.q4cdn.com/273397814/files/doc_financials/2026/q2/SO-2026-Q2-Earnings-Call-Final.pdf",
    filings: "https://s27.q4cdn.com/273397814/files/doc_financials/2026/q2/2Q26-Earnings-Release-FINAL-07302026.pdf",
  },
};

export function isSoRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|10-?q|10-?k|form.?10|fact.?sheet|sustainab/i.test(n);
}

export function isSoIrPdf(href: string | null | undefined): boolean {
  if (!href || isSoRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s27.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!(u.pathname.includes("/273397814/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeSoKnownQuarterDocs(): Map<string, SoQuarterDocs> {
  return new Map(Object.entries(SO_KNOWN_QUARTER_DOCS));
}
