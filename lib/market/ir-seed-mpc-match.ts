/**
 * Marathon Petroleum (MPC) IR — calendar FY.
 * Slides = Earnings Slides; Filings = Earnings/Press Release PDF.
 * Host: s2.q4cdn.com/142437514. Never IR packet / webcast / SEC HTML.
 */

export type MpcQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MPC_IR_PAGES = [
  "https://www.marathonpetroleum.com/Investors/",
  "https://ir.marathonpetroleum.com/",
] as const;

/** Catalog Q1 2022 → Q2 2026 — green (press feed fills doc_news filings). */
export const MPC_KNOWN_QUARTER_DOCS: Readonly<Record<string, MpcQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2022/q1/MPC-1Q22-Slides-vFinal.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2022/q1/MPC-Q1-2022-Earnings-Release-vFinal.pdf",
  },
  "Q2 2022": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2022/q2/MPC-2Q22-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2022/q2/MPC-2Q22-Earnings-Release.pdf",
  },
  "Q3 2022": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2022/q3/MPC-3Q22-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2022/q3/MPC-3Q22-Press-Release.pdf",
  },
  "Q4 2022": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2022/q4/MPC-4Q22-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2022/q4/MPC-Q4-2022-Press-Release.pdf",
  },
  "Q1 2023": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_presentations/2023/MPC-Q1-2023-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_news/2023/MPC-Q1-2023-Press-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2023/q2/MPC-Q2-2023-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2023/q2/MPC-Q2-2023-Press-Release.pdf",
  },
  "Q3 2023": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2023/q3/MPC-Q3-2023-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2023/q3/MPC-Q3-2023-Press-Release.pdf",
  },
  "Q4 2023": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2023/q4/MPC-Q4-2023-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_news/2023/Q4/MPC-Q4-2023-Press-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_presentations/2024/04/MPC-1Q24-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_news/2024/04/MPC-Q1-2024-Press-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2024/q2/MPC-2Q24-Slides-vFinal.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2024/q2/MPC-Q2-2024-Earnings-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2024/q3/v2/MPC-3Q24-Earnings-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2024/q3/MPC-3Q24-Earnings-Release.pdf",
  },
  "Q4 2024": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2024/q4/MPC-Q4-2024-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_news/2025/MPC-Q4-2024-Press-Release.pdf",
  },
  "Q1 2025": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2025/q1/MPC-1Q25-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2025/q1/MPC-1Q25-Earnings-Release.pdf",
  },
  "Q2 2025": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_presentations/2025/MPC-Q2-2025-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2025/q2/MPC-Q2-2025-Press-Release.pdf",
  },
  "Q3 2025": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_presentations/2025/MPC-Q3-2025-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_news/2025/MPC-Q3-2025-Earnings-Release.pdf",
  },
  "Q4 2025": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2025/q4/06/MPC-4Q-2025-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2025/q4/MPC-4Q-2025-Earnings-Release.pdf",
  },
  "Q1 2026": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_presentations/2026/06/MPC-1Q-2026-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2026/q1/MPC-1Q-2026-Earnings-Release.pdf",
  },
  "Q2 2026": {
    slides: "https://s2.q4cdn.com/142437514/files/doc_financials/2026/q2/MPC-2Q-2026-Slides.pdf",
    filings: "https://s2.q4cdn.com/142437514/files/doc_financials/2026/q2/MPC-2Q-2026-Earnings-Release.pdf",
  },
};

export function isMpcRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|packet|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isMpcIrPdf(href: string | null | undefined): boolean {
  if (!href || isMpcRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s2.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/142437514/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeMpcKnownQuarterDocs(): Map<string, MpcQuarterDocs> {
  return new Map(Object.entries(MPC_KNOWN_QUARTER_DOCS));
}
