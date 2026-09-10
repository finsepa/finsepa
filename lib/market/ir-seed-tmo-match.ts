/** Thermo Fisher IR: no recoverable quarterly earnings deck (recon / Investor Day / hashed 10-Q are not Slides). Press is Business Wire HTML — filings stay empty. */

export type TmoQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const TMO_IR_PAGES = [
  "https://ir.thermofisher.com/investors/financial-information/quarterly-results/default.aspx",
] as const;

/** Honest empty — no first-party quarterly presentation PDFs recovered on q4cdn. */
export const TMO_KNOWN_QUARTER_DOCS: Readonly<Record<string, TmoQuarterDocs>> = {};

export function isTmoRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|reconcil|investor[-_\s]*day|form[-_\s]?10-?[qk]|10-q|10-k|hashed|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf/i.test(
    n,
  );
}

export function isTmoIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /q4cdn\.com\/797047529\/.+\.pdf/i.test(url) && !isTmoRejected(url);
}

export function mergeTmoKnownQuarterDocs(): Map<string, TmoQuarterDocs> {
  return new Map(Object.entries(TMO_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
