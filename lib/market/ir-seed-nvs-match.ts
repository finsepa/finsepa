/** Novartis IR: qN-YYYY investor presentation as slides, English media release as filings. */

export type NvsQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const FILES = "https://www.novartis.com/sites/novartis_com/files";

export const NVS_IR_PAGES = ["https://www.novartis.com/investors/financial-data/quarterly-results"] as const;

/** Q1–Q3 2022 decks are gone from the IR CDN (404). Press PDFs remain. */
const NVS_MISSING_SLIDES = new Set(["Q1 2022", "Q2 2022", "Q3 2022"]);

export function nvsSlidesUrl(fq: number, fy: number): string | null {
  if (fq < 1 || fq > 4 || fy < 2022) return null;
  const label = `Q${fq} ${fy}`;
  if (NVS_MISSING_SLIDES.has(label)) return null;
  return `${FILES}/q${fq}-${fy}-investor-presentation.pdf`;
}

export function nvsFilingsUrl(fq: number, fy: number): string | null {
  if (fq < 1 || fq > 4 || fy < 2022) return null;
  return `${FILES}/q${fq}-${fy}-media-release-en.pdf`;
}

export function isNvsRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|media-release-de|interim-financial|impact-and-sustainability|deutsch|podcast|transcript|webcast/i.test(
    n,
  );
}

export function isNvsIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /novartis\.com\/sites\/novartis_com\/files\/.+\.pdf/i.test(url) && !isNvsRejected(url);
}

/** True only when the filename names this quarter (`q1-2025-…` on a Q1 2025 row). */
export function nvsUrlMatchesLabel(url: string, label: string): boolean {
  const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return false;
  return decodeURIComponent(url).toLowerCase().includes(`q${m[1]}-${m[2]}-`);
}

export function mergeNvsConstructedQuarterDocs(labels: readonly string[]): Map<string, NvsQuarterDocs> {
  const out = new Map<string, NvsQuarterDocs>();
  for (const label of labels) {
    const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
    if (!m) continue;
    const fq = Number(m[1]);
    const fy = Number(m[2]);
    out.set(label, { slides: nvsSlidesUrl(fq, fy), filings: nvsFilingsUrl(fq, fy) });
  }
  return out;
}
