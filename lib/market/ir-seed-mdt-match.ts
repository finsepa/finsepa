/**
 * Medtronic (MDT) IR — FY ends late April (~04-30).
 * Slides = Earnings Presentation; Filings = Press Release.
 * Host: investorrelations.medtronic.com/image/. Never Exhibit 99.1 / SEC HTML.
 */

export type MdtQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Medtronic FY ends late April (use 04-30 for period-end mapping). */
export const MDT_FY_END = "04-30";

export const MDT_IR_PAGES = [
  "https://investorrelations.medtronic.com/",
] as const;

/** Catalog Q1 2022 → Q1 2027 (issuer late-April FY) — green. */
export const MDT_KNOWN_QUARTER_DOCS: Readonly<Record<string, MdtQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://investorrelations.medtronic.com/image/Earnings_Presentation-FY22Q1-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/MDT%20Press_Release-FY22Q1-FINAL.pdf",
  },
  "Q2 2022": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY22Q2-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY22Q2-FINAL.pdf",
  },
  "Q3 2022": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY22Q3-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY22Q3-FINAL.pdf",
  },
  "Q4 2022": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY22Q4-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY22Q4-FINAL.pdf",
  },
  "Q1 2023": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY23Q1-FINAL4.pdf",
    filings: "https://investorrelations.medtronic.com/image/Medtronic+Q1+FY23+Press+Release.pdf",
  },
  "Q2 2023": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY23Q2-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press+Release+FYQ2-2023.pdf",
  },
  "Q3 2023": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY23Q3-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY23Q3-FINAL-with_Financial_Schedules.pdf",
  },
  "Q4 2023": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY23Q4-FINALV2.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY23Q4_FINAL.pdf",
  },
  "Q1 2024": {
    slides: "https://investorrelations.medtronic.com/image/Earnings-Presentation-FY24Q1-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY24Q1-FINAL.pdf",
  },
  "Q2 2024": {
    slides: "https://investorrelations.medtronic.com/image/Earnings-Presentation-FY24Q2-Final.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY24Q2-FINAL.pdf",
  },
  "Q3 2024": {
    slides: "https://investorrelations.medtronic.com/image/Earnings_Presentation-FY24Q3-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY24Q3-FINAL.pdf",
  },
  "Q4 2024": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY24Q4-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY24Q4-FINAL.pdf",
  },
  "Q1 2025": {
    slides: "https://investorrelations.medtronic.com/image/Earnings_Presentation-FY25Q1-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY25Q1-FINAL.pdf",
  },
  "Q2 2025": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY25Q2_Final.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY25Q2-FINAL.pdf",
  },
  "Q3 2025": {
    slides: "https://investorrelations.medtronic.com/image/Earnings-Presentation-FY25Q3-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Medtronic_Press_Release_Q3FY25_Final.pdf",
  },
  "Q4 2025": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation-FY25Q4-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release_FY25Q4_FINAL.pdf",
  },
  "Q1 2026": {
    slides: "https://investorrelations.medtronic.com/image/Earnings-Presentation-FY26Q1-Final.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY26Q1-FINAL.pdf",
  },
  "Q2 2026": {
    slides: "https://investorrelations.medtronic.com/image/Earnings-Presentation-FY26Q2-FINAL.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press_Release-FY26Q2-FINAL.pdf",
  },
  "Q3 2026": {
    slides: "https://investorrelations.medtronic.com/image/Earnings+Presentation+FY26Q3+Final+2.19.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press+Release+FY26Q3+FINAL.pdf",
  },
  "Q4 2026": {
    slides: "https://investorrelations.medtronic.com/image/Earnings-Presentation-FY26Q4-vFinal.pdf",
    filings: "https://investorrelations.medtronic.com/image/Press-Release-FY26Q4-vfinal2.pdf",
  },
  "Q1 2027": {
    slides: "https://investorrelations.medtronic.com/image/FY27Q1-Earnings-Presentation.pdf",
    filings: "https://investorrelations.medtronic.com/image/FY27Q1-Press+Release-FINAL.pdf",
  },
};

export function isMdtRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|exhibit.?99|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isMdtIrPdf(href: string | null | undefined): boolean {
  if (!href || isMdtRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investorrelations.medtronic.com" || host.endsWith(".medtronic.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeMdtKnownQuarterDocs(): Map<string, MdtQuarterDocs> {
  return new Map(Object.entries(MDT_KNOWN_QUARTER_DOCS));
}
