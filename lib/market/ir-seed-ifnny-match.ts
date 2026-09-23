/**
 * IFNNY IR seed — 09-30.
 * Infineon Technologies ADR; Sept 30 FY (like SBUX). Finsepa labels = issuer FY quarter tags (Q1 FY2022→Q1 2022 … Q3 FY2026→Q3 2026). Slides=Investor Presentation / Quarterly Update (infineon.com assets|content/dam|assets.infineon.com). Filings=full news/press PDF (infxx/infpr or quarterly-report descriptive). Rejected edit.infineon.com/dgdl (empty/non-downloadable). Half-year financial report/annual report not used. Holes: Q3 2022 slides missing; press gaps Q4'22, Q1–Q3'23, Q1–Q2'25, Q1–Q2'26. Scope: 10g / 9y / 0r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type IfnnyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const IFNNY_IR_PAGES = [
  "https://www.infineon.com/cms/en/about-infineon/investor/reports-and-presentations/",
] as const;

export const IFNNY_KNOWN_QUARTER_DOCS: Readonly<Record<string, IfnnyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2022/2022-02-03-q1-fy22-investor-presentation.pdf",
    filings: "https://assets.infineon.com/is/content/infineon/infineon/row/public/documents/corporate/investors/presentations/2022/infxx202202-046e.pdf",
  },
  "Q2 2022": {
    slides: "https://www.infineon.com/content/dam/infineon/row/public/documents/corporate/investors/presentations/2022/2022-05-09-q2-fy22-investor-presentation.pdf",
    filings: "https://assets.infineon.com/is/content/infineon/infineon/row/public/documents/corporate/investors/presentations/2022/infxx202205-078e.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://www.infineon.com/content/dam/infineon/row/public/images/corporate/press/press-releases/quarterly-report/infxx202208-109e.pdf",
  },
  "Q4 2022": {
    slides: "https://www.infineon.com/content/dam/infineon/row/public/documents/corporate/investors/presentations/2022/2022-11-15-q4-fy22-investor-presentation.pdf",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://www.infineon.com/content/dam/infineon/row/public/documents/corporate/investors/presentations/2023/2023-02-02-q1-fy23-investor-presentation.pdf",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2023/2023-05-04-q2-fy23-investor-presentation.pdf",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://assets.infineon.com/is/content/infineon/infineon/row/public/documents/corporate/investors/presentations/2023/2023-08-03-q3-fy23-investor-presentation.pdf",
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2023/2023-11-15-q4-fy23-investor-presentation.pdf",
    filings: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2023/infxx202311-022-v01-00-en.pdf",
  },
  "Q1 2024": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2024/2024-02-06-q1-fy24-investor-presentation-v01-00-en.pdf",
    filings: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2024/infxx202402-056-v01-00-en.pdf",
  },
  "Q2 2024": {
    slides: "https://www.infineon.com/content/dam/infineon/row/public/documents/corporate/investors/presentations/2024/2024-05-07-q2-fy24-investor-presentation-v01-00-en.pdf",
    filings: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2024/infxx202405-100-v01-00-en.pdf",
  },
  "Q3 2024": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2024/2024-08-05-q3-fy24-investor-presentation-v01-00-en.pdf",
    filings: "https://www.infineon.com/content/dam/infineon/row/public/documents/corporate/press/press-releases/quarterly-report/2024/slight-increase-in-revenue-and-earnings-in-q3-fy-2024.pdf",
  },
  "Q4 2024": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2024/2024-11-12-q4-fy24-investor-presentation-v01-00-en.pdf",
    filings: "https://www.infineon.com/assets/row/public/documents/corporate/press/press-releases/quarterly-report/2024/infineon-concludes-fy-2024-with-an-increase-in-revenue-and-earnings-in-the-last-quarter.pdf",
  },
  "Q1 2025": {
    slides: "https://www.infineon.com/row/public/documents/corporate/investors/presentations/2025/2025-02-04-q1-fy25-investor-presentation-v01-00-en.pdf",
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2025/2025-05-08-q2-fy25-investor-presentation-v01-00-en.pdf",
    filings: null,
  },
  "Q3 2025": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2025/2025-08-05-q3-fy25-investor-presentation-v01-00-en.pdf",
    filings: "https://www.infineon.com/row/public/images/corporate/press/2025/infxx202508-130e.pdf",
  },
  "Q4 2025": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2025/2025-11-12-q4-fy25-investor-presentation-v01-00-en.pdf",
    filings: "https://www.infineon.com/row/public/documents/corporate/press/2025/infxx202511-021e.pdf",
  },
  "Q1 2026": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2026/2026-02-04-q1-fy26-investor-presentation-v01-00-en.pdf",
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2026/2026-05-06-q2-fy26-investor-presentation-v01-00-en.pdf",
    filings: null,
  },
  "Q3 2026": {
    slides: "https://www.infineon.com/assets/row/public/documents/corporate/investors/presentations/2026/2026-08-05-q3-fy26-investor-presentation-v01-00-en.pdf",
    filings: "https://www.infineon.com/assets/row/public/documents/corporate/press/2026/infpr202608-125e.pdf",
  },
};

export function isIfnnyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isIfnnyIrPdf(href: string | null | undefined): boolean {
  if (!href || isIfnnyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.infineon.com" || host === "assets.infineon.com" || host.endsWith(".infineon.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeIfnnyKnownQuarterDocs(): Map<string, IfnnyQuarterDocs> {
  return new Map(Object.entries(IFNNY_KNOWN_QUARTER_DOCS));
}
