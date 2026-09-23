/**
 * MHVIY IR seed — 03-31.
 * Mitsubishi Heavy Industries ADR. March FY; Finsepa labels = issuer FY (fyYYYYNq → QN YYYY), same as NTTYY/TOELY. Slides=presentation.pdf under /finance/library/result/pdf/fy{YYYY}{N}q/. Filings=/news/pdf/fy{YYYY}{N}q_press_release.pdf for Q1 2022→Q3 2025; Q4 2025/Q1 2026 use financial_results.pdf (press 404). Never SEC HTML. Reject presentation_summary / Q&A.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type MhviyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MHVIY_IR_PAGES = [
  "https://www.mhi.com/finance/library/result/",
] as const;

export const MHVIY_KNOWN_QUARTER_DOCS: Readonly<Record<string, MhviyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20221q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20221q_press_release.pdf",
  },
  "Q2 2022": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20222q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20222q_press_release.pdf",
  },
  "Q3 2022": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20223q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20223q_press_release.pdf",
  },
  "Q4 2022": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20224q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20224q_press_release.pdf",
  },
  "Q1 2023": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20231q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20231q_press_release.pdf",
  },
  "Q2 2023": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20232q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20232q_press_release.pdf",
  },
  "Q3 2023": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20233q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20233q_press_release.pdf",
  },
  "Q4 2023": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20234q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20234q_press_release.pdf",
  },
  "Q1 2024": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20241q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20241q_press_release.pdf",
  },
  "Q2 2024": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20242q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20242q_press_release.pdf",
  },
  "Q3 2024": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20243q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20243q_press_release.pdf",
  },
  "Q4 2024": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20244q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20244q_press_release.pdf",
  },
  "Q1 2025": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20251q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20251q_press_release.pdf",
  },
  "Q2 2025": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20252q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20252q_press_release.pdf",
  },
  "Q3 2025": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20253q/presentation.pdf",
    filings: "https://www.mhi.com/news/pdf/fy20253q_press_release.pdf",
  },
  "Q4 2025": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20254q/presentation.pdf",
    filings: "https://www.mhi.com/finance/library/result/pdf/fy20254q/financial_results.pdf",
  },
  "Q1 2026": {
    slides: "https://www.mhi.com/finance/library/result/pdf/fy20261q/presentation.pdf",
    filings: "https://www.mhi.com/finance/library/result/pdf/fy20261q/financial_results.pdf",
  },
};

export function isMhviyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isMhviyIrPdf(href: string | null | undefined): boolean {
  if (!href || isMhviyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.mhi.com" || host.endsWith(".mhi.com"))) return false;
    return (
      (/\/finance\/library\/result\/pdf\//i.test(u.pathname) || /\/news\/pdf\//i.test(u.pathname)) &&
      (/\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href))
    );
  } catch {
    return false;
  }
}

export function mergeMhviyKnownQuarterDocs(): Map<string, MhviyQuarterDocs> {
  return new Map(Object.entries(MHVIY_KNOWN_QUARTER_DOCS));
}
