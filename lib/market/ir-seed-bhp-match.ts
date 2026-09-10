/** BHP IR: HY (Q2) and FY (Q4) results presentation as slides. Q1/Q3 operational reviews are not earnings — leave empty. Never speech / transcript / BofA. FY ends 30 Jun. */

export type BhpQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BHP_FY_END = "06-30";

function media(yyyy: string, file: string): string {
  return `https://www.bhp.com/-/media/documents/media/reports-and-presentations/${yyyy}/${file}`;
}

export const BHP_IR_PAGES = [
  "https://www.bhp.com/investor-hub/reports-and-presentations/financial-results-operational-reviews",
] as const;

/**
 * Only HY (period-end 31 Dec = Q2) and FY (period-end 30 Jun = Q4) publish earnings decks.
 * GCS/WAF 403 from some hosts — catalog still locks issuer URLs (same as RTX).
 */
export const BHP_KNOWN_QUARTER_DOCS: Readonly<Record<string, BhpQuarterDocs>> = {
  "Q4 2026": {
    slides: media("2026", "260818_bhpresultsfortheyearended30june2026_presentation.pdf"),
    filings: null,
  },
  "Q2 2026": {
    slides: media("2026", "260217_bhpresultsforthehalfyearended31dec2025_presentation.pdf"),
    filings: null,
  },
};

export function isBhpRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|_speech|transcript|operational.?review|bofa|conference|annual.?report/i.test(n);
}

export function isBhpIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /bhp\.com\/-\/media\/documents\/media\/reports-and-presentations\/.+\.pdf/i.test(url) && !isBhpRejected(url);
}

export function mergeBhpKnownQuarterDocs(): Map<string, BhpQuarterDocs> {
  return new Map(Object.entries(BHP_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
