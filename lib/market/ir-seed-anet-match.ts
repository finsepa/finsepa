/** Arista IR: quarterly Highlights / earnings deck as slides. Press is Business Wire HTML — filings stay empty. Never 10-Q / Technical IR / conference. */

export type AnetQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const Q4 = "https://s21.q4cdn.com/861911615/files/doc_financials";

function pdf(path: string): string {
  return `${Q4}/${path}`;
}

export const ANET_IR_PAGES = [
  "https://investors.arista.com/",
  "https://investors.arista.com/Financials/Quarterly-Results/default.aspx",
] as const;

/**
 * Calendar FY. Highlights decks are the earnings IR overview (results + guidance), not Costco-style monthly sales.
 * Filenames are inconsistent; catalog GET/web-verified only. Leave holes empty.
 */
export const ANET_KNOWN_QUARTER_DOCS: Readonly<Record<string, AnetQuarterDocs>> = {
  "Q1 2025": { slides: pdf("2025/q1/B/Arista-2025-Q1-Highlights.pdf"), filings: null },
  "Q4 2024": { slides: pdf("2024/q4/Arista-2024-Q4-Highlights.pdf"), filings: null },
  "Q3 2024": { slides: pdf("2024/q3/ANET_Financial_Q324_FINAL.pdf"), filings: null },
  "Q2 2024": { slides: pdf("2024/q2/ANET_Financial_Q224_FINAL5.pdf"), filings: null },
  "Q4 2022": { slides: pdf("2022/q4/Arista_IRDeck_Q422Highlights_v2.pdf"), filings: null },
};

export function isAnetRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|form[-_\s]?10-?q|10-q|10-k|8-k|transcript|technical[_-]?ir|data-driven-solutions|investor[-_\s]*day|conference/i.test(
    n,
  );
}

export function isAnetIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!/s21\.q4cdn\.com\/861911615\/files\/doc_financials\/.+\.pdf/i.test(url)) return false;
  if (isAnetRejected(url)) return false;
  const file = decodeURIComponent(url).split("/").pop() ?? "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(file)) return false;
  return /highlights|anet_financial|irdeck/i.test(file);
}

export function mergeAnetKnownQuarterDocs(): Map<string, AnetQuarterDocs> {
  return new Map(Object.entries(ANET_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
