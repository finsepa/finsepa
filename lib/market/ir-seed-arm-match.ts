/** Arm IR: results / investor presentation as slides, shareholder letter as filings. Never transcripts, 6-K wrappers, XLS, or SoftBank decks. */

export type ArmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends March 31. */
export const ARM_FY_END = "03-31";

const GCS = "https://investors.arm.com/static-files";

function gcs(uuid: string): string {
  return `${GCS}/${uuid}`;
}

export const ARM_IR_PAGES = ["https://investors.arm.com/financials/quarterly-annual-results"] as const;

/**
 * Verified GCS static-files. IPO ~Sep 2023 — earlier quarters stay empty.
 * Labels are issuer FY (Q1 = Jun 30).
 */
export const ARM_KNOWN_QUARTER_DOCS: Readonly<Record<string, ArmQuarterDocs>> = {
  "Q1 2027": { slides: null, filings: gcs("d8db20bd-7b96-486a-b99b-23315627d1ec") },
  "Q4 2026": { slides: gcs("33244a6e-1929-4a61-ac25-e8a30fcfa4d5"), filings: gcs("344cbcfe-e28b-48ab-b272-c856e0756a91") },
  "Q3 2026": { slides: gcs("43e9cb50-de86-4aee-b8d1-076460de27b8"), filings: null },
  "Q2 2026": { slides: null, filings: gcs("59959491-1724-4f1d-bc6f-9186652b8a8b") },
  "Q1 2026": { slides: gcs("dae25601-3e5a-4d40-b9f5-e0149989e553"), filings: null },
  "Q4 2025": { slides: gcs("6bb3def3-ddce-4588-bf81-b5a718973274"), filings: gcs("a9baed37-2c28-4ac3-83b0-c11387d02bb2") },
  "Q3 2025": { slides: gcs("a05a1ae1-62e5-4c1c-b1dc-d5e7a53f8b43"), filings: null },
  "Q2 2025": { slides: gcs("2fdf83c2-ea2b-4104-9f34-18750967240d"), filings: null },
  "Q1 2025": { slides: null, filings: gcs("559eabc5-4dce-4cfe-bfaf-bb19735eeb40") },
  "Q3 2024": { slides: gcs("187d293b-42eb-48b0-b82f-e78bce4da9e4"), filings: null },
  "Q2 2024": { slides: null, filings: gcs("bf24c7a3-d2c0-47bd-bf72-73f686a5d62f") },
};

export function isArmRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|transcript|form[-_\s]?6-?k|6-k|key[-_\s]?financial|\.xls|softbank|investor[-_\s]*day/i.test(
    n,
  );
}

export function isArmIrStaticFiles(url: string | null | undefined): boolean {
  if (!url) return false;
  return /investors\.arm\.com\/static-files\/[a-f0-9-]{36}/i.test(url) && !isArmRejected(url);
}

export function mergeArmKnownQuarterDocs(): Map<string, ArmQuarterDocs> {
  return new Map(Object.entries(ARM_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
