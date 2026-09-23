/**
 * MNST IR seed — 12-31.
 * Monster Beverage calendar FY. Filings=earnings press PDF via /node/N/pdf (PDF Version on news-release-details). No quarterly earnings slide decks on IR (event pages webcast-only; scanner decks are 8-K Ex 99.2 — not locked). Investor Meeting decks excluded. Scope: 0g / 18y / 0r. Never SEC HTML. Range GET %PDF verified in-browser (Akamai blocks CLI curl).
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type MnstQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MNST_IR_PAGES = [
  "https://investors.monsterbevcorp.com/financials/quarterly-results/default.aspx",
] as const;

export const MNST_KNOWN_QUARTER_DOCS: Readonly<Record<string, MnstQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/15751/pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/15916/pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/15971/pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/16101/pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/16241/pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/16446/pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/16576/pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/16741/pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/16861/pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/17106/pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/17196/pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/17336/pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/17506/pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/17666/pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/17736/pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/17871/pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/17996/pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://investors.monsterbevcorp.com/node/18181/pdf",
  },
};

export function isMnstRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isMnstIrPdf(href: string | null | undefined): boolean {
  if (!href || isMnstRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.monsterbevcorp.com" || host.endsWith(".monsterbevcorp.com"))) return false;
    return /\/node\/\d+\/pdf\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeMnstKnownQuarterDocs(): Map<string, MnstQuarterDocs> {
  return new Map(Object.entries(MNST_KNOWN_QUARTER_DOCS));
}
