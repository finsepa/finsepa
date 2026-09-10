/** LVMH IR: quarterly revenue / HY / FY presentation as slides. Press is HTML — filings stay empty. Never URD / financial report / snapshot. */

export type LvmuyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

function pdf(id: string): string {
  return `https://lvmh-com.cdn.prismic.io/lvmh-com/${id}`;
}

export const LVMUY_IR_PAGES = [
  "https://www.lvmh.com/en/financial-calendar",
  "https://www.lvmh.com/en/investors/investors-and-analysts",
] as const;

/**
 * Calendar quarters. Q1/Q3 are official revenue decks (Nestlé-like, not monthly sales).
 * Prefer English FirsthalfResults_Presentation over French RésultatsSemestriels.
 */
export const LVMUY_KNOWN_QUARTER_DOCS: Readonly<Record<string, LvmuyQuarterDocs>> = {
  "Q2 2026": { slides: pdf("68yUok3lubOY0jf__LVMH_2026FirsthalfResults_Presentation.pdf"), filings: null },
  "Q1 2026": { slides: pdf("ad0KsJ1ZCF7ETJLf_LVMHQ12026.pdf"), filings: null },
  "Q4 2025": { slides: pdf("aXjo4AIvOtkhB_7H_LVMH-2025FullYearresults.pdf"), filings: null },
  "Q3 2025": { slides: pdf("aO5reZ5xUNkB184B_LVMHQ32025_Presentation.pdf"), filings: null },
  "Q2 2025": { slides: pdf("aIJJHVGsbswqTOPX_LVMH_2025FirsthalfResults.pdf"), filings: null },
  "Q1 2025": { slides: pdf("Z_0pc-vxEdbNPBim_LVMHQ12025.pdf"), filings: null },
  "Q4 2024": { slides: pdf("Z5j825bqstJ998qD_LVMH-2024FullYearresults.pdf"), filings: null },
  "Q3 2024": { slides: pdf("Zw6EcoF3NbkBXeDD_LVMHQ32024.pdf"), filings: null },
  "Q1 2024": { slides: pdf("ZmHVIJm069VX1hW5_lvmh-q1-2024-1-.pdf"), filings: null },
  "Q4 2023": { slides: pdf("ZmMq8Jm069VX1j0t_lvmh_2023-annual-results.pdf"), filings: null },
  "Q3 2023": { slides: pdf("ZmbOpZm069VX1luj_lvmh-q3-2023-1-.pdf"), filings: null },
  "Q2 2023": { slides: pdf("ZmF8DJm069VX1gTQ_lvmh_2023-first-half-results.pdf"), filings: null },
  "Q1 2023": { slides: pdf("Zmb_G5m069VX1mcb_lvmh_presentation_q1-2023-12-04-2023-1-.pdf"), filings: null },
  "Q4 2022": { slides: pdf("ZmcHuJm069VX1mkc_lvmh-2022-annual-results.pdf"), filings: null },
  "Q3 2022": { slides: pdf("ZmcRspm069VX1msr_lvmh-q3-2022-1-.pdf"), filings: null },
  "Q2 2022": { slides: pdf("ZmcYU5m069VX1mxw_lvmh_2022-first-half-results.pdf"), filings: null },
  "Q1 2022": { slides: pdf("Zmcb3Zm069VX1m0Q_lvmh_presentation_q1-2022-1-.pdf"), filings: null },
};

export function isLvmuyRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|universalregistration|urd|financialdocuments|document-financier|financialreport|rapportfinancier|snapshot|letter.?to.?shareholders|positive_impact/i.test(
    n,
  );
}

export function isLvmuyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /lvmh-com\.cdn\.prismic\.io\/lvmh-com\/.+\.pdf/i.test(url) && !isLvmuyRejected(url);
}

export function mergeLvmuyKnownQuarterDocs(): Map<string, LvmuyQuarterDocs> {
  return new Map(Object.entries(LVMUY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
