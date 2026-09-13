/**
 * Charles Schwab (SCHW) IR — calendar FY.
 * Slides = seasonal Business Update presentation; Filings = earnings press release PDF.
 * Never 10-Q / 10-K / XLS tables / Investor Day / SEC HTML.
 * Host: content.schwab.com
 */

export type SchwQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const SCHW_CDN = "https://content.schwab.com/web/retail/public/about-schwab";

function file(name: string): string {
  return `${SCHW_CDN}/${name}`;
}

export const SCHW_IR_PAGES = [
  "https://www.aboutschwab.com/financial-reports",
  "https://www.aboutschwab.com/investor-relations",
] as const;

/** Browser-verified from aboutschwab.com/financial-reports (Q1 2022 → Q2 2026). */
export const SCHW_KNOWN_QUARTER_DOCS: Readonly<Record<string, SchwQuarterDocs>> = {
  "Q2 2026": {
    slides: file("schwab_summer_business_update_072126b.pdf"),
    filings: file("schwab_q2_2026_earnings_release.pdf"),
  },
  "Q1 2026": {
    slides: file("schwab_spring_business_update_041626.pdf"),
    filings: file("schwab_q1_2026_earnings_release.pdf"),
  },
  "Q4 2025": {
    slides: file("schwab_winter_business_update_012126.pdf"),
    filings: file("schwab_q4_2025_earnings_release.pdf"),
  },
  "Q3 2025": {
    slides: file("schw_fall_business_update_10162025.pdf"),
    filings: file("schwab_q3_2025_earnings_release.pdf"),
  },
  "Q2 2025": {
    slides: file("schw_summer_business_update_071825.pdf"),
    filings: file("schw_q2_2025_earnings_release.pdf"),
  },
  "Q1 2025": {
    slides: file("schwab_spring2025_business_update_041725.pdf"),
    filings: file("schw_q1_2025_earnings_release.pdf"),
  },
  "Q4 2024": {
    slides: file("schwab_winter_business_update_012125.pdf"),
    filings: file("schwab_q4_2024_earnings_release.pdf"),
  },
  "Q3 2024": {
    slides: file("schw_fall_business_update_10152024.pdf"),
    filings: file("schwab_q3_2024_earnings_release.pdf"),
  },
  "Q2 2024": {
    slides: file("schw_summer_business_update_07162024.pdf"),
    filings: file("schw_q2_2024_earnings_release.pdf"),
  },
  "Q1 2024": {
    slides: file("schw_spring2024_business_update_041524.pdf"),
    filings: file("schw_q1_2024_earnings_release.pdf"),
  },
  "Q4 2023": {
    slides: file("schwab_winter_business_update_011724.pdf"),
    filings: file("schw_q4_2023_earnings_release.pdf"),
  },
  "Q3 2023": {
    slides: file("schwab_fall_business_update_101623.pdf"),
    filings: file("schw_q3_2023_earnings_release.pdf"),
  },
  "Q2 2023": {
    slides: file("schw_summer_business_update_071823.pdf"),
    filings: file("schw_q2_2023_earnings_release.pdf"),
  },
  "Q1 2023": {
    slides: file("schw_spring2023_business_update_04172023.pdf"),
    filings: file("schw_q1_2023_earnings_release.pdf"),
  },
  "Q4 2022": {
    slides: file("schw_2023_winter_business_update_012723.pdf"),
    filings: file("schw_q4_2022_earnings_release.pdf"),
  },
  "Q3 2022": {
    slides: file("schw_business_update_fall_102722.pdf"),
    filings: file("schw_q3_2022_earnings_release.pdf"),
  },
  "Q2 2022": {
    slides: file("schw_summer_business_update_072822.pdf"),
    filings: file("schw_q2_2022_earnings_release.pdf"),
  },
  "Q1 2022": {
    slides: file("schw_2022_spring_business_update_04212022.pdf"),
    filings: file("schw_q1_2022_earnings_release.pdf"),
  },
};

export function isSchwRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return (
    /sec\.gov|10-?q|10-?k|8-?k|\.xls|investor[-_\s]*day|monthly|activity.?report|transcript/i.test(
      n,
    )
  );
}

export function isSchwIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "content.schwab.com" || u.hostname.endsWith(".schwab.com"))) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return (
      /business[_-]?update|earnings[_-]?release/i.test(u.pathname) && !isSchwRejected(url)
    );
  } catch {
    return false;
  }
}

export function mergeSchwKnownQuarterDocs(): Map<string, SchwQuarterDocs> {
  return new Map(Object.entries(SCHW_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
