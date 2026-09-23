/**
 * Newmont (NEM) IR — calendar FY.
 * Slides = earnings presentation; Filings = earnings release / press release PDF.
 * Never 10-Q / 10-K / transcript / statistics / SEC HTML.
 * Host: s24.q4cdn.com/382246808.
 */

export type NemQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const NEM_IR_PAGES = [
  "https://www.newmont.com/investors/",
  "https://www.newmont.com/investors/news-release/default.aspx",
] as const;

/** FinancialReport.svc catalog (Q1 2022 → Q2 2026). */
export const NEM_KNOWN_QUARTER_DOCS: Readonly<Record<string, NemQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2026/q2/presentation/Newmont-Q2-2026-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2026/q2/earnings-result/Newmont-Q2-2026-Earnings-Release_Final.pdf",
  },
  "Q1 2026": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2026/q1/presentation/Newmont-Q1-2026-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2026/q1/earnings-result/Newmont-Q1-2026-Earnings-Release_Final.pdf",
  },
  "Q4 2025": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2025/q4/presentation/Newmont-Q4-2025-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2025/q4/earnings-result/Newmont-Q4-2025-Earnings-Release_Final.pdf",
  },
  "Q3 2025": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2025/q3/presentation/Newmont-Q3-2025-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2025/q3/earnings-result/Newmont-Q3-2025-Earnings-Release_Final.pdf",
  },
  "Q2 2025": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2025/q2/presentation/Newmont-Q2-2025-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2025/q2/earnings-result/Newmont-Q2-2025-Earnings-Release_Final.pdf",
  },
  "Q1 2025": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2025/q1/presentation/Newmont-Q1-2025-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2025/q1/earnings-result/Newmont-Q1-2025-Earnings-Release_Final.pdf",
  },
  "Q4 2024": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2024/q4/presentation/Newmont-Q4-2024-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2024/q4/earnings-result/Newmont-Q4-2024-Earnings-and-2025-Guidance-Release-FINAL.pdf",
  },
  "Q3 2024": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2024/q3/presentation/Newmont-Q3-2024-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2024/q3/earnings-result/Newmont-Q3-2024-Earnings-Release_Final.pdf",
  },
  "Q2 2024": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2024/q2/presentation/Newmont-Q2-2024-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2024/q2/earnings-result/Newmont-Q2-2024-Earnings-Release_Final.pdf",
  },
  "Q1 2024": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2024/q1/presentation/Newmont-Q1-2024-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2024/q1/earnings-result/Newmont-Q1-2024-Earnings-Release_Final.pdf",
  },
  "Q4 2023": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2023/q4/presentation/Newmont-Q4-2023-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2023/q4/earnings-result/Newmont-Q4-2023-Earnings-Release_Final.pdf",
  },
  "Q3 2023": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_presentations/2023/Oct/newmont-third-quarter-2023-results-presentation_final2.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2023/q3/earnings-result/Newmont-Q3-2023-Earnings-Release_Final.pdf",
  },
  "Q2 2023": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_earnings/2023/q2/presentation/Newmont-Q2-2023-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_earnings/2023/q2/earnings-result/Newmont-Q2-2023-Earnings-Release_Final.pdf",
  },
  "Q1 2023": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_financials/2023/q1/Newmont-First-Quarter-2023-Results-Presentation_Final2.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_financials/2023/q1/Newmont-Q1-2023-Earnings-Release_Final.pdf",
  },
  "Q4 2022": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_financials/2022/q4/Newmont-2023-Guidance-and-Fourth-Quarter-2022-Results-Presentation_Final2.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_financials/2022/q4/Newmont-Q4-2022-Earnings-and-2023-Guidance-Release_Final.pdf",
  },
  "Q3 2022": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_financials/2022/q3/Newmont-Q3-2022-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_financials/2022/q3/Newmont-Q3-2022-Earnings-Release_Final.pdf",
  },
  "Q2 2022": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_financials/2022/q2/Newmont-Q2-2022-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_financials/2022/q2/Newmont-Q2-2022-Earnings-Release_Final-(clean).pdf",
  },
  "Q1 2022": {
    slides: "https://s24.q4cdn.com/382246808/files/doc_financials/2022/q1/Newmont-Q1-2022-Earnings-Presentation_Final.pdf",
    filings: "https://s24.q4cdn.com/382246808/files/doc_financials/2022/q1/Newmont-Q1-2022-Earnings-Release_Final2.pdf",
  },
};

export function isNemRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|prepared[-_\s]*remarks|webcast|operating[-_\s]*statistics|statistics|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isNemIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "s24.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/382246808/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isNemRejected(url);
  } catch {
    return false;
  }
}

export function mergeNemKnownQuarterDocs(): Map<string, NemQuarterDocs> {
  return new Map(Object.entries(NEM_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
