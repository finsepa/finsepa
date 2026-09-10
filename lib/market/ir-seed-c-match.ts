/** Citigroup IR: earnings preso as slides, prqtr press as filings. Never at-a-glance / 8-K wrapper / transcript / supplement. */

export type CQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const EARN = "https://www.citigroup.com/rcs/citigpa/storage/public/Earnings";

function preso(y: number, q: number): string {
  return `${EARN}/Q${q}${y}/${y}presoqtr${q}rslt.pdf`;
}

function psqtr(y: number, q: number): string {
  return `${EARN}/Q${q}${y}/${y}psqtr${q}rslt.pdf`;
}

function prqtr(y: number, q: number): string {
  return `${EARN}/Q${q}${y}/${y}prqtr${q}rslt.pdf`;
}

export const C_IR_PAGES = ["https://www.citigroup.com/global/investors/quarterly-earnings"] as const;

/** GET-verified. Q2 2026 uses older `presoqtr` filename; 2024–2026 otherwise use `psqtr`. */
export const C_KNOWN_QUARTER_DOCS: Readonly<Record<string, CQuarterDocs>> = {
  "Q2 2026": { slides: preso(2026, 2), filings: prqtr(2026, 2) },
  "Q1 2026": { slides: psqtr(2026, 1), filings: prqtr(2026, 1) },
  "Q4 2025": { slides: psqtr(2025, 4), filings: prqtr(2025, 4) },
  "Q3 2025": { slides: psqtr(2025, 3), filings: prqtr(2025, 3) },
  "Q1 2025": { slides: psqtr(2025, 1), filings: prqtr(2025, 1) },
  "Q3 2024": { slides: psqtr(2024, 3), filings: null },
  "Q2 2024": { slides: psqtr(2024, 2), filings: prqtr(2024, 2) },
};

export function isCRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|at-a-glance|8-k|transcript|supplement|seeking.?alpha/i.test(n);
}

export function isCIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    /citigroup\.com\/rcs\/citigpa\/storage\/public\/.+\.pdf/i.test(url) &&
    !isCRejected(url) &&
    /(presoqtr|psqtr|prqtr)/i.test(url)
  );
}

export function mergeCKnownQuarterDocs(): Map<string, CQuarterDocs> {
  return new Map(Object.entries(C_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
