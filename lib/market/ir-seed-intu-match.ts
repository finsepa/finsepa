/** Intuit (INTU) IR — FY ends Jul 31. Slides = Fact Sheet; Filings = earnings press PDF. Never transcript / SEC HTML. */

export type IntuQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends July 31. */
export const INTU_FY_END = "07-31";

const ASSET = "https://investors.intuit.com/_assets/_b47bef62c2922576cfc0ce6fc96bb015";

export const INTU_IR_PAGES = [
  "https://investors.intuit.com/financial-information/fact-sheet",
  "https://investors.intuit.com/financial-information/financial-results",
  "https://investors.intuit.com/news-events/press-releases",
] as const;

/** Browser-verified catalog (issuer FY labels). Fact sheets under db/946/.../fact_sheet/; press under /intuit/news/. */
export const INTU_KNOWN_QUARTER_DOCS: Readonly<Record<string, IntuQuarterDocs>> = {
  "Q4 2026": {
    slides: `${ASSET}/intuit/db/946/10378/fact_sheet/Q4+FY26+Fact+Sheet+External+vf.pdf`,
    filings: `${ASSET}/intuit/news/2026-08-25_Intuit_Reports_Fourth_Quarter_and_Full_Year_1320.pdf`,
  },
  "Q3 2026": {
    slides: `${ASSET}/intuit/db/946/10372/fact_sheet/Q3+FY26+Fact+Sheet+External.pdf`,
    filings: `${ASSET}/intuit/news/2026-05-20_Intuit_Reports_Strong_Third_Quarter_Results_and_1312.pdf`,
  },
  "Q2 2026": {
    slides: `${ASSET}/intuit/db/946/10358/fact_sheet/Q2+FY26+Fact+Sheet+External.pdf`,
    filings: `${ASSET}/intuit/news/2026-02-26_Intuit_Reports_Strong_Second_Quarter_Results_and_1307.pdf`,
  },
  "Q1 2026": {
    slides: `${ASSET}/intuit/db/946/10339/fact_sheet/Q1+FY26+External+Fact+Sheet.pdf`,
    filings: `${ASSET}/intuit/news/2025-11-20_Intuit_Reports_Strong_First_Quarter_Results_and_1286.pdf`,
  },
  "Q4 2025": {
    slides: `${ASSET}/intuit/db/946/10311/fact_sheet/Q4+FY25+External+Factsheet.pdf`,
    filings: `${ASSET}/intuit/news/2025-08-21_Intuit_Reports_Strong_Fourth_Quarter_and_Full_1266.pdf`,
  },
  "Q3 2025": {
    slides: `${ASSET}/intuit/db/946/10275/fact_sheet/Q3+FY25+External+Factsheet+%281%29.pdf`,
    filings: `${ASSET}/intuit/news/2025-05-22_Intuit_Reports_Strong_Third_Quarter_Results_and_1251.pdf`,
  },
  "Q2 2025": {
    slides: `${ASSET}/intuit/db/946/10258/fact_sheet/Q2+FY25+External+Fact+Sheet+%281%29.pdf`,
    filings: `${ASSET}/intuit/news/2025-02-25_Intuit_Reports_Strong_Second_Quarter_Results_and_1239.pdf`,
  },
  "Q1 2025": {
    slides: `${ASSET}/intuit/db/946/10233/fact_sheet/Q1+FY25+External+Factsheet+v2.pdf`,
    filings: `${ASSET}/intuit/news/2024-11-21_Intuit_Reports_Strong_First_Quarter_Results_and_1223.pdf`,
  },
  "Q4 2024": {
    slides: `${ASSET}/intuit/db/946/9949/fact_sheet/FQ4+2024+Fact+Sheet+External_.pdf`,
    filings: `${ASSET}/intuit/news/2024-08-22_Intuit_Reports_Strong_Fourth_Quarter_and_Full_1202.pdf`,
  },
  "Q3 2024": {
    slides: `${ASSET}/intuit/db/946/9270/fact_sheet/FQ3-2024-Fact-Sheet-External_FINAL.pdf`,
    filings: `${ASSET}/intuit/news/2024-05-23_Intuit_Reports_Strong_Third_Quarter_Results_and_1188.pdf`,
  },
  "Q2 2024": {
    slides: `${ASSET}/intuit/db/946/9269/fact_sheet/FQ2-2024-Fact-Sheet-External.pdf`,
    filings: `${ASSET}/intuit/news/2024-02-22_Intuit_Reports_Strong_Second_Quarter_Results_and_11.pdf`,
  },
  "Q1 2024": {
    slides: `${ASSET}/intuit/db/946/9268/fact_sheet/FQ1-2024-Fact-Sheet-External.pdf`,
    filings: `${ASSET}/intuit/news/2023-11-28_Intuit_Reports_Strong_First_Quarter_Results_and_20.pdf`,
  },
  "Q4 2023": {
    slides: `${ASSET}/intuit/db/946/9267/fact_sheet/FQ4-2023-Fact-Sheet-External.pdf`,
    filings: `${ASSET}/intuit/news/2023-08-24_Intuit_Reports_Strong_Fourth_Quarter_and_Full_47.pdf`,
  },
  "Q3 2023": {
    slides: `${ASSET}/intuit/db/946/9266/fact_sheet/FQ3-2023-Fact-Sheet-External.pdf`,
    filings: `${ASSET}/intuit/news/2023-05-23_Intuit_Reports_Third_Quarter_Results_and_Raises_64.pdf`,
  },
  "Q2 2023": {
    slides: `${ASSET}/intuit/db/946/9265/fact_sheet/FQ2-2023-Fact-Sheet-External.pdf`,
    filings: `${ASSET}/intuit/news/2023-02-23_Intuit_Reports_Strong_Second_Quarter_Results_and_79.pdf`,
  },
  "Q1 2023": {
    slides: `${ASSET}/intuit/db/946/9264/fact_sheet/FQ1-2023-Fact-Sheet-External.pdf`,
    filings: `${ASSET}/intuit/news/2022-11-29_Intuit_Reports_Strong_First_Quarter_Results_and_94.pdf`,
  },
  "Q4 2022": {
    slides: `${ASSET}/intuit/db/946/9263/fact_sheet/FQ4-2022-Fact-Sheet-External-08-23-2022.pdf`,
    filings: `${ASSET}/intuit/news/2022-08-23_Intuit_Reports_Strong_Full_Year_Results_and_Sets_113.pdf`,
  },
  "Q3 2022": {
    slides: `${ASSET}/intuit/db/946/9262/fact_sheet/FQ3-2022-Fact-Sheet-External.pdf`,
    filings: `${ASSET}/intuit/news/2022-05-24_Intuit_Reports_Third_Quarter_Results_and_Raises_119.pdf`,
  },
  "Q2 2022": {
    slides: `${ASSET}/intuit/db/946/9261/fact_sheet/FQ2-2022-Fact-Sheet.pdf`,
    filings: `${ASSET}/intuit/news/2022-02-24_Intuit_Reports_Second_Quarter_Results_and_128.pdf`,
  },
  "Q1 2022": {
    slides: `${ASSET}/intuit/db/946/9260/fact_sheet/FQ1-2022-Fact-Sheet-External.pdf`,
    filings: `${ASSET}/intuit/news/2021-11-18_Intuit_Reports_Strong_First_Quarter_Results_and_148.pdf`,
  },
};

export function isIntuRejected(href: string, title = ""): boolean {
  const n = `${href} ${title}`.toLowerCase();
  return (
    n.includes("transcript") ||
    n.includes("earnings+script") ||
    n.includes("earnings-script") ||
    n.includes("webcast_transcript") ||
    n.includes("10-q") ||
    n.includes("10-k") ||
    n.includes("sec-filings") ||
    n.includes("sec.gov") ||
    /\/content\/0000/i.test(href) ||
    /\.htm(?:l)?(?:$|[?#])/i.test(href)
  );
}

export function isIntuIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (!(h === "investors.intuit.com" || h === "intuit.com" || h.endsWith(".intuit.com"))) {
      return false;
    }
    if (isIntuRejected(url)) return false;
    return u.pathname.includes("/_assets/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeIntuKnownQuarterDocs(): Map<string, IntuQuarterDocs> {
  return new Map(Object.entries(INTU_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
