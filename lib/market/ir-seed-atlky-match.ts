/**
 * ATLKY IR seed — 12-31.
 * Atlas Copco AB ADR (ATLKY) calendar FY on atlascopcogroup.com. Slides=handout/quarterly-results-presentation; Filings=interim report. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type AtlkyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ATLKY_IR_PAGES = [
  "https://www.atlascopcogroup.com/en/investors/reports-and-presentations",
] as const;

export const ATLKY_KNOWN_QUARTER_DOCS: Readonly<Record<string, AtlkyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20220426-q1-2022-handout-en-js.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20220426-en-q1-2022-js.pdf",
  },
  "Q2 2022": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20220719-q2-2022-handout-en-ok.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20220719-en-q2-2022-ok.pdf",
  },
  "Q3 2022": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20221019-q3-2022-handout-en-ab.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20221019-en-q3-2022-ab.pdf",
  },
  "Q4 2022": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20230126-q4-en-handout-pm.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20230126-en-q4-2022-rh.pdf",
  },
  "Q1 2023": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20230427-q1-2023-handout-en-lg.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20230427-en-q1-2023-lg.pdf",
  },
  "Q2 2023": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20230719-q2-2023-handout-en-up.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20230719-en-q2-2023-rh.pdf",
  },
  "Q3 2023": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20231025-q3-2023-handout-en-ri.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20231025-en-q3-2023-ri.pdf",
  },
  "Q4 2023": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20240125-q4-handout-2023-en-ok.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20240125-en-q4-2023-js.pdf",
  },
  "Q1 2024": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20240424-q1-2024-handout-en-ej.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20240424-en-q1-2024-ej.pdf",
  },
  "Q2 2024": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/0240718-q2-2024-handout-en-wn.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20240718-en-q2-2024-wn.pdf",
  },
  "Q3 2024": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20241023-q3-2024-handout-en-nh.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20241023-en-q3-2024-nh.pdf",
  },
  "Q4 2024": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20250128-quarterly-results-presentation-q4-2024-en-lg.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20250128-en-q4-2024-lg.pdf",
  },
  "Q1 2025": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20250429-q1-2025-handout-en-rs.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20250429-en-q1-2025-rs.pdf",
  },
  "Q2 2025": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20250718-quarterly-results-presentations-q2-2025-wg.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20250718-en-q2-2025-wg.pdf",
  },
  "Q3 2025": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20251023-q3-2025-handout-en-ge.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20251023-en-q3-2025-ge.pdf",
  },
  "Q4 2025": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260127-quarterly-results-presentation-en-q4-2025.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260127-en-q4-2025-et.pdf",
  },
  "Q1 2026": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260428-q1-2026-quarterly-results-presentation-en-ib.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260428-en-q1-2026-ib.pdf",
  },
  "Q2 2026": {
    slides: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260716-quarterly-results-presentations-q2-2026-en-fl.pdf",
    filings: "https://www.atlascopcogroup.com/content/dam/atlas-copco/group/documents/investors/financial-publications/english/20260716-en-q2-2026-fl.pdf",
  },
};

export function isAtlkyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|esg|annual.?report|capital.?markets/i.test(n);
}

export function isAtlkyIrPdf(href: string | null | undefined): boolean {
  if (!href || isAtlkyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.atlascopcogroup.com" || host.endsWith(".atlascopcogroup.com") || host === "www.atlascopco.com" || host.endsWith(".atlascopco.com"))) return false;
    if (!(u.pathname.includes("/investors/") || u.pathname.includes("/financial-publications/") || u.pathname.includes("/content/dam/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAtlkyKnownQuarterDocs(): Map<string, AtlkyQuarterDocs> {
  return new Map(Object.entries(ATLKY_KNOWN_QUARTER_DOCS));
}
