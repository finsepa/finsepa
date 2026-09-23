/**
 * Mitsubishi Corporation ADR (MTSUY) IR — FY ends 03-31.
 * Slides = English presentation (meetings/pdf); Filings = earnings release PDF.
 * Host: www.mitsubishicorp.com. Never Japanese-only / SEC HTML.
 */

export type MtsuyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MTSUY_FY_END = "03-31";

export const MTSUY_IR_PAGES = [
  "https://www.mitsubishicorp.com/jp/en/ir/",
  "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/",
] as const;

/** Catalog Q1 2022 → Q1 2026 (issuer March FY). Gaps early FY22–FY23. */
export const MTSUY_KNOWN_QUARTER_DOCS: Readonly<Record<string, MtsuyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: null,
    filings: null,
  },
  "Q3 2022": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/230203/20230203e.pdf",
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/230509/20230509e.pdf",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/230803/20230803e.pdf",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/231102/20231102e.pdf",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/240206/20240206e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202402e.pdf",
  },
  "Q4 2023": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/240502/20240502e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202405e.pdf",
  },
  "Q1 2024": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/240801/20240801e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202408e.pdf",
  },
  "Q2 2024": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/241101/20241101e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202411e.pdf",
  },
  "Q3 2024": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/250206/20250206e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202502e.pdf",
  },
  "Q4 2024": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/250502/20250502e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202505e.pdf",
  },
  "Q1 2025": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/250804/20250804e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202508e.pdf",
  },
  "Q2 2025": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/251104/20251104e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202511e.pdf",
  },
  "Q3 2025": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/260205/20260205e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202602e.pdf",
  },
  "Q4 2025": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/260501/20260501e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202605e.pdf",
  },
  "Q1 2026": {
    slides: "https://www.mitsubishicorp.com/jp/en/ir/library/meetings/pdf/260803/20260803e.pdf",
    filings: "https://www.mitsubishicorp.com/jp/en/ir/library/earnings/pdf/202608e.pdf",
  },
};

export function isMtsuyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isMtsuyIrPdf(href: string | null | undefined): boolean {
  if (!href || isMtsuyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.mitsubishicorp.com" || host.endsWith(".mitsubishicorp.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeMtsuyKnownQuarterDocs(): Map<string, MtsuyQuarterDocs> {
  return new Map(Object.entries(MTSUY_KNOWN_QUARTER_DOCS));
}
