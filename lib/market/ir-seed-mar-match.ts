/**
 * MAR IR seed — 12-31.
 * Marriott calendar FY. Filings-only Press Release+Tables on marriott.gcs-web.com/static-files (no decks). Latest Q2 2026. Scope stats: 0 green / 18 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type MarQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MAR_IR_PAGES = [
  "https://marriott.gcs-web.com/financial-information/quarterly-results",
] as const;

export const MAR_KNOWN_QUARTER_DOCS: Readonly<Record<string, MarQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/24293aca-75a0-497f-ad51-29a5892ef957",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/fa73d6f8-5022-43c8-bc52-76fd92ca108e",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/5e09601c-8899-4b7c-9b45-d58728566130",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/2716251f-e996-48f7-b29b-2a3c6ac3b019",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/65962e07-ad63-41c2-b194-f2782ee1b230",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/a7b1ac01-1614-4aff-9163-bf01cc02731d",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/da07ea8d-88b9-4d4b-b719-854bcb427c03",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/fab13bad-9342-4162-b392-d5a1cba1403f",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/fc1e2423-66f6-4bb8-a96c-2f086ede608f",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/dcf731df-ecfa-4bf7-8d19-ea07b722da86",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/8cb6cbea-52e1-4072-a3cc-27bff444dd9e",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/1171123b-951e-4aa6-a666-37b19f4ac9da",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/bf02f141-4f44-4d48-a770-453a0d10e7d0",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/2a3f1dbd-12fd-4ab6-93ef-de27ff759b72",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/f7342c28-9d94-4455-a26d-37bf2d27ae6c",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/21e7e566-2b39-4072-adf6-9209fe4c07d9",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/9eac5832-8431-4907-8976-41d813c7454e",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://marriott.gcs-web.com/static-files/c3c2c056-fad9-42c2-9237-75b0fbe5e928",
  },
};

export function isMarRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isMarIrPdf(href: string | null | undefined): boolean {
  if (!href || isMarRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "marriott.gcs-web.com" || host.endsWith(".marriott.com") || host.endsWith(".gcs-web.com"))) return false;
    if (!/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname) && !/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeMarKnownQuarterDocs(): Map<string, MarQuarterDocs> {
  return new Map(Object.entries(MAR_KNOWN_QUARTER_DOCS));
}
