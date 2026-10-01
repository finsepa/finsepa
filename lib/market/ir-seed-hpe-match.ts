/**
 * HPE IR seed — 10-31.
 * Hewlett Packard Enterprise. Oct 31 FY. Slides=*earnings-presentation*; Filings=*earnings-press-release* /*press-release* on investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q{N}-{YYYY}/. Reject transcripts/quarterly-results tables/salient/summary. Scope Q1 2022→Q3 2026 (19 green / 0 yellow / 0 red). Range-GET %PDF verified. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type HpeQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const HPE_IR_PAGES = [
  "https://investors.hpe.com/financials/quarterly-results",
] as const;

export const HPE_KNOWN_QUARTER_DOCS: Readonly<Record<string, HpeQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2022/q1-2022-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2022/q1-2022-press-release.pdf",
  },
  "Q2 2022": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2022/q2-2022-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2022/q2-2022-press-release.pdf",
  },
  "Q3 2022": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2022/q3-2022-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2022/q3-2022-press-release.pdf",
  },
  "Q4 2022": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q4-2022/q4-2022-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q4-2022/q4-2022-press-release.pdf",
  },
  "Q1 2023": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2023/q1-2023-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2023/q1-2023-press-release.pdf",
  },
  "Q2 2023": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2023/q2-2023-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2023/q2-2023-earnings-press-release-v1.pdf",
  },
  "Q3 2023": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2023/q3-2023-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2023/q3-2023-earnings-press-release.pdf",
  },
  "Q4 2023": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q4-2023/q4-2023-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q4-2023/q4-2023-earnings-press-release.pdf",
  },
  "Q1 2024": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2024/q1-2024-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2024/q1-2024-earnings-press-release.pdf",
  },
  "Q2 2024": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2024/q2-2024-earnings--presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2024/q2-2024-earnings-press-release.pdf",
  },
  "Q3 2024": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2024/q3fy24-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2024/q3-2024-press-release.pdf",
  },
  "Q4 2024": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q4-2024/hpe-q4-24-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q4-2024/hpe-q4-24-earnings-press-release.pdf",
  },
  "Q1 2025": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2025/hpe-q1-fy25-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2025/hpe-q1-2025-press-release.pdf",
  },
  "Q2 2025": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2025/q2-2025-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2025/q2-2025-earnings-press-release.pdf",
  },
  "Q3 2025": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2025/q3-2025-earning-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2025/q3-2025-earnings-press-release.pdf",
  },
  "Q4 2025": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q4-2025/q4-2025-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q4-2025/q4-2025-earnings-press-release.pdf",
  },
  "Q1 2026": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2026/q1-2026-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q1-2026/q1-2026-earnings-press-release.pdf",
  },
  "Q2 2026": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2026/q2-2026-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q2-2026/q2-2026-earnings-press-release.pdf",
  },
  "Q3 2026": {
    slides: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2026/q3-2026-earnings-presentation.pdf",
    filings: "https://investors.hpe.com/~/media/Files/H/HP-Enterprise-IR/documents/q3-2026/q3-2026-earnings-press-release.pdf",
  },
};

export function isHpeRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isHpeIrPdf(href: string | null | undefined): boolean {
  if (!href || isHpeRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.hpe.com" || host.endsWith(".hpe.com"))) return false;
    if (!/hp-enterprise-ir/i.test(u.pathname)) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeHpeKnownQuarterDocs(): Map<string, HpeQuarterDocs> {
  return new Map(Object.entries(HPE_KNOWN_QUARTER_DOCS));
}
