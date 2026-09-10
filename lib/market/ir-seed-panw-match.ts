/** Palo Alto Networks IR: earnings presentation as slides. Press is HTML — leave filings empty. Never supplement, transcripts, 10-Q, or conference decks. */

export type PanwQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends July 31. */
export const PANW_FY_END = "07-31";

const GCS = "https://investors.paloaltonetworks.com/static-files";

function gcs(uuid: string): string {
  return `${GCS}/${uuid}`;
}

export const PANW_IR_PAGES = [
  "https://investors.paloaltonetworks.com/financial-information/quarterly-results",
] as const;

/**
 * Verified GCS earnings presentations. Filings stay empty (HTML press; supplement is XLS).
 * Labels are issuer FY (Q4 = Jul 31).
 */
export const PANW_KNOWN_QUARTER_DOCS: Readonly<Record<string, PanwQuarterDocs>> = {
  "Q3 2026": { slides: gcs("67ce9226-4fe0-43cd-b83e-42efb035f38c"), filings: null },
  "Q2 2026": { slides: gcs("60a04bfd-9a45-451b-8a71-31cee50df28e"), filings: null },
  "Q1 2026": { slides: gcs("7adeb1fd-e842-49b9-8a37-527abdc15659"), filings: null },
  "Q4 2025": { slides: gcs("fa70bf3c-c9d7-4ac3-a73e-f20c2e29ad1f"), filings: null },
  "Q3 2025": { slides: gcs("d1d179d7-017f-477f-a3f2-cce7a2b594c7"), filings: null },
  "Q2 2025": { slides: gcs("1aec3588-68f8-4ca3-b167-740453d1e11d"), filings: null },
  "Q1 2025": { slides: gcs("618ab7cd-906c-4d4a-893c-918245e3cd1a"), filings: null },
  "Q4 2024": { slides: gcs("dae146ab-d06b-46fd-a776-25b7e8740388"), filings: null },
  "Q1 2024": { slides: gcs("ddae4e1d-7619-49ec-a893-d80c0a63d73a"), filings: null },
  "Q3 2023": { slides: gcs("70379c02-346b-493b-81c0-69ef1498b730"), filings: null },
};

export function isPanwRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|supplement|prepared\s*remarks|10-?q|10-?k|investor[-_\s]*day|conference/i.test(
    n,
  );
}

export function isPanwIrStaticFiles(url: string | null | undefined): boolean {
  if (!url) return false;
  return /investors\.paloaltonetworks\.com\/static-files\/[a-f0-9-]{36}/i.test(url) && !isPanwRejected(url);
}

export function mergePanwKnownQuarterDocs(): Map<string, PanwQuarterDocs> {
  return new Map(Object.entries(PANW_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
