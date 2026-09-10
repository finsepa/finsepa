/** RTX IR: investor webcast as slides, Exhibit 99 earnings release PDF as filings. Never 10-Q / transcript / Bernstein / GTF update. */

export type RtxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const GCS = "https://investors.rtx.com/static-files";

function gcs(uuid: string): string {
  return `${GCS}/${uuid}`;
}

export const RTX_IR_PAGES = [
  "https://investors.rtx.com/events-and-presentations",
  "https://investors.rtx.com/financial-information/quarterly-results",
] as const;

/**
 * Verified GCS static-files. Calendar FY. Q3 2023 webcast UUID not recovered —
 * leave slides empty rather than lock 10-Q / GTF fleet update.
 */
export const RTX_KNOWN_QUARTER_DOCS: Readonly<Record<string, RtxQuarterDocs>> = {
  "Q2 2026": { slides: gcs("4974fa8e-e918-4e2e-aac6-4da956d6fd50"), filings: null },
  "Q1 2026": { slides: gcs("2c351bfe-d90c-4990-9910-a5dbd4e6b23b"), filings: gcs("b976b008-f71a-4d0e-ba36-7ad734555a2e") },
  "Q4 2025": { slides: gcs("10494d39-c1d0-4ff0-b945-1db5288a923b"), filings: null },
  "Q3 2025": { slides: gcs("3b3532ea-0446-460c-85b4-22fdf6a7f3c7"), filings: null },
  "Q2 2025": { slides: gcs("4431ddf8-4a87-4a15-b16c-2cbfafe7e843"), filings: null },
  "Q1 2025": { slides: gcs("107f79d8-a2cf-4b65-84af-f466d1984dd5"), filings: gcs("1c27d7f0-ef17-400a-bc5a-1accaaaff56b") },
  "Q4 2024": { slides: gcs("cae2e5c0-50ad-4686-9acd-7830c2ece42e"), filings: gcs("ceebbf85-eb69-4563-a303-c62ad9918fba") },
  "Q3 2024": { slides: gcs("52d38337-ec8c-4e09-85b8-d75038197ca3"), filings: gcs("a65bd2fd-9a56-487b-8190-c1de86e0357b") },
  "Q2 2024": { slides: gcs("b691d8fa-51ea-41b9-9a54-585a2cd1a133"), filings: null },
  "Q1 2024": { slides: gcs("2f11f99a-8aad-4276-9c7d-90ace69496bc"), filings: null },
  "Q4 2023": { slides: gcs("c4c101bd-3190-43f7-94b5-5c0337c19593"), filings: gcs("63ea7d92-14f5-4cc4-8a11-6c1671101e3c") },
  "Q3 2023": { slides: null, filings: gcs("8b02ac78-a1a1-487e-82a2-11a90a698a2b") },
  "Q2 2023": { slides: gcs("dc6b57a2-cb4d-4b83-88f4-b5c6851b4e16"), filings: null },
  "Q1 2023": { slides: gcs("178a8c1f-8369-4625-ac06-c203ac3f7fd8"), filings: null },
  "Q4 2022": { slides: gcs("a1b35f0d-2c0e-49e7-a245-ba339a3b6409"), filings: null },
  "Q3 2022": { slides: gcs("d9d5d969-892f-4d33-8ecb-5f3364b65adb"), filings: null },
  "Q2 2022": { slides: gcs("8f4706f3-0648-45b2-b13d-12a765afc88d"), filings: null },
  "Q1 2022": { slides: gcs("6191f7c6-c8e6-46e6-8843-889cd93ce6e5"), filings: null },
};

export function isRtxRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|form[-_\s]?10-?q|10-q|transcript|bernstein|gtf[-_\s]?fleet|powder[-_\s]?metal|investor[-_\s]*day/i.test(
    n,
  );
}

export function isRtxIrStaticFiles(url: string | null | undefined): boolean {
  if (!url) return false;
  return /(?:investors\.rtx\.com|rtx\.gcs-web\.com)\/static-files\/[a-f0-9-]{36}/i.test(url) && !isRtxRejected(url);
}

export function mergeRtxKnownQuarterDocs(): Map<string, RtxQuarterDocs> {
  return new Map(Object.entries(RTX_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
