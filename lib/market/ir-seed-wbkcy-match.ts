/**
 * WBKCY IR seed — 09-30.
 * Westpac (WBC) Sept 30 FY; half-year reporting. Map 1H FY{N}→Q2 {N}, Full Year FY{N}→Q4 {N}. Slides=Presentation+Investor Discussion Pack; Filings=Media Release (or HY ASX announcement PDF when labeled that way). Q1/Q3 trading updates (1Q/3Q Update/IDP) not locked as earnings. FY26 full-year not yet (Nov 2026). Scope: 9g / 0y / 9r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type WbkcyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const WBKCY_IR_PAGES = [
  "https://www.westpac.com.au/about-westpac/investor-centre/",
] as const;

export const WBKCY_KNOWN_QUARTER_DOCS: Readonly<Record<string, WbkcyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/WBC_1H22_IDP_and_Presentation.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/1H22_MediaRelease.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/WBC_FY22_IDP_and_Presentation.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/FY22_Media_Release.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/WBC_1H23_Presentation_and_IDP.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/1H23_Media_Release.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/Full-year-2023-presentation-and-IDP.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/Full-Year-2023-Media-Release.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/WBC-1H24-IDP-and-Presentation.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/WBC-ASX-Announcement-Half-Year-2024-Result.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-full-year-presentation-and-IDP-2024.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-full-year-media-release-2024.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-1H25-presentation-IDP-2025.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-1H25-media-release-2025.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-full-year-presentation-and-IDP-2025.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-media-release-2025.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-1H26-presentation-IDP-2026.pdf",
    filings: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-1H26-media-release-2026.pdf",
  },
};

export function isWbkcyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isWbkcyIrPdf(href: string | null | undefined): boolean {
  if (!href || isWbkcyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.westpac.com.au" || host.endsWith(".westpac.com.au"))) return false;
    if (!u.pathname.includes("/content/dam/public/wbc/documents/pdf/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeWbkcyKnownQuarterDocs(): Map<string, WbkcyQuarterDocs> {
  return new Map(Object.entries(WBKCY_KNOWN_QUARTER_DOCS));
}
