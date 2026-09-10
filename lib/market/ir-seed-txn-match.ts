/** TI IR: earnings-release static-files as filings. No public quarterly deck — slides stay empty. Never 10-Q / 8-K wrapper. */

export type TxnQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

function gcs(uuid: string): string {
  return `https://investor.ti.com/static-files/${uuid}`;
}

export const TXN_IR_PAGES = [
  "https://investor.ti.com/financial-information/earnings-annual-reports",
] as const;

/** Slides empty — TI IR listing has no Presentation link (NFLX/HD class). */
export const TXN_KNOWN_QUARTER_DOCS: Readonly<Record<string, TxnQuarterDocs>> = {
  "Q2 2026": { slides: null, filings: gcs("82caba02-3b0a-4452-933e-5b97274b4db6") },
  "Q1 2026": { slides: null, filings: gcs("b6565bf6-eef3-4a50-a12a-cce6cc24611b") },
  "Q4 2025": { slides: null, filings: gcs("74f9f431-2080-4a7f-aa91-a772127eac39") },
  "Q3 2025": { slides: null, filings: gcs("e25eac30-8593-460f-9fac-ebf89a866fd7") },
  "Q2 2025": { slides: null, filings: gcs("d4351ef2-83b7-48e9-aab3-7349d25957f9") },
  "Q1 2025": { slides: null, filings: gcs("7ed5cd94-7769-46de-a9ca-d970d1b0f22b") },
  "Q4 2024": { slides: null, filings: gcs("4d6c66cb-f0a2-4f32-adfe-c840b4c28d38") },
  "Q3 2024": { slides: null, filings: gcs("7c3cdf0a-b8ab-43a7-920e-24837de49d79") },
};

export function isTxnRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|form[-_\s]?10-?[qk]|10-q|10-k|form[-_\s]?8-?k|8-k|transcript|prepared.?remarks|annual.?report|mp3|ceo/i.test(
    n,
  );
}

export function isTxnIrUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /investor\.ti\.com\/static-files\/[a-f0-9-]{36}/i.test(url) && !isTxnRejected(url);
}

export function mergeTxnKnownQuarterDocs(): Map<string, TxnQuarterDocs> {
  return new Map(Object.entries(TXN_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
