/**
 * REGN IR seed — 12-31.
 * Regeneron calendar FY. Slides=Corporate Presentation on investor.regeneron.com/static-files; Filings=PDF Version /node/N/pdf from earnings press pages. Full Q1'22→Q2'26. Reject transcripts, 10-Q/10-K, Modeling Support. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type RegnQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const REGN_IR_PAGES = [
  "https://investor.regeneron.com/financials/quarterly-results/default.aspx",
] as const;

export const REGN_KNOWN_QUARTER_DOCS: Readonly<Record<string, RegnQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://investor.regeneron.com/static-files/8509d69f-5f66-401f-828a-933e581b76b2",
    filings: "https://investor.regeneron.com/node/26671/pdf",
  },
  "Q2 2022": {
    slides: "https://investor.regeneron.com/static-files/2bed4561-b43f-4fe6-be95-021f223cd7cb",
    filings: "https://investor.regeneron.com/node/26856/pdf",
  },
  "Q3 2022": {
    slides: "https://investor.regeneron.com/static-files/986387c3-c40b-4240-a633-0aea17c3b525",
    filings: "https://investor.regeneron.com/node/27176/pdf",
  },
  "Q4 2022": {
    slides: "https://investor.regeneron.com/static-files/ff73fc12-062d-41c2-8ca4-98d63f3bcf49",
    filings: "https://investor.regeneron.com/node/27626/pdf",
  },
  "Q1 2023": {
    slides: "https://investor.regeneron.com/static-files/dbe7aad3-8aff-483f-9366-fa1678d7b738",
    filings: "https://investor.regeneron.com/node/28031/pdf",
  },
  "Q2 2023": {
    slides: "https://investor.regeneron.com/static-files/a73a7d9c-591d-43e4-905f-6851ac1ff04e",
    filings: "https://investor.regeneron.com/node/28241/pdf",
  },
  "Q3 2023": {
    slides: "https://investor.regeneron.com/static-files/27bf1467-a410-414b-9bec-916fa90e7748",
    filings: "https://investor.regeneron.com/node/28656/pdf",
  },
  "Q4 2023": {
    slides: "https://investor.regeneron.com/static-files/0ee6a193-2ac7-4dbc-8e5b-1f99473ce90b",
    filings: "https://investor.regeneron.com/node/29171/pdf",
  },
  "Q1 2024": {
    slides: "https://investor.regeneron.com/static-files/d6375b15-eded-4a7f-a048-b1ec42f0d412",
    filings: "https://investor.regeneron.com/node/29631/pdf",
  },
  "Q2 2024": {
    slides: "https://investor.regeneron.com/static-files/fd62f7ea-d519-4c61-8c85-8c45836e7ae5",
    filings: "https://investor.regeneron.com/node/29961/pdf",
  },
  "Q3 2024": {
    slides: "https://investor.regeneron.com/static-files/3626954a-272b-45f9-81b2-8fc6ae08010c",
    filings: "https://investor.regeneron.com/node/30336/pdf",
  },
  "Q4 2024": {
    slides: "https://investor.regeneron.com/static-files/ba1c6625-db35-4b30-8f5d-9a4f2e5c3211",
    filings: "https://investor.regeneron.com/node/30671/pdf",
  },
  "Q1 2025": {
    slides: "https://investor.regeneron.com/static-files/e9c6524e-faa8-43a9-be14-52f6b9b56db2",
    filings: "https://investor.regeneron.com/node/30956/pdf",
  },
  "Q2 2025": {
    slides: "https://investor.regeneron.com/static-files/afdb2be9-eed0-4770-94a1-087a530ee32a",
    filings: "https://investor.regeneron.com/node/31156/pdf",
  },
  "Q3 2025": {
    slides: "https://investor.regeneron.com/static-files/79e3089c-da68-407c-8ce0-87fe9b3e3554",
    filings: "https://investor.regeneron.com/node/31356/pdf",
  },
  "Q4 2025": {
    slides: "https://investor.regeneron.com/static-files/a25766ce-cb49-4d8e-923b-56b403f3b063",
    filings: "https://investor.regeneron.com/node/31721/pdf",
  },
  "Q1 2026": {
    slides: "https://investor.regeneron.com/static-files/34bd3814-ec41-4433-8472-1e866a858c18",
    filings: "https://investor.regeneron.com/node/32066/pdf",
  },
  "Q2 2026": {
    slides: "https://investor.regeneron.com/static-files/d503af4b-2f14-4e1a-b754-4a1b2dea3cc9",
    filings: "https://investor.regeneron.com/node/32226/pdf",
  },
};

export function isRegnRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isRegnIrPdf(href: string | null | undefined): boolean {
  if (!href || isRegnRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investor.regeneron.com" || host.endsWith(".regeneron.com"))) return false;
    return (
      /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname) ||
      /\/node\/\d+\/pdf\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export function mergeRegnKnownQuarterDocs(): Map<string, RegnQuarterDocs> {
  return new Map(Object.entries(REGN_KNOWN_QUARTER_DOCS));
}
