/**
 * British American Tobacco ADR (BTI) IR — calendar FY, UK semi-annual only.
 * HY → Q2; FY → Q4. Q1/Q3 intentionally null.
 * Slides = Presentation; Filings = Announcement on bat.com DAM.
 * Never Pre-Close / CAGNY / transcript / annual report / SEC HTML.
 */

export type BtiQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BTI_IR_PAGES = [
  "https://www.bat.com/investors-and-reporting/results-centre",
  "https://www.bat.com/investors-and-reporting",
] as const;

/** Catalog Q1 2022 → Q2 2026 (Q1/Q3 empty by design). */
export const BTI_KNOWN_QUARTER_DOCS: Readonly<Record<string, BtiQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2026_Presentation_Slides.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2026_Annoucement.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/FY_2025_Presentation.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/FY_2025_Announcement.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2025_Presentation_Slides.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2025_Announcement.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/FY_2024_Presentation_Slides.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/FY_2024_Announcement.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2024_Presentation_Slides.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2024_Announcement.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/FY_2023_Presentation_Slides.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/FY_2023_Announcement.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2023_Presentation_Slides.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2023_Announcement.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/FY_2022_Presentation_Slides.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/FY_2022_Announcement.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2022_Presentation_Slides.pdf",
    filings: "https://www.bat.com/content/dam/batcom/global/main-nav/investors-and-reporting/results-centre/pdf/HY_2022_Announcement.pdf",
  },
  "Q1 2022": {
    slides: null,
    filings: null,
  },
};

export function isBtiRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|proxy|transcript|pre[-_\s]*close|cagny|conference|annual[-_\s]*report|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isBtiIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.bat.com" || host === "bat.com" || host.endsWith(".bat.com"))) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isBtiRejected(url);
  } catch {
    return false;
  }
}

export function mergeBtiKnownQuarterDocs(): Map<string, BtiQuarterDocs> {
  return new Map(Object.entries(BTI_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
