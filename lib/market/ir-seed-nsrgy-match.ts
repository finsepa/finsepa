/** Nestlé IR: quarterly sales / HY / FY investor presentation as slides, English press as filings. Never transcript / report / aide-memoire. */

export type NsrgyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const NSRGY_IR_PAGES = ["https://www.nestle.com/investors/publications"] as const;

function pdf(path: string): string {
  return `https://www.nestle.com/sites/default/files/${path}`;
}

/**
 * Calendar quarters. Filename folders are publish-month, not period-end.
 * Q1/Q3 are official sales presentations (not Costco-style monthly sales).
 */
export const NSRGY_KNOWN_QUARTER_DOCS: Readonly<Record<string, NsrgyQuarterDocs>> = {
  "Q2 2026": {
    slides: pdf("2026-07/half-year-results-investor-presentation-2026.pdf"),
    filings: pdf("2026-07/half-year-results-press-release-2026-en.pdf"),
  },
  "Q1 2026": {
    slides: pdf("2026-04/three-month-sales-investor-presentation-2026.pdf"),
    filings: pdf("2026-04/three-month-sales-press-release-2026-en.pdf"),
  },
  "Q4 2025": {
    slides: pdf("2026-02/full-year-results-investor-presentation-2025.pdf"),
    filings: pdf("2026-02/full-year-results-press-release-2025-en.pdf"),
  },
  "Q3 2025": {
    slides: pdf("2025-10/nine-month-sales-investor-presentation-2025.pdf"),
    filings: pdf("2025-10/nine-month-sales-press-release-2025-en.pdf"),
  },
  "Q2 2025": {
    slides: pdf("2025-07/half-year-results-investor-presentation-2025.pdf"),
    filings: pdf("2025-07/half-year-results-press-release-2025-en.pdf"),
  },
  "Q1 2025": {
    slides: pdf("2025-04/three-month-sales-investor-presentation-2025.pdf"),
    filings: pdf("2025-04/three-month-sales-press-release-2025-en.pdf"),
  },
  "Q4 2024": {
    slides: pdf("2025-02/full-year-results-investor-presentation-2024.pdf"),
    filings: pdf("2025-02/full-year-results-press-release-2024-en.pdf"),
  },
  "Q3 2024": {
    slides: pdf("2024-10/investor-presentation-2024-nine-month-sales.pdf"),
    filings: pdf("2024-10/2024-nine-month-sales-press-release-en.pdf"),
  },
  "Q2 2024": {
    slides: pdf("2024-07/investor-presentation-2024-half-year-results.pdf"),
    filings: pdf("2024-07/2024-half-year-results-press-release-en.pdf"),
  },
  "Q1 2024": {
    slides: pdf("2024-04/investor-presentation-2024-three-month-sales.pdf"),
    filings: pdf("2024-04/three-month-sales-2024-press-release-en.pdf"),
  },
  "Q4 2023": {
    slides: pdf("2024-02/2023-full-year-results-investor-presentation.pdf"),
    filings: pdf("2024-02/2023-full-year-results-press-release-en.pdf"),
  },
  "Q3 2023": {
    slides: null,
    filings: pdf("2023-10/2023-nine-month-sales-press-release-en.pdf"),
  },
  "Q2 2023": {
    slides: null,
    filings: pdf("2023-07/2023-half-year-results-press-release-en.pdf"),
  },
  "Q1 2023": {
    slides: pdf("2023-04/investor-presentation-2023-three-month-sales.pdf"),
    filings: pdf("2023-04/three-month-sales-2023-press-release-en.pdf"),
  },
  "Q4 2022": {
    slides: pdf("2023-02/2022-full-year-results-investor-presentation.pdf"),
    filings: pdf("2023-02/2022-full-year-results-press-release-en.pdf"),
  },
  "Q3 2022": {
    slides: null,
    filings: pdf("2022-10/2022-nine-month-sales-press-release-en.pdf"),
  },
  "Q2 2022": {
    slides: null,
    filings: pdf("2022-07/2022-half-year-results-press-release-en.pdf"),
  },
  "Q1 2022": {
    slides: pdf("2022-04/investor-presentation-2022-three-month-sales.pdf"),
    filings: pdf("2022-04/three-month-sales-2022-press-release-en.pdf"),
  },
};

export function isNsrgyRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|prepared-remarks|transcript|aide-memoire|half-year-report|annual-review|financial-statements|press-conference|alternative-performance|-de\.pdf|-fr\.pdf/i.test(
    n,
  );
}

export function isNsrgyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /nestle\.com\/sites\/default\/files\/.+\.pdf/i.test(url) && !isNsrgyRejected(url);
}

export function mergeNsrgyKnownQuarterDocs(): Map<string, NsrgyQuarterDocs> {
  return new Map(Object.entries(NSRGY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
