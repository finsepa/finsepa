/** SanDisk IR: earnings presentation as slides, node/pdf or GCS press as filings. Never 10-Q / transcript / 8-K wrapper. */

export type SndkQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Friday-near-June FY; early-July closes still map as Q4 (same as PANW 07-31). */
export const SNDK_FY_END = "07-31";

const GCS = "https://investor.sandisk.com/static-files";
const NODE = "https://investor.sandisk.com/node";

function gcs(uuid: string): string {
  return `${GCS}/${uuid}`;
}

function nodePdf(id: number): string {
  return `${NODE}/${id}/pdf`;
}

export const SNDK_IR_PAGES = [
  "https://investor.sandisk.com/",
  "https://investor.sandisk.com/financial-information/quarterly-results",
] as const;

/**
 * Standalone IR begins Q3 FY2025 (spin ~Feb 2025). Earlier carve-out quarters stay empty.
 * Labels are issuer FY (Q4 ends late June / early July).
 */
export const SNDK_KNOWN_QUARTER_DOCS: Readonly<Record<string, SndkQuarterDocs>> = {
  "Q4 2026": { slides: gcs("c75d1bee-c5c9-4e5a-8605-302c1aeac59b"), filings: nodePdf(8136) },
  "Q3 2026": { slides: gcs("8ea78860-f8e5-4f1c-ada3-c554437d6281"), filings: nodePdf(7896) },
  "Q2 2026": { slides: gcs("1b7ca99b-f84a-4294-9f56-690b32fce69a"), filings: nodePdf(7716) },
  "Q1 2026": { slides: gcs("a1cf180d-5720-4475-a3cc-345cfc8aab38"), filings: nodePdf(7481) },
  "Q4 2025": { slides: gcs("0d41325a-6dc9-47f6-9da7-661b97de6826"), filings: nodePdf(7246) },
  "Q3 2025": { slides: gcs("28846bc7-9d2c-4587-98d2-32741a623e0f"), filings: gcs("c74121d1-b168-4850-893d-12f86a305fe6") },
};

export function isSndkRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|form[-_\s]?10-?q|10-q|transcript|form[-_\s]?8-?k|8-k|investor[-_\s]*day|supplement/i.test(
    n,
  );
}

export function isSndkIrUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    /investor\.sandisk\.com\/(static-files\/[a-f0-9-]{36}|node\/\d+\/pdf)/i.test(url) && !isSndkRejected(url)
  );
}

export function mergeSndkKnownQuarterDocs(): Map<string, SndkQuarterDocs> {
  return new Map(Object.entries(SNDK_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
