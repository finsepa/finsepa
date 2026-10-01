/**
 * SPG IR seed — 12-31.
 * Simon Property Group calendar FY. Slides=Supplemental Information on investors.simon.com/static-files/{uuid}; Filings=Press Release PDF Version /node/N/pdf (distinct from supplement; sample sizes ~1.6MB vs ~74KB). Reject Form 10-Q/10-K/SEC HTML/conference decks. Scope Q1 2022→Q2 2026 (18g / 0y / 0r). Range-GET %PDF verified in-browser (Akamai blocks CLI curl). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type SpgQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SPG_IR_PAGES = [
  "https://investors.simon.com/financials/quarterly-results/default.aspx",
] as const;

export const SPG_KNOWN_QUARTER_DOCS: Readonly<Record<string, SpgQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://investors.simon.com/static-files/d0b6fe6b-34d3-4faa-bc11-e75d204abbc9",
    filings: "https://investors.simon.com/node/20681/pdf",
  },
  "Q2 2022": {
    slides: "https://investors.simon.com/static-files/374ab7f8-67ad-4b77-98a5-3566e45fe813",
    filings: "https://investors.simon.com/node/20946/pdf",
  },
  "Q3 2022": {
    slides: "https://investors.simon.com/static-files/0190922e-c867-44de-b990-f9cb8dead0ed",
    filings: "https://investors.simon.com/node/21086/pdf",
  },
  "Q4 2022": {
    slides: "https://investors.simon.com/static-files/4532a1b9-adbc-46aa-bec8-ff287ae7f413",
    filings: "https://investors.simon.com/node/21326/pdf",
  },
  "Q1 2023": {
    slides: "https://investors.simon.com/static-files/9151df21-ea1c-4e9e-9572-88132de3d504",
    filings: "https://investors.simon.com/node/21656/pdf",
  },
  "Q2 2023": {
    slides: "https://investors.simon.com/static-files/c5709cab-cf01-4c44-8e64-b762cd58a22f",
    filings: "https://investors.simon.com/node/21871/pdf",
  },
  "Q3 2023": {
    slides: "https://investors.simon.com/static-files/bc67f99b-9857-4f0d-b411-5758efd25c12",
    filings: "https://investors.simon.com/node/22016/pdf",
  },
  "Q4 2023": {
    slides: "https://investors.simon.com/static-files/c69877db-4e85-40db-8355-35cf7f0e03f8",
    filings: "https://investors.simon.com/node/22276/pdf",
  },
  "Q1 2024": {
    slides: "https://investors.simon.com/static-files/93e6cebf-479b-4f9e-9ebd-99f61564f924",
    filings: "https://investors.simon.com/node/22591/pdf",
  },
  "Q2 2024": {
    slides: "https://investors.simon.com/static-files/8bb5e799-56e3-40a7-9f9d-c2d111e984c9",
    filings: "https://investors.simon.com/node/22796/pdf",
  },
  "Q3 2024": {
    slides: "https://investors.simon.com/static-files/23c304e3-7f35-4783-ada3-8a0f1ca1c930",
    filings: "https://investors.simon.com/node/23011/pdf",
  },
  "Q4 2024": {
    slides: "https://investors.simon.com/static-files/d7afbc22-1afa-4169-b4e7-84d1db2a4c92",
    filings: "https://investors.simon.com/node/23186/pdf",
  },
  "Q1 2025": {
    slides: "https://investors.simon.com/static-files/882d452b-e573-482a-8c7d-e956e62c98dc",
    filings: "https://investors.simon.com/node/23511/pdf",
  },
  "Q2 2025": {
    slides: "https://investors.simon.com/static-files/0e49f16c-6fc0-4458-94ba-04aac4f300d6",
    filings: "https://investors.simon.com/node/23701/pdf",
  },
  "Q3 2025": {
    slides: "https://investors.simon.com/static-files/b89e9334-3076-4580-91a2-0db2c40e14f9",
    filings: "https://investors.simon.com/node/23896/pdf",
  },
  "Q4 2025": {
    slides: "https://investors.simon.com/static-files/3a1fdf39-cf75-4ba0-bcd1-68d2459e92fe",
    filings: "https://investors.simon.com/node/24081/pdf",
  },
  "Q1 2026": {
    slides: "https://investors.simon.com/static-files/0be7be2e-a716-4f72-b804-42b3d2c36b96",
    filings: "https://investors.simon.com/node/24431/pdf",
  },
  "Q2 2026": {
    slides: "https://investors.simon.com/static-files/502f882a-9e90-4661-a038-1ac004b747a8",
    filings: "https://investors.simon.com/node/24651/pdf",
  },
};

export function isSpgRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isSpgIrPdf(href: string | null | undefined): boolean {
  if (!href || isSpgRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.simon.com" || host.endsWith(".simon.com"))) return false;
    return (
      /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname) ||
      /\/node\/\d+\/pdf\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export function mergeSpgKnownQuarterDocs(): Map<string, SpgQuarterDocs> {
  return new Map(Object.entries(SPG_KNOWN_QUARTER_DOCS));
}
