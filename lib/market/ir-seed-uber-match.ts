/**
 * Uber (UBER) IR — calendar FY.
 * Slides = Earnings Supplemental Data; Filings = Earnings Press Release PDF.
 * Host: s23.q4cdn.com/407969754. Never transcript / prepared remarks / investor-update / SEC HTML.
 */

export type UberQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const CDN = "https://s23.q4cdn.com/407969754/files";

export const UBER_IR_PAGES = [
  "https://investor.uber.com/",
  "https://investor.uber.com/news-events/default.aspx",
] as const;

/** Event.svc-verified Supplemental Data + Press Release (Q1 2022 → Q2 2026). */
export const UBER_KNOWN_QUARTER_DOCS: Readonly<Record<string, UberQuarterDocs>> = {
  "Q2 2026": {
    slides: `${CDN}/doc_earnings/2026/q2/supplemental-info/Uber-Q2-26-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2026/q2/earnings-result/Uber-Q2-26-Earnings-Press-Release.pdf`,
  },
  "Q1 2026": {
    slides: `${CDN}/doc_earnings/2026/q1/supplemental-info/Uber-Q1-26-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2026/q1/earnings-result/Uber-Q1-26-Earnings-Press-Release.pdf`,
  },
  "Q4 2025": {
    slides: `${CDN}/doc_earnings/2025/q4/supplemental-info/Uber-Q4-25-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2025/q4/earnings-result/Uber-Q4-25-Earnings-Press-Release.pdf`,
  },
  "Q3 2025": {
    slides: `${CDN}/doc_events/2025/Nov/04/Uber-Q3-25-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2025/q3/earnings-result/Uber-Q3-25-Earnings-Press-Release.pdf`,
  },
  "Q2 2025": {
    slides: `${CDN}/doc_earnings/2025/q2/supplemental-info/Uber-Q2-25-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2025/q2/earnings-result/Uber-Q2-25-Earnings-Press-Release.pdf`,
  },
  "Q1 2025": {
    slides: `${CDN}/doc_events/2025/May/07/Uber-Q1-25-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2025/q1/earnings-result/Uber-Q1-25-Earnings-Press-Release.pdf`,
  },
  "Q4 2024": {
    slides: `${CDN}/doc_earnings/2024/q4/supplemental-info/Uber-Q4-24-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2024/q4/earnings-result/Uber-Q4-24-Earnings-Press-Release.pdf`,
  },
  "Q3 2024": {
    slides: `${CDN}/doc_earnings/2024/q3/supplemental-info/Uber-Q3-24-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2024/q3/earnings-result/Uber-Q3-24-Earnings-Press-Release.pdf`,
  },
  "Q2 2024": {
    slides: `${CDN}/doc_earnings/2024/q2/Uber-Q2-24-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2024/q2/earnings-result/Uber-Q2-24-Earnings-Press-Release.pdf`,
  },
  "Q1 2024": {
    slides: `${CDN}/doc_earnings/2024/q1/supplemental-info/Uber-Q1-24-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2024/q1/earnings-result/Uber-Q1-24-Earnings-Press-Release.pdf`,
  },
  "Q4 2023": {
    slides: `${CDN}/doc_earnings/2023/q4/supplemental-info/Uber-Q4-23-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2023/q4/earnings-result/Uber-Q4-23-Earnings-Press-Release.pdf`,
  },
  "Q3 2023": {
    slides: `${CDN}/doc_earnings/2023/q3/supplemental-info/Uber-Q3-23-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2023/q3/earnings-result/Uber-Q3-23-Earnings-Press-Release.pdf`,
  },
  "Q2 2023": {
    slides: `${CDN}/doc_earnings/2023/q2/supplemental-info/Uber-Q2-23-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_earnings/2023/q2/earnings-result/Uber-Q2-23-Earnings-Press-Release.pdf`,
  },
  "Q1 2023": {
    slides: `${CDN}/doc_financials/2023/q1/Uber-Q1-23-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_financials/2023/q1/Uber-Q1-23-Earnings-Press-Release.pdf`,
  },
  "Q4 2022": {
    slides: `${CDN}/doc_financials/2022/q4/Uber-Q4-22-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_financials/2022/q4/Uber-Q4-22-Earnings-Press-Release.pdf`,
  },
  "Q3 2022": {
    slides: `${CDN}/doc_financials/2022/q3/vf/Q3-2022-Earnings-Supplemental-Data.pdf`,
    filings: `${CDN}/doc_financials/2022/q3/Uber-Q3-22-Earnings-Press-Release-(1).pdf`,
  },
  "Q2 2022": {
    slides: `${CDN}/doc_financials/2022/q2/Q2-2022-Earnings-Supplemental-Data.pdf`,
    filings: null,
  },
  "Q1 2022": {
    slides: `${CDN}/doc_financials/2022/q1/UBER-Q1-2022-Supplemental-Data.pdf`,
    filings: null,
  },
};

export function isUberRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|prepared[-_\s]*remarks|investor[-_\s]*update|10-?q|10-?k|\.(xls|xlsx|csv)(?:$|[?#])/i.test(
    n,
  );
}

export function isUberIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "s23.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/407969754/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isUberRejected(url);
  } catch {
    return false;
  }
}

export function mergeUberKnownQuarterDocs(): Map<string, UberQuarterDocs> {
  return new Map(Object.entries(UBER_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
