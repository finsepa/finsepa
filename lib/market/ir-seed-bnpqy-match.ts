/**
 * BNP Paribas ADR (BNPQY) IR — calendar FY.
 * Slides = invest.bnpparibas/en/document/{q}q{yy}-slides (PDF bytes, no .pdf suffix);
 * Filings = .../{q}q{yy}-pr. Never transcript / appendix / URD / SEC HTML.
 */

export type BnpqyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BNPQY_IR_PAGES = [
  "https://invest.bnpparibas/en/results",
  "https://invest.bnpparibas/en/search/reports/documents/results",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const BNPQY_KNOWN_QUARTER_DOCS: Readonly<Record<string, BnpqyQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://invest.bnpparibas/en/document/2q26-slides",
    filings: "https://invest.bnpparibas/en/document/2q26-pr",
  },
  "Q1 2026": {
    slides: "https://invest.bnpparibas/en/document/1q26-slides",
    filings: "https://invest.bnpparibas/en/document/1q26-pr",
  },
  "Q4 2025": {
    slides: "https://invest.bnpparibas/en/document/4q25-slides",
    filings: "https://invest.bnpparibas/en/document/4q25-pr",
  },
  "Q3 2025": {
    slides: "https://invest.bnpparibas/en/document/3q25-slides",
    filings: "https://invest.bnpparibas/en/document/3q25-pr",
  },
  "Q2 2025": {
    slides: "https://invest.bnpparibas/en/document/2q25-slides",
    filings: "https://invest.bnpparibas/en/document/2q25-pr",
  },
  "Q1 2025": {
    slides: "https://invest.bnpparibas/en/document/1q25-slides",
    filings: "https://invest.bnpparibas/en/document/1q25-pr",
  },
  "Q4 2024": {
    slides: "https://invest.bnpparibas/en/document/4q24-slides",
    filings: "https://invest.bnpparibas/en/document/4q24-pr",
  },
  "Q3 2024": {
    slides: "https://invest.bnpparibas/en/document/3q24-slides",
    filings: "https://invest.bnpparibas/en/document/3q24-pr",
  },
  "Q2 2024": {
    slides: "https://invest.bnpparibas/en/document/2q24-slides",
    filings: "https://invest.bnpparibas/en/document/2q24-pr",
  },
  "Q1 2024": {
    slides: "https://invest.bnpparibas/en/document/1q24-slides",
    filings: "https://invest.bnpparibas/en/document/1q24-pr",
  },
  "Q4 2023": {
    slides: "https://invest.bnpparibas/en/document/4q23-slides",
    filings: "https://invest.bnpparibas/en/document/4q23-pr",
  },
  "Q3 2023": {
    slides: "https://invest.bnpparibas/en/document/3q23-slides",
    filings: "https://invest.bnpparibas/en/document/3q23-pr",
  },
  "Q2 2023": {
    slides: "https://invest.bnpparibas/en/document/2q23-slides",
    filings: "https://invest.bnpparibas/en/document/2q23-pr",
  },
  "Q1 2023": {
    slides: "https://invest.bnpparibas/en/document/1q23-slides",
    filings: "https://invest.bnpparibas/en/document/1q23-pr",
  },
  "Q4 2022": {
    slides: "https://invest.bnpparibas/en/document/4q22-slides",
    filings: "https://invest.bnpparibas/en/document/4q22-pr",
  },
  "Q3 2022": {
    slides: "https://invest.bnpparibas/en/document/3q22-slides",
    filings: "https://invest.bnpparibas/en/document/3q22-pr",
  },
  "Q2 2022": {
    slides: "https://invest.bnpparibas/en/document/2q22-slides",
    filings: "https://invest.bnpparibas/en/document/2q22-pr",
  },
  "Q1 2022": {
    slides: "https://invest.bnpparibas/en/document/1q22-slides",
    filings: "https://invest.bnpparibas/en/document/1q22-pr",
  },
};

export function isBnpqyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|proxy|transcript|appendix|universal[-_\s]*registration|urd|debt[-_\s]*investor|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isBnpqyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "invest.bnpparibas" || host.endsWith(".bnpparibas"))) return false;
    if (!/\/en\/document\/\dq\d{2}-(slides|pr)\/?$/i.test(u.pathname)) return false;
    return !isBnpqyRejected(url);
  } catch {
    return false;
  }
}

export function mergeBnpqyKnownQuarterDocs(): Map<string, BnpqyQuarterDocs> {
  return new Map(Object.entries(BNPQY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
