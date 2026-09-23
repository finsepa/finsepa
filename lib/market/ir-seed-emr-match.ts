/**
 * EMR IR seed — 09-30.
 * Emerson Electric Sept FY (not calendar). Slides=Earnings Presentation on ir.emerson.com/_assets/.../db/938/* /presentation/; Filings=Earnings Release PDF under /emerson/news/. Reject 10-Q/10-K/SEC HTML/webcast. Never SEC HTML. Scope Q1 2022→Q3 2026 (19 green / 0 yellow / 0 red). Range-GET %PDF verified.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type EmrQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const EMR_IR_PAGES = [
  "https://ir.emerson.com/financials/quarterly-results",
] as const;

export const EMR_KNOWN_QUARTER_DOCS: Readonly<Record<string, EmrQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9568/presentation/emerson-reports-first-quarter-2022-results-updates-2022-outlook-en-us-7979148.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2022-02-02_Emerson_Reports_First_Quarter_2022_Results_134.pdf",
  },
  "Q2 2022": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9569/presentation/emerson-q2-earnings-conference-call-en-us-8122816.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2022-05-04_Emerson_Reports_Second_Quarter_2022_Results_128.pdf",
  },
  "Q3 2022": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9570/presentation/emerson-reports-third-quarter-2022-results-updates-2022-outlook-en-us-8476018.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2022-08-09_Emerson_Reports_Third_Quarter_2022_Results_112.pdf",
  },
  "Q4 2022": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9571/presentation/emerson-reports-fourth-quarter-full-year-2022-results-provides-initial-2023-outlook-en-us-8632084.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2022-10-31_Emerson_Reports_Fourth_Quarter_and_Full_Year_2022__99.pdf",
  },
  "Q1 2023": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9572/presentation/emerson-2023-q1-earnings-presentation-en-us-8769468.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2023-02-08_Emerson_Reports_First_Quarter_2023_Results_82.pdf",
  },
  "Q2 2023": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9573/presentation/emerson-2023-q2-earnings-presentation-en-us-9007350.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2023-05-03_Emerson_Reports_Second_Quarter_2023_Results_70.pdf",
  },
  "Q3 2023": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9574/presentation/emerson-reports-third-quarter-2023-results-updates-2023-outlook-en-us-9281446.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2023-08-02_Emerson_Reports_Third_Quarter_2023_Results_64.pdf",
  },
  "Q4 2023": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9575/presentation/emerson-reports-fourth-quarter-full-year-2023-results-provides-initial-2024-outlook-en-us-9882696.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2023-11-07_Emerson_Reports_Fourth_Quarter_and_Full_Year_2023__52.pdf",
  },
  "Q1 2024": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9576/presentation/emerson-reports-first-quarter-results-en-us-10109324.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2024-02-07_Emerson_Reports_First_Quarter_2024_Results_44.pdf",
  },
  "Q2 2024": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9577/presentation/2024-q2-emerson-earnings-en-us-10321844.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2024-05-08_Emerson_Reports_Second_Quarter_2024_Results_35.pdf",
  },
  "Q3 2024": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9578/presentation/emerson-2024-q3-earnings-presentation-en-us-10746916.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2024-08-07_Emerson_Reports_Third_Quarter_2024_Results_28.pdf",
  },
  "Q4 2024": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9579/presentation/2024-q4-full-year-2024-earnings-presentation-en-us-11103538.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2024-11-05_Emerson_Reports_Fourth_Quarter_and_Full_Year_2024__22.pdf",
  },
  "Q1 2025": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9580/presentation/emerson-reports-first-quarter-2025-results-updates-2025-outlook-en-us-11470388.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2025-02-05_Emerson_Reports_First_Quarter_2025_Results_15.pdf",
  },
  "Q2 2025": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/9581/presentation/emerson-2025-q2-earnings-presentation-en-us-11737160.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2025-05-07_Emerson_Reports_Second_Quarter_2025_Results_8.pdf",
  },
  "Q3 2025": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/10098/presentation/Emerson+2025+Q3+Earnings+Presentation.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2025-08-06_Emerson_Reports_Third_Quarter_2025_Results_612.pdf",
  },
  "Q4 2025": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/10115/presentation/Emerson+2025+Q4+and+Full+Year+Earnings+Presentation.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2025-11-05_Emerson_Reports_Fourth_Quarter_and_Full_Year_2025__617.pdf",
  },
  "Q1 2026": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/10134/presentation/Emerson+2026+Q1+Earnings+Presentation.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2026-02-03_Emerson_Reports_First_Quarter_2026_Results_623.pdf",
  },
  "Q2 2026": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/10208/presentation/Emerson+2026+Q2+Earnings+Presentation.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2026-05-05_Emerson_Reports_Second_Quarter_2026_Results_629.pdf",
  },
  "Q3 2026": {
    slides: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/db/938/10242/presentation/Emerson+2026+Q3+Earnings+Presentation.pdf",
    filings: "https://ir.emerson.com/_assets/_c0388696e3a69f59a3ee43598053c60c/emerson/news/2026-08-04_Emerson_Reports_Third_Quarter_2026_Results_Raises__642.pdf",
  },
};

export function isEmrRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isEmrIrPdf(href: string | null | undefined): boolean {
  if (!href || isEmrRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "ir.emerson.com" || host.endsWith(".emerson.com"))) return false;
    if (!u.pathname.includes("/_assets/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeEmrKnownQuarterDocs(): Map<string, EmrQuarterDocs> {
  return new Map(Object.entries(EMR_KNOWN_QUARTER_DOCS));
}
