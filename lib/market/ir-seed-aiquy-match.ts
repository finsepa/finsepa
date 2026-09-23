/**
 * Air Liquide ADR (AIQUY) IR — calendar FY.
 * Q1/Q3 = activity presentation + press; Q2 = H1; Q4 = FY.
 * Slides = results/activity presentation; Filings = press release PDF.
 * Never credit decks / URD / pre-comms / SEC HTML.
 */

export type AiquyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const AIQUY_IR_PAGES = [
  "https://www.airliquide.com/investors/documents-presentations",
  "https://www.airliquide.com/investors/first-half-2026-results",
  "https://www.airliquide.com/2025-annual-results",
] as const;

/** Catalog Q1 2022 → Q2 2026 — green (activity decks for Q1/Q3). */
export const AIQUY_KNOWN_QUARTER_DOCS: Readonly<Record<string, AiquyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2022-05/air-liquide-q1-2022-activity-strong-sales-growth-continued-momentum-in-projects-development.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2022-04/air-liquide-strong-sales-growth-and-continued-investment.pdf",
  },
  "Q2 2022": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2022-07/presentation-h1-2022-results.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2022-07/en-pr-management-report-h1-2022.pdf",
  },
  "Q3 2022": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2022-10/strong-sales-growth-solid-investment-momentum-illustrating-resilience-business-model-presentation.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2022-10/strong-sales-growth-solid-investment-momentum-illustrating-resilience-business-model.pdf",
  },
  "Q4 2022": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2023-02/air-liquide-2022-strong-performance-acceleration-investment-decisions-prepare-future-presentation.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2023-02/air-liquide-2022-strong-performance-and-acceleration-investment-decisions-prepare-future.pdf",
  },
  "Q1 2023": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2023-04/air-liquide-q1-2023-activity-strong-execution-and-sales-growth-high-investment-backlog-presentation.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2023-04/air-liquide-q1-2023-strong-sales-growth-and-solid-investment.pdf",
  },
  "Q2 2023": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2023-07/air-liquide-h1-2023-results-presentation.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2023-07/air-liquide-h1-2023-solid-performance-and-sustained-investment-momentum-paving-the-way-for-the-future.pdf",
  },
  "Q3 2023": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2023-10/air-liquide-2023-third-quarter-revenue-solid-performance-demonstrating-the-resilience-of-the-business-model-presentation.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2023-10/air-liquide-2023-third-quarter-revenue-solid-performance-demonstrating-the-resilience-of-the-business-model.pdf",
  },
  "Q4 2023": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2024-02/air-liquide-2023-annual-results-building-solid-performance-record-investment-dynamic-2023-air-liquide-accelerates-doubles-margin-ambition-advance-strategic-plan-presentation.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2024-02/air-liquide-2023-annual-results-building-on-a-solid-performance-and-a-record-investment-dynamic-in-2023-air-liquide-accelerates-and-doubles-the-margin-ambition-of-its-advance-strategic-plan.pdf",
  },
  "Q1 2024": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2024-04/air-liquide-continues-its-trajectory-with-another-solid-quarter-combining-sales-growth-performance-improvement-and-investment-momentum-presentation.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2024-04/air-liquide-continues-its-trajectory-with-another-solid-quarter-combining-sales-growth-performance-improvement-and-investment-momentum.pdf",
  },
  "Q2 2024": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2024-07/air-liquide-presentation-h1-strong-margin-improvement-and-major-projects-to-prepare-the-future.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2024-07/air-liquide-pr-h1-margin-improvement-and-major-projects-to-prepare-the-future.pdf",
  },
  "Q3 2024": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2024-10/airliquide-presentation-q3-24-continues-trajectory-combining-solid-performance-sales-growth-record-investment.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2024-10/air-liquide-q3-2024-air-liquide-continues-its-trajectory-by-combining-solid-performance-sales-growth-and-record-investment-decisions.pdf",
  },
  "Q4 2024": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2025-02/air-liquide-presentation-fy-2024-record-year-margin-improvement-step-up-future-growth-major-commercial-successes.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2025-02/air-liquide-pr-fy-2024-building-on-record-margin-improvement-and-major-commercial-successes-fueling-future-growth-air-liquide-is-once-again-raising-its-margin-ambition.pdf",
  },
  "Q1 2025": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2025-04/air-liquide-presentation-q1-25-staying-the-course-in-turbulent-times.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2025-04/air-liquide-pr-q1-building-on-its-resilience-air-liquide-is-staying-the-course-in-the-first-quarter-of-2025.pdf",
  },
  "Q2 2025": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2025-07/air-liquide-presentation-h1-25-profitable-growth-in-turbulent-times.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2025-07/air-liquide-pr-h1-leveraging-performance-and-growth-engines-air-liquide-remains-on-track-in-the-1st-half-of-2025.pdf",
  },
  "Q3 2025": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2025-10/air-liquide-presentation-q3-25-on-track-and-accelerating-growth-potential.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2025-11/air-liquide-pr-25-q3-air-liquide-continues-to-combine-sales-growth-with-commercial-successes-to-shape-the-future.pdf",
  },
  "Q4 2025": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2026-02/air-liquide-presentation-fy-2025-new-heights.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2026-02/air-liquide-pr-fy-2025-with-record-performance-and-confident-in-its-transformation-dynamic-air-liquide-confirms-its-growth-outlook.pdf",
  },
  "Q1 2026": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2026-04/air-liquide-presentation-q1-growth-performance-and-record-investments-air-liquide-continues-on-its-successful-trajectory-in-q1-2026.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2026-04/air-liquide-pr-q1-growth-performance-and-record-investments-air-liquide-continues-on-its-successful-trajectory-in-q1-2026.pdf",
  },
  "Q2 2026": {
    slides: "https://www.airliquide.com/sites/airliquide.com/files/2026-07/air-liquide-presentation-s1-26-strong-growth-performance-in-a-disrupted-environment.pdf",
    filings: "https://www.airliquide.com/sites/airliquide.com/files/2026-07/air-liquide-pr-h1-with-an-acceleration-in-the-second-quarter-air-liquide-combines-growth-with-continuous-performance-improvement.pdf",
  },
};

export function isAiquyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|credit.investor|universal.registration|voting.rights|availability.pre|pre-q\d|pre-h1|pre-fy|pre-full|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isAiquyIrPdf(href: string | null | undefined): boolean {
  if (!href || isAiquyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.airliquide.com" || host === "airliquide.com" || host.endsWith(".airliquide.com"))) {
      return false;
    }
    return u.pathname.includes("/sites/") && u.pathname.includes("/files/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAiquyKnownQuarterDocs(): Map<string, AiquyQuarterDocs> {
  return new Map(Object.entries(AIQUY_KNOWN_QUARTER_DOCS));
}
