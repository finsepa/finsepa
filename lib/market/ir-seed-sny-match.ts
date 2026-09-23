/**
 * SNY IR seed — 12-31.
 * Sanofi calendar FY. Slides=Results Presentation; Filings=Press Release / Results EN. Skip aide-memoire/transcript. 2025+ often filings-only yellow. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type SnyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SNY_IR_PAGES = [
  "https://www.sanofi.com/en/investors",
] as const;

export const SNY_KNOWN_QUARTER_DOCS: Readonly<Record<string, SnyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2022/q1-results-2022/2022_04_28_Sanofi_Q1_2022_Results_Presentation_v2.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2022/q1-results-2022/2022_04_28_Sanofi_Q1_2022_Press_Release.pdf",
  },
  "Q2 2022": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2022/q2-results-2022/2022_07_28_Sanofi_Q2_2022_Results.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2022/q2-results-2022/Press_Release_Q2_2022.pdf",
  },
  "Q3 2022": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2022/q3-results-2022/2022_10_28_Sanofi_Q3_Results_2022.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2022/q3-results-2022/2022_10_28_Sanofi_Q3_Press_Release_EN.pdf",
  },
  "Q4 2022": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2022/q4-results-2022/2023_02_03_Sanofi_Q4FY_2022_Results_Presentation.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2022/q4-results-2022/2023_02_03_Q4_FY_2022_SANOFI_Press_Release_EN.pdf",
  },
  "Q1 2023": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2023/2023_04_27_Sanofi_Q1_2023_Results_Presentation.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2023/q1-2023/2023_04_27_Press_Release_Q1_2023_EN.pdf",
  },
  "Q2 2023": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2023/2023-q2-2023-results/q2-2023-presentation-en.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2023/2023-07-28-05-30-00-2712863-en.pdf",
  },
  "Q3 2023": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2023/2023-q3-2023-results/q3-2023-presentation-en.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2023/2023-10-27-05-30-00-2768148-en.pdf",
  },
  "Q4 2023": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2023/2023-q4-2023-results/q4-2023-presentation-en.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2024/2024-02-01-06-30-00-2821667-en.pdf",
  },
  "Q1 2024": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2024/2024-q1-2024-results/q1-2024-presentation-en.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2024/2024-04-25-05-30-00-2869276-en.pdf",
  },
  "Q2 2024": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2024/2024-q2-2024-results/q2-2024-presentation-en.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2024/2024-07-25-05-30-00-2918503-en.pdf",
  },
  "Q3 2024": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2024/2024-q3-2024-results/q3-2024-presentation-en.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2024/2024-10-25-05-30-00-2969234-en.pdf",
  },
  "Q4 2024": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2025/2024-q4-and-full-year-2024-results/2025-01-30_Sanofi-Q4FY-2024.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2025/2025-01-30-06-30-00-3017713-en.pdf",
  },
  "Q1 2025": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2025/2025-q1-2025-results/2025_04_24_Sanofi_Q1_2025_Results.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2025/2025-04-24-05-30-00-3067075-en.pdf",
  },
  "Q2 2025": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2025/2025-q2-2025-results/2025_07_31_Sanofi_Q2_2025_Results.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2025/2025-07-31-05-30-00-3124660-en.pdf",
  },
  "Q3 2025": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2025/2025-q3-2025-results/2025_10_24_Sanofi_Q3_2025_Results.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2025/2025-10-24-05-30-00-3172594-en.pdf",
  },
  "Q4 2025": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2026/2025-q4-and-full-year-2025-results/2026_01_29_Sanofi_Q4FY_2025_Results.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2026/2026-01-29-06-30-00-3228191-en.pdf",
  },
  "Q1 2026": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2026/2026-q1-2026-results/sanofi-q1-2026-results.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2026/2026-04-23-05-30-00-3279572_EN.pdf",
  },
  "Q2 2026": {
    slides: "https://www.sanofi.com/assets/dotcom/content-app/events/quaterly-results/2026/2026-q2-2026-results/2026_07_30_Sanofi_Q2_2026_Results.pdf",
    filings: "https://www.sanofi.com/assets/dotcom/pressreleases/2026/2026-07-30-05-30-00-3335767-en.pdf",
  },
};

export function isSnyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|aide.?memoire|pipeline/i.test(n);
}

export function isSnyIrPdf(href: string | null | undefined): boolean {
  if (!href || isSnyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.sanofi.com" || host.endsWith(".sanofi.com"))) return false;
    if (!(u.pathname.includes("/events/") || u.pathname.includes("/assets/") || u.pathname.includes("/investors"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeSnyKnownQuarterDocs(): Map<string, SnyQuarterDocs> {
  return new Map(Object.entries(SNY_KNOWN_QUARTER_DOCS));
}
