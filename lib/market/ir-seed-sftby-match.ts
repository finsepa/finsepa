/** SoftBank Group IR: English earnings-presentation as slides, financial-report as filings. Japanese FY in filenames is vault FY − 1. Never investor-presentation briefing / datasheet / JP-only. */

export type SftbyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends 31 Mar. Jun 30 2026 → Q1 2027. Filename q1fy2026 = vault Q1 2027 (jpFy = fy − 1). */
export const SFTBY_FY_END = "03-31";

const IR = "https://group.softbank/media/Project/sbg/sbg/pdf/ir";

export const SFTBY_IR_PAGES = ["https://group.softbank/en/ir/financials"] as const;

export function sftbyJpFy(vaultFy: number): number {
  return vaultFy - 1;
}

export function sftbySlidesUrl(fq: number, fy: number): string | null {
  if (fq < 1 || fq > 4 || fy < 2023) return null;
  const jp = sftbyJpFy(fy);
  if (jp < 2022) return null;
  return `${IR}/presentations/${jp}/earnings-presentation_q${fq}fy${jp}_01_en.pdf`;
}

export function sftbyFilingsUrl(fq: number, fy: number): string | null {
  if (fq < 1 || fq > 4 || fy < 2023) return null;
  const jp = sftbyJpFy(fy);
  if (jp < 2022) return null;
  return `${IR}/financials/financial_reports/financial-report_q${fq}fy${jp}_01_en.pdf`;
}

export function isSftbyRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|investor-presentation|earnings-datasheet|datasheet|_jp\.pdf|annual-report|transcript/i.test(n);
}

export function isSftbyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    /group\.softbank\/media\/Project\/sbg\/sbg\/pdf\/ir\/.+\.pdf/i.test(url) && !isSftbyRejected(url)
  );
}

export function sftbyUrlMatchesLabel(url: string, label: string): boolean {
  const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return false;
  const fq = Number(m[1]);
  const jp = sftbyJpFy(Number(m[2]));
  return decodeURIComponent(url).toLowerCase().includes(`q${fq}fy${jp}`);
}

export function mergeSftbyConstructedQuarterDocs(labels: readonly string[]): Map<string, SftbyQuarterDocs> {
  const out = new Map<string, SftbyQuarterDocs>();
  for (const label of labels) {
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    out.set(label, { slides: sftbySlidesUrl(fq, fy), filings: sftbyFilingsUrl(fq, fy) });
  }
  return out;
}
