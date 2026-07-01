/** Ferrari quarterly decks on `cdn.ferrari.com` (IR site is bot-blocked server-side). */

const FERRARI_PDF_BASE = "https://cdn.ferrari.com/cms/network/media/pdf";

function encodePdfFilename(name: string): string {
  return `${FERRARI_PDF_BASE}/${encodeURIComponent(name).replace(/%20/g, "%20")}`;
}

/** `2026-05-04` → `2026_05_04`, plus ±1 day (deck filenames often use filing/release day). */
export function ferrariReportDatePrefixes(reportDateYmd: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDateYmd)) return [];
  const [y, m, d] = reportDateYmd.split("-").map(Number);
  const base = Date.UTC(y!, m! - 1, d!);
  const out: string[] = [];
  for (const delta of [0, 1, -1]) {
    const dt = new Date(base + delta * 86400000);
    const py = dt.getUTCFullYear();
    const pm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const pd = String(dt.getUTCDate()).padStart(2, "0");
    const prefix = `${py}_${pm}_${pd}`;
    if (!out.includes(prefix)) out.push(prefix);
  }
  return out;
}

export function ferrariPresentationFilenames(fq: number, fy: number): string[] {
  if (fq === 4) {
    return [
      `Ferrari - FY ${fy} Results Presentation.pdf`,
      `Ferrari - Q4 and Full Year ${fy} Results Presentation.pdf`,
    ];
  }
  return [`Ferrari - Q${fq} ${fy} Results Presentation.pdf`];
}

export function ferrariPresentationCandidateUrls(
  reportDateYmd: string | null,
  fq: number,
  fy: number,
): string[] {
  if (!reportDateYmd) return [];
  const prefixes = ferrariReportDatePrefixes(reportDateYmd);
  const names = ferrariPresentationFilenames(fq, fy);
  const out: string[] = [];
  for (const prefix of prefixes) {
    for (const name of names) {
      out.push(encodePdfFilename(`${prefix} - ${name}`));
    }
  }
  return [...new Set(out)];
}
