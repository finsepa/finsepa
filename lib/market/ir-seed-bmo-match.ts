/**
 * Bank of Montreal (BMO) IR — FY ends 10-31.
 * Slides = AnalystPresentation; Filings = EarningsRelease under /ir/qtrinfo/1/.
 * Never ReportToShareholders / transcript / supplement / SEC HTML.
 */

export type BmoQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BMO_FY_END = "10-31";

export const BMO_IR_PAGES = [
  "https://www.bmo.com/main/about-bmo/investor-relations/",
  "https://www.bmo.com/main/about-bmo/investor-relations/presentations-events",
] as const;

/** Catalog Q1 2022 → Q3 2026 (issuer October FY). */
export const BMO_KNOWN_QUARTER_DOCS: Readonly<Record<string, BmoQuarterDocs>> = {
  "Q3 2026": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2026-q3/Q326_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2026-q3/Q326_EarningsRelease.pdf",
  },
  "Q2 2026": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2026-q2/Q226_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2026-q2/Q226_EarningsRelease.pdf",
  },
  "Q1 2026": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2026-q1/Q126_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2026-q1/Q126_EarningsRelease.pdf",
  },
  "Q4 2025": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2025-q4/Q425_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2025-q4/Q425_EarningsRelease.pdf",
  },
  "Q3 2025": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2025-q3/Q325_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2025-q3/Q325_EarningsRelease.pdf",
  },
  "Q2 2025": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2025-q2/Q225_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2025-q2/Q225_EarningsRelease.pdf",
  },
  "Q1 2025": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2025-q1/Q125_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2025-q1/Q125_EarningsRelease.pdf",
  },
  "Q4 2024": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2024-q4/Q424_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2024-q4/Q424_EarningsRelease.pdf",
  },
  "Q3 2024": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2024-q3/Q324_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2024-q3/Q324_EarningsRelease.pdf",
  },
  "Q2 2024": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2024-q2/Q224_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2024-q2/Q224_EarningsRelease.pdf",
  },
  "Q1 2024": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2024-q1/Q124_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2024-q1/Q124_EarningsRelease.pdf",
  },
  "Q4 2023": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2023-q4/Q423_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2023-q4/Q423_EarningsRelease.pdf",
  },
  "Q3 2023": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2023-q3/Q323_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2023-q3/Q323_EarningsRelease.pdf",
  },
  "Q2 2023": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2023-q2/Q223_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2023-q2/Q223_EarningsRelease.pdf",
  },
  "Q1 2023": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2023-q1/Q123_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2023-q1/Q123_EarningsRelease.pdf",
  },
  "Q4 2022": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2022-q4/Q422_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2022-q4/Q422_EarningsRelease.pdf",
  },
  "Q3 2022": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2022-q3/Q322_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2022-q3/Q322_EarningsRelease.pdf",
  },
  "Q2 2022": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2022-q2/Q222_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2022-q2/Q222_EarningsRelease.pdf",
  },
  "Q1 2022": {
    slides: "https://www.bmo.com/ir/qtrinfo/1/2022-q1/Q122_AnalystPresentation.pdf",
    filings: "https://www.bmo.com/ir/qtrinfo/1/2022-q1/Q122_EarningsRelease.pdf",
  },
};

export function isBmoRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|proxy|transcript|report[-_\s]*to[-_\s]*shareholders|supplement|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isBmoIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.bmo.com" || host === "bmo.com" || host.endsWith(".bmo.com"))) return false;
    if (!u.pathname.includes("/ir/qtrinfo/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isBmoRejected(url);
  } catch {
    return false;
  }
}

export function mergeBmoKnownQuarterDocs(): Map<string, BmoQuarterDocs> {
  return new Map(Object.entries(BMO_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
