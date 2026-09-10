/** Palantir IR: quarterly Business Update PDF as slides. Never SEC HTML or Seeking Alpha. */

export type PltrQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const FILES = "https://investors.palantir.com/files";

export function pltrBusinessUpdateUrl(fq: number, fy: number): string {
  return `${FILES}/Palantir%20-%20Q${fq}%20${fy}%20Business%20Update.pdf`;
}

export function labelFromPltrPeriod(label: string | null | undefined): string | null {
  const m = label?.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return null;
  return `Q${m[1]} ${m[2]}`;
}

/**
 * Q3 2022 first-party URLs (dash and no-dash) return WAF HTML, not a PDF.
 * Do not construct that quarter. All other in-scope quarters use the dash filename.
 */
export const PLTR_KNOWN_QUARTER_DOCS: Readonly<Record<string, PltrQuarterDocs>> = {
  "Q2 2026": { slides: pltrBusinessUpdateUrl(2, 2026), filings: null },
  "Q1 2026": { slides: pltrBusinessUpdateUrl(1, 2026), filings: null },
  "Q4 2025": { slides: pltrBusinessUpdateUrl(4, 2025), filings: null },
  "Q3 2025": { slides: pltrBusinessUpdateUrl(3, 2025), filings: null },
  "Q2 2025": { slides: pltrBusinessUpdateUrl(2, 2025), filings: null },
  "Q1 2025": { slides: pltrBusinessUpdateUrl(1, 2025), filings: null },
  "Q4 2024": { slides: pltrBusinessUpdateUrl(4, 2024), filings: null },
  "Q3 2024": { slides: pltrBusinessUpdateUrl(3, 2024), filings: null },
  "Q2 2024": { slides: pltrBusinessUpdateUrl(2, 2024), filings: null },
  "Q1 2024": { slides: pltrBusinessUpdateUrl(1, 2024), filings: null },
  "Q4 2023": { slides: pltrBusinessUpdateUrl(4, 2023), filings: null },
  "Q3 2023": { slides: pltrBusinessUpdateUrl(3, 2023), filings: null },
  "Q2 2023": { slides: pltrBusinessUpdateUrl(2, 2023), filings: null },
  "Q1 2023": { slides: pltrBusinessUpdateUrl(1, 2023), filings: null },
  "Q4 2022": { slides: pltrBusinessUpdateUrl(4, 2022), filings: null },
  "Q3 2022": { slides: null, filings: null },
  "Q2 2022": { slides: pltrBusinessUpdateUrl(2, 2022), filings: null },
  "Q1 2022": { slides: pltrBusinessUpdateUrl(1, 2022), filings: null },
};

export const PLTR_IR_PAGES = ["https://investors.palantir.com/"] as const;

/** Future quarters after the last catalogued print: dash `Business Update` on investors.palantir.com/files. */
export function pltrSlidesUrlForLabel(label: string): string | null {
  const known = PLTR_KNOWN_QUARTER_DOCS[label];
  if (known) return known.slides;
  const m = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return null;
  const fq = Number(m[1]);
  const fy = Number(m[2]);
  if (fy === 2022 && fq === 3) return null;
  if (fy < 2022) return null;
  return pltrBusinessUpdateUrl(fq, fy);
}
