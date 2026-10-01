/**
 * CTAS IR seed — 05-31.
 * Cintas May 31 FY. Labels = issuer fiscal Q1–Q4 (Q1 ends Aug 31, Q2 Nov 30, Q3 Feb 28/29, Q4 May 31). Filings-only: revenue-and-earnings press PDFs on cintas.com/docs/default-source/investor-relations/quarterly-reports (older long-form filenames; mid years drop 'and' or use q3-fy'23). No quarterly IR slide decks found. Reject 10-K/proxy/income-statement/balance-sheet/cash-flow standalone. Never SEC HTML. Scope: 0g / 20y / 0r.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type CtasQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const CTAS_IR_PAGES = [
  "https://www.cintas.com/investors/financials/",
] as const;

export const CTAS_KNOWN_QUARTER_DOCS: Readonly<Record<string, CtasQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/cintas-corporation-reports-first-quarter-fiscal-2022-revenue-and-earnings.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/cintas-corporation-reports-second-quarter-fiscal-2022-revenue-and-earnings.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/cintas-corporation-reports-third-quarter-fiscal-2022-revenue-and-earnings.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/cintas-corporation-reports-fourth-quarter-fiscal-2022-revenue-and-earnings.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/cintas-corporation-reports-first-quarter-fiscal-2023-revenue-and-earnings.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/cintas-corporation-reports-second-quarter-fiscal-2023-revenue-and-earnings.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q3-fy%2723-revenue-and-earnings.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q4-fy23-revenue-and-earnings.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q1-fy24-revenue-and-earnings.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q2-fy24-revenue-and-earnings.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q3-fy24-revenue-earnings.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q4-fy24-revenue-and-earnings.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q1-fy25-revenue-and-earnings.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q2-fy25-revenue-earnings.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q3-fy25-revenue-and-earnings.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q4-fy25-revenue-and-earnings.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q1-fy26-revenue-and-earnings.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q2-fy26-revenue-and-earnings.pdf",
  },
  "Q3 2026": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q3-fy26-revenue-and-earnings.pdf",
  },
  "Q4 2026": {
    slides: null,
    filings: "https://www.cintas.com/docs/default-source/investor-relations/quarterly-reports/q4-fy26-revenue-and-earnings.pdf",
  },
};

export function isCtasRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isCtasIrPdf(href: string | null | undefined): boolean {
  if (!href || isCtasRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.cintas.com" || host === "cintas.com" || host.endsWith(".cintas.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeCtasKnownQuarterDocs(): Map<string, CtasQuarterDocs> {
  return new Map(Object.entries(CTAS_KNOWN_QUARTER_DOCS));
}
