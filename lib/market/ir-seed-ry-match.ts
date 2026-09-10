/** RBC IR: quarterly slides as slides, earnings-release PDF as filings. Never speech, pillar 3, strategic update, annual report, or XLS. */

export type RyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const RY_PDF = "https://www.rbc.com/investor-relations/_assets-custom/pdf";

/** Issuer FY ends October 31. */
export const RY_FY_END = "10-31";

export function rySlidesUrl(fq: number, fy: number): string {
  return `${RY_PDF}/${fy}q${fq}slides.pdf`;
}

export function ryFilingsUrl(fq: number, fy: number): string {
  return `${RY_PDF}/${fy}q${fq}release.pdf`;
}

export const RY_IR_PAGES = ["https://www.rbc.com/investor-relations/financial-information.html"] as const;

export function isRyRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return (
    /sec\.gov|\.xls|speech|pillar3|strategicupdate|ar_\d{4}|_report\.pdf|supp\.pdf|investor[-_\s]*day/i.test(
      n,
    )
  );
}

export function mergeRyConstructedQuarterDocs(labels: readonly string[]): Map<string, RyQuarterDocs> {
  const out = new Map<string, RyQuarterDocs>();
  for (const label of labels) {
    const m = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    out.set(label, { slides: rySlidesUrl(fq, fy), filings: ryFilingsUrl(fq, fy) });
  }
  return out;
}
