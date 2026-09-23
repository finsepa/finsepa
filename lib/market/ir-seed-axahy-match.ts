/**
 * AXAHY IR seed — calendar (European insurer; semi-annual HY/FY).
 * AXA SA ADR. Semi-annual only: HY→Q2, FY→Q4; Q1/Q3 left empty (1Q/9M activity indicators exist but are not full earnings). Slides=Presentation to analysts (Half/Full Year Results*.pdf — not Press Presentation, not supplement/financial report). Filings=Press release PDFs (AXA_PR_*). Ignore SFCR/URD/transcripts/activity reports. Scope through HY2026 (Q2 2026); FY2026 not published. Counts green=9 yellow=0 red=9. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type AxahyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const AXAHY_IR_PAGES = [
  "https://www.axa.com/en/investor/results",
] as const;

export const AXAHY_KNOWN_QUARTER_DOCS: Readonly<Record<string, AxahyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0O155xUNkB1Wht_AXA_Half_Year_Results_2022.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0O1J5xUNkB1Whq_AXA_PR_20220803.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0PC55xUNkB1WiE_axa_full_year_earnings_20230223.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0OYJ5xUNkB1Wgh_axa_pr_20230223.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0Q5p5xUNkB1Wld_axa_half_year_results_2023c.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0Q455xUNkB1Wlb_AXA_PR_HY23_20230803.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0RF55xUNkB1Wl9_AXA_Full_Year_Results_2023_with_commentaries.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0RFZ5xUNkB1Wl8_axa_pr_20240222c.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0dMJ5xUNkB1XDu_AXA_Half_Year_Results_2024b.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0dLp5xUNkB1XDt_AXA_PR_20240801.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0dTp5xUNkB1XD8_AXA_Full_Year_Results_2024.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0QhZ5xUNkB1Wky_AXA_PR_20250227.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0eV55xUNkB1XGR_AXA_Half_Year_Results_2025.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/aN0eVZ5xUNkB1XGP_AXA_PR_20250801.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/abwhxx5fn6DF3AUJ_AXA_Full_Year_Results_2025b.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/aZ_Ib8FoBIGEg123_AXA_PR_20260226.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www-axa-com.cdn.prismic.io/www-axa-com/MOMLII3d3HDHdRnW_AXA_Half_Year_Results_2026_Presentation.pdf",
    filings: "https://www-axa-com.cdn.prismic.io/www-axa-com/x8rUepJwi243MMVk_AXA_PR_20260731.pdf",
  }
};

export function isAxahyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|infographic|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n) || /financial.?report|urd|activity|9m|appendices|script|video|climate|sfcr|press.?presentation/i.test(n);
}

export function isAxahyIrPdf(href: string | null | undefined): boolean {
  if (!href || isAxahyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www-axa-com.cdn.prismic.io" || host.endsWith(".prismic.io") || host === "www.axa.com" || host.endsWith(".axa.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAxahyKnownQuarterDocs(): Map<string, AxahyQuarterDocs> {
  return new Map(Object.entries(AXAHY_KNOWN_QUARTER_DOCS));
}
