/**
 * Chubb (CB) IR — calendar FY.
 * Slides = Corporate Presentation; Filings = Earnings Press Release PDF.
 * Never 10-Q / 10-K / transcript / statistics / SEC HTML.
 * Host: s201.q4cdn.com/471466897.
 * Slides missing for Q4’22, Q1’23, Q2’23, Q1’24 (not published / 404 on IR).
 */

export type CbQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const CB = "https://s201.q4cdn.com/471466897/files";

export const CB_IR_PAGES = [
  "https://investor.chubb.com/",
  "https://investor.chubb.com/financials/quarterly-results/default.aspx",
  "https://investors.chubb.com/News--Events/news-presentations/presentations/default.aspx",
] as const;

/** Corporate Presentation + press release catalog (Q1 2022 → Q2 2026). */
export const CB_KNOWN_QUARTER_DOCS: Readonly<Record<string, CbQuarterDocs>> = {
  "Q2 2026": {
    slides: `${CB}/doc_presentations/2026/07/Final-Q2-2026-Corporate-Presentation-7-30-26.pdf`,
    filings: `${CB}/doc_financials/2026/q2/2nd-Quarter-2026-Earnings-Press-Release.pdf`,
  },
  "Q1 2026": {
    slides: `${CB}/doc_financials/2026/q1/v2/Final-Q1-2026-Corporate-Presentation-4-29-26.pdf`,
    filings: `${CB}/doc_financials/2026/q1/1st-Quarter-2026-Earnings-Press-Release.pdf`,
  },
  "Q4 2025": {
    slides: `${CB}/doc_presentations/2026/Feb/13/Final-Q4-2025-Corporate-Presentation-2-13-26.pdf`,
    filings: `${CB}/doc_financials/2025/q4/4th-Quarter-2025-Earnings-Press-Release.pdf`,
  },
  "Q3 2025": {
    slides: `${CB}/doc_presentations/2025/10/Final-Chubb-3rd-Quarter-2025-Corporate-Presentation-10-24-25.pdf`,
    filings: `${CB}/doc_financials/2025/q3/3rd-Quarter-2025-Earnings-Press-Release.pdf`,
  },
  "Q2 2025": {
    slides: `${CB}/doc_downloads/2025/Final-Chubb-2nd-Quarter-2025-Corporate-Presentation-7-24-25.pdf`,
    filings: `${CB}/doc_financials/2025/q2/2nd-Quarter-2025-Earnings-Press-Release.pdf`,
  },
  "Q1 2025": {
    slides: `${CB}/doc_financials/2025/q1/Final-Chubb-1st-Quarter-2025-Corporate-Presentation-4-28-25-3pm.pdf`,
    filings: `${CB}/doc_financials/2025/q1/1st-Quarter-2025-Earnings-Press-Release.pdf`,
  },
  "Q4 2024": {
    slides: `${CB}/doc_presentations/2025/04/Chubb-Fourth-Quarter-2024-Corporate-Presentation-Final_.pdf`,
    filings: `${CB}/doc_financials/2024/q4/4th-Quarter-2024-Earnings-Press-Release.pdf`,
  },
  "Q3 2024": {
    slides: `${CB}/doc_downloads/2024/11/Chubb-Third-Quarter-2024-Corporate-Presentation-Final.pdf`,
    filings: `${CB}/doc_financials/2024/q3/3rd-Quarter-2024-Earnings-Press-Release.pdf`,
  },
  "Q2 2024": {
    slides: `${CB}/doc_downloads/2024/07/chubb-second-quarter-2024-corporate-presentation.pdf`,
    filings: `${CB}/doc_financials/2024/q2/2nd-Quarter-2024-Earnings-Press-Release.pdf`,
  },
  "Q1 2024": {
    slides: null,
    filings: `${CB}/doc_financials/2024/q1/1st-Quarter-2024-Earnings-Press-Release.pdf`,
  },
  "Q4 2023": {
    slides: `${CB}/doc_financials/2023/q4/Chubb-Fourth-Quarter-2023-Corporate-Presentation.pdf`,
    filings: `${CB}/doc_financials/2023/q4/4th-Quarter-2023-Earnings-Press-Release.pdf`,
  },
  "Q3 2023": {
    slides: `${CB}/doc_financials/2023/q3/Chubb-Third-Quarter-2023-Corporate-Presentation.pdf`,
    filings: `${CB}/doc_financials/2023/q3/3rd-Quarter-2023-Earnings-Press-Release.pdf`,
  },
  "Q2 2023": {
    slides: null,
    filings: `${CB}/doc_financials/2023/q2/2nd-Quarter-2023-Earnings-Press-Release-1.pdf`,
  },
  "Q1 2023": {
    slides: null,
    filings: `${CB}/doc_financials/2023/q1/1st-Quarter-2023-Earnings-Press-Release.pdf`,
  },
  "Q4 2022": {
    slides: null,
    filings: `${CB}/doc_financials/2022/q4/4th-Quarter-2022-Earnings-Press-Release.pdf`,
  },
  "Q3 2022": {
    slides: `${CB}/doc_presentation/2022/11/Chubb-Third-Quarter-2022-Corporate-Presentation.pdf`,
    filings: `${CB}/doc_financials/2022/q3/3rd-Quarter-2022-Earnings-Press-Release.pdf`,
  },
  "Q2 2022": {
    slides: `${CB}/doc_presentation/2022/Chubb-Second-Quarter-2022-Corporate-Presentation.pdf`,
    filings: `${CB}/doc_financials/2022/q2/2nd-Quarter-2022-Earnings-Press-Release.pdf`,
  },
  "Q1 2022": {
    slides: `${CB}/doc_presentation/2022/05/Chubb-First-Quarter-2022-Corporate-Presentation.pdf`,
    filings: `${CB}/doc_financials/2022/q1/1st-Quarter-2022-Earnings-Press-Release.pdf`,
  },
};

export function isCbRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|prepared[-_\s]*remarks|webcast|financial[-_\s]*supplement|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isCbIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "s201.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/471466897/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isCbRejected(url);
  } catch {
    return false;
  }
}

export function mergeCbKnownQuarterDocs(): Map<string, CbQuarterDocs> {
  return new Map(Object.entries(CB_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
