/** American Express IR: earnings presentation as slides, press-release PDF as filings. Never tables / 10-Q / fixed-income. */

export type AxpQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const Q4 = "https://s26.q4cdn.com/747928648/files";

function fin(y: number, q: number, kind: "Presentation" | "Press-Release"): string {
  return `${Q4}/doc_financials/${y}/q${q}/Q${q}-${y}-Earnings-${kind}.pdf`;
}

function earnPres(y: number, q: number): string {
  return `${Q4}/doc_earnings/${y}/q${q}/presentation/Q${q}-${y}-Earnings-Presentation.pdf`;
}

function earnPress(y: number, q: number): string {
  return `${Q4}/doc_earnings/${y}/q${q}/earnings-result/Q${q}-${y}-Earnings-Press-Release.pdf`;
}

export const AXP_IR_PAGES = [
  "https://ir.americanexpress.com/financials/earnings-and-sec-filings/default.aspx",
] as const;

export const AXP_KNOWN_QUARTER_DOCS: Readonly<Record<string, AxpQuarterDocs>> = {
  "Q2 2026": { slides: earnPres(2026, 2), filings: earnPress(2026, 2) },
  "Q1 2026": { slides: earnPres(2026, 1), filings: earnPress(2026, 1) },
  "Q4 2025": { slides: earnPres(2025, 4), filings: earnPress(2025, 4) },
  "Q3 2025": { slides: fin(2025, 3, "Presentation"), filings: fin(2025, 3, "Press-Release") },
  "Q2 2025": { slides: fin(2025, 2, "Presentation"), filings: fin(2025, 2, "Press-Release") },
  "Q1 2025": { slides: fin(2025, 1, "Presentation"), filings: fin(2025, 1, "Press-Release") },
  "Q4 2024": { slides: fin(2024, 4, "Presentation"), filings: fin(2024, 4, "Press-Release") },
  "Q3 2024": { slides: fin(2024, 3, "Presentation"), filings: fin(2024, 3, "Press-Release") },
  "Q2 2024": {
    slides: `${Q4}/doc_financials/2024/q2/q2-_-2024-earnings-presentation.pdf`,
    filings: `${Q4}/doc_financials/2024/q2/q2-2024-earnings-press-release.pdf`,
  },
  "Q1 2024": { slides: fin(2024, 1, "Presentation"), filings: fin(2024, 1, "Press-Release") },
  "Q4 2023": { slides: fin(2023, 4, "Presentation"), filings: fin(2023, 4, "Press-Release") },
  "Q3 2023": { slides: fin(2023, 3, "Presentation"), filings: fin(2023, 3, "Press-Release") },
  "Q2 2023": { slides: fin(2023, 2, "Presentation"), filings: fin(2023, 2, "Press-Release") },
  "Q1 2023": { slides: fin(2023, 1, "Presentation"), filings: fin(2023, 1, "Press-Release") },
  "Q4 2022": { slides: fin(2022, 4, "Presentation"), filings: fin(2022, 4, "Press-Release") },
  "Q3 2022": {
    slides: `${Q4}/doc_financials/2022/q3/Q3-2022-Earnings-Presentation-(2).pdf`,
    filings: fin(2022, 3, "Press-Release"),
  },
  "Q2 2022": {
    slides: `${Q4}/doc_financials/2022/q2/Q2-2022-Earnings-Presentation-(2).pdf`,
    filings: fin(2022, 2, "Press-Release"),
  },
  "Q1 2022": { slides: fin(2022, 1, "Presentation"), filings: fin(2022, 1, "Press-Release") },
};

export function isAxpRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|tables|supplemental|fixed[-_\s]?income|transcript/i.test(n);
}

export function isAxpIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    /s26\.q4cdn\.com\/747928648\/files\/.+\.pdf/i.test(url) &&
    /earnings[-_]?(presentation|press[-_]?release)/i.test(url) &&
    !isAxpRejected(url)
  );
}

export function mergeAxpKnownQuarterDocs(): Map<string, AxpQuarterDocs> {
  return new Map(Object.entries(AXP_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
