/** KLA IR: earnings slide presentation as slides, press PDF as filings. Never 10-Q/10-K, infographic, shareholder letter. FY ends 30 Jun. */

export type KlacQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const KLAC_FY_END = "06-30";

export const KLAC_IR_PAGES = [
  "https://ir.kla.com/financial-information/financial-results",
  "https://ir.kla.com/news-events/press-releases",
] as const;

export const KLAC_KNOWN_QUARTER_DOCS: Readonly<Record<string, KlacQuarterDocs>> = {
  "Q4 2026": {
    slides:
      "https://d1io3yog0oux5.cloudfront.net/_7791115a123b86b3f10b1a5eb5210224/klatencor/db/1117/10668/earnings_slide_presentation/KLA+Earnings+Slides+-+Q4+FY26.pdf",
    filings:
      "https://d1io3yog0oux5.cloudfront.net/_7791115a123b86b3f10b1a5eb5210224/klatencor/news/2026-07-28_KLA_CORPORATION_REPORTS_FISCAL_2026_FOURTH_518.pdf",
  },
  "Q2 2026": {
    slides:
      "https://d1io3yog0oux5.cloudfront.net/_a357bfc9113388e37f3bfcb2ea2f0b64/klatencor/db/1117/10612/earnings_slide_presentation/KLA+Earnings+Slides+-+Q2+FY26.pdf",
    filings: null,
  },
};

export function isKlacRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|form[-_\s]?10-?[qk]|10-q|10-k|infographic|letter.?to.?shareholders|shareholder.?letter|proxy|stock-split|8-k/i.test(
    n,
  );
}

export function isKlacIrUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const n = decodeURIComponent(url);
  return (
    (/d1io3yog0oux5\.cloudfront\.net\/.+\/klatencor\//i.test(n) || /ir\.kla\.com\/.+\.pdf/i.test(n)) &&
    !isKlacRejected(n)
  );
}

export function mergeKlacKnownQuarterDocs(): Map<string, KlacQuarterDocs> {
  return new Map(Object.entries(KLAC_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
