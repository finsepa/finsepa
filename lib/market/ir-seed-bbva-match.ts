/**
 * BBVA IR — calendar FY.
 * Slides = Earnings/Results Presentation Analysts; Filings = Informe/Report PDF.
 * Never Corporate Presentation / Fixed Income / Pillar 3 / Annual Report / AGM / SEC HTML.
 */

export type BbvaQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const BBVA_WP = "https://shareholdersandinvestors.bbva.com/wp-content/uploads";

export const BBVA_IR_PAGES = [
  "https://shareholdersandinvestors.bbva.com/",
  "https://shareholdersandinvestors.bbva.com/financials/financial-reports/",
] as const;

/** HEAD-verified Results Presentation + Informe/Report PDFs (ENG). */
export const BBVA_KNOWN_QUARTER_DOCS: Readonly<Record<string, BbvaQuarterDocs>> = {
  "Q2 2026": {
    slides: `${BBVA_WP}/2026/07/2Q26-ENG-Earnings-Presentation_Analysts.pdf`,
    filings: `${BBVA_WP}/2026/07/January-June-Report-2026.pdf`,
  },
  "Q1 2026": {
    slides: `${BBVA_WP}/2026/04/1Q26-ENG-Earnings-Presentation-Analysts.pdf`,
    filings: `${BBVA_WP}/2026/04/Quarterly-Report_1T26.pdf`,
  },
  "Q4 2025": {
    slides: `${BBVA_WP}/2026/02/4Q25-Earnings-Presentation_Analysts_ENG.pdf`,
    filings: `${BBVA_WP}/2026/02/January-December-Report-2025.pdf`,
  },
  "Q3 2025": {
    slides: `${BBVA_WP}/2025/10/Earnings-Presentation-Analysts-3Q25_ENG.pdf`,
    filings: `${BBVA_WP}/2025/10/20251030_IP_3Q25-Report_ENG.pdf`,
  },
  "Q2 2025": {
    slides: `${BBVA_WP}/2025/07/2Q25-Earnings-Presentation_Analysts_ENG.pdf`,
    filings: `${BBVA_WP}/2025/07/2Q-2025-Report_ENG.pdf`,
  },
  "Q1 2025": {
    slides: `${BBVA_WP}/2025/04/1Q25-Earnings-Presentation_Analysts_ENG.pdf`,
    filings: `${BBVA_WP}/2025/04/1Q25-Informe-de-resultados_ENG.pdf`,
  },
  "Q4 2024": {
    slides: `${BBVA_WP}/2025/01/Presentacion-Resultados-4Q24_ENG.pdf`,
    filings: `${BBVA_WP}/2025/01/Informe-Resultados-4Q24_ENG.pdf`,
  },
  "Q3 2024": {
    slides: `${BBVA_WP}/2024/10/3Q24-ENG-Earnings-Presentation_Analysts.pdf`,
    filings: `${BBVA_WP}/2024/10/January-September-Report-2024-1.pdf`,
  },
  "Q2 2024": {
    slides: `${BBVA_WP}/2024/07/2Q24-Earnings-Presentation_Analysts_ENG.pdf`,
    filings: `${BBVA_WP}/2024/07/EarningsReport2Q24_ENG.pdf`,
  },
  "Q1 2024": {
    slides: `${BBVA_WP}/2024/04/PresentacionResultados-1Q24_ENG.pdf`,
    filings: `${BBVA_WP}/2024/04/InformeResultados1Q24_ENG.pdf`,
  },
  "Q4 2023": {
    slides: `${BBVA_WP}/2024/01/4Q23-Results-Presentation_Analysts_ENG.pdf`,
    filings: `${BBVA_WP}/2024/01/Results-Report-4Q23_ENG.pdf`,
  },
  "Q3 2023": {
    slides: `${BBVA_WP}/2023/10/3Q23-Results-Presentation_Analysts_ENG.pdf`,
    filings: `${BBVA_WP}/2023/10/Informe-Resultados-3Q23_ENG.pdf`,
  },
  "Q2 2023": {
    slides: `${BBVA_WP}/2023/07/2Q23-Results-Presentation_Analysts_ENG.pdf`,
    filings: `${BBVA_WP}/2023/07/28072023-Informe-Resultados-2Q23_ENG.pdf`,
  },
  "Q1 2023": {
    slides: `${BBVA_WP}/2023/04/27042023PresentacionResultados1Q23_ENG.pdf`,
    filings: `${BBVA_WP}/2023/04/27042023InformeResultados1Q23_ENG.pdf`,
  },
  "Q4 2022": {
    slides: `${BBVA_WP}/2023/01/010223PresentacionResultados-4Q22_ENG.pdf`,
    filings: `${BBVA_WP}/2023/01/010223InformeResultados-4Q22_ENG.pdf`,
  },
  "Q3 2022": {
    slides: `${BBVA_WP}/2022/10/281022PresentacionResultados3Q22_ENG.pdf`,
    filings: `${BBVA_WP}/2022/10/281022InformeResultados3Q22_ENG.pdf`,
  },
  "Q2 2022": {
    slides: `${BBVA_WP}/2022/07/29072022PresentacionResultados2Q22_ENG.pdf`,
    filings: `${BBVA_WP}/2022/07/29072022InformeResultados2Q22_ENG.pdf`,
  },
  "Q1 2022": {
    slides: `${BBVA_WP}/2022/04/29042022PresentacionResultados1T22_ENG.pdf`,
    filings: `${BBVA_WP}/2022/04/29042022InformeResultados1T22_ENG.pdf`,
  },
};

export function isBbvaRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|fixed[-_\s]*income|pillar[-_\s]*3|corporate[-_\s]*presentation|investment[-_\s]*case|agm|annual[-_\s]*report|sustainability|10-?q|10-?k|\.(xls|xlsx|csv)(?:$|[?#])/i.test(
    n,
  );
}

export function isBbvaIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "shareholdersandinvestors.bbva.com" || host.endsWith(".bbva.com"))) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isBbvaRejected(url);
  } catch {
    return false;
  }
}

export function mergeBbvaKnownQuarterDocs(): Map<string, BbvaQuarterDocs> {
  return new Map(Object.entries(BBVA_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
