/**
 * Rio Tinto ADR (RIO) IR — calendar FY.
 * Slides = HY / Annual results presentation; Filings = results release PDF.
 * Only HY (Q2) and FY/Annual (Q4) publish earnings packs; Q1/Q3 are operations reviews — leave empty.
 * Never SEC HTML / QOR / Capital Markets Day / script / transcript.
 */

export type RioQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const RIO_RESULTS =
  "https://www.riotinto.com/-/media/content/documents/invest/financial-news-and-performance/results";

function results(year: number, file: string): string {
  return `${RIO_RESULTS}/${year}/${file}`;
}

export const RIO_IR_PAGES = [
  "https://www.riotinto.com/en/invest/invest-archive",
  "https://www.riotinto.com/en/invest/presentations",
  "https://www.riotinto.com/en/invest",
] as const;

/**
 * Catalog from invest-archive (riotinto.com / cdn-rio.dataweavers.io media paths).
 * 2024+ uses `{year}-hy-results*` / `{year}-annual-results*`; 2022–2023 use `rt-*-results-{year}*`.
 */
export const RIO_KNOWN_QUARTER_DOCS: Readonly<Record<string, RioQuarterDocs>> = {
  "Q2 2026": {
    slides: results(2026, "2026-hy-results-slides.pdf"),
    filings: results(2026, "2026-half-year-results.pdf"),
  },
  "Q4 2025": {
    slides: results(2025, "2025-annual-results-slides.pdf"),
    filings: results(2025, "2025-annual-results.pdf"),
  },
  "Q2 2025": {
    slides: results(2025, "2025-hy-results-slides.pdf"),
    filings: results(2025, "2025-hy-results.pdf"),
  },
  "Q4 2024": {
    slides: results(2024, "2024-annual-results-slides.pdf"),
    filings: results(2024, "2024-annual-results.pdf"),
  },
  "Q2 2024": {
    slides: results(2024, "2024-hy-results-slides.pdf"),
    filings: results(2024, "2024-hy-results.pdf"),
  },
  "Q4 2023": {
    slides: results(2023, "rt-annual-results-2023-slides.pdf"),
    filings: results(2023, "rt-annual-results-2023.pdf"),
  },
  "Q2 2023": {
    slides: results(2023, "rt-half-year-results-2023-slides.pdf"),
    filings: results(2023, "rt-half-year-results-2023.pdf"),
  },
  "Q4 2022": {
    slides: results(2022, "rt-annual-results-2022-slides.pdf"),
    filings: results(2022, "rt-annual-results-2022.pdf"),
  },
  "Q2 2022": {
    slides: results(2022, "rt-half-year-results-2022-slides.pdf"),
    filings: results(2022, "rt-half-year-results-2022.pdf"),
  },
};

export function isRioRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|transcript|script|qor|operations.?review|production|cmd|capital.?markets|investor.?day|annual.?report|climate|speech|\.xls/i.test(
    n,
  );
}

export function isRioIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "www.riotinto.com" ||
        host === "riotinto.com" ||
        host.endsWith(".riotinto.com") ||
        host === "cdn-rio.dataweavers.io"
      )
    ) {
      return false;
    }
    if (!u.pathname.includes("/-/media/content/documents/invest/financial-news-and-performance/results/")) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    const looksLikeResults =
      /(?:hy|half-year|annual)-results(?:-slides)?\.pdf$/i.test(u.pathname) ||
      /rt-(?:half-year|annual)-results-\d{4}(?:-slides)?\.pdf$/i.test(u.pathname);
    return looksLikeResults && !isRioRejected(url);
  } catch {
    return false;
  }
}

export function mergeRioKnownQuarterDocs(): Map<string, RioQuarterDocs> {
  return new Map(Object.entries(RIO_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
