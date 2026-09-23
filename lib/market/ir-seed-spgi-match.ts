/**
 * S&P Global (SPGI) IR — calendar FY.
 * Slides = Earnings Call Slides; Filings = Earnings Release PDF.
 * Host: s29.q4cdn.com/690959130. Never supplemental / xlsx / webcast / proxy / SEC HTML.
 */

export type SpgiQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SPGI_IR_PAGES = [
  "https://investor.spglobal.com/financials/quarterly-results/default.aspx",
] as const;

/** Catalog Q1 2022 → Q2 2026 (Q3 2026 not yet published). */
export const SPGI_KNOWN_QUARTER_DOCS: Readonly<Record<string, SpgiQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2022/q1/SP-Global-1Q22-Earnings-Slides-5-3-2022.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2022/q1/S-P-Global-1Q-2022-Earnings-Release-and-Exhibits-5-3-2022.pdf",
  },
  "Q2 2022": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2022/q2/SPGI-2Q-2022-Earnings-Call-Slides-8-2-2022.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2022/q2/S-P-Global-2Q-2022-Earnings-Release-and-Exhibits-8-2-2022.pdf",
  },
  "Q3 2022": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2022/q3/S-P-Global-3Q-2022-Earnings-Call-Slides-10-27-2022.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2022/q3/S-P-Global-3Q-2022-Earnings-Release-and-Exhibits-10-27-2022.pdf",
  },
  "Q4 2022": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2022/q4/S-P-Global-4Q-and-Full-Year-2022-Earnings-Call-Slides-2-9-2023.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2022/q4/S-P-Global-4Q-Full-Year-2022-Earnings-Release-and-Exhibits.pdf",
  },
  "Q1 2023": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2023/q1/S-P-Global-1Q-2023-Earnings-Call-Slides-4-27-2023.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2023/q1/S-P-Global-1Q-2023-Earnings-Release-and-Exhibits-4-27-2023.pdf",
  },
  "Q2 2023": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2023/q2/new-s-p-global-2q-2023-earnings-call-slides-7-27-2023.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2023/q2/S-P-Global-2Q-2023-Earnings-Release-Exhibits-7-27-2023e.pdf",
  },
  "Q3 2023": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2023/q3/11/S-P-Global-3Q-2023-Earnings-Call-Slides-11-2-2023.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2023/q3/11/S-P-Global-3Q-2023-Earnings-Release-Exhibits-11-2-2023.pdf",
  },
  "Q4 2023": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2023/q4/S-P-Global-4Q-FY-2023-Earnings-Call-Slides.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2023/q4/S-P-Global-4Q-and-FY-2023-Earnings-Release-and-Exhibits-2-8-2024.pdf",
  },
  "Q1 2024": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2024/q1/s-p-global-1q-2024-earnings-call-slides-4-25-2024r.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2024/q1/sp-global-1q-2024-earnings-release-exhibits-4-25-2024.pdf",
  },
  "Q2 2024": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2024/q2/S-P-Global-2Q-2024-Earnings-Call-Slides-7-30-2024.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2024/q2/S-P-GIobal-2Q-2024-Earnings-Release-Exhibits-7-30-2024.pdf",
  },
  "Q3 2024": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2024/q3/S-P-Global-3Q-2024-Earnings-Call-Slides-10-24-2024.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2024/q3/S-P-Global-3Q-2024-Earnings-Release-Exhibits-10-24-2024.pdf",
  },
  "Q4 2024": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2024/q4/S-P-Global-4Q-and-Full-Year-2024-Earnings-Call-Slides-2-11-2025.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2024/q4/S-P-Global-4Q-and-Full-Year-2024-Earnings-Release-Exhibits-2-11-2025.pdf",
  },
  "Q1 2025": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2025/q1/S-P-Global-1Q-2025-Earnings-Call-Slides-4-29-2025.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2025/q1/S-P-Global-1Q-2025-Earnings-Release-4-29-2025.pdf",
  },
  "Q2 2025": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2025/q2/S-P-Global-2Q-2025-Earnings-Call-Slides-7-31-2025.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2025/q2/S-P-Global-2Q-2025-Earnings-Release-and-Exhibits-7-31-2025.pdf",
  },
  "Q3 2025": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2025/q3/S-P-Global-3Q-2025-Earnings-Call-Slides-10-30-2025.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2025/q3/S-P-Global-3Q-2025-Earnings-Release-Exhibits-10-30-2025.pdf",
  },
  "Q4 2025": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2025/q4/S-P-Global-4Q-FY-2025-Earnings-Call-Slides-2-10-2026.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2025/q4/S-P-Global-4Q-FY-2025-Earnings-Release-Exhibits-2-10-2026.pdf",
  },
  "Q1 2026": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2026/q1/NEW-PDF-S-P-Global-1Q-2026-Earnings-Call-Slides-4-28-2026r.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2026/q1/S-P-Global-1Q-2026-Earnings-Release-Exhibits-4-28-2026.pdf",
  },
  "Q2 2026": {
    slides: "https://s29.q4cdn.com/690959130/files/doc_financials/2026/q2/S-P-Global-2Q-2026-Earnings-Call-Slides-7-28-2026.pdf",
    filings: "https://s29.q4cdn.com/690959130/files/doc_financials/2026/q2/S-P-Global-2Q-2026-Earnings-Release-and-Exhibits-7-28-2026.pdf",
  },
};

export function isSpgiRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplemental|monthly.metrics|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isSpgiIrPdf(href: string | null | undefined): boolean {
  if (!href || isSpgiRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s29.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/690959130/")) return false;
    return /\.(?:pdf)(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeSpgiKnownQuarterDocs(): Map<string, SpgiQuarterDocs> {
  return new Map(Object.entries(SPGI_KNOWN_QUARTER_DOCS));
}
