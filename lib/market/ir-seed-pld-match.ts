/**
 * Prologis (PLD) IR — calendar FY.
 * Slides = Earnings Supplemental PDF (REIT deck). Filings = null (release is HTML-only on IR).
 * Never 10-Q / 10-K / transcript / SEC HTML.
 * Host: d1io3yog0oux5.cloudfront.net (prologis supplemental_financial_report_pdf).
 */

export type PldQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const PLD_CF_BASE =
  "https://d1io3yog0oux5.cloudfront.net/_0a55db7b115b9b5a5f02debaa95eb7af/prologis/db/2346";

function supplemental(dbId: string, filename: string): string {
  return `${PLD_CF_BASE}/${dbId}/supplemental_financial_report_pdf/${filename}`;
}

export const PLD_IR_PAGES = [
  "https://ir.prologis.com/",
  "https://ir.prologis.com/financials/quarterly-results/default.aspx",
] as const;

/** IR supplemental deck catalog (Q1 2022 → Q2 2026). */
export const PLD_KNOWN_QUARTER_DOCS: Readonly<Record<string, PldQuarterDocs>> = {
  "Q2 2026": {
    slides: supplemental("23888", "Q2_2026_Prologis_Earnings_Supplemental.pdf"),
    filings: null,
  },
  "Q1 2026": {
    slides: supplemental("23867", "Q1_2026_Prologis_Earnings_Supplemental.pdf"),
    filings: null,
  },
  "Q4 2025": {
    slides: supplemental("23552", "Q4_2025_Prologis_Earnings_Supplemental.pdf"),
    filings: null,
  },
  "Q3 2025": {
    slides: supplemental("23551", "Q3_2025_Prologis_Earnings_Supplemental.pdf"),
    filings: null,
  },
  "Q2 2025": {
    slides: supplemental("23550", "Q2_2025_Prologis_Earnings_Supplemental.pdf"),
    filings: null,
  },
  "Q1 2025": {
    slides: supplemental("23549", "Q1_2025_Prologis_Earnings_Supplemental.pdf"),
    filings: null,
  },
  "Q4 2024": {
    slides: supplemental("23548", "Q4_2024_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q3 2024": {
    slides: supplemental("23547", "Q3_2024_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q2 2024": {
    slides: supplemental("23546", "Q2_2024_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q1 2024": {
    slides: supplemental("23545", "Q1_2024_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q4 2023": {
    slides: supplemental("23544", "Q4_2023_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q3 2023": {
    slides: supplemental("23543", "Q3_2023_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q2 2023": {
    slides: supplemental("23542", "Q2_2023_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q1 2023": {
    slides: supplemental("23541", "Q1_2023_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q4 2022": {
    slides: supplemental("23540", "Q4-2022-Final-Supplemental.pdf"),
    filings: null,
  },
  "Q3 2022": {
    slides: supplemental("23539", "Q3_2022_Final_Supplemental.pdf"),
    filings: null,
  },
  "Q2 2022": {
    slides: supplemental("23538", "22Q2-PLD-Final-Supplemental.pdf"),
    filings: null,
  },
  "Q1 2022": {
    slides: supplemental("23537", "22Q1-PLD-Final-Supplemental.pdf"),
    filings: null,
  },
};

export function isPldRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|prepared[-_\s]*remarks|webcast|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isPldIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== "d1io3yog0oux5.cloudfront.net") return false;
    if (!/\/prologis\/db\/\d+\/\d+\/supplemental_financial_report_pdf\//i.test(u.pathname)) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isPldRejected(url);
  } catch {
    return false;
  }
}

export function mergePldKnownQuarterDocs(): Map<string, PldQuarterDocs> {
  return new Map(Object.entries(PLD_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
