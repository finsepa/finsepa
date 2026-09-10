/** Amgen IR: earnings-call slides as Slides; earnings-release PDF as Filings. Never 8-K wrapper / 10-Q / transcript. */

export type AmgnQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const GCS = "https://investors.amgen.com/static-files";

function gcs(uuid: string): string {
  return `${GCS}/${uuid}`;
}

export const AMGN_IR_PAGES = ["https://investors.amgen.com/financials/quarterly-earnings"] as const;

/** Calendar FY. Q2 2026 press is an 8-K wrapper — filings stay empty. */
export const AMGN_KNOWN_QUARTER_DOCS: Readonly<Record<string, AmgnQuarterDocs>> = {
  "Q2 2026": { slides: gcs("6214ad8a-4a21-4f66-8571-165e8cbb4681"), filings: null },
  "Q1 2026": {
    slides: gcs("f97cddec-cc50-4749-b33a-05c317ab5e32"),
    filings: gcs("4e8e58ab-1e91-441e-94ea-4c8285338ec9"),
  },
  "Q4 2025": { slides: gcs("1bad9687-cd7f-4ee0-b80b-4b5d1e6bfbfd"), filings: null },
  "Q3 2025": { slides: gcs("ccf28fab-e6b4-4d38-848f-6cb13771fb2a"), filings: null },
  "Q2 2025": {
    slides: gcs("27fcb898-9cee-48db-9684-1da25888c845"),
    filings: gcs("d1371ae8-10e0-4ace-8d92-35c1c32ab37c"),
  },
  "Q1 2025": {
    slides: gcs("418d975b-d793-4a44-bb3e-2bc44021ba68"),
    filings: gcs("c94bac69-b3ce-44cf-8cb6-8922cfb49581"),
  },
  "Q4 2024": { slides: gcs("b97ca0b2-b182-4b3c-9251-9a9e25e38e6e"), filings: null },
  "Q3 2024": {
    slides: gcs("66c89ba3-96f5-4bfb-99fc-3ba3bec6cb09"),
    filings: gcs("0b75fccf-cd72-4dfc-b9ee-2dc967464562"),
  },
  "Q2 2024": {
    slides: gcs("46d13760-0796-4940-93c5-2f6cde74bd4d"),
    filings: gcs("60a661ae-e46e-485d-8fa2-8f831859530c"),
  },
  "Q1 2024": { slides: gcs("c94912ba-7169-4c84-98b6-23a286b2f72d"), filings: null },
  "Q4 2023": { slides: gcs("e2a3ee45-b21d-4671-aad7-637bfdb8ec8b"), filings: null },
  "Q1 2023": { slides: gcs("5b34d179-c93c-4e89-a19f-9b40eaeaf6eb"), filings: null },
};

export function isAmgnRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|8-?k|10-?q|10-?k|transcript|conference/i.test(n);
}

export function isAmgnIrStaticFiles(url: string | null | undefined): boolean {
  if (!url) return false;
  return /investors\.amgen\.com\/static-files\/[a-f0-9-]{36}/i.test(url) && !isAmgnRejected(url);
}

export function mergeAmgnKnownQuarterDocs(): Map<string, AmgnQuarterDocs> {
  return new Map(Object.entries(AMGN_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
