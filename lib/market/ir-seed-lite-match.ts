/**
 * LITE IR seed — 06-30.
 * Lumentum Holdings June FY (labels=issuer fiscal Q1–Q4; Q1 ends ~Sep, Q4 ends ~Jun). Slides=Earnings Presentation/Deck/Call on s21.q4cdn.com/377324469 doc_financials (also mirrored under doc_events). Filings=earnings press PDF under doc_news (Business Wire). Q2 2022 press PDF not found on IR CDN — slides-only yellow. Reject conference decks / GAAP reconciliations / SEC HTML. Never SEC HTML. Scope: Ng=19 / Ny=1 / Nr=0. Range-GET %PDF verified.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type LiteQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const LITE_IR_PAGES = [
  "https://investor.lumentum.com/financials/quarterly-results/default.aspx",
] as const;

export const LITE_KNOWN_QUARTER_DOCS: Readonly<Record<string, LiteQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2022/q1/Q1-FY22-Earnings-CallFinal.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-First-Quarter-2022-Financial-Results-2021.pdf",
  },
  "Q2 2022": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2022/q2/Q2-FY22-Earnings-Deck_final.pdf",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2022/q3/Q3-FY22-Earnings-Deck_Final_2.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Third-Quarter-2022-Financial-Results-2022.pdf",
  },
  "Q4 2022": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2022/q4/Q4-FY22-Earnings-Call-Final.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Fourth-Quarter-and-Full-Year-2022-Results-2022.pdf",
  },
  "Q1 2023": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2023/q1/Q1-FY23-Earnings-Presentation.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-First-Quarter-2023-Financial-Results-2022.pdf",
  },
  "Q2 2023": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2023/q2/Q2-FY23-Earnings-Presentation_final_.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Second-Quarter-2023-Financial-Results-2023.pdf",
  },
  "Q3 2023": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2023/q3/Q3-FY23-Earnings-Call_final_.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Third-Quarter-2023-Financial-Results-2023.pdf",
  },
  "Q4 2023": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2023/q4/Q4-FY23-LITE-Earnings-Presentation_Final.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Fourth-Quarter-and-Full-Year-2023-Results-2023.pdf",
  },
  "Q1 2024": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2024/q1/Q1-FY24-Earnings-Call_final.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-First-Quarter-2024-Financial-Results-2023.pdf",
  },
  "Q2 2024": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2024/q2/Q2-FY24-Earnings-Presentation_final_2.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Second-Quarter-2024-Financial-Results-2024.pdf",
  },
  "Q3 2024": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2024/q3/Q3FY24-Earnings-Presentation_final_.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Third-Quarter-2024-Financial-Results-2024.pdf",
  },
  "Q4 2024": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2024/q4/Q4-FY24-Earnings-Presentation_final_3.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Fourth-Quarter-and-Full-Year-2024-Results-2024.pdf",
  },
  "Q1 2025": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2025/q1/Q1-FY25-Earnings-Presentation_final.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-First-Quarter-2025-Financial-Results-2024.pdf",
  },
  "Q2 2025": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2025/q2/Q2-FY25-Earnings-Presentation_final.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Second-Quarter-2025-Financial-Results-2025.pdf",
  },
  "Q3 2025": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2025/q3/Q3-FY25-Earnings-Presentation-final_2.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fiscal-Third-Quarter-2025-Financial-Results-2025.pdf",
  },
  "Q4 2025": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2025/q4/Q4-FY25-Earnings-Presentation_final_.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fourth-Quarter-and-Full-Fiscal-Year-2025-Results-2025.pdf",
  },
  "Q1 2026": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2026/q1/Q1-FY26-Earnings-Presentation_final.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-First-Quarter-of-Fiscal-Year-2026-Financial-Results-2025.pdf",
  },
  "Q2 2026": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2026/q2/Q2-FY26-Earnings-Presentation-final_2.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Second-Quarter-of-Fiscal-Year-2026-Financial-Results-2026.pdf",
  },
  "Q3 2026": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2026/q3/Q3-FY26-Earnings-Presentation_final.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Third-Quarter-of-Fiscal-Year-2026-Financial-Results-2026.pdf",
  },
  "Q4 2026": {
    slides: "https://s21.q4cdn.com/377324469/files/doc_financials/2026/q4/Q4-FY26-Earnings-Presentation_final.pdf",
    filings: "https://s21.q4cdn.com/377324469/files/doc_news/Lumentum-Announces-Fourth-Quarter-and-Full-Fiscal-Year-2026-Results-2026.pdf",
  },
};

export function isLiteRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isLiteIrPdf(href: string | null | undefined): boolean {
  if (!href || isLiteRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s21.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/377324469/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeLiteKnownQuarterDocs(): Map<string, LiteQuarterDocs> {
  return new Map(Object.entries(LITE_KNOWN_QUARTER_DOCS));
}
