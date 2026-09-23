/**
 * Oversea-Chinese Banking (OVCHY / OCBC) IR — calendar FY (31 Dec).
 * Slides = Results Highlights (Q1/Q3) or Results Presentation (Q2/FY); Filings = Press/Media Release.
 * Host: www.ocbc.com/iwov-resources/.../quarterly-results/. Never SEC HTML.
 */

export type OvchyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const OVCHY_IR_PAGES = [
  "https://www.ocbc.com/group/investors/financials.page",
  "https://www.ocbc.com/group/investors.html",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const OVCHY_KNOWN_QUARTER_DOCS: Readonly<Record<string, OvchyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2022/OCBC%201Q22%20Results%20Highlights.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2022/OCBC%201Q22%20Results%20Press%20Release.pdf",
  },
  "Q2 2022": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2022/OCBC%201H22%20Results%20Presentation%20.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2022/OCBC%201H22%20Media%20Release%20and%20Financial%20Highlights.pdf",
  },
  "Q3 2022": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2022/OCBC%203Q22%20Results%20Highlights%20%20.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2022/OCBC%203Q22%20Results%20Press%20Release.pdf",
  },
  "Q4 2022": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2022/OCBC%20FY22%20Results%20Presentation.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2022/OCBC%20FY22%20Media%20Release%20and%20Financial%20Highlights.pdf",
  },
  "Q1 2023": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2023/OCBC%201Q23%20Results%20Highlights.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2023/OCBC%201Q23%20Results%20Press%20Release.pdf",
  },
  "Q2 2023": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2023/OCBC%201H23%20Results%20Presentation.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2023/1H23%20Media%20Release%20and%20Financial%20Highlights.pdf",
  },
  "Q3 2023": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2023/OCBC%203Q23%20Results%20Highlights.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2023/OCBC%203Q23%20Results%20Press%20Release.pdf",
  },
  "Q4 2023": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2023/OCBC%20FY23%20Results%20Presentation.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2023/FY23%20Media%20Release%20%20Financial%20Highlights.pdf",
  },
  "Q1 2024": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2024/OCBC%201Q24%20Results%20Highlights%20.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2024/OCBC%201Q24%20Results%20Press%20Release.pdf",
  },
  "Q2 2024": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2024/OCBC%201H24%20Results%20Presentation.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2024/OCBC%201H24%20Media%20Release%20Financial%20Highlights.pdf",
  },
  "Q3 2024": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2024/OCBC%203Q24%20Results%20Highlights.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2024/OCBC%203Q24%20Results%20Press%20Release.pdf",
  },
  "Q4 2024": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2024/OCBC%20FY24%20Results%20Presentation.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2024/OCBC%20FY24%20Media%20Release%20Financial%20Highlights.pdf",
  },
  "Q1 2025": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2025/OCBC%201Q25%20Results%20Highlights.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2025/OCBC%201Q25%20Results%20%20Press%20Release.pdf",
  },
  "Q2 2025": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2025/OCBC%201H25%20Results%20Presentation.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2025/OCBC%201H25%20Media%20Release%20Financial%20Highlights.pdf",
  },
  "Q3 2025": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2025/OCBC%203Q25%20Results%20Highlights.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2025/OCBC%203Q25%20Results%20Press%20Release.pdf",
  },
  "Q4 2025": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2025/OCBC%20FY25%20Results%20Presentation.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2025/OCBC%20FY25%20Media%20Release%20Financial%20Highlights.pdf",
  },
  "Q1 2026": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2026/OCBC%201Q26%20Results%20Highlights.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2026/OCBC%201Q26%20Results%20Press%20Release.pdf",
  },
  "Q2 2026": {
    slides: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2026/OCBC%201H26%20Results%20Presentation.pdf",
    filings: "https://www.ocbc.com/iwov-resources/sg/ocbc/gbc/pdf/investors/quarterly-results/2026/OCBC%201H26%20Media%20Release%20Financial%20Highlights.pdf",
  }
};

export function isOvchyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|pillar|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isOvchyIrPdf(href: string | null | undefined): boolean {
  if (!href || isOvchyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.ocbc.com" || host === "ocbc.com" || host.endsWith(".ocbc.com"))) return false;
    if (!u.pathname.includes("/iwov-resources/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeOvchyKnownQuarterDocs(): Map<string, OvchyQuarterDocs> {
  return new Map(Object.entries(OVCHY_KNOWN_QUARTER_DOCS));
}
