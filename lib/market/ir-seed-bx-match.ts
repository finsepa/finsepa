/**
 * Blackstone (BX) IR — calendar FY.
 * Issuer publishes a single combined "Press Release and Presentation" PDF per quarter
 * (no separate earnings-release PDF). Slides = that deck; Filings stay empty (never duplicate URL).
 * Host: s23.q4cdn.com/714267708. Never transcript / supplemental / SEC HTML.
 */

export type BxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BX_IR_PAGES = [
  "https://ir.blackstone.com/",
  "https://ir.blackstone.com/events/default.aspx",
] as const;

/** Event.svc-verified Press Release and Presentation PDFs (Q1 2022 → Q2 2026). Filings empty. */
export const BX_KNOWN_QUARTER_DOCS: Readonly<Record<string, BxQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2026/q2/Blackstone2Q26EarningsPressRelease.pdf",
    filings: null,
  },
  "Q1 2026": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2026/q1/Blackstone1Q26EarningsPressRelease.pdf",
    filings: null,
  },
  "Q4 2025": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2025/q4/Blackstone4Q25EarningsPressRelease.pdf",
    filings: null,
  },
  "Q3 2025": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2025/q3/Blackstone3Q25EarningsPressRelease.pdf",
    filings: null,
  },
  "Q2 2025": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2025/q2/Blackstone2Q25EarningsPressRelease.pdf",
    filings: null,
  },
  "Q1 2025": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2025/q1/Blackstone1Q25EarningsPressRelease.pdf",
    filings: null,
  },
  "Q4 2024": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2024/q4/Blackstone4Q24EarningsPressRelease.pdf",
    filings: null,
  },
  "Q3 2024": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_downloads/2024/10/Blackstone3Q24EarningsPressRelease.pdf",
    filings: null,
  },
  "Q2 2024": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2024/q2/Blackstone2Q24EarningsPressRelease.pdf",
    filings: null,
  },
  "Q1 2024": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_downloads/2024/Earnings/Blackstone1Q24EarningsPressRelease.pdf",
    filings: null,
  },
  "Q4 2023": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2023/q4/Blackstone4Q23EarningsPressRelease.pdf",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2023/q3/Blackstone3Q23EarningsPressRelease.pdf",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2023/q2/Blackstone2Q23EarningsPressRelease.pdf",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2023/q1/Blackstone1Q23EarningsPressRelease.pdf",
    filings: null,
  },
  "Q4 2022": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2022/q4/Blackstone4Q22EarningsPressRelease.pdf",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2022/Q3/Blackstone3Q22EarningsPressRelease.pdf",
    filings: null,
  },
  "Q2 2022": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_financials/2022/Q2/Blackstone2Q22EarningsPressRelease.pdf",
    filings: null,
  },
  "Q1 2022": {
    slides: "https://s23.q4cdn.com/714267708/files/doc_downloads/2022/04/Blackstone1Q22EarningsPressRelease.pdf",
    filings: null,
  },
};

export function isBxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|supplemental|investor[-_\s]*call|10-?q|10-?k|\.(xls|xlsx|csv)(?:$|[?#])/i.test(
    n,
  );
}

export function isBxIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "s23.q4cdn.com" || host === "q4cdn.com" || host.endsWith(".q4cdn.com"))) {
      return false;
    }
    if (!u.pathname.includes("/714267708/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isBxRejected(url);
  } catch {
    return false;
  }
}

export function mergeBxKnownQuarterDocs(): Map<string, BxQuarterDocs> {
  return new Map(Object.entries(BX_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
