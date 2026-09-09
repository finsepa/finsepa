/** Caterpillar q4cdn: analyst slide deck as slides, earnings-release PDF as filings. */

export type CatQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const CAT_FIN = "https://s25.q4cdn.com/358376879/files/doc_financials";

function catPdf(year: number, fq: number, file: string): string {
  return `${CAT_FIN}/${year}/q${fq}/${file}`;
}

/**
 * Verified q4cdn PDFs from investors.caterpillar.com quarterly-results.
 * Older press is HTML on caterpillar.com — leave filings empty (never SEC HTML).
 */
export const CAT_KNOWN_QUARTER_DOCS: Readonly<Record<string, CatQuarterDocs>> = {
  "Q2 2026": {
    slides: catPdf(2026, 2, "2Q-2026-Analyst-Slide-Deck_Final.pdf"),
    filings: catPdf(2026, 2, "2Q-2026-Earnings-Release-Final.pdf"),
  },
  "Q1 2026": {
    slides: catPdf(2026, 1, "1Q-2026-Analyst-Slide-Deck_Final.pdf"),
    filings: catPdf(2026, 1, "1Q-2026-Earnings-Release-Final.pdf"),
  },
  "Q4 2025": { slides: catPdf(2025, 4, "4Q-2025-Analyst-Slide-Deck_Final.pdf"), filings: null },
  "Q3 2025": { slides: catPdf(2025, 3, "3Q-2025-Analyst-Slide-Deck-vFinal.pdf"), filings: null },
  "Q2 2025": { slides: catPdf(2025, 2, "2Q-2025-Analyst-Slide-Deck-Final.pdf"), filings: null },
  "Q1 2025": { slides: catPdf(2025, 1, "1Q-2025-Analyst-Slide-Deck-Final.pdf"), filings: null },
  "Q4 2024": { slides: catPdf(2024, 4, "4Q-2024-Analyst-Slide-Deck_Final.pdf"), filings: null },
  "Q3 2024": { slides: catPdf(2024, 3, "3Q-2024-Analyst-Slide-Deck_Final.pdf"), filings: null },
  "Q2 2024": { slides: catPdf(2024, 2, "2Q-2024-Analyst-Slide-Deck_Final.pdf"), filings: null },
  "Q1 2024": { slides: catPdf(2024, 1, "1Q-2024-Analyst-Slide-Deck_Final-1.pdf"), filings: null },
  "Q4 2023": { slides: catPdf(2023, 4, "4Q-2023-Analyst-Slide-Deck-FINAL-2.pdf"), filings: null },
  "Q3 2023": { slides: catPdf(2023, 3, "3Q_2023-Analyst-Slide-Deck.pdf"), filings: null },
  "Q2 2023": { slides: catPdf(2023, 2, "2Q-2023-Analyst-Slide-Deck-Final-2.pdf"), filings: null },
  "Q1 2023": { slides: catPdf(2023, 1, "1Q-2023-Caterpillar-Inc-Earnings-Presentation.pdf"), filings: null },
  "Q4 2022": { slides: catPdf(2022, 4, "4Q-2022-Caterpillar-Inc-Earnings-Presentation.pdf"), filings: null },
  "Q3 2022": { slides: catPdf(2022, 3, "3Q-2022-Caterpillar-Inc-Earnings-Presentation.pdf"), filings: null },
  "Q2 2022": {
    slides: catPdf(2022, 2, "2Q-2022-Earnings-Release_Analyst-Slides-Final.pdf"),
    filings: null,
  },
  "Q1 2022": {
    slides: catPdf(2022, 1, "1Q-2022-Earnings-Release_Analyst-Slides-Final.pdf"),
    filings: null,
  },
};

export const CAT_IR_PAGES = [
  "https://investors.caterpillar.com/financials/quarterly-results/default.aspx",
] as const;

export function mergeCatKnownQuarterDocs(fromHtml: Map<string, CatQuarterDocs>): Map<string, CatQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(CAT_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

export function labelFromCatPdfHref(href: string): string | null {
  const n = decodeURIComponent(href);
  const dir = n.match(/\/(\d{4})\/q([1-4])\//i);
  if (dir) return `Q${dir[2]} ${dir[1]}`;
  const compact = n.match(/\b([1-4])Q[-_]?(\d{4})\b/i);
  if (compact) return `Q${compact[1]} ${compact[2]}`;
  return null;
}

function isCatRejectedPdf(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  return (
    /transcript|10-q|10-k|form-10|cloudfront\.net|caterpillar\.com\/.+\.html/i.test(n) ||
    /sec\.gov/i.test(n)
  );
}

function isCatSlidesPdf(href: string): boolean {
  if (isCatRejectedPdf(href)) return false;
  const n = decodeURIComponent(href).toLowerCase();
  return /analyst-slide-deck|earnings-presentation|earnings-release_analyst-slides/i.test(n);
}

function isCatFilingsPdf(href: string): boolean {
  if (isCatRejectedPdf(href)) return false;
  const n = decodeURIComponent(href).toLowerCase();
  if (/analyst-slide|transcript|presentation/i.test(n)) return false;
  return /earnings-release/i.test(n);
}

function absCat(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

/** Parse Caterpillar quarterly-results HTML for slide decks vs earnings-release PDFs. */
export function parseCatQuarterlyResultsHtml(html: string, pageUrl: string): Map<string, CatQuarterDocs> {
  const out = new Map<string, CatQuarterDocs>();
  const hrefRe = /(?:href|src)\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const href = absCat((m[1] ?? "").trim(), pageUrl);
    if (!href || !/s25\.q4cdn\.com\/358376879/i.test(href)) continue;
    const label = labelFromCatPdfHref(href);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides && isCatSlidesPdf(href)) cur.slides = href;
    else if (!cur.filings && isCatFilingsPdf(href)) cur.filings = href;
    out.set(label, cur);
  }
  return out;
}
