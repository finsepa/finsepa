/**
 * Welltower (WELL) IR — calendar FY.
 * Slides = quarterly Business Update deck; Filings = Earnings Release PDF.
 * Supplemental / Fixed Income / 10-Q are NOT slides. Never SEC HTML.
 */

export type WellQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const WELL_UPLOADS = "https://welltower.com/wp-content/uploads";

function upload(pathFile: string): string {
  return `${WELL_UPLOADS}/${pathFile}`;
}

export const WELL_IR_PAGES = [
  "https://welltower.com/investors/",
  "https://welltower.com/investors/financial-summary/",
] as const;

/**
 * Catalog from investors + financial-summary (filenames vary: vF / vFF / vFFF / month names).
 * Q4 2022 Business Update PDF not locked to a stable path — slides left empty.
 */
export const WELL_KNOWN_QUARTER_DOCS: Readonly<Record<string, WellQuarterDocs>> = {
  "Q2 2026": {
    slides: upload("2026/07/Business-Update-2Q26_vFF.pdf"),
    filings: upload("2026/07/2Q26-Earnings-Release-99.1-FINAL.pdf"),
  },
  "Q1 2026": {
    slides: upload("2026/04/Business-Update-1Q26_vFFF.pdf"),
    filings: upload("2026/04/1Q26-Earnings-Release-99.1-FINAL.pdf"),
  },
  "Q4 2025": {
    slides: upload("2026/02/Business-Update-4Q25_vFF.pdf"),
    filings: upload("2026/02/4Q25-Earnings-Release-99.1-FINAL.pdf"),
  },
  "Q3 2025": {
    slides: upload("2025/10/Business-Update-3Q25_vF.pdf"),
    filings: upload("2025/10/3Q25-Earnings-Release-99.1-FINAL.pdf"),
  },
  "Q2 2025": {
    slides: upload("2025/07/Business-Update-2Q25-vF.pdf"),
    filings: upload("2025/07/2Q25-Earnings-Release.pdf"),
  },
  "Q1 2025": {
    slides: upload("2025/04/Business-Update-1Q25-vFFF.pdf"),
    filings: upload("2025/04/1Q25-Earnings-Release-99.1-FINAL.pdf"),
  },
  "Q4 2024": {
    slides: upload("2025/02/Business-Update-4Q24_vF.pdf"),
    filings: upload("2025/02/4Q24-Earnings-Release.pdf"),
  },
  "Q3 2024": {
    slides: upload("2025/03/Business-Update-3Q24.pdf"),
    filings: upload("2025/02/3Q24-Earnings-Release.pdf"),
  },
  "Q2 2024": {
    slides: upload("2024/07/Business-Update-2Q24.pdf"),
    filings: upload("2025/02/2Q24-Earnings-Release.pdf"),
  },
  "Q1 2024": {
    slides: upload("2024/04/Business-Update-1Q24-1.pdf"),
    filings: upload("2025/02/1Q24-Earnings-Release.pdf"),
  },
  "Q4 2023": {
    slides: upload("2024/02/Business-Update-4Q23_F.pdf"),
    filings: upload("2025/02/4Q23-Earnings-Release.pdf"),
  },
  "Q3 2023": {
    slides: upload("2023/10/Business-Update-3Q23.pdf"),
    filings: upload("2025/02/3Q23-Earnings-Release.pdf"),
  },
  "Q2 2023": {
    slides: upload("2023/07/Business-Update-JULY2023.pdf"),
    filings: upload("2025/02/2Q23-Earnings-Release.pdf"),
  },
  "Q1 2023": {
    slides: upload("2023/05/Business-Update-May-2023vFFF.pdf"),
    filings: upload("2025/02/1Q23-Earnings-Release.pdf"),
  },
  "Q4 2022": {
    slides: null,
    filings: upload("financial-summary/earnings-release/2022/4Q22-Earnings-Release.pdf"),
  },
  "Q3 2022": {
    slides: upload("2022/11/Business-Update-November-2022_vFINAL1.pdf"),
    filings: upload("financial-summary/earnings-release/2022/3Q22-Earnings-Release.pdf"),
  },
  "Q2 2022": {
    slides: upload("2022/08/Business-Update-August-2022.vFINAL-1.pdf"),
    filings: upload("financial-summary/earnings-release/2022/2Q22-Earnings-Release.pdf"),
  },
  "Q1 2022": {
    slides: upload("2022/04/Business-Update-21APR22.vF_.pdf"),
    filings: upload("financial-summary/earnings-release/2022/1Q22-Earnings-Release.pdf"),
  },
};

export function isWellRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|supplement|fixed[-_\s]*income|investor[-_\s]*day|transcript|webcast|infographic|\.xls/i.test(
    n,
  );
}

export function isWellIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "welltower.com" || host === "www.welltower.com" || host.endsWith(".welltower.com"))) {
      return false;
    }
    if (!u.pathname.includes("/wp-content/uploads/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    const path = u.pathname.toLowerCase();
    const isSlides = /business[-_]?update/i.test(path);
    const isFilings = /earnings[-_]?release/i.test(path);
    return (isSlides || isFilings) && !isWellRejected(url);
  } catch {
    return false;
  }
}

export function mergeWellKnownQuarterDocs(): Map<string, WellQuarterDocs> {
  return new Map(Object.entries(WELL_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
