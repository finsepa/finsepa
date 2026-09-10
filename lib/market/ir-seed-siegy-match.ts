/** Siemens IR: analyst presentation-en as slides, earnings-release-en as filings. Never German / shareholder letter / annual report. */

export type SiegyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends 30 Sep. Q1=Dec 31, Q2=Mar 31, Q3=Jun 30, Q4=Sep 30. */
export const SIEGY_FY_END = "09-30";

const CDN = "https://assets.new.siemens.com/siemens/assets/api";

function uuidPdf(id: string, file: string): string {
  return `${CDN}/uuid:${id}/${file}`;
}

export const SIEGY_IR_PAGES = [
  "https://www.siemens.com/global/en/company/investor-relations.html",
  "https://www.siemens.com/global/en/company/investor-relations/events-publications.html",
] as const;

/**
 * Prefer `YYYY-qN-presentation-en.pdf` as Slides; `YYYY-qN-earnings-release-en.pdf` as Filings.
 * Press-call decks are last-resort earnings slides (same quarter). UUID is the asset — never reuse a presentation UUID as filings.
 */
export const SIEGY_KNOWN_QUARTER_DOCS: Readonly<Record<string, SiegyQuarterDocs>> = {
  "Q3 2026": {
    slides: uuidPdf("d4a50737-d5e4-4447-b81d-56f7f974db90", "2026-q3-presentation-en.pdf"),
    filings: uuidPdf("84d1a90b-542e-4775-a907-06f29940eb71", "HQCOPR202608037434EN.pdf"),
  },
  "Q2 2026": {
    slides: uuidPdf("b333927d-5456-44f7-b410-e7fe5b4b7f9b", "2026-q2-presentation-en.pdf"),
    filings: uuidPdf("d4072f41-f21d-4287-af75-0cb72c194262", "HQCOPR202605117394EN.pdf"),
  },
  "Q1 2026": {
    slides: uuidPdf("7928be7d-266d-40ba-a814-64248e7a9bb7", "Q1-FY2026-Presentation.pdf"),
    filings: uuidPdf("6e0ced33-bb64-49cb-867c-eea80e928739", "2026-q1-earnings-release-en.pdf"),
  },
  "Q4 2025": {
    slides: uuidPdf("7fe2d062-c9a2-4468-98bf-06015dcf2fad", "2025-q4-presentation-en.pdf"),
    filings: uuidPdf("7fdd21fb-c248-43a3-b475-f2e618fbae88", "2025-q4-earnings-release-en.pdf"),
  },
  "Q3 2025": {
    slides: uuidPdf("4c4b4b74-3046-487e-b917-b0fb8d5d141d", "Q3-FY-2025-Press-Call-Presentation.pdf"),
    filings: uuidPdf("4ca2342b-681a-4593-b631-df3c486cbb61", "2025-q3-earnings-release-en.pdf"),
  },
  "Q2 2025": {
    slides: uuidPdf("3a88da1f-8404-4ce7-bcb0-e145b01772de", "Q2-FY-25-Press-Call-Presentation.pdf"),
    filings: null,
  },
  "Q1 2025": {
    slides: null,
    filings: uuidPdf("8bd20994-21a2-4c87-9115-6da02e5bda13", "2025-q1-earnings-release-en.pdf"),
  },
  "Q4 2024": {
    slides: null,
    filings: uuidPdf("7c6b9d32-94a1-450d-a921-ce8c09544ad9", "2024-q4-earnings-release-en.pdf"),
  },
  "Q4 2023": {
    slides: uuidPdf("67151fa8-beb6-470a-8303-823ea68dffb4", "2023-q4-p-presentation-en.pdf"),
    filings: null,
  },
};

export function isSiegyRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|shareholderletter|presserede|annual[-_\s]*report|-de\.pdf|transcript|deutsch/i.test(n);
}

export function isSiegyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /assets\.new\.siemens\.com\/siemens\/assets\/api\/uuid:[a-f0-9-]+\/.+\.pdf/i.test(url) && !isSiegyRejected(url);
}

export function mergeSiegyKnownQuarterDocs(): Map<string, SiegyQuarterDocs> {
  return new Map(Object.entries(SIEGY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
