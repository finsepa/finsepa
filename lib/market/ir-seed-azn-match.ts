/** AstraZeneca IR: quarterly results presentation as slides, English announcement as filings. Never aide-memoire / clinical appendix / transcript. */

export type AznQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const DAM = "https://www.astrazeneca.com/content/dam/az/PDF";

function pdf(path: string): string {
  return `${DAM}/${path}`;
}

export const AZN_IR_PAGES = ["https://www.astrazeneca.com/investor-relations.html"] as const;

/**
 * Calendar FY. DAM folders vary (`eq1` vs `q1`, `h1q2` vs `h1`, `9m-q3` vs `9mq3` vs `q3`).
 * Catalog GET/web-verified URLs only — do not invent folders.
 */
export const AZN_KNOWN_QUARTER_DOCS: Readonly<Record<string, AznQuarterDocs>> = {
  "Q2 2026": {
    slides: pdf("2026/h1q2/H1-and-Q2-2026-results-presentation.pdf"),
    filings: pdf("2026/h1q2/H1-and-Q2-2026-results-announcement.pdf"),
  },
  "Q1 2026": {
    slides: pdf("2026/eq1/Q1-2026-results-presentation.pdf"),
    filings: pdf("2026/eq1/Q1-2026-results-announcement.pdf"),
  },
  "Q4 2025": {
    slides: pdf("2025/Q4-FY/Full-year-Q4-2025-results-presentation.pdf"),
    filings: pdf("2025/Q4-FY/Full-year-Q4-2025-results-announcement.pdf"),
  },
  "Q3 2025": {
    slides: pdf("2025/9m-q3/9M-and-Q3-2025-results-presentation.pdf"),
    filings: pdf("2025/9m-q3/9M-and-Q3-2025-results-announcement.pdf"),
  },
  "Q2 2025": {
    slides: pdf("2025/h1q2/H1-and-Q2-2025-results-presentation.pdf"),
    filings: pdf("2025/h1q2/H1-and-Q2-2025-results-announcement.pdf"),
  },
  "Q1 2025": {
    slides: pdf("2025/q1/Q1-2025-results-presentation.pdf"),
    filings: pdf("2025/q1/Q1-2025-results-announcement.pdf"),
  },
  "Q4 2024": {
    slides: pdf("2024/fy/Full-year-and-Q4-2024-results-presentation.pdf"),
    filings: pdf("2024/fy/Full-year-and-Q4-2024-results-announcement.pdf"),
  },
  "Q3 2024": {
    slides: pdf("2024/9mq3/9M-and-Q3-2024-results-presentation.pdf"),
    filings: pdf("2024/9mq3/9M-and-Q3-2024-results-announcement.pdf"),
  },
  "Q2 2024": {
    slides: pdf("2024/h1/H1-and-Q2-2024-results-presentation.pdf"),
    filings: pdf("2024/h1/H1-and-Q2-2024-results-announcement.pdf"),
  },
  "Q1 2024": {
    slides: pdf("2024/q1/Q1-2024-results-presentation.pdf"),
    filings: pdf("2024/q1/Q1-2024-results-announcement.pdf"),
  },
  "Q4 2023": {
    slides: pdf("2023/fy/Full-year-and-Q4-2023-results-presentation.pdf"),
    filings: pdf("2023/fy/Full-year-and-Q4-2023-results-announcement.pdf"),
  },
  "Q3 2023": {
    slides: pdf("2023/q3/9M_and_Q3_2023_results_presentation.pdf"),
    filings: pdf("2023/q3/9M_and_Q3_2023_results_announcement.pdf"),
  },
  "Q2 2023": {
    slides: pdf("2023/h1/H1-and-Q2-2023-results-presentation.pdf"),
    filings: pdf("2023/h1/H1-and-Q2-2023-results-announcement.pdf"),
  },
  "Q1 2023": {
    slides: pdf("2023/q1/Q1-2023-results-presentation.pdf"),
    filings: pdf("2023/q1/Q1-2023-results-announcement.pdf"),
  },
  "Q4 2022": {
    slides: pdf("2022/fy/Full-year-and-Q4-2022-results-presentation.pdf"),
    filings: pdf("2022/fy/Full-year-and-Q4-2022-results-announcement.pdf"),
  },
  "Q1 2022": {
    slides: pdf("2022/q1-2022/Q1-2022-results-presentation.pdf"),
    filings: pdf("2022/q1-2022/Q1-2022-results-announcement.pdf"),
  },
};

export function isAznRejected(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return /sec\.gov|aide[-_\s]*memoire|clinical[-_\s]*appendix|clinical[-_\s]*trials|transcript|az-se|deutsch|debt-investor|sweden/i.test(
    n,
  );
}

export function isAznIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /astrazeneca\.com\/content\/dam\/az\/PDF\/.+\.pdf/i.test(url) && !isAznRejected(url);
}

/** True when the path names this calendar quarter (avoids reuse across Q1s). */
export function aznUrlMatchesLabel(url: string, label: string): boolean {
  const m = label.match(/^Q([1-4])\s+(\d{4})$/i);
  if (!m) return false;
  const fq = m[1];
  const fy = m[2];
  const n = decodeURIComponent(url);
  if (fq === "1") return new RegExp(`Q1[-_]${fy}|q1-2022`, "i").test(n) && n.includes(fy);
  if (fq === "2") return new RegExp(`H1-and-Q2-${fy}|H1_and_Q2_${fy}`, "i").test(n);
  if (fq === "3") return new RegExp(`9M[-_]and[-_]Q3[-_]${fy}`, "i").test(n);
  return new RegExp(`Full-year.*Q4[-_]${fy}|Full-year-and-Q4-${fy}|Q4[-_]FY.*${fy}`, "i").test(n);
}

export function mergeAznKnownQuarterDocs(): Map<string, AznQuarterDocs> {
  return new Map(Object.entries(AZN_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
