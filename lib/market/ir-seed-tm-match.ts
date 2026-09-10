/** Toyota IR: presentation_2_en as slides, English financial summary as filings. FY ends 31 Mar and matches vault labels. Never JP-only / transcript / Q&A. */

export type TmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const TM_FY_END = "03-31";

const FR = "https://global.toyota/pages/global_toyota/ir/financial-results";

export const TM_IR_PAGES = ["https://global.toyota/en/ir/financial-results/"] as const;

export function tmSlidesUrl(fq: number, fy: number): string | null {
  if (fq < 1 || fq > 4 || fy < 2022) return null;
  return `${FR}/${fy}_${fq}q_presentation_2_en.pdf`;
}

export function tmFilingsUrl(fq: number, fy: number): string | null {
  if (fq < 1 || fq > 4 || fy < 2022) return null;
  return `${FR}/${fy}_${fq}q_summary_en.pdf`;
}

export function isTmRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|_jp\.pdf|transcript|q&a|qa.?summary/i.test(n);
}

export function isTmIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /global\.toyota\/pages\/global_toyota\/ir\/financial-results\/.+\.pdf/i.test(url) && !isTmRejected(url);
}

export function tmUrlMatchesLabel(url: string, label: string): boolean {
  const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return false;
  return decodeURIComponent(url).toLowerCase().includes(`${m[2]}_${m[1]}q_`);
}

export function mergeTmConstructedQuarterDocs(labels: readonly string[]): Map<string, TmQuarterDocs> {
  const out = new Map<string, TmQuarterDocs>();
  for (const label of labels) {
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    out.set(label, { slides: tmSlidesUrl(fq, fy), filings: tmFilingsUrl(fq, fy) });
  }
  return out;
}
