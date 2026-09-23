/**
 * AEM IR seed — 12-31.
 * Agnico Eagle Mines calendar FY. Slides=Presentation; Filings=News Release on ir.agnicoeagle.com. Catalog through Q4 2024 (FinancialReport Year=2025 empty as of discovery). Scope stats: 12 green / 0 yellow / 6 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type AemQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const AEM_IR_PAGES = [
  "https://ir.agnicoeagle.com/",
] as const;

export const AEM_KNOWN_QUARTER_DOCS: Readonly<Record<string, AemQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2022/Q1-2022-Presentation-FINAL.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2022/2022-Q1_AEM-Results-Final-2022.04.28.pdf",
  },
  "Q2 2022": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2022/Q2-2022-Presentation-Final.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2022/2022-Q2_AEM-Results_2022.07.27_Final.pdf",
  },
  "Q3 2022": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2022/AEM-Q3-2022-Presentation-FINAL.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2022/2022-Q3_AEM-Results-2022.10.26.pdf",
  },
  "Q4 2022": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2023/AEM-Q4-2022-Presentation-Final.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2023/2022-Q4_AEM-Results-2023.02.16-FINAL.pdf",
  },
  "Q1 2023": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2023/AEM-Q1-2023-Results-Presentation-Final.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2023/2023-Q1_AEM-Results-Final-2023-04-27.pdf",
  },
  "Q2 2023": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2023/AEM-Q2-2023-Presentation-Final.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2023/2023-Q2_AEM-Results_2023-07-26-Final.pdf",
  },
  "Q3 2023": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2023/AEM-Q3-2023-Presentation-FINAL.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2023/2023-Q3_AEM-Results-Final.pdf",
  },
  "Q4 2023": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2024/AEM-Q4-2023-Presentation-FINAL.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2024/2023-Q4_AEM-Results-Final.pdf",
  },
  "Q1 2024": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2024/_AEM-Earnings-Presentation-Q1-2024-FINAL.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_financials/quarterly/2024/AEM-News-Release_Q1-2024-FINAL.pdf",
  },
  "Q2 2024": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2024/_AEM-Earnings-Presentation-Q2-2024-FINAL.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2024/_AEM-News-Release-Q2-2024-FINAL.pdf",
  },
  "Q3 2024": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2024/AEM-Earnings-Presentation-Q3-2024-FINAL.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2024/_AEM-News-Release-Q3-2024-FINAL.pdf",
  },
  "Q4 2024": {
    slides: "https://ir.agnicoeagle.com/files/doc_presentations/2025/_AEM-Earnings-Presentation-Q4-2024-FINAL.pdf",
    filings: "https://ir.agnicoeagle.com/files/doc_news/news_documents/2025/_AEM-News-Release-Q4-2024-FINAL.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: null,
    filings: null,
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: null,
    filings: null,
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: null,
    filings: null,
  },
};

export function isAemRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|operating.?data|financials.?and.?operating|investor.?day|fact.?sheet/i.test(n);
}

export function isAemIrPdf(href: string | null | undefined): boolean {
  if (!href || isAemRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "ir.agnicoeagle.com" || host.endsWith(".agnicoeagle.com"))) return false;
    if (!(u.pathname.includes("/files/") || u.pathname.includes("/doc_"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAemKnownQuarterDocs(): Map<string, AemQuarterDocs> {
  return new Map(Object.entries(AEM_KNOWN_QUARTER_DOCS));
}
