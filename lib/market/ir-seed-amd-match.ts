/** AMD IR — calendar FY. Slides = Earnings Slide Presentation; Filings = Financial Tables PDF. Never transcript / HTML release / 10-Q. */

export type AmdQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const AMD_IR_PAGES = [
  "https://ir.amd.com/financial-information/financial-results",
] as const;

export const AMD_KNOWN_QUARTER_DOCS: Readonly<Record<string, AmdQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9237/presentation/AMD+Q2+2026+Earnings+Slides+FINAL.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9237/financial_tables_pdf/Q2+2026+GAAP+and+Non-GAAP+Earnings+Tables.pdf",
  },
  "Q1 2026": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9232/presentation/AMD+Q1%2726+Earnings+Slides+Final.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9232/financial_tables_pdf/Q1+2026+GAAP+and+Non-GAAP+Earnings+Tables.pdf",
  },
  "Q4 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9223/presentation/AMD+Q4%2725+Earnings+Slides+FINAL.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9223/financial_tables_pdf/Q4+2025+GAAP+and+Non-GAAP+Earnings+Tables.pdf",
  },
  "Q3 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9182/presentation/AMD+Q3%2725+Earnings+Slides+Final+V2.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9182/financial_tables_pdf/Q3+2025+GAAP+and+Non-GAAP+Earnings+Tables_.pdf",
  },
  "Q2 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9167/presentation/AMD+Q2%2725+Earnings+Slides+FINAL+2.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9167/financial_tables_pdf/Q2+2025+GAAP+and+Non-GAAP+Earnings+Tables_CFS+_4.2.pdf",
  },
  "Q1 2025": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9160/presentation/AMD+Q1%2725+Earnings+Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9160/financial_tables_pdf/Q1+2025+Gaap+and+Non-gaap+Earnings+Tables.pdf",
  },
  "Q4 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9090/presentation/AMD+Q4%2724+Earnings+Slides+.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/9090/financial_tables_pdf/Q4+2024+Gaap+and+Non-Gaap+Earnings+Tables.pdf",
  },
  "Q3 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8900/presentation/AMD+Q3%2724+Earnings+Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8900/financial_tables_pdf/AMD+Q3%2724+Gaap+and+Non-Gaap+Earnings+Tables.pdf",
  },
  "Q2 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8899/presentation/AMD+Q2%2724+Earnings+Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8899/financial_tables_pdf/q2+2024+gaap+and+non-gaap+earnings+tables.pdf",
  },
  "Q1 2024": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8898/presentation/AMD+Q1%2724+Earnings+Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8898/financial_tables_pdf/Q1%2724+gaap+and+non-gaap+earnings+tables.pdf",
  },
  "Q4 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8897/presentation/AMD+Q4%2723+Earnings+Slides+FINAL.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8897/financial_tables_pdf/Q4+and+Full+Year+2023+Gaap+and+Non-Gaap+Earnings+Tables.pdf",
  },
  "Q3 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8896/presentation/AMD_Q3%2723_Earnings_Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8896/financial_tables_pdf/Q3_2023_GAAP_and_Non-GAAP_Earnings_Tables.pdf",
  },
  "Q2 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8895/presentation/AMD_Q2%2723_Earnings_Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8895/financial_tables_pdf/Q2_2023_GAAP_and_Non-GAAP_Earnings_Tables.pdf",
  },
  "Q1 2023": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8894/presentation/AMD_Q1%2723_Earnings_Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8894/financial_tables_pdf/Q1_2023_GAAP_and_Non-GAAP_Earnings_Tables.pdf",
  },
  "Q4 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8893/presentation/AMD_Q4%2722_Earnings_Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8893/financial_tables_pdf/Q4_2022_GAAP_and_Non-GAAP_Earnings_Tables.pdf",
  },
  "Q3 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8892/presentation/AMD_Q3%2722_Earnings_Slides_.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8892/financial_tables_pdf/Q3_2022_GAAP_and_Non-GAAP_Earnings_Tables.pdf",
  },
  "Q2 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8891/presentation/AMD_Q2%2722_Earnings_Slidesa.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8891/financial_tables_pdf/AMD_Q2_2022_GAAP_and_Non-GAAP_Earnings_Tables_with_Segments.pdf",
  },
  "Q1 2022": {
    slides: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8890/presentation/AMD_Q1%2722_Financial_Results_Slides.pdf",
    filings: "https://d1io3yog0oux5.cloudfront.net/_27bce72d32733992628b3ff3db544bf5/amd/db/841/8890/financial_tables_pdf/AMD_Q1_2022_GAAP_and_Non-GAAP_Earnings_Tables.pdf",
  },
};

export function isAmdRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|10-?q|10-?k|8-?k|xbrl|html/i.test(n);
}

export function isAmdIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname !== "d1io3yog0oux5.cloudfront.net") return false;
    return u.pathname.includes("/amd/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAmdKnownQuarterDocs(): Map<string, AmdQuarterDocs> {
  return new Map(Object.entries(AMD_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
