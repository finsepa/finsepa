/**
 * GLNCY IR seed — 12-31.
 * Glencore PLC ADR. Calendar FY but half-year reporting only. HY→Q2, Preliminary/FY→Q4. Q1/Q3 empty by design. Slides=Half-Year/Preliminary Results Presentation; Filings=Half-Year Report or Preliminary Results PDF on glencore.com/.rest/api/v1/documents. Never SEC HTML. Reject production reports / AGM / conference decks.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type GlncyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const GLNCY_IR_PAGES = [
  "https://www.glencore.com/investors/reports-results",
] as const;

export const GLNCY_KNOWN_QUARTER_DOCS: Readonly<Record<string, GlncyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/24280311ed0fc4a8ff5ea14bb5f1b55d/GLEN-2022-Half-Year-Results-presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/ed4fc426016bb98c50fb2c30763dde71/GLEN-2022-Half-Year-Report.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/7a1939ba50c9e9d69bbb4a18b8d78bbc/GLEN-2022-Preliminary-Results-Presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/7ce9527cb786528b7016cd495780a4af/GLEN-2022-Preliminary-Results.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/static/dabd9822-ba64-458f-817f-c074997fb5e2/GLEN-2023-Half-Year-Results-presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/static/a6349da6-3d11-4662-9107-28e19667d236/GLEN-2023-Half-Year-Report.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/static/bcd27c43-43cf-4592-8557-83597fd5bf35/20240221+GLEN+2023+Preliminary+Results+presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/static/7e55cef8-54b5-47c5-8a48-171d685e319d/GLEN-2023-Preliminary-Results.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/static/7d6c9b61-104a-4e00-ae15-c02025d4ddd2/20240807+GLEN+2024+Half-Year+Results+Presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/static/31bcbe31-4250-42cd-b6d8-1a7cb48efbd2/GLEN-2024-Half-Year-Report.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/static/12da8f07-23d7-4150-91b8-cb8fc651cbca/20250219-GLEN-2024-Preliminary-Results-Presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/static/218c5d8d-cc96-47f9-8df3-f21116de5ea9/GLEN-2024-Preliminary-Results.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/static/2abdcde1-a43c-4a87-8986-4018a8470253/20250806+GLEN+2025+Half-Year+Results+Presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/static/07647168-ed29-49b5-a379-9a3c7eb87a55/GLEN-2025-Half-Year-Report.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/static/8c149e90-3801-4ac0-90dd-921191687af9/20260218-GLEN-2025-Preliminary-Results-Presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/static/d1a49c6b-9771-4bf1-9090-7c136aac8112/GLEN-2025-Preliminary-Results.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www.glencore.com/.rest/api/v1/documents/static/a8dfc8ac-480f-46d8-bbf3-ede5686cba20/20260805+GLEN+2026+Half-Year+Results+Presentation.pdf",
    filings: "https://www.glencore.com/.rest/api/v1/documents/static/98cf0f2a-ede7-4ced-9539-061198c3b6be/GLEN-2026-Half-Year-Report.pdf",
  },
};

export function isGlncyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isGlncyIrPdf(href: string | null | undefined): boolean {
  if (!href || isGlncyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.glencore.com" || host.endsWith(".glencore.com"))) return false;
    if (!u.pathname.includes("/.rest/api/v1/documents/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeGlncyKnownQuarterDocs(): Map<string, GlncyQuarterDocs> {
  return new Map(Object.entries(GLNCY_KNOWN_QUARTER_DOCS));
}
