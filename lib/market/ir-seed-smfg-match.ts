/**
 * Sumitomo Mitsui Financial Group ADR (SMFG) IR — FY ends 03-31.
 * Slides = Investors Meeting Presentation (`*_e_pre.pdf`); Filings = consolidated Financial Results (`*_e01.pdf`).
 * Q1/Q3 usually have no investor meeting — slides stay empty. Never conference / summary / databook / SEC HTML.
 */

export type SmfgQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Japanese bank FY ends March 31. */
export const SMFG_FY_END = "03-31";

const ORIGIN = "https://www.smfg.co.jp/english/investor/financial/latest_statement";

function stmt(folder: string, file: string): string {
  return `${ORIGIN}/${folder}/${file}`;
}

export const SMFG_IR_PAGES = [
  "https://www.smfg.co.jp/english/investor/financial/latest_statement.html",
  "https://www.smfg.co.jp/english/investor/",
] as const;

/**
 * Catalog from IR HTML + indexed PDFs (issuer FY labels via FY_END 03-31).
 * FY3/2022 lives under legacy `fy2021/` (no `2022_3/2022_*` English pack).
 * Later years under `{fyEnd}_3/`. Q1/Q3 slides usually empty; Q2/FY have e_pre.
 */
export const SMFG_KNOWN_QUARTER_DOCS: Readonly<Record<string, SmfgQuarterDocs>> = {
  "Q1 2027": {
    slides: null,
    filings: stmt("2027_3", "2027_1q_e01.pdf"),
  },
  "Q4 2026": {
    slides: stmt("2026_3", "2026_fy_e_pre.pdf"),
    filings: stmt("2026_3", "2026_fy_e01.pdf"),
  },
  "Q3 2026": {
    slides: null,
    filings: stmt("2026_3", "2026_3q_e01.pdf"),
  },
  "Q2 2026": {
    slides: stmt("2026_3", "2026_2q_e_pre.pdf"),
    filings: stmt("2026_3", "2026_2q_e01.pdf"),
  },
  "Q1 2026": {
    slides: null,
    filings: stmt("2026_3", "2026_1q_e01.pdf"),
  },
  "Q4 2025": {
    slides: stmt("2025_3", "2025_fy_e_pre.pdf"),
    filings: stmt("2025_3", "2025_fy_e01.pdf"),
  },
  "Q3 2025": {
    slides: null,
    filings: stmt("2025_3", "2025_3q_e01.pdf"),
  },
  "Q2 2025": {
    slides: stmt("2025_3", "2025_2q_e_pre.pdf"),
    filings: stmt("2025_3", "2025_2q_e01.pdf"),
  },
  "Q1 2025": {
    slides: null,
    filings: stmt("2025_3", "2025_1q_e01.pdf"),
  },
  "Q4 2024": {
    slides: stmt("2024_3", "2024_fy_e_pre.pdf"),
    filings: stmt("2024_3", "2024_fy_e01.pdf"),
  },
  "Q3 2024": {
    slides: null,
    filings: stmt("2024_3", "2024_3q_e01.pdf"),
  },
  "Q2 2024": {
    slides: stmt("2024_3", "2024_2q_e_pre.pdf"),
    filings: stmt("2024_3", "2024_2q_e01.pdf"),
  },
  "Q1 2024": {
    slides: null,
    filings: stmt("2024_3", "2024_1q_e01.pdf"),
  },
  "Q4 2023": {
    slides: stmt("2023_3", "2023_fy_e_pre.pdf"),
    filings: stmt("2023_3", "2023_fy_e01.pdf"),
  },
  "Q3 2023": {
    slides: null,
    filings: stmt("2023_3", "2023_3q_e01.pdf"),
  },
  "Q2 2023": {
    slides: stmt("2023_3", "2023_2q_e_pre.pdf"),
    filings: stmt("2023_3", "2023_2q_e01.pdf"),
  },
  "Q1 2023": {
    slides: null,
    filings: stmt("2023_3", "2023_1q_e01.pdf"),
  },
  "Q4 2022": {
    slides: stmt("fy2021", "fy2021_fy_e_pre.pdf"),
    filings: stmt("fy2021", "fy2021_fy_e01.pdf"),
  },
  "Q3 2022": {
    slides: null,
    filings: stmt("fy2021", "fy2021_3q_e01.pdf"),
  },
  "Q2 2022": {
    slides: stmt("fy2021", "fy2021_2q_e_pre.pdf"),
    filings: stmt("fy2021", "fy2021_2q_e01.pdf"),
  },
  "Q1 2022": {
    slides: null,
    filings: stmt("fy2021", "fy2021_1q_e01.pdf"),
  },
};

export function isSmfgRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|faq|summary|databook|conference|irday|investor[-_\s]*day|basel|_e02|_e03|fixed[-_\s]?income|speech|transcript|webcast|10-?q|10-?k|8-?k/i.test(
    n,
  );
}

export function isSmfgIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.smfg.co.jp" || host === "smfg.co.jp" || host.endsWith(".smfg.co.jp"))) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (!u.pathname.includes("/english/investor/financial/latest_statement/")) return false;
    const path = u.pathname.toLowerCase();
    const ok = /_e_pre\.pdf$/i.test(path) || /_e01\.pdf$/i.test(path);
    return ok && !isSmfgRejected(url);
  } catch {
    return false;
  }
}

export function mergeSmfgKnownQuarterDocs(): Map<string, SmfgQuarterDocs> {
  return new Map(Object.entries(SMFG_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
