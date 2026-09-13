/**
 * Novo Nordisk (NVO ADR) IR — calendar FY.
 * Slides = quarterly investor presentation PDF on novonordisk.com DAM.
 * Filings = company announcement PDF when published as `.pdf` (recent quarters link HTML news pages → leave empty).
 * Never ADA / Capital Markets Day / AHA conference decks / SEC HTML / XLS.
 */

export type NvoQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const NVO_DAM =
  "https://www.novonordisk.com/content/dam/nncorp/global/en/investors";

function slidesPdf(pathUnderInvestors: string): string {
  return `${NVO_DAM}/${pathUnderInvestors}`;
}

export const NVO_IR_PAGES = [
  "https://www.novonordisk.com/investors/financial-results.html",
] as const;

/**
 * HTTP-verified investor presentation PDFs from the financial-results hub
 * (Q1 2022 → Q2 2026). Filings left null when only HTML company announcements exist.
 */
export const NVO_KNOWN_QUARTER_DOCS: Readonly<Record<string, NvoQuarterDocs>> = {
  "Q2 2026": {
    slides: slidesPdf("pdfs/financial-results/2026/Q2-2026-Full%20presentation.pdf"),
    filings: null,
  },
  "Q1 2026": {
    slides: slidesPdf("pdfs/financial-results/2026/Q1-2026-investor-presentation.pdf"),
    filings: null,
  },
  "Q4 2025": {
    slides: slidesPdf("pdfs/financial-results/2026/Q4-2025-investor-presentation-4Feb.pdf"),
    filings: null,
  },
  "Q3 2025": {
    slides: slidesPdf("pdfs/financial-results/2025/Q3-investor-presentation-2025.pdf"),
    filings: null,
  },
  "Q2 2025": {
    slides: slidesPdf("pdfs/financial-results/2025/Q2-2025-investor-presentation-updated.pdf"),
    filings: null,
  },
  "Q1 2025": {
    slides: slidesPdf("pdfs/financial-results/2025/Q1-2025-investor-presentation.pdf"),
    filings: null,
  },
  "Q4 2024": {
    slides: slidesPdf("irmaterial/annual_report/2025/q4-2024-investor-presentation.pdf"),
    filings: null,
  },
  "Q3 2024": {
    slides: slidesPdf("pdfs/financial-results/2024/q3-2024-investor-presentation.pdf"),
    filings: null,
  },
  "Q2 2024": {
    slides: slidesPdf("pdfs/financial-results/2024/Q2-2024-investor-presentation.pdf"),
    filings: null,
  },
  "Q1 2024": {
    slides: slidesPdf("pdfs/financial-results/2024/q1-2024-investor-presentation.pdf"),
    filings: null,
  },
  "Q4 2023": {
    slides: slidesPdf("pdfs/financial-results/2023/q4-2023-presentation.pdf"),
    filings: null,
  },
  "Q3 2023": {
    slides: slidesPdf("pdfs/financial-results/2023/Q3-2023-investor-presentation.pdf"),
    filings: null,
  },
  "Q2 2023": {
    slides: slidesPdf("pdfs/financial-results/2023/Q2-2023-investor-presentation.pdf"),
    filings: null,
  },
  "Q1 2023": {
    slides: slidesPdf("pdfs/financial-results/2023/Q1-2023-investor-presentation.pdf"),
    filings: null,
  },
  "Q4 2022": {
    slides: slidesPdf("pdfs/financial-results/2022/Q4-2022-investor-presentation.pdf"),
    filings: null,
  },
  "Q3 2022": {
    slides: slidesPdf("pdfs/financial-results/2022/Q3-2022-investor-presentation.pdf"),
    filings: null,
  },
  "Q2 2022": {
    slides: slidesPdf("pdfs/financial-results/2022/Q2-2022-investor-presentation.pdf"),
    filings: null,
  },
  "Q1 2022": {
    slides: slidesPdf("pdfs/financial-results/2022/Q1-2022-investor-presentation.pdf"),
    filings: null,
  },
};

export function isNvoRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return (
    /sec\.gov|10-?q|10-?k|8-?k|\.xls|ada[-_/\s]|capital[-_\s]*markets|aha[-_\s]|r-?and-?d[-_\s]*investor|semaglutide|conference-call-supply|transcript/i.test(
      n,
    )
  );
}

export function isNvoIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "www.novonordisk.com" || u.hostname === "novonordisk.com")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    if (!u.pathname.includes("/investors/")) return false;
    if (isNvoRejected(url)) return false;
    return /investor[-_]?presentation|q\d[-_].*presentation|full%20presentation|full presentation/i.test(
      decodeURIComponent(u.pathname),
    );
  } catch {
    return false;
  }
}

export function mergeNvoKnownQuarterDocs(): Map<string, NvoQuarterDocs> {
  return new Map(Object.entries(NVO_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
