/**
 * FCX IR seed — 12-31.
 * Freeport-McMoRan calendar FY. Slides=FCX_*Q*_CC.pdf under doc_presentations; Filings=*Earnings_Release* under doc_news (FinancialReport.svc). Reject 10-Q/10-K. Q3'25 only publishes FCX_3Q25_CC_supplementary.pdf as the presentation (no main CC). Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). All locked URLs Range-GET %PDF. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type FcxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const FCX_IR_PAGES = [
  "https://investors.fcx.com/investors/default.aspx",
] as const;

export const FCX_KNOWN_QUARTER_DOCS: Readonly<Record<string, FcxQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2022/FCX_1Q22_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2022/FCX_220421_1Q_2022_Earnings_Release.pdf",
  },
  "Q2 2022": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2022/FCX_2Q22_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2022/FCX_220721_2Q_2022_Earnings_Release.pdf",
  },
  "Q3 2022": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2022/FCX_3Q22_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2022/FCX_221020_3Q_2022_Earnings_Release.pdf",
  },
  "Q4 2022": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2023/FCX_4Q22_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2023/FCX_230125_4Q_2022_Earnings_Release.pdf",
  },
  "Q1 2023": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2023/FCX_1Q23_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2023/FCX_230421_1Q_2023_Earnings_Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2023/FCX_2Q23_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2023/FCX_230720_2Q_2023_Earnings_Release.pdf",
  },
  "Q3 2023": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2023/FCX_3Q23_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2023/FCX_231019_3Q_2023_Earnings_Release.pdf",
  },
  "Q4 2023": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2023/FCX_4Q23_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2024/FCX_240124_4Q_2023_Earnings_Release.pdf",
  },
  "Q1 2024": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2024/FCX_1Q24_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2024/FCX_240423_1Q_2024_Earnings_Release.pdf",
  },
  "Q2 2024": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2024/FCX_2Q24_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2024/FCX_240723_2Q_2024_Earnings_Release.pdf",
  },
  "Q3 2024": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2024/FCX_3Q24_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2024/FCX_241022_3Q_2024_Earnings_Release-docx.pdf",
  },
  "Q4 2024": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2024/FCX_4Q24_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2025/FCX_250123_4Q_2024_Earnings_Release.pdf",
  },
  "Q1 2025": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2025/FCX_1Q25_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2025/FCX_250424_1Q_2025_Earnings_Release.pdf",
  },
  "Q2 2025": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2025/FCX_2Q25_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2025/FCX_250723_2Q_2025_Earnings_Release.pdf",
  },
  "Q3 2025": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2025/FCX_3Q25_CC_supplementary.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2025/FCX_251023_3Q_2025_Earnings_Release.pdf",
  },
  "Q4 2025": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2025/FCX_4Q25_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2026/FCX_260122.pdf",
  },
  "Q1 2026": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2026/FCX_1Q26_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2026/FCX_260423.pdf",
  },
  "Q2 2026": {
    slides: "https://s22.q4cdn.com/529358580/files/doc_presentations/2026/FCX_2Q26_CC.pdf",
    filings: "https://s22.q4cdn.com/529358580/files/doc_news/2026/FCX_260723_2Q_2026_Earnings_Release.pdf",
  }
};

export function isFcxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isFcxIrPdf(href: string | null | undefined): boolean {
  if (!href || isFcxRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s22.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/529358580/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeFcxKnownQuarterDocs(): Map<string, FcxQuarterDocs> {
  return new Map(Object.entries(FCX_KNOWN_QUARTER_DOCS));
}
