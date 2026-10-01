/**
 * SU IR seed — 12-31.
 * Suncor Energy calendar FY. Slides=Investor Presentation under investor-relations-presentations-{Y} (only Q2'26 currently live on IR; older decks rotated off). Filings=Quarterly Report PDF under quarterly-reports-{Y}. Q1–Q4'22 quarterly PDFs not on current media path (red). Reject transcripts/webcast/Investor Day/proxy/guidance/XBRL. Scope: 1g / 13y / 4r. HEAD-verified in-browser. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type SuQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SU_IR_PAGES = [
  "https://www.suncor.com/en-ca/investors/financial-reports-and-guidance",
] as const;

export const SU_KNOWN_QUARTER_DOCS: Readonly<Record<string, SuQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: null,
    filings: null,
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: null,
    filings: null,
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2023/2023-q1-suncor-energy-quarterly-report-en.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2023/2023-q2-suncor-energy-quarterly-report-en.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2023/2023-q3-suncor-energy-quarterly-report-en.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2023/2023-q4-suncor-energy-quarterly-report-en.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2024/2024-q1-suncor-energy-quarterly-report-en.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2024/2024-q2-suncor-energy-quarterly-report-en.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2024/2024-q3-suncor-energy-quarterly-report-en.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2024/2024-q4-suncor-energy-quarterly-report-en.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2025/2025-q1-suncor-energy-quarterly-report-en.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2025/2025-q2-suncor-energy-quarterly-report-en.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2025/2025-q3-suncor-energy-quarterly-report-en.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2025/2025-q4-suncor-energy-quarterly-report-en.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2026/2026-q1-suncor-energy-quarterly-report-en.pdf",
  },
  "Q2 2026": {
    slides: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/investor-relations-presentations-2026/2026-q2-suncor-energy-investor-presentation-en.pdf",
    filings: "https://www.suncor.com/-/media/project/suncor/files/investor-centre/quarterly-reports-2026/2026-q2-suncor-energy-quarterly-report-en.pdf",
  },
};

export function isSuRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl|guidance|contingent/i.test(n);
}

export function isSuIrPdf(href: string | null | undefined): boolean {
  if (!href || isSuRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.suncor.com" || host === "suncor.com" || host.endsWith(".suncor.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeSuKnownQuarterDocs(): Map<string, SuQuarterDocs> {
  return new Map(Object.entries(SU_KNOWN_QUARTER_DOCS));
}
