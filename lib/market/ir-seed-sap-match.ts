/** SAP IR: sap-YYYY-qN-presentation as slides, English statement as filings. Never mitteilung / Sapphire / performance-measures. */

export type SapQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const DOCS = "https://www.sap.com/docs/download/investors";

export const SAP_IR_PAGES = ["https://www.sap.com/investors/en/reports.html"] as const;

/** Q2 2026 English deck was not on IR (German mitteilung + performance-measures only). */
const SAP_MISSING_SLIDES = new Set(["Q2 2026"]);

export function sapSlidesUrl(fq: number, fy: number): string | null {
  if (fq < 1 || fq > 4 || fy < 2022) return null;
  const label = `Q${fq} ${fy}`;
  if (SAP_MISSING_SLIDES.has(label)) return null;
  return `${DOCS}/${fy}/sap-${fy}-q${fq}-presentation.pdf`;
}

export function sapFilingsUrl(fq: number, fy: number): string | null {
  if (fq < 1 || fq > 4 || fy < 2022) return null;
  return `${DOCS}/${fy}/sap-${fy}-q${fq}-statement.pdf`;
}

export function isSapRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|mitteilung|performance-measures|sapphire|deutsch|transcript/i.test(n);
}

export function isSapIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /sap\.com\/docs\/download\/investors\/\d{4}\/sap-\d{4}-q[1-4]-(presentation|statement)\.pdf/i.test(url) &&
    !isSapRejected(url);
}

/** True only when the filename names this quarter (`sap-2025-q1-…` on a Q1 2025 row). */
export function sapUrlMatchesLabel(url: string, label: string): boolean {
  const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return false;
  return decodeURIComponent(url).toLowerCase().includes(`sap-${m[2]}-q${m[1]}-`);
}

export function mergeSapConstructedQuarterDocs(labels: readonly string[]): Map<string, SapQuarterDocs> {
  const out = new Map<string, SapQuarterDocs>();
  for (const label of labels) {
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    out.set(label, { slides: sapSlidesUrl(fq, fy), filings: sapFilingsUrl(fq, fy) });
  }
  return out;
}
