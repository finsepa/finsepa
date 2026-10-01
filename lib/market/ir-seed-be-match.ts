/**
 * BE IR seed — 12-31.
 * Bloom Energy calendar FY. Slides=Supplemental Financial Information / Earnings Deck; Filings=Earnings Release / Financial Results on s29.q4cdn.com/452919417. From FinancialReport.svc. Reject transcripts/Investor Day/10-Q. Never SEC HTML. Scope Q1 2022→Q2 2026. All 36 PDFs Range-GET %PDF verified.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type BeQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BE_IR_PAGES = [
  "https://investor.bloomenergy.com/financials/quarterly-results/default.aspx",
] as const;

export const BE_KNOWN_QUARTER_DOCS: Readonly<Record<string, BeQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2022/q1/Q1'22-SUPPLEMENTAL-FINANCIAL-INFORMATION-FINAL.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2022/q1/Bloom-Energy-Announces-First-Quarter-2022-Financial-Results-_-Final.pdf",
  },
  "Q2 2022": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2022/q2/v2/Q2'22-SUPPLEMENTAL-FINANCIAL-INFORMATION-FINAL.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2022/q2/v2/Bloom-Energy-Announces-Second-Quarter-2022-Financial-Results-_-Final.pdf",
  },
  "Q3 2022": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2022/q3/Q3'22-SUPPLEMENTAL-FINANCIAL-INFORMATION-FINAL.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2022/q3/Bloom-Energy-Announces-Third-Quarter-2022-Financial-Results-_-Final.pdf",
  },
  "Q4 2022": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2022/q4/Q4'22-SUPPLEMENTAL-FINANCIAL-INFORMATION-FINAL.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2022/q4/Bloom-Energy-Announces-4Q-2022-Financial-Results_Final.pdf",
  },
  "Q1 2023": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2023/q1/Q1-23-SUPPLEMENTAL-FINANCIAL-INFORMATION-FINAL.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2023/q1/Bloom-Energy-Announces-1Q-2023-Financial-Results_Final.pdf",
  },
  "Q2 2023": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2023/q2/Q223-Earnings-Deck-FINAL.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2023/q2/Bloom-Energy-Announces-2Q-2023-Financial-Results-FINAL.pdf",
  },
  "Q3 2023": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2023/q3/Q323-Earnings-Deck-Final.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2023/q3/ex99-1_Q3-2023-Financial-Results-Final.pdf",
  },
  "Q4 2023": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2023/q4/BE-4Q23-Earnings-Deck-Final.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2023/q4/BE-Q4-2023-Financial-Results-FINAL.pdf",
  },
  "Q1 2024": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2024/q1/Q124-Supplemental-Financial-Information-1.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2024/q1/Q1-2024-Financial-Results-Press-release-1.pdf",
  },
  "Q2 2024": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2024/q2/Q224-Supplemental-Financial-Information.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2024/q2/Q2-2024-Earnings-release.pdf",
  },
  "Q3 2024": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2024/q3/Q324-Supplemental-Financial-Information.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2024/q3/Q324-Financial-Results-Earnings-release-1.pdf",
  },
  "Q4 2024": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2024/q4/Q4-2024-Supplemental-deck-Final.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2024/q4/Q4-2024-Financial-Results-FINAL.pdf",
  },
  "Q1 2025": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2025/q1/Q125-Supplemental-Financial-Information_.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2025/q1/ex99-1_Q1-2025-Financial-Results-FINAL.pdf",
  },
  "Q2 2025": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2025/q2/Q225-Supplemental-Financial-Information.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2025/q2/Q2-25-Earnings-Release.pdf",
  },
  "Q3 2025": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2025/q3/Q32025-Supplemental-financial-information.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2025/q3/Q3-2025-Earnings-release.pdf",
  },
  "Q4 2025": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2025/q4/Q4-2025-Supplemental-deck.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2025/q4/Q4-2025-Financial-Results.pdf",
  },
  "Q1 2026": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2026/q1/Q1-26-Supplemental-financial-information.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2026/q1/Q1-26-Earnings-release.pdf",
  },
  "Q2 2026": {
    slides: "https://s29.q4cdn.com/452919417/files/doc_financials/2026/q2/Q226-Supplemental-Financial-Information.pdf",
    filings: "https://s29.q4cdn.com/452919417/files/doc_financials/2026/q2/Q226-Earnings-release.pdf",
  },
};

export function isBeRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isBeIrPdf(href: string | null | undefined): boolean {
  if (!href || isBeRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s29.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/452919417/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeBeKnownQuarterDocs(): Map<string, BeQuarterDocs> {
  return new Map(Object.entries(BE_KNOWN_QUARTER_DOCS));
}
