/**
 * Valero Energy (VLO) IR — calendar FY.
 * Filings = Earnings Release on s23.q4cdn.com/587626645; slides intentionally null (no quarterly decks).
 * Never Guidance evergreen / 10-Q / SEC HTML.
 */

export type VloQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const VLO_IR_PAGES = [
  "https://investorvalero.com/",
  "https://investorvalero.com/financials/quarterly-results/default.aspx",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const VLO_KNOWN_QUARTER_DOCS: Readonly<Record<string, VloQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_financials/2022/q1/1Q22-VLO-Earnings-Release.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_financials/2022/q2/VLO-2Q22-Earnings-Release.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_financials/2022/q3/VLO-3Q22-Earnings-Release.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_financials/2022/q4/VLO-4Q22-Earnings-Release.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_financials/2023/q1/VLO-1Q23-Earnings-Release.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2023/q2/earnings-result/VLO-2Q23-Earnings-Release.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2023/q3/earnings-result/VLO-3Q23-Earnings-Release.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2023/q4/earnings-result/VLO-4Q23-Earnings-Release.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2024/q1/earnings-result/VLO-1Q24-Earnings-Release.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2024/q2/earnings-result/VLO-2Q24-Earnings-Release.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2024/q3/earnings-result/VLO-3Q24-Earnings-Release.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2024/q4/earnings-result/VLO-4Q24-Earnings-Release.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2025/q1/earnings-result/VLO-1Q25-Earnings-Release.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2025/q2/earnings-result/VLO-2Q25-Earnings-Release.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2025/q3/earnings-result/VLO-3Q25-Earnings-Release.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2025/q4/earnings-result/VLO-4Q25-Earnings-Release.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2026/q1/earnings-result/VLO-1Q26-Earnings-Release.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://s23.q4cdn.com/587626645/files/doc_earnings/2026/q2/earnings-result/VLO-2Q26-Earnings-Release.pdf",
  }
};

export function isVloRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|guidance|supplement|primer|tcfd|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isVloIrPdf(href: string | null | undefined): boolean {
  if (!href || isVloRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s23.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/587626645/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeVloKnownQuarterDocs(): Map<string, VloQuarterDocs> {
  return new Map(Object.entries(VLO_KNOWN_QUARTER_DOCS));
}
