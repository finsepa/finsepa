/**
 * Fast Retailing ADR (FRCOY) IR — FY ends 08-31 (Sep 1 – Aug 31).
 * Slides = English results presentation (*_results_en.pdf);
 * Filings = tanshin results announcement (tanshin{YYYY}08_{q}q_eng.pdf).
 * Never FAQ / factbook / Japanese-only / SEC HTML.
 */

export type FrcoyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const FRCOY_FY_END = "08-31";

export const FRCOY_IR_PAGES = [
  "https://www.fastretailing.com/eng/ir/library/earning.html",
  "https://www.fastretailing.com/eng/ir/library/tanshin.html",
] as const;

/** Catalog Q1 2022 → Q3 2026 (August FY). */
export const FRCOY_KNOWN_QUARTER_DOCS: Readonly<Record<string, FrcoyQuarterDocs>> = {
  "Q3 2026": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20260709_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202608_3q_eng.pdf",
  },
  "Q2 2026": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20260409_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202608_2q_eng.pdf",
  },
  "Q1 2026": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20260108_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202608_1q_eng.pdf",
  },
  "Q4 2025": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20251009_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202508_4q_eng.pdf",
  },
  "Q3 2025": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20250710_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202508_3q_eng.pdf",
  },
  "Q2 2025": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20250410_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202508_2q_eng.pdf",
  },
  "Q1 2025": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20250109_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202508_1q_eng.pdf",
  },
  "Q4 2024": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20241010_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202408_4q_eng.pdf",
  },
  "Q3 2024": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20240711_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202408_3q_eng.pdf",
  },
  "Q2 2024": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20240411_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202408_2q_eng.pdf",
  },
  "Q1 2024": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20240111_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202408_1q_eng.pdf",
  },
  "Q4 2023": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20231012_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202308_4q_eng.pdf",
  },
  "Q3 2023": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20230713_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202308_3q_eng.pdf",
  },
  "Q2 2023": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20230413_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202308_2q_eng.pdf",
  },
  "Q1 2023": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20230112_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202308_1q_eng.pdf",
  },
  "Q4 2022": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20221013_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202208_4q_eng.pdf",
  },
  "Q3 2022": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20220714_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202208_3q_eng.pdf",
  },
  "Q2 2022": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20220414_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202208_2q_eng.pdf",
  },
  "Q1 2022": {
    slides: "https://www.fastretailing.com/eng/ir/library/pdf/20220113_results_en.pdf",
    filings: "https://www.fastretailing.com/eng/ir/library/pdf/tanshin202208_1q_eng.pdf",
  },
};

export function isFrcoyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|proxy|transcript|faq|factbook|q&a|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isFrcoyIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.fastretailing.com" || host === "fastretailing.com" || host.endsWith(".fastretailing.com"))) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isFrcoyRejected(url);
  } catch {
    return false;
  }
}

export function mergeFrcoyKnownQuarterDocs(): Map<string, FrcoyQuarterDocs> {
  return new Map(Object.entries(FRCOY_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
