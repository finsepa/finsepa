/**
 * ServiceNow (NOW) IR — calendar FY.
 * Slides = Investor Presentation; Filings = Earnings Release / Financial Results PDF.
 * Host: s205.q4cdn.com/916135447. Never 10-Q/10-K / FAD / fact sheet / SEC HTML.
 */

export type NowQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const CDN = "https://s205.q4cdn.com/916135447/files";

export const NOW_IR_PAGES = [
  "https://investor.servicenow.com/",
  "https://investor.servicenow.com/financials/quarterly-results/default.aspx",
] as const;

/** FinancialReport.svc-verified Investor Presentation + Earnings Release (Q1 2022 → Q2 2026). */
export const NOW_KNOWN_QUARTER_DOCS: Readonly<Record<string, NowQuarterDocs>> = {
  "Q2 2026": {
    slides: `${CDN}/doc_financials/2026/q2/ServiceNow-2Q26-Investor-Presentation.pdf`,
    filings: `${CDN}/doc_financials/2026/q2/ER-Q2-FY26.pdf`,
  },
  "Q1 2026": {
    slides: `${CDN}/doc_financials/2026/q1/ServiceNow-1Q26-Investor-Presentation.pdf`,
    filings: `${CDN}/doc_financials/2026/q1/ER-Q1-FY26.pdf`,
  },
  "Q4 2025": {
    slides: `${CDN}/doc_financials/2025/q4/ServiceNow-4Q25-Investor-Presentation.pdf`,
    filings: `${CDN}/doc_financials/2025/q4/ServiceNow-Reports-Fourth-Quarter-and-Full-Year-2025-Financial-Results.pdf`,
  },
  "Q3 2025": {
    slides: `${CDN}/doc_presentation/2025/servicenow-q3-2025-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2025/q3/Q3-2025-Earnings-Release.pdf`,
  },
  "Q2 2025": {
    slides: `${CDN}/doc_presentation/2025/servicenow-q2-2025-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2025/q2/Q2-2025-Earnings-Release.pdf`,
  },
  "Q1 2025": {
    slides: `${CDN}/doc_presentation/2025/servicenow-q1-2025-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2025/q1/Q1-2025-Earnings-Release.pdf`,
  },
  "Q4 2024": {
    slides: `${CDN}/doc_presentation/2024/servicenow-q4-2024-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2024/q4/Q4-2024-Earnings-Release.pdf`,
  },
  "Q3 2024": {
    slides: `${CDN}/doc_presentation/2024/servicenow-q3-2024-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2024/q3/Q3-2024-Earnings-Release.pdf`,
  },
  "Q2 2024": {
    slides: `${CDN}/doc_presentation/2024/servicenow-q2-2024-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2024/q2/Q2-2024-Earnings-Release.pdf`,
  },
  "Q1 2024": {
    slides: `${CDN}/doc_presentation/2024/servicenow-q1-2024-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2024/q1/Q1-2024-Earnings-Release.pdf`,
  },
  "Q4 2023": {
    slides: `${CDN}/doc_presentation/2023/servicenow-q4-2023-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2023/q4/Q4-2023-Earnings-Release.pdf`,
  },
  "Q3 2023": {
    slides: `${CDN}/doc_presentation/2023/servicenow-q3-2023-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2023/q3/Q3-2023-Earnings-Release.pdf`,
  },
  "Q2 2023": {
    slides: `${CDN}/doc_presentation/2023/servicenow-q2-2023-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2023/q2/Q2-2023-Earnings-Release.pdf`,
  },
  "Q1 2023": {
    slides: `${CDN}/doc_presentation/2023/servicenow-q1-2023-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2023/q1/Q1-2023-Earnings-Release.pdf`,
  },
  "Q4 2022": {
    slides: `${CDN}/doc_presentation/2022/servicenow-q4-2022-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2022/q4/Q4-Fiscal-Year-2022-Earnings-Release.pdf`,
  },
  "Q3 2022": {
    slides: `${CDN}/doc_presentation/2022/servicenow-q3-2022-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2022/q3/Q3-2022-Earnings-Release.pdf`,
  },
  "Q2 2022": {
    slides: `${CDN}/doc_presentation/2022/servicenow-q2-2022-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2022/q2/Q2-2022-Earnings-Release.pdf`,
  },
  "Q1 2022": {
    slides: `${CDN}/doc_presentation/2022/servicenow-q1-2022-investor-presentation.pdf`,
    filings: `${CDN}/doc_financials/2022/q1/Q1-2022-Earnings-Release.pdf`,
  },
};

export function isNowRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|proxy|annual[-_\s]*report|fact[-_\s]*sheet|financial[-_\s]*analyst[-_\s]*day|\bfad\b|transcript|prepared[-_\s]*remarks|\.(xls|xlsx|csv)(?:$|[?#])/i.test(
    n,
  );
}

export function isNowIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "s205.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/916135447/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isNowRejected(url);
  } catch {
    return false;
  }
}

export function mergeNowKnownQuarterDocs(): Map<string, NowQuarterDocs> {
  return new Map(Object.entries(NOW_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
