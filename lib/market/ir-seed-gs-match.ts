/** Goldman Sachs IR: earnings-results presentation as slides, earnings-results PDF as filings. Never 10-K, proxy, or fixed-income fact sheets. */

export type GsQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** goldmansachs.com PDF paths redirect to an HTML viewer; lock the CloudFront object. */
export const GS_PDF_CDN = "https://d3cobg6h0snvt3.cloudfront.net/pressroom/press-releases/current/pdfs";

export function gsSlidesUrl(fq: number, fy: number): string {
  return `${GS_PDF_CDN}/${fy}-q${fq}-earnings-results-presentation.pdf`;
}

export function gsFilingsUrl(fq: number, fy: number): string {
  return `${GS_PDF_CDN}/${fy}-q${fq}-results.pdf`;
}

export const GS_IR_PAGES = ["https://www.goldmansachs.com/investor-relations"] as const;

export function isGsRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|10-k|proxy-statement|fixed-income|fact-sheet|libor|transcript/i.test(n);
}

export function mergeGsConstructedQuarterDocs(labels: readonly string[]): Map<string, GsQuarterDocs> {
  const out = new Map<string, GsQuarterDocs>();
  for (const label of labels) {
    const m = label.trim().match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    out.set(label, { slides: gsSlidesUrl(fq, fy), filings: gsFilingsUrl(fq, fy) });
  }
  return out;
}
