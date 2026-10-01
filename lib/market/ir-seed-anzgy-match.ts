/**
 * ANZGY IR seed — 09-30.
 * ANZ Group Holdings ADR (ANZGY); Sept FY half-year like NAB/Westpac. Slides=*investor-discussion-pack* / *Results-presentation-and-IDP*; Filings=*media-release* /*news-release*. Map 1H→Q2, FY→Q4. Q1/Q3 empty by design (trading updates / pillar-3 not locked). Q2 2025 filings CMS path misnamed ANZGHL-2024-Half-Year-Results-Media-Release.pdf under 2025-half-year-results-announcement/. Reject transcripts/pillar-3/consolidated reports. Scope Q1 2022→Q3 2026 (9 green / 0 yellow / 10 red). Range-GET %PDF verified. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type AnzgyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ANZGY_IR_PAGES = [
  "https://www.anz.com/shareholder/centre/reporting/",
] as const;

export const ANZGY_KNOWN_QUARTER_DOCS: Readonly<Record<string, AnzgyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/2022-half-year-results-investor-discussion-pack.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/2022-half-year-results-media-release.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/2022-full-year-results-investor-discussion-pack.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/2022-full-year-results-media-release.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/2023-half-year-results-presentation-and-investor-discussion-pack.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/2023-anzghl-half-year-news-release.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/ANZGHL-full-year-2023-results-investor-discussion-pack.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/2023-full-year-result-media-release.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/ANZGHL-2024-Half-Year-Results-Investor-Discussion-Pack.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/ANZGHL-2024-Half-Year-Results-Media-Release.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/2024-anzghl-full-year-results-presentation-and-investor-discussion-pack.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/2024-anzghl-full-year-results-media-release.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/ANZGHL-2025-Half-Year-Results-Investor-Discussion-Pack.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/2025-half-year-results-announcement/ANZGHL-2024-Half-Year-Results-Media-Release.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/full-year-results-announcement/2025-full-year-results-investor-discussion-pack.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/full-year-results-announcement/2025-full-year-results-news-release.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www.anz.com/content/dam/anzcom/shareholder/1H26-results-announcement/1H26-ANZ-Results-presentation-and-IDP.pdf",
    filings: "https://www.anz.com/content/dam/anzcom/shareholder/1H26-results-announcement/1H26-Media-Release.pdf",
  },
  "Q3 2026": {
    slides: null,
    filings: null,
  },
};

export function isAnzgyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isAnzgyIrPdf(href: string | null | undefined): boolean {
  if (!href || isAnzgyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.anz.com" || host.endsWith(".anz.com"))) return false;
    if (!u.pathname.includes("/content/dam/anzcom/shareholder/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeAnzgyKnownQuarterDocs(): Map<string, AnzgyQuarterDocs> {
  return new Map(Object.entries(ANZGY_KNOWN_QUARTER_DOCS));
}
