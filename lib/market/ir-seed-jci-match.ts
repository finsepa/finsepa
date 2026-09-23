/**
 * JCI IR seed — 09-30.
 * Johnson Controls International Sept FY. Slides=Earnings Presentation/slides; Filings=Press/Earnings Release on s21.q4cdn.com/502874060 (doc_financials + doc_earnings). FinancialReport.svc. Reject 10-Q/10-K/transcript/XBRL. Never SEC HTML. Scope: Ng=19 / Ny=0 / Nr=0. Range-GET %PDF verified.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type JciQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const JCI_IR_PAGES = [
  "https://investors.johnsoncontrols.com/news-events/earnings",
] as const;

export const JCI_KNOWN_QUARTER_DOCS: Readonly<Record<string, JciQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2022/q1/johnson-controls-q122-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2022/q1/johnson-controls-q122-earnings-release.pdf",
  },
  "Q2 2022": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2022/q2/johnson-controls-q222-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2022/q2/johnson-controls-q222-earnings-release-v1.pdf",
  },
  "Q3 2022": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2022/q3/johnson-controls-q322-earnings-slides-v1-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2022/q3/johnson-controls-q322-earnings-release.pdf",
  },
  "Q4 2022": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2022/q4/johnson-controls-q422-earnings-slides-final-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2022/q4/johnson-controls-q422-earnings-release.pdf",
  },
  "Q1 2023": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2023/q1/johnson-controls-q123-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2023/q1/johnson-controls-q123-earnings-release.pdf",
  },
  "Q2 2023": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2023/q2/johnson-controls-q223-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2023/q2/johnson-controls-q223-earnings-release.pdf",
  },
  "Q3 2023": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2023/q3/q323-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2023/q3/q323-earnings-release.pdf",
  },
  "Q4 2023": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2023/q4/johnson-controls-q423-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2023/q4/johnson-controls-q423-earnings-release.pdf",
  },
  "Q1 2024": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2024/q1/johnson-controls-q124-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2024/q1/johnson-controls-q124-earnings-release.pdf",
  },
  "Q2 2024": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2024/q2/johnson-controls-q224-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2024/q2/johnson-controls-q224-earnings-release.pdf",
  },
  "Q3 2024": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2024/q3/johnson-controls-q324-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2024/q3/johnson-controls-q324-earnings-release.pdf",
  },
  "Q4 2024": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2024/q4/johnson-controls-q424-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2024/q4/johnson-controls-q424-earnings-release.pdf",
  },
  "Q1 2025": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2025/q1/johnson-controls-q125-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2025/q1/johnson-controls-q125-earnings-release-1.pdf",
  },
  "Q2 2025": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2025/q2/johnson-controls-q225-earnings-slides-v1-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2025/q2/johnson-controls-q225-earnings-release.pdf",
  },
  "Q3 2025": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2025/q3/johnson-controls-q325-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2025/q3/johnson-controls-q325-earnings-release.pdf",
  },
  "Q4 2025": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2025/q4/johnson-controls-q425-earnings-slides-1.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2025/q4/johnson-controls-q425-earnings-release.pdf",
  },
  "Q1 2026": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_financials/2026/q1/johnson-controls-q1-26-earnings-slides.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_financials/2026/q1/johnson-controls-q1-26-earnings-release.pdf",
  },
  "Q2 2026": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_earnings/2026/q2/presentation/Q2-2026-Presentation.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_earnings/2026/q2/earnings-result/v2/Johnson-Controls-Q226-Earnings-Release_Revised.pdf",
  },
  "Q3 2026": {
    slides: "https://s21.q4cdn.com/502874060/files/doc_earnings/2026/q3/presentation/Q3-2026-Presentation.pdf",
    filings: "https://s21.q4cdn.com/502874060/files/doc_earnings/2026/q3/earnings-result/Q3-2026-Press-Release.pdf",
  },
};

export function isJciRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isJciIrPdf(href: string | null | undefined): boolean {
  if (!href || isJciRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s21.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/502874060/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeJciKnownQuarterDocs(): Map<string, JciQuarterDocs> {
  return new Map(Object.entries(JCI_KNOWN_QUARTER_DOCS));
}
