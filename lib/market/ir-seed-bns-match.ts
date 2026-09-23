/**
 * Bank of Nova Scotia (BNS) IR — FY ends 10-31.
 * Slides = Investor_Presentation; Filings = Quarterly_Press_Release-EN.
 * Host: www.scotiabank.com/content/dam/.../corporate/quarterly-reports/.
 * Never Shareholders_Report / Marketing / Supplement / transcript / SEC HTML.
 */

export type BnsQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BNS_FY_END = "10-31";

export const BNS_IR_PAGES = [
  "https://www.scotiabank.com/ca/en/about/investors-shareholders/financial-result.html",
  "https://www.scotiabank.com/ca/en/about/investors-shareholders.html",
] as const;

const BNS_QR = "https://www.scotiabank.com/content/dam/scotiabank/corporate/quarterly-reports";

function bnsSlides(fy: number, q: number): string {
  const yy = String(fy).slice(-2);
  return `${BNS_QR}/${fy}/q${q}/Q${q}${yy}_Investor_Presentation.pdf`;
}

function bnsFilings(fy: number, q: number): string {
  const yy = String(fy).slice(-2);
  return `${BNS_QR}/${fy}/q${q}/Q${q}${yy}_Quarterly_Press_Release-EN.pdf`;
}

/** Catalog Q1 2022 → Q3 2026 (issuer October FY; Q4 2026 not yet). */
export const BNS_KNOWN_QUARTER_DOCS: Readonly<Record<string, BnsQuarterDocs>> = {
  "Q3 2026": { slides: bnsSlides(2026, 3), filings: bnsFilings(2026, 3) },
  "Q2 2026": { slides: bnsSlides(2026, 2), filings: bnsFilings(2026, 2) },
  "Q1 2026": { slides: bnsSlides(2026, 1), filings: bnsFilings(2026, 1) },
  "Q4 2025": { slides: bnsSlides(2025, 4), filings: bnsFilings(2025, 4) },
  "Q3 2025": { slides: bnsSlides(2025, 3), filings: bnsFilings(2025, 3) },
  "Q2 2025": { slides: bnsSlides(2025, 2), filings: bnsFilings(2025, 2) },
  "Q1 2025": { slides: bnsSlides(2025, 1), filings: bnsFilings(2025, 1) },
  "Q4 2024": { slides: bnsSlides(2024, 4), filings: bnsFilings(2024, 4) },
  "Q3 2024": { slides: bnsSlides(2024, 3), filings: bnsFilings(2024, 3) },
  "Q2 2024": { slides: bnsSlides(2024, 2), filings: bnsFilings(2024, 2) },
  "Q1 2024": { slides: bnsSlides(2024, 1), filings: bnsFilings(2024, 1) },
  "Q4 2023": { slides: bnsSlides(2023, 4), filings: bnsFilings(2023, 4) },
  "Q3 2023": { slides: bnsSlides(2023, 3), filings: bnsFilings(2023, 3) },
  "Q2 2023": { slides: bnsSlides(2023, 2), filings: bnsFilings(2023, 2) },
  "Q1 2023": { slides: bnsSlides(2023, 1), filings: bnsFilings(2023, 1) },
  "Q4 2022": { slides: bnsSlides(2022, 4), filings: bnsFilings(2022, 4) },
  "Q3 2022": { slides: bnsSlides(2022, 3), filings: bnsFilings(2022, 3) },
  "Q2 2022": { slides: bnsSlides(2022, 2), filings: bnsFilings(2022, 2) },
  "Q1 2022": { slides: bnsSlides(2022, 1), filings: bnsFilings(2022, 1) },
};

export function isBnsRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|shareholders[_-]?report|marketing|supplement|transcript|pillar|regulatory|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isBnsIrPdf(href: string | null | undefined): boolean {
  if (!href || isBnsRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.scotiabank.com" || host === "scotiabank.com" || host.endsWith(".scotiabank.com"))) {
      return false;
    }
    if (!u.pathname.includes("/corporate/quarterly-reports/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeBnsKnownQuarterDocs(): Map<string, BnsQuarterDocs> {
  return new Map(Object.entries(BNS_KNOWN_QUARTER_DOCS));
}
