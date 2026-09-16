/**
 * Pfizer (PFE) IR — calendar FY.
 * Slides = Earnings Charts; Filings = Press / Earnings Release PDF.
 * Source: investors.pfizer.com FinancialReport.svc (s206.q4cdn.com/795948973).
 * Never 10-Q / 10-K / transcript / SEC HTML.
 */

export type PfeQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const PFE_IR_PAGES = [
  "https://investors.pfizer.com/",
  "https://investors.pfizer.com/Investors/Financials/Quarterly-Reports/default.aspx",
] as const;

/** From FinancialReport.svc — DocumentCategory Presentation/Charts + Press Release. */
export const PFE_KNOWN_QUARTER_DOCS: Readonly<Record<string, PfeQuarterDocs>> = {
  "Q2 2026": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2026/q2/Q2-2026-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2026/q2/Q2-2026-PFE-Earnings-Release-FINAL.pdf`,
  },
  "Q1 2026": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2026/q1/Q1-2026-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2026/q1/Q1-2026-PFE-Earnings-Release-FINAL.pdf`,
  },
  "Q4 2025": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2025/q4/Q4-2025-Earnings-Charts.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2025/q4/Q4-2025-PFE-Earnings-Release-FINAL2.pdf`,
  },
  "Q3 2025": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2025/q3/Q3-2025-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2025/q3/Q3-2025-PFE-Earnings-Release-FINAL.pdf`,
  },
  "Q2 2025": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2025/q2/Q2-2025-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2025/q2/Q2-2025-PFE-Earnings-Release-FINAL.pdf`,
  },
  "Q1 2025": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2025/q1/Q1-2025-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2025/q1/Q1-2025-PFE-Earnings-Release-FINAL.pdf`,
  },
  "Q4 2024": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2024/q4/Q4-2024-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2024/q4/Q4-2024-PFE-Earnings-Release-Final.pdf`,
  },
  "Q3 2024": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2024/q3/Q3_2024_Earnings_Charts_FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2024/q3/Q3-2024-PFE-Earnings-Release-Final.pdf`,
  },
  "Q2 2024": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2024/q2/Q2-2024_Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2024/q2/Q2-2024-PFE-Earnings-Release.pdf`,
  },
  "Q1 2024": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2024/q1/Q1-2024-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2024/q1/Q1-2024-PFE-Earnings-Release.pdf`,
  },
  "Q4 2023": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2023/q4/Q4-2023-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2023/q4/Q4-2023-PFE-Earnings-Release.pdf`,
  },
  "Q3 2023": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2023/q3/Q3-2023-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2023/q3/Q3-2023-PFE-Earnings-Release.pdf`,
  },
  "Q2 2023": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2023/q2/Q2-2023-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2023/q2/Q2-2023-PFE-Earnings-Release.pdf`,
  },
  "Q1 2023": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2023/q1/Q1-2023-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2023/q1/Q1-2023-PFE-Earnings-Release.pdf`,
  },
  "Q4 2022": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2022/q4/Q4-2022-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2022/q4/Q4-2022-PFE-Earnings-Release.pdf`,
  },
  "Q3 2022": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2022/q3/Q3-2022-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2022/q3/Q3-2022-PFE-Earnings-Release.pdf`,
  },
  "Q2 2022": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2022/q2/Q2-2022-Earnings-Charts-FINAL.pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2022/q2/Q2-2022-PFE-Earnings-Release.pdf`,
  },
  "Q1 2022": {
    slides: `https://s206.q4cdn.com/795948973/files/doc_financials/2022/q1/Q1-2022-Earnings-Charts-FINAL-(1).pdf`,
    filings: `https://s206.q4cdn.com/795948973/files/doc_financials/2022/q1/Q1-2022-PFE-Earnings-Release.pdf`,
  },
};

export function isPfeRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|webcast|10-?q|10-?k|proxy|annual[-_\s]*report|sustainability|\.(xls|xlsx|csv)(?:$|[?#])/i.test(
    n,
  );
}

export function isPfeIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "s206.q4cdn.com" ||
        host.endsWith(".q4cdn.com") ||
        host === "investors.pfizer.com" ||
        host.endsWith(".pfizer.com")
      )
    ) {
      return false;
    }
    if (host.includes("q4cdn") && !u.pathname.includes("/795948973/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isPfeRejected(url);
  } catch {
    return false;
  }
}

export function mergePfeKnownQuarterDocs(): Map<string, PfeQuarterDocs> {
  return new Map(Object.entries(PFE_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
