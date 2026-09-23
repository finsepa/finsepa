/**
 * Cloudflare (NET) IR — calendar FY.
 * Slides = Earnings Supplemental; Filings = Earnings Release (Exhibit 99.1).
 * Never transcript / 10-Q / 10-K / webcast / SEC HTML.
 * Host: cloudflare.net/files (Q4 CDN mirror).
 */

export type NetQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const NET_IR_PAGES = [
  "https://cloudflare.net/",
  "https://cloudflare.net/financials/quarterly-results/default.aspx",
] as const;

/** FinancialReport.svc catalog (Q1 2022 → Q2 2026). */
export const NET_KNOWN_QUARTER_DOCS: Readonly<Record<string, NetQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://cloudflare.net/files/doc_financials/2026/q2/Q2-26-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2026/q2/Q2-26-Exhibit-99-1.pdf",
  },
  "Q1 2026": {
    slides: "https://cloudflare.net/files/doc_financials/2026/q1/Q1-26-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2026/q1/Q1-26-Exhibit-99-1.pdf",
  },
  "Q4 2025": {
    slides: "https://cloudflare.net/files/doc_financials/2025/q4/Q4-25-Supplemental-Financial-Information_FINAL.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2025/q4/Q4-25-Exhibit-99-1_FINAL.pdf",
  },
  "Q3 2025": {
    slides: "https://cloudflare.net/files/doc_financials/2025/q3/v2/Q3-25-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2025/q3/v2/Q3-25-Exhibit-99-1_FINAL.pdf",
  },
  "Q2 2025": {
    slides: "https://cloudflare.net/files/doc_financials/2025/q2/Q2-25-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2025/q2/Q2-25-Exhibit-99-1.pdf",
  },
  "Q1 2025": {
    slides: "https://cloudflare.net/files/doc_financials/2025/q1/Q1-25-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2025/q1/Q1-25-Exhibit-99-1.pdf",
  },
  "Q4 2024": {
    slides: "https://cloudflare.net/files/doc_financials/2024/q4/Q4-24-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2024/q4/Q4-24-Exhibit-99-1.pdf",
  },
  "Q3 2024": {
    slides: "https://cloudflare.net/files/doc_financials/2024/q3/Q3-24-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2024/q3/Q3-24-Exhibit-99-1.pdf",
  },
  "Q2 2024": {
    slides: "https://cloudflare.net/files/doc_financials/2024/q2/Q2-24-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2024/q2/Q2-24-Exhibit-99-1_final.pdf",
  },
  "Q1 2024": {
    slides: "https://cloudflare.net/files/doc_financials/2024/q1/Q1-24-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2024/q1/Q1-24-Exhibit-99-1.pdf",
  },
  "Q4 2023": {
    slides: "https://cloudflare.net/files/doc_financials/2023/q4/Q4-23-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2023/q4/Q4-23-Exhibit-99-1.pdf",
  },
  "Q3 2023": {
    slides: "https://cloudflare.net/files/doc_financials/2023/q3/Q3-23-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2023/q3/Q3-23-Exhibit-99-1.pdf",
  },
  "Q2 2023": {
    slides: "https://cloudflare.net/files/doc_financials/2023/q2/Q2-23-Supplemental-Financial-Information_FINAL.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2023/q2/Q2-23-Exhibit-99-1_FINAL.pdf",
  },
  "Q1 2023": {
    slides: "https://cloudflare.net/files/doc_financials/2023/q1/Q123-Supplemental-Financial-Information_FINAL.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2023/q1/Q123-Exhibit-99-1_FINAL.pdf",
  },
  "Q4 2022": {
    slides: "https://cloudflare.net/files/doc_financials/2022/q4/Q4'22-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2022/q4/Q4'22-Exhibit-99.1.pdf",
  },
  "Q3 2022": {
    slides: "https://cloudflare.net/files/doc_financials/2022/q3/Q3'22-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2022/q3/Q3'22-Exhibit-99.1.pdf",
  },
  "Q2 2022": {
    slides: "https://cloudflare.net/files/doc_financials/2022/q2/Q2'22-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2022/q2/v2/Q2'22-Exhibit-99.1.pdf",
  },
  "Q1 2022": {
    slides: "https://cloudflare.net/files/doc_financials/2022/q1/Q1'22-Supplemental-Financial-Information.pdf",
    filings: "https://cloudflare.net/files/doc_financials/2022/q1/Q1'22-Exhibit-99.1.pdf",
  },
};

export function isNetRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isNetIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "cloudflare.net" || host.endsWith(".cloudflare.net") || host.endsWith(".q4cdn.com"))) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isNetRejected(url);
  } catch {
    return false;
  }
}

export function mergeNetKnownQuarterDocs(): Map<string, NetQuarterDocs> {
  return new Map(Object.entries(NET_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
