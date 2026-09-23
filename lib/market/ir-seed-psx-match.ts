/**
 * PSX IR seed — 12-31.
 * Phillips 66 calendar FY. Hub investor.phillips66.com. Slides=Event Attachment Presentation/Slides on s22.q4cdn.com/128149789 (doc_financials / doc_presentations / doc_downloads). Filings=FinancialReport DocumentCategory news Earnings Release PDF (distinct URL; content hash-checked ≠ slides). Reject transcripts / market-indicators / investor-update / supplemental. Scope Q1 2022→Q2 2026. 18 green / 0 yellow / 0 red. All Range-GET %PDF. Ticker GREEN.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type PsxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const PSX_IR_PAGES = [
  "https://investor.phillips66.com/",
] as const;

export const PSX_KNOWN_QUARTER_DOCS: Readonly<Record<string, PsxQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2022/q1/PSX-1Q-2022-Earnings-Presentation-FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2022/q1/PSX-1Q-2022-Earnings-Release-FINAL.pdf",
  },
  "Q2 2022": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_presentations/2022/07/PSX-2Q-22-Earnings-Release-Presentation-Slides-FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2022/q2/PSX-2Q-22-FINAL-(7-28-22).pdf",
  },
  "Q3 2022": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_presentations/2022/11/3Q-2022-PSX-Earnings-Release-Slides.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2022/q3/PSX-3Q-22-Earnings-Release.pdf",
  },
  "Q4 2022": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2022/q4/Phillips-66-Fourth-Quarter-22-Presentation-Slides.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2022/q4/Phillips-66-Fourth-Quarter-22-Earnings-Release.pdf",
  },
  "Q1 2023": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_presentations/2023/Phillips-66-First-Quarter-2023-Presentation-Slides.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2023/q1/Phillips-66-First-Quarter-2023-Earnings-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2023/q2/PSX-2Q-23-ER-Earnings-Release-Presentation.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_news/PSX-2Q-23-ER-Earnings-Release.pdf",
  },
  "Q3 2023": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_downloads/2023/Phillips-66-Third-Quarter-2023-Earnings-Presentation-FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2023/q3/Phillips-66-Third-Quarter-2023-Earnings-Release-FINAL.pdf",
  },
  "Q4 2023": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2023/q4/Phillips-66-4Q-2023-Earnings-Release_Presentation.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2023/q4/Phillips-66-4Q-2023-Earnings-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2024/q1/P66_Earnings-Release_First-Quarter_2024.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2024/q1/Phillips-66-1Q-24-Earnings-Release-FINAL.pdf",
  },
  "Q2 2024": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_downloads/2024/Phillips-66-Second-Quarter-2024-Earnings-Presentation.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2024/q2/Phillips-66-Second-Quarter-2024-Earnings-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2024/q3/Phillips-66-Third-Quarter_Earnings_Presentation_Slides_FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2024/q3/Phillips-66-Third-Quarter-2024-Earnings-Release.pdf",
  },
  "Q4 2024": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2024/q4/Phillips-66-4Q24-Earnings-RELEASE-Jan-31-FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2024/q4/Phillips-66-4Q24-Earnings-RELEASE-FINAL-2.pdf",
  },
  "Q1 2025": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2025/q1/v2/First-Quarter-Phillips-66-Presentation-Slides-FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2025/q1/First-Quarter-Phillips-66-Earnings-Release-FINAL.pdf",
  },
  "Q2 2025": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2025/q2/Presentation/PSX-2Q-25-Earnings-Release-FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2025/q2/PSX-2Q-25-Earnings-Release-FINAL.pdf",
  },
  "Q3 2025": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2025/q3/3Q-2025-Earnings-Presentation-FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2025/q3/Phillips-66-Third-Quarter-2025-Earnings-Release.pdf",
  },
  "Q4 2025": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2025/q4/Phillips-66-Fourth-Quarter-2025-Earnings-Presentation-FINAL.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2025/q4/Phillips-66-Fourth-Quarter-2025-Earnings-Release-FINAL.pdf",
  },
  "Q1 2026": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2026/q1/First-Quarter-2026-Earnings-Presentation.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2026/q1/First-Quarter-2026-Earnings-Release.pdf",
  },
  "Q2 2026": {
    slides: "https://s22.q4cdn.com/128149789/files/doc_financials/2026/q2/Phillips-66-2Q-2026-Earnings-Presentation.pdf",
    filings: "https://s22.q4cdn.com/128149789/files/doc_financials/2026/q2/Phillips-66-2Q-2026-Earnings-Release.pdf",
  }
};

export function isPsxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isPsxIrPdf(href: string | null | undefined): boolean {
  if (!href || isPsxRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s22.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/128149789/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergePsxKnownQuarterDocs(): Map<string, PsxQuarterDocs> {
  return new Map(Object.entries(PSX_KNOWN_QUARTER_DOCS));
}
