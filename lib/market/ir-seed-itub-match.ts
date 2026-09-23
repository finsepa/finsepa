/**
 * ITUB IR seed — 12-31.
 * Itaú Unibanco calendar FY. Sparse MZ IQ filemanager PDFs (company 42787847…). Latest Q2 2026. Scope stats: 1 green / 3 yellow / 14 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type ItubQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ITUB_IR_PAGES = [
  "https://www.itau.com.br/relacoes-com-investidores/en/",
] as const;

export const ITUB_KNOWN_QUARTER_DOCS: Readonly<Record<string, ItubQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: null,
    filings: null,
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: null,
    filings: null,
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: null,
    filings: null,
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: null,
    filings: null,
  },
  "Q1 2024": {
    slides: null,
    filings: "https://api.mziq.com/mzfilemanager/v2/d/42787847-4cf6-4461-94a5-40ed237dca33/b346754e-3a55-895e-3264-8de4d4df4a70?origin=2",
  },
  "Q2 2024": {
    slides: null,
    filings: null,
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://api.mziq.com/mzfilemanager/v2/d/42787847-4cf6-4461-94a5-40ed237dca33/0a80c9bd-28c0-6b98-2c76-88b3a4584a9b?origin=2",
    filings: null,
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: null,
    filings: null,
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: null,
    filings: null,
  },
  "Q1 2026": {
    slides: "https://api.mziq.com/mzfilemanager/v2/d/42787847-4cf6-4461-94a5-40ed237dca33/309d095e-23d6-30e1-d944-4db1362c8e0f?origin=2",
    filings: "https://api.mziq.com/mzfilemanager/v2/d/42787847-4cf6-4461-94a5-40ed237dca33/4ebfa312-5fe0-7ed3-ecf5-d32284a24472?origin=2",
  },
  "Q2 2026": {
    slides: "https://api.mziq.com/mzfilemanager/v2/d/42787847-4cf6-4461-94a5-40ed237dca33/a886b521-389e-da70-dbb1-0be7758c8d91?origin=2",
    filings: null,
  },
};

export function isItubRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|strategic.?update/i.test(n);
}

export function isItubIrPdf(href: string | null | undefined): boolean {
  if (!href || isItubRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "api.mziq.com" || host.endsWith(".mziq.com"))) return false;
    if (!/\/mzfilemanager\/v2\/d\/42787847-4cf6-4461-94a5-40ed237dca33\/[a-f0-9-]{36}/i.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function mergeItubKnownQuarterDocs(): Map<string, ItubQuarterDocs> {
  return new Map(Object.entries(ITUB_KNOWN_QUARTER_DOCS));
}
