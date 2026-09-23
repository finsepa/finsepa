/**
 * NABZY IR seed — 09-30.
 * National Australia Bank ADR (NABZY); Sept FY half-year like Westpac. Slides=*-investor-presentation.pdf; Filings=*-results-announcement.pdf (fallback *-asx-announcement / *-results-summary). Map 1H→Q2, FY→Q4. Q1/Q3 empty by design (trading updates / pillar-3 not locked). Never SEC HTML. Scope Q1 2022→Q3 2026 (9 green / 0 yellow / 10 red). Range-GET %PDF verified.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type NabzyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const NABZY_IR_PAGES = [
  "https://www.nab.com.au/about-us/shareholder-centre/financial-disclosures",
] as const;

export const NABZY_KNOWN_QUARTER_DOCS: Readonly<Record<string, NabzyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2022-half-year-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2022-half-year-results-announcement.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2022-full-year-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2022-full-year-asx-announcement.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2023-half-year-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2023-half-year-results-announcement.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2023-full-year-results-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2023-full-year-asx-announcement.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2024-half-year-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2024-half-year-results-announcement.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2024-full-year-results-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2024-full-year-asx-announcement.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-half-year-results-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-half-year-results-announcement.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-full-year-results-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-full-year-results-summary.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2026-half-year-results-investor-presentation.pdf",
    filings: "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2026-half-year-results-announcement.pdf",
  },
  "Q3 2026": {
    slides: null,
    filings: null,
  },
};

export function isNabzyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isNabzyIrPdf(href: string | null | undefined): boolean {
  if (!href || isNabzyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.nab.com.au" || host.endsWith(".nab.com.au"))) return false;
    if (!u.pathname.includes("/content/dam/nab/documents/reports/corporate/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeNabzyKnownQuarterDocs(): Map<string, NabzyQuarterDocs> {
  return new Map(Object.entries(NABZY_KNOWN_QUARTER_DOCS));
}
