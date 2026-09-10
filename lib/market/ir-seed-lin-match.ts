/** Linde IR: teleconference slides as Slides; earnings-release tables PDF as Filings. Never 10-Q / transcript / annual report. */

export type LinQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const ASSETS = "https://assets.linde.com/-/media/global/corporate/corporate/documents";

function yy(year: number): string {
  return String(year).slice(-2);
}

function slidesUrl(year: number, q: number): string {
  return `${ASSETS}/investors/quarterly-earnings/linde${q}q${yy(year)}teleconferenceslides.pdf`;
}

function filingsUrl(year: number, q: number): string {
  if (year === 2023 && q === 1) {
    return `${ASSETS}/press-releases/2023/1q23-earnings-release-tables.pdf`;
  }
  return `${ASSETS}/press-releases/${year}/linde-${q}q${yy(year)}-earnings-release-tables.pdf`;
}

export const LIN_IR_PAGES = ["https://www.linde.com/investors/financial-reports"] as const;

/** Calendar FY. Q4 2023 teleconference slides 403 — filings only. */
export const LIN_KNOWN_QUARTER_DOCS: Readonly<Record<string, LinQuarterDocs>> = {
  "Q2 2026": { slides: slidesUrl(2026, 2), filings: filingsUrl(2026, 2) },
  "Q1 2026": { slides: slidesUrl(2026, 1), filings: filingsUrl(2026, 1) },
  "Q4 2025": { slides: slidesUrl(2025, 4), filings: filingsUrl(2025, 4) },
  "Q3 2025": { slides: slidesUrl(2025, 3), filings: filingsUrl(2025, 3) },
  "Q2 2025": { slides: slidesUrl(2025, 2), filings: filingsUrl(2025, 2) },
  "Q1 2025": { slides: slidesUrl(2025, 1), filings: filingsUrl(2025, 1) },
  "Q4 2024": { slides: slidesUrl(2024, 4), filings: filingsUrl(2024, 4) },
  "Q3 2024": { slides: slidesUrl(2024, 3), filings: filingsUrl(2024, 3) },
  "Q2 2024": { slides: slidesUrl(2024, 2), filings: filingsUrl(2024, 2) },
  "Q1 2024": { slides: slidesUrl(2024, 1), filings: filingsUrl(2024, 1) },
  "Q4 2023": { slides: null, filings: filingsUrl(2023, 4) },
  "Q3 2023": { slides: slidesUrl(2023, 3), filings: filingsUrl(2023, 3) },
  "Q2 2023": { slides: slidesUrl(2023, 2), filings: filingsUrl(2023, 2) },
  "Q1 2023": { slides: slidesUrl(2023, 1), filings: filingsUrl(2023, 1) },
  "Q4 2022": { slides: slidesUrl(2022, 4), filings: filingsUrl(2022, 4) },
  "Q3 2022": { slides: slidesUrl(2022, 3), filings: filingsUrl(2022, 3) },
  "Q2 2022": { slides: slidesUrl(2022, 2), filings: filingsUrl(2022, 2) },
  "Q1 2022": { slides: slidesUrl(2022, 1), filings: filingsUrl(2022, 1) },
};

export function isLinRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|transcript|annual-report|directors[-_]?report|praxair|full-year-financial/i.test(
    n,
  );
}

export function isLinIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    /assets\.linde\.com\/.+\.pdf/i.test(url) &&
    /(teleconferenceslides|earnings-release-tables)/i.test(url) &&
    !isLinRejected(url)
  );
}

export function mergeLinKnownQuarterDocs(): Map<string, LinQuarterDocs> {
  return new Map(Object.entries(LIN_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
