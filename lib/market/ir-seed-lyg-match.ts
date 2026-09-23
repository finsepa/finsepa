/**
 * LYG IR seed — 12-31.
 * Lloyds Banking Group ADR — UK IR on lloydsbankinggroup.com. Slides=Results presentation (HY/FY) or Q1/Q3 IMS presentation; Filings=Results announcement / IMS PDF under assets/pdfs/.../lloyds-banking-group-plc. Path shift: 2022 used half-year/ and full-year/; 2023+ uses q2/q4. Reject FI booklet / annual report / Pillar 3 / Form 20-F / transcripts / subsidiary results. Never SEC HTML. Scope: Ng=18 / Ny=0 / Nr=0. Range-GET %PDF verified (browser if Cloudflare).
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type LygQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const LYG_IR_PAGES = [
  "https://www.lloydsbankinggroup.com/investors/financial-downloads.html",
] as const;

export const LYG_KNOWN_QUARTER_DOCS: Readonly<Record<string, LygQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2022/q1/2022-lbg-q1-ims-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2022/q1/2022-lbg-q1-ims.pdf",
  },
  "Q2 2022": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2022/half-year/2022-lbg-hy-results-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2022/half-year/2022-lbg-hy-results.pdf",
  },
  "Q3 2022": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2022/q3/2022-lbg-q3-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2022/q3/2022-lbg-q3-ims.pdf",
  },
  "Q4 2022": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2022/full-year/2022-lbg-fy-results-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2022/full-year/2022-lbg-fy-results.pdf",
  },
  "Q1 2023": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2023/q1/2023-lbg-q1-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2023/q1/2023-lbg-q1-ims.pdf",
  },
  "Q2 2023": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2023/q2/2023-lbg-hy-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2023/q2/2023-lbg-hy-results.pdf",
  },
  "Q3 2023": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2023/q3/2023-lbg-q3-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2023/q3/2023-lbg-q3-ims.pdf",
  },
  "Q4 2023": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2023/q4/2023-lbg-fy-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2023/q4/2023-lbg-fy-results.pdf",
  },
  "Q1 2024": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2024/q1/2024-lbg-q1-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2024/q1/2024-lbg-q1-ims.pdf",
  },
  "Q2 2024": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2024/q2/2024-lbg-hy-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2024/q2/2024-lbg-hy-results.pdf",
  },
  "Q3 2024": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2024/q3/2024-lbg-q3-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2024/q3/2024-lbg-q3-ims.pdf",
  },
  "Q4 2024": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2024/q4/2024-lbg-fy-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2024/q4/2024-lbg-fy-results.pdf",
  },
  "Q1 2025": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2025/q1/2025-lbg-q1-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2025/q1/2025-lbg-q1-ims.pdf",
  },
  "Q2 2025": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2025/q2/2025-lbg-hy-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2025/q2/2025-lbg-hy-results.pdf",
  },
  "Q3 2025": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2025/q3/2025-lbg-q3-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2025/q3/2025-lbg-q3-ims.pdf",
  },
  "Q4 2025": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2025/q4/2025-lbg-fy-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2025/q4/2025-lbg-fy-results.pdf",
  },
  "Q1 2026": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2026/q1/2026-lbg-q1-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2026/q1/2026-lbg-q1-ims.pdf",
  },
  "Q2 2026": {
    slides: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2026/q2/2026-lbg-hy-presentation.pdf",
    filings: "https://www.lloydsbankinggroup.com/assets/pdfs/investors/financial-performance/lloyds-banking-group-plc/2026/q2/2026-lbg-hy-results.pdf",
  },
};

export function isLygRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isLygIrPdf(href: string | null | undefined): boolean {
  if (!href || isLygRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.lloydsbankinggroup.com" || host.endsWith(".lloydsbankinggroup.com"))) return false;
    if (!u.pathname.includes("/assets/pdfs/investors/financial-performance/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeLygKnownQuarterDocs(): Map<string, LygQuarterDocs> {
  return new Map(Object.entries(LYG_KNOWN_QUARTER_DOCS));
}
