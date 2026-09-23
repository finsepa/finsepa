/**
 * Accenture (ACN) IR — FY ends 08-31.
 * Slides = earnings presentation / supporting-materials; Filings = earnings press release.
 * Hosts: investor.accenture.com (accenture-v4 + Accenture-IR-V3 for some FY25).
 * Never transcript / podcast / infographic / 10-Q / SEC HTML.
 * Q3 2023: filings only (no non-infographic deck on IR).
 */

export type AcnQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ACN_FY_END = "08-31";

export const ACN_IR_PAGES = [
  "https://investor.accenture.com/filings-and-reports/earnings-reports",
  "https://investor.accenture.com/",
] as const;

/** Catalog Q1 2022 → Q3 2026 (Q3 2023 slides null). */
export const ACN_KNOWN_QUARTER_DOCS: Readonly<Record<string, AcnQuarterDocs>> = {
  "Q1 2022": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2022/q1/q1-fy22-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2022/q1/q1fy22-earnings-release.pdf",
  },
  "Q2 2022": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2022/q2/q2-fy22-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2022/q2/q2fy22-earnings-release.pdf",
  },
  "Q3 2022": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2022/q3/q3fy22-supporting-material.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2022/q3/q3-fy22-earnings-release.pdf",
  },
  "Q4 2022": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2022/q4/fourth-quarter-2022-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2022/q4/accentures-fourth-quarter-fiscal-2022-earnings-release.pdf",
  },
  "Q1 2023": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2023/q1/first-quarter-2023-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2023/q1/accentures-first-quarter-fiscal-2023-earnings-release-final.pdf",
  },
  "Q2 2023": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2023/q2/second-quarter-2023-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2023/q2/accentures-second-quarter-fiscal-2023-earnings-press-release.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2023/q3/accenture-third-quarter-fiscal-2023-earnings-release-final.pdf",
  },
  "Q4 2023": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2023/q4/supporting-q4fy23-final-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2023/q4/final-q4-fy23-earnings-press-release.pdf",
  },
  "Q1 2024": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2024/q1/accentures-first-quarter-fiscal-2024-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2024/q1/accenture-reports-first-quarter-fiscal-2024-results.pdf",
  },
  "Q2 2024": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2024/q2/accentures-second-quarter-fiscal-2024-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2024/q2/accenture-reports-second-quarter-fiscal-2024-results.pdf",
  },
  "Q3 2024": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2024/q3/accentures-third-quarter-fiscal-2024-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2024/q3/accenture-reports-third-quarter-fiscal-2024-press-release.pdf",
  },
  "Q4 2024": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2024/q4/accentures-fourth-quarter-fiscal-2024-supporting-materials--.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2024/q4/accenture-reports-fourth-quarter-and-full-year-fiscal-2024-results.pdf",
  },
  "Q1 2025": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2025/first-quarter-fiscal-2025-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2025/accentures-first-quarter-fiscal-2025-results.pdf",
  },
  "Q2 2025": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2025/second-quarter-2025-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/Accenture-IR-V3/quarterly-earnings/2025/q2fy25/accentures-second-quarter-fiscal-2025-earnings-release.pdf",
  },
  "Q3 2025": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/Accenture-IR-V3/quarterly-earnings/2025/q3-fy25/acn-third-quarter-2025-supporting-materials.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/Accenture-IR-V3/quarterly-earnings/2025/q3-fy25/acn-third-quarter-fiscal-2025-earnings-release.pdf",
  },
  "Q4 2025": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/Accenture-IR-V3/quarterly-earnings/2025/q4-fy-25/acn-fourth-quarter-fiscal-2025-earnings-presentation.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/Accenture-IR-V3/quarterly-earnings/2025/q4-fy-25/acn-fourth-quarter-fiscal-2025-earnings-release.pdf",
  },
  "Q1 2026": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2026/first-quarter-fiscal-2026-earnings-presentation.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2026/accentures-first-quarter-fiscal-2026-earnings-press-release.pdf",
  },
  "Q2 2026": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2026/second-quarter-fiscal-2026-earnings-presentation.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2026/accentures-second-quarter-fiscal-2026-earnings-press-release.pdf",
  },
  "Q3 2026": {
    slides:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2026/accenture-3q-fy26-earnings-presentation.pdf",
    filings:
      "https://investor.accenture.com/~/media/Files/A/accenture-v4/investors/earnings-reports/2026/accenture-3q-fy26-earnings-release.pdf",
  },
};

export function isAcnRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|podcast|infographic|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isAcnIrPdf(href: string | null | undefined): boolean {
  if (!href || isAcnRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investor.accenture.com" || host.endsWith(".accenture.com"))) return false;
    if (!u.pathname.includes("/media/Files/A/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAcnKnownQuarterDocs(): Map<string, AcnQuarterDocs> {
  return new Map(Object.entries(ACN_KNOWN_QUARTER_DOCS));
}
