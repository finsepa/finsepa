/**
 * CDNS IR seed — 12-31.
 * Cadence Design Systems calendar FY. Slides=CFO Commentary; Filings=Financial Schedules / Earnings Tables on s206.q4cdn.com/597110084 (BusinessWire press is HTML — tables used as lockable IR filings package). Reject prepared-remarks / 10-Q / Proxy. Range-GET %PDF verified. Scope: 18g / 0y / 0r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type CdnsQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const CDNS_IR_PAGES = [
  "https://www.cadence.com/en_US/home/company/investor-relations/quarterly-results.html",
] as const;

export const CDNS_KNOWN_QUARTER_DOCS: Readonly<Record<string, CdnsQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2022/q1/1q22-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2022/q1/1q22-earnings-tables.pdf",
  },
  "Q2 2022": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2022/q2/2q22-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2022/q2/2q22-earnings-tables.pdf",
  },
  "Q3 2022": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2022/q3/3q22-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2022/q3/3q22-earnings-tables.pdf",
  },
  "Q4 2022": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2022/q4/4q22-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2022/q4/4q22-earnings-tables.pdf",
  },
  "Q1 2023": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2023/q1/1q23-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2023/q1/1q23-earnings-tables.pdf",
  },
  "Q2 2023": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2023/q2/2q23-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2023/q2/2q23-earnings-tables.pdf",
  },
  "Q3 2023": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2023/q3/3q23-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2023/q3/3q23-earnings-tables.pdf",
  },
  "Q4 2023": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2023/q4/4q23-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2023/q4/4q23-earnings-tables.pdf",
  },
  "Q1 2024": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2024/q1/1q24-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2024/q1/1q24-earnings-tables.pdf",
  },
  "Q2 2024": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2024/q2/2q24-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2024/q2/2q24-earnings-tables.pdf",
  },
  "Q3 2024": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2024/q3/3q24-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2024/q3/3q24-earnings-tables.pdf",
  },
  "Q4 2024": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2024/q4/4q24-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2024/q4/4q24-earnings-tables.pdf",
  },
  "Q1 2025": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2025/q1/1q25-cfo-commentary.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2025/q1/1q25-earnings-tables.pdf",
  },
  "Q2 2025": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2025/q2/CFO-Commentary-Q2-2025-Final-Updated.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2025/q2/Q225-Earnings-Tables-for-Web.pdf",
  },
  "Q3 2025": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2025/q3/Q3-2025-CFO-Commentary-Final.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2025/q3/Q325-Earnings-Tables-for-Web.pdf",
  },
  "Q4 2025": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2025/q4/Q4-2025-CFO-Commentary-FINAL.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2025/q4/Q425-Earnings-Tables-for-Web.pdf",
  },
  "Q1 2026": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2026/q1/Q1-2026-CFO-Commentary-FINAL.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2026/q1/Q126-Earnings-Tables-for-Web.pdf",
  },
  "Q2 2026": {
    slides: "https://s206.q4cdn.com/597110084/files/doc_financials/2026/q2/Q2-2026-CFO-Commentary-FINAL.pdf",
    filings: "https://s206.q4cdn.com/597110084/files/doc_financials/2026/q2/Q226-Earnings-Tables-for-Web.pdf",
  },
};

export function isCdnsRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isCdnsIrPdf(href: string | null | undefined): boolean {
  if (!href || isCdnsRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s206.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/597110084/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeCdnsKnownQuarterDocs(): Map<string, CdnsQuarterDocs> {
  return new Map(Object.entries(CDNS_KNOWN_QUARTER_DOCS));
}
