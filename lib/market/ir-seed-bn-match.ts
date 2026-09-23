/**
 * BN IR seed — 12-31.
 * Brookfield Corporation (not BAM). Calendar FY. Slides=Supplemental Information; Filings=Press Release PDF on bn.brookfield.com. Q1–Q3 2022 empty (pre-/early rebrand; no lockable PDFs on current IR). Q2 2025 press PDF at quarterly-reports path (page linked HTML). Never SEC HTML. Reject letter-to-shareholders / interim report / transcript as primary slots.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type BnQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BN_IR_PAGES = [
  "https://bn.brookfield.com/events-news",
] as const;

export const BN_KNOWN_QUARTER_DOCS: Readonly<Record<string, BnQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: null,
    filings: null,
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/2022-q4-bn-supplemental.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/bn-pr-brookfield-corporation-announces-strong-2022-results.pdf",
  },
  "Q1 2023": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/2023-q1-supplemental-bn-final.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/bn-2023-press-release-brookfield-corporation-reports-strong-first-quarter-results-final.pdf",
  },
  "Q2 2023": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/2023-q2-supplemental-bn.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/bn-2023-press-release-brookfield-announces-q2-2023-results-f.pdf",
  },
  "Q3 2023": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/q3-23-bn-supplemental-f.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/q3-23-bn-press-release-f.pdf",
  },
  "Q4 2023": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/2023-q4-supplemental-bn-vf.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/q4-23-bn-press-release.pdf",
  },
  "Q1 2024": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/q1-24-bn-supplemental-f.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/2024-q1-press-release-bn-f.pdf",
  },
  "Q2 2024": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/2024-q2-supplemental-bn-for-release.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/bn-2024-press-release-brookfield-corporation-reports-strong-second-quarter-results.pdf",
  },
  "Q3 2024": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/q3-24-bn-supplemental-f.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/q3-24-bn-press-release-f.pdf",
  },
  "Q4 2024": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/q4-24-bn-supplemental-f.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/q4-24-bn-press-release-f.pdf",
  },
  "Q1 2025": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/2025-q1-bn-supplemental-vf.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/events-news/2025-q1-bn-press-release-vf.pdf",
  },
  "Q2 2025": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/reports-filings/quarterly-reports/q2-2025-bn-supplemental-f.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/brookfield-bn/reports-filings/quarterly-reports/q2-2025-bn-press-release-f.pdf",
  },
  "Q3 2025": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/BN-IR-Master/Supplemental-Information/2025/2025%20-%20Q3%20BN%20Supplemental.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/BN-IR-Master/Press-Releases/2025/2025%20-%20Q3%20BN%20Press%20Release.pdf",
  },
  "Q4 2025": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/BN-IR-Master/Supplemental-Information/2026/2025%20-%20Q4%20BN%20Supplemental_vF.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/BN-IR-Master/Press-Releases/2026/2025%20-%20Q4%20BN%20Press%20Release_vF.pdf",
  },
  "Q1 2026": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/Brookfield-BN-IR-V2/2026/Q1/2026-Q1-BN-Supplemental-vF-2.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/Brookfield-BN-IR-V2/2026/Q1/2026-Q1-BN-Press-Release-vF.pdf",
  },
  "Q2 2026": {
    slides: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/Brookfield-BN-IR-V2/2026/Q2/2026-Q2-BN-Supplemental.pdf",
    filings: "https://bn.brookfield.com/sites/brookfield-bn-v2/files/Brookfield-BN-IR-V2/2026/Q2/2026-Q2-BN-Press-Release.pdf",
  },
};

export function isBnRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isBnIrPdf(href: string | null | undefined): boolean {
  if (!href || isBnRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "bn.brookfield.com" || host.endsWith(".brookfield.com"))) return false;
    if (!(/\/sites\/brookfield-bn/i.test(u.pathname) || /\/Brookfield-BN/i.test(u.pathname))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeBnKnownQuarterDocs(): Map<string, BnQuarterDocs> {
  return new Map(Object.entries(BN_KNOWN_QUARTER_DOCS));
}
