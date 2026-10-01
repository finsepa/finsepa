/**
 * WM IR seed — 12-31.
 * Waste Management calendar FY. Filings=News Release PDF on investors.wm.com/static-files. No quarterly earnings deck (Key Presentations are Investor Day/general IR only — not locked as slides). Reject 10-Q/10-K HTML, transcripts, conference decks. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type WmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const WM_IR_PAGES = [
  "https://investors.wm.com/financials/financial-results",
] as const;

export const WM_KNOWN_QUARTER_DOCS: Readonly<Record<string, WmQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://investors.wm.com/static-files/d1a6440c-9cd0-47e6-9a11-db305ed5fff5",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://investors.wm.com/static-files/7196d2ff-9f5f-401a-bf03-06a907d25fe7",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://investors.wm.com/static-files/b96e6b42-09df-4904-bd01-4e91990d7176",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://investors.wm.com/static-files/56bef103-a3e0-4557-8267-f4c851d9e229",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://investors.wm.com/static-files/3011c2bc-d779-401e-b7c0-62c80881daa5",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://investors.wm.com/static-files/88311bb0-e0f3-4c8e-96b9-99639d07618f",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://investors.wm.com/static-files/eb5ce4da-2bf2-4659-9998-b4d23e5fec9a",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://investors.wm.com/static-files/1331b248-ec1e-4fc3-bfa5-12dc003e4bf0",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://investors.wm.com/static-files/6f1c4f1c-7978-4275-bc4f-2aea91a9c107",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://investors.wm.com/static-files/6ca843e0-2ec2-43bd-b7ae-c71f9f2c6556",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://investors.wm.com/static-files/37a036b3-d212-4350-b6ef-4ec72fa2eb93",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://investors.wm.com/static-files/75772dcb-b736-466b-9bbe-be867a1ce13a",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://investors.wm.com/static-files/eff7e2b7-2393-4165-bd78-474b2561aa94",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://investors.wm.com/static-files/68a2659e-93a3-478d-b991-9a6cb7d8969f",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://investors.wm.com/static-files/8e52baca-0a45-4c96-8134-5d5a59dab711",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://investors.wm.com/static-files/b205de78-0616-4ed9-9ac8-0ecbbd943527",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://investors.wm.com/static-files/c4aa7b56-854c-4981-ada3-127d52c597e6",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://investors.wm.com/static-files/7330b8ac-17d7-4959-bdb4-f05f7cb39906",
  },
};

export function isWmRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isWmIrPdf(href: string | null | undefined): boolean {
  if (!href || isWmRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.wm.com" || host.endsWith(".wm.com"))) return false;
    return /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeWmKnownQuarterDocs(): Map<string, WmQuarterDocs> {
  return new Map(Object.entries(WM_KNOWN_QUARTER_DOCS));
}
