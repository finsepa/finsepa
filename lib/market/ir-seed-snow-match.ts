/**
 * Snowflake (SNOW) IR — FY ends 01-31.
 * Slides = Investor Presentation; Filings = null (press is HTML aspx only).
 * Host: s26.q4cdn.com/463892824. Never webcast / SEC HTML.
 */

export type SnowQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SNOW_FY_END = "01-31";

export const SNOW_IR_PAGES = [
  "https://investors.snowflake.com/",
] as const;

/** Catalog Q1 2022 → Q2 2027 (issuer Jan FY). Filings null by design. */
export const SNOW_KNOWN_QUARTER_DOCS: Readonly<Record<string, SnowQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2022/q1/Q1-FY22-Snowflake-Investor-Presentation_vFINAL.pdf",
    filings: null,
  },
  "Q2 2022": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2022/q2/Q2-FY22-Snowflake-Investor-Presentation_Final-(2).pdf",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2022/q3/Q3-FY22-Snowflake-Investor-Presentation_vFINAL-(1).pdf",
    filings: null,
  },
  "Q4 2022": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2022/q4/Q4-FY22-Snowflake-Investor-Presentation_vFinal.pdf",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2023/q1/Q1-FY23-Snowflake-Investor-PresentationvF.pdf",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2023/q2/Q2-FY2023-Investor-Presentation_vF.pdf",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2023/q3/Q3-FY2023-Investor-Presentation_vFinal.pdf",
    filings: null,
  },
  "Q4 2023": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2023/q4/Q4-FY2023-Investor-Presentation_vF.pdf",
    filings: null,
  },
  "Q1 2024": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2024/q1/Q1-FY2024-Investor-Presentation_vF-FINAL2.pdf",
    filings: null,
  },
  "Q2 2024": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2024/q2/Q2-FY2024-Investor-Presentation-vF1.pdf",
    filings: null,
  },
  "Q3 2024": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2024/q3/Q3-FY2024-Investor-Presentation-vF.pdf",
    filings: null,
  },
  "Q4 2024": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2024/q4/Q4-FY2024-Investor-Presentation-vF.pdf",
    filings: null,
  },
  "Q1 2025": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2025/q1/Q1-FY2025-Investor-Presentation-vF.pdf",
    filings: null,
  },
  "Q2 2025": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2025/q2/Q2-FY2025-Investor-Presentation_vF.pdf",
    filings: null,
  },
  "Q3 2025": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2025/q3/Q3-FY2025-Investor-Presentation_vFF.pdf",
    filings: null,
  },
  "Q4 2025": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2025/q4/Q4-FY2025-Investor-Presentation_vFF.pdf",
    filings: null,
  },
  "Q1 2026": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2026/q1/Q1-FY2026-Investor-Presentation_vF.pdf",
    filings: null,
  },
  "Q2 2026": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2026/q2/Q2-FY2026-Investor-Presentation_vF.pdf",
    filings: null,
  },
  "Q3 2026": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2026/q3/Q3-FY2026-Investor-Presentation_vF.pdf",
    filings: null,
  },
  "Q4 2026": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2026/q4/Q4-FY2026-Investor-Presentation_vF.pdf",
    filings: null,
  },
  "Q1 2027": {
    slides: "https://s26.q4cdn.com/463892824/files/doc_financials/2027/q1/Q1-FY2027-Investor-Presentation_vFF.pdf",
    filings: null,
  },
  "Q2 2027": {
    slides: "https://s26.q4cdn.com/463892824/files/content_files/Q2-FY2027-Investor-Presentation_vFF.pdf",
    filings: null,
  },
};

export function isSnowRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|\.aspx|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isSnowIrPdf(href: string | null | undefined): boolean {
  if (!href || isSnowRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s26.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/463892824/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeSnowKnownQuarterDocs(): Map<string, SnowQuarterDocs> {
  return new Map(Object.entries(SNOW_KNOWN_QUARTER_DOCS));
}
