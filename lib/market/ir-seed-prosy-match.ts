/**
 * PROSY IR seed — 03-31.
 * Prosus NV ADR. March FY semi-annual: HY→Q2, FY→Q4 of issuer FY; Q1/Q3 empty by design. Slides=Results/Results Call Presentation; Filings=Media release on prosus.com/~/media/Files/P/prosus-corp-v2/. Q4 2023 filings null (no media-release PDF). Reject transcripts/annual report/KPI/deep-dive. Scope: 9g / 1y / 10r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type ProsyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const PROSY_IR_PAGES = [
  "https://www.prosus.com/investors/results-reports-events",
] as const;

export const PROSY_KNOWN_QUARTER_DOCS: Readonly<Record<string, ProsyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/hy-2022/results-call-presentation.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/hy-2022/media-release.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/fy-2022/results-call-presentation.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/fy-2022/media-release.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/hy-2023/results-call-presentation.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/hy-2023/media-release.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/investors/full-year-results-2023/latest-financial-results/fy23-results-call-presentation-2007232.pdf",
    filings: null,
  },
  "Q1 2024": {
    slides: null,
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/latest-financial-results/HY2024/H1%20FY24%20Results%20Call%20Presentation.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/latest-financial-results/HY2024/HY2024%20Media%20release.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/AR2024/fy2024-resultscallpresentation2024.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/AR2024/fy2024-prosus-media-release.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/hy2025/hy2025-results-presentation-updated.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/hy2025/hy2025-media-release.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/fy-2025/fy2025-results-presentation-updated.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/fy-2025/fy2025-media-release.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/hy2026/hy2026-results-presentation.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/latest-results/hy2026/hy2026-media-release.pdf",
  },
  "Q3 2026": {
    slides: null,
    filings: null,
  },
  "Q4 2026": {
    slides: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/annual-report/2026/fy2026-results-presentation.pdf",
    filings: "https://www.prosus.com/~/media/Files/P/prosus-corp-v2/results-reports-and-events-archive/annual-report/2026/fy2026-media-release.pdf",
  },
};

export function isProsyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isProsyIrPdf(href: string | null | undefined): boolean {
  if (!href || isProsyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.prosus.com" || host.endsWith(".prosus.com"))) return false;
    if (!u.pathname.toLowerCase().includes("/prosus-corp-v2/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeProsyKnownQuarterDocs(): Map<string, ProsyQuarterDocs> {
  return new Map(Object.entries(PROSY_KNOWN_QUARTER_DOCS));
}
