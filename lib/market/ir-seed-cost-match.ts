/** Costco q4cdn: earnings supplement as slides, operating-results news PDF as filings. */

export type CostQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const COST_FILES = "https://s201.q4cdn.com/287523651/files";

function supplement(path: string): string {
  return `${COST_FILES}/doc_presentations/${path}`;
}

function news(file: string): string {
  return `${COST_FILES}/doc_news/${file}`;
}

/**
 * Verified first-party q4cdn PDFs. Monthly sales-only releases are not filings.
 * Missing quarters stay empty — do not fall back to SEC HTML.
 */
export const COST_KNOWN_QUARTER_DOCS: Readonly<Record<string, CostQuarterDocs>> = {
  "Q3 2026": {
    slides: supplement("2026/May/28/Q3-FY-26-Earnings-Supplement.pdf"),
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Third-Quarter-and-Year-To-Date-Operating-Results-For-Fiscal-2026-2026.pdf",
    ),
  },
  "Q2 2026": {
    slides: supplement("2026/Mar/05/Q2-FY-26-Earnings-Supplement.pdf"),
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Second-Quarter-and-Year-to-Date-Operating-Results-for-Fiscal-2026-and-February-Sales-Results-2026.pdf",
    ),
  },
  "Q1 2026": {
    slides: supplement("2025/Dec/11/Q1-FY-26-Earnings-Supplement.pdf"),
    filings: null,
  },
  "Q4 2025": {
    slides: supplement("2025/Sep/25/Q4-FY-25-Earnings-Supplement.pdf"),
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Fourth-Quarter-and-Fiscal-Year-2025-Operating-Results-2025.pdf",
    ),
  },
  "Q3 2025": {
    slides: supplement("2025/May/29/Q3-FY-25-Earnings-Supplement.pdf"),
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Third-Quarter-and-Year-To-Date-Operating-Results-for-Fiscal-2025-2025.pdf",
    ),
  },
  "Q2 2025": {
    slides: supplement("2025/Mar/06/Q2-FY-25.pdf"),
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Second-Quarter-and-Year-To-Date-Operating-Results-For-Fiscal-2025-and-February-Sales-Results-2025.pdf",
    ),
  },
  "Q1 2025": {
    slides: supplement("2024/Dec/12/Q1-FY-25-Earnings-Supplement.pdf"),
    filings: null,
  },
  "Q4 2024": {
    slides: supplement("2024/Sep/26/q4-fy-24-earnings-supplement.pdf"),
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Fourth-Quarter-and-Fiscal-Year-2024-Operating-Results-2024.pdf",
    ),
  },
  "Q3 2024": {
    slides: supplement("2024/May/30/q3-fy-24.pdf"),
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Third-Quarter-and-Year-to-Date-Operating-Results-for-Fiscal-2024-2024.pdf",
    ),
  },
  "Q2 2024": {
    slides: null,
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Second-Quarter-and-Year-to-Date-Operating-Results-for-Fiscal-2024-and-February-Sales-Results-2024.pdf",
    ),
  },
  "Q4 2023": {
    slides: null,
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Fourth-Quarter-and-Fiscal-Year-2023-Operating-Results-2023.pdf",
    ),
  },
  "Q3 2023": {
    slides: supplement("2023/May/07/q3-fy-23.pdf"),
    filings: news(
      "Costco-Wholesale-Corporation-Reports-Third-Quarter-and-Year-to-Date-Operating-Results-for-Fiscal-2023-2023.pdf",
    ),
  },
};

export const COST_IR_PAGES = [
  "https://investor.costco.com/news/default.aspx",
  "https://investor.costco.com/events-and-presentations/default.aspx",
] as const;

export function mergeCostKnownQuarterDocs(
  fromHtml: Map<string, CostQuarterDocs>,
): Map<string, CostQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(COST_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

const ORDINAL_FQ: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };

export function labelFromCostPdfHref(href: string): string | null {
  const n = decodeURIComponent(href.replace(/\+/g, " "));
  const fyToken = n.match(/\bQ([1-4])[-_]?FY[-_]?(\d{2})\b/i) ?? n.match(/\bq([1-4])-fy-(\d{2})\b/i);
  if (fyToken) return `Q${fyToken[1]} 20${fyToken[2]}`;
  const fourthFy = n.match(/\bFourth-Quarter-and-Fiscal-Year-(\d{4})/i);
  if (fourthFy) return `Q4 ${fourthFy[1]}`;
  const ordinal = n.match(
    /\b(First|Second|Third|Fourth)-Quarter(?:-and-Year-to-Date)?-Operating-Results-[Ff]or-Fiscal-(\d{4})/i,
  );
  if (ordinal) {
    const fq = ORDINAL_FQ[ordinal[1]!.toLowerCase()];
    if (!fq) return null;
    return `Q${fq} ${ordinal[2]}`;
  }
  return null;
}

function isCostRejectedPdf(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  if (/annual-report|proxy|sustainability|safe-harbor|shareholders-meeting|vsm-/i.test(n)) return true;
  if (/sec\.gov/i.test(n)) return true;
  // Monthly sales-only (no quarterly operating results).
  if (/sales-results/i.test(n) && !/operating-results/i.test(n)) return true;
  if (/cash-dividend/i.test(n) && !/operating-results/i.test(n)) return true;
  return false;
}

function isCostSlidesPdf(href: string): boolean {
  if (isCostRejectedPdf(href)) return false;
  const n = decodeURIComponent(href).toLowerCase();
  return /earnings-supplement|\/q[1-4]-fy-\d{2}(?:-earnings-supplement)?\.pdf/i.test(n);
}

function isCostFilingsPdf(href: string): boolean {
  if (isCostRejectedPdf(href)) return false;
  const n = decodeURIComponent(href).toLowerCase();
  return /operating-results/i.test(n) && /doc_news/i.test(href);
}

function absCost(href: string, pageUrl: string): string | null {
  try {
    const raw = href.replace(/&amp;/g, "&");
    const viewer = raw.match(/[?&]file=(https?:\/\/[^&#]+)/i);
    return new URL(viewer ? decodeURIComponent(viewer[1]!) : raw, pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

/** Parse Costco IR news / events HTML for supplement + operating-results PDFs. */
export function parseCostIrHtml(html: string, pageUrl: string): Map<string, CostQuarterDocs> {
  const out = new Map<string, CostQuarterDocs>();
  const hrefRe = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const raw = (m[1] ?? "").trim();
    if (!/\.pdf/i.test(raw)) continue;
    const href = absCost(raw, pageUrl);
    if (!href || !/s201\.q4cdn\.com\/287523651/i.test(href)) continue;
    const label = labelFromCostPdfHref(href);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides && isCostSlidesPdf(href)) cur.slides = href;
    else if (!cur.filings && isCostFilingsPdf(href)) cur.filings = href;
    out.set(label, cur);
  }
  return out;
}
