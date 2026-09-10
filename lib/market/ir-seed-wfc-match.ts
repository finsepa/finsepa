/** Wells Fargo IR: financial-results presentation as slides, earnings PDF as filings. Never supplement, 10-Q, or transcripts. */

export type WfcQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const WFC_PDF = "https://www.wellsfargo.com/assets/pdf/about/investor-relations/earnings";

const WFC_ORDINAL = ["", "first", "second", "third", "fourth"] as const;

export function wfcOrdinal(fq: number): string | null {
  if (fq < 1 || fq > 4) return null;
  return WFC_ORDINAL[fq] ?? null;
}

/** Prefer financial-results; Q3 2025 is presentation-only. */
export function wfcSlidesCandidates(fq: number, fy: number): string[] {
  const ord = wfcOrdinal(fq);
  if (!ord) return [];
  const financial = `${WFC_PDF}/${ord}-quarter-${fy}-financial-results.pdf`;
  const presentation = `${WFC_PDF}/${ord}-quarter-${fy}-presentation.pdf`;
  if (fq === 3 && fy === 2025) return [presentation, financial];
  return [financial, presentation];
}

export function wfcSlidesUrl(fq: number, fy: number): string | null {
  return wfcSlidesCandidates(fq, fy)[0] ?? null;
}

export function wfcFilingsUrl(fq: number, fy: number): string {
  const ord = wfcOrdinal(fq) ?? "first";
  return `${WFC_PDF}/${ord}-quarter-${fy}-earnings.pdf`;
}

export const WFC_IR_PAGES = [
  "https://www.wellsfargo.com/about/investor-relations/quarterly-earnings/",
] as const;

export function isWfcRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|supplement|10-?q|10-?k|transcript|prepared\s*remarks/i.test(n);
}

export function mergeWfcConstructedQuarterDocs(labels: readonly string[]): Map<string, WfcQuarterDocs> {
  const out = new Map<string, WfcQuarterDocs>();
  for (const label of labels) {
    const m = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    out.set(label, { slides: wfcSlidesUrl(fq, fy), filings: wfcFilingsUrl(fq, fy) });
  }
  return out;
}
