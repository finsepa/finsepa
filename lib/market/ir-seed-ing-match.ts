/**
 * ING IR seed — 12-31.
 * ING Groep calendar FY. Slides=results presentation; Filings=press release. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type IngQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ING_IR_PAGES = [
  "https://www.ing.com/Investor-relations.htm",
] as const;

export const ING_KNOWN_QUARTER_DOCS: Readonly<Record<string, IngQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/ing-results-presentation-1q2022.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/press-releases/2022/ing_press_release_1q2022-06-may-2022-0700-cet.pdf",
  },
  "Q2 2022": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/ing-results-presentation-2q2022.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/press-releases/2022/ing_press_release_2q2022-04-august-2022-0700-cet.pdf",
  },
  "Q3 2022": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/ing-results-presentation-3q2022.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/press-releases/2022/ing_press_release_3q2022-15-september-2022-0900-cet.pdf",
  },
  "Q4 2022": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/ing-results-presentation-4q2022.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/files/ing-posts-fy2022-net-result-of-3674-million-proposed-final-2022-dividend-of-0.389-per-share-1.pdf",
  },
  "Q1 2023": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/1q2023-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/press-releases/2023/1q2023-ing-press-release.pdf",
  },
  "Q2 2023": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/2q2023-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/press-releases/2023/2q2023-ing-press-release.pdf",
  },
  "Q3 2023": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/3q2023-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/press-releases/2023/3q2023-ing-press-release.pdf",
  },
  "Q4 2023": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/4qfy2023-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/files/4qfy2023-ing-press-release.pdf",
  },
  "Q1 2024": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/1q2024-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/files/1q2024-ing-press-release-1.pdf",
  },
  "Q2 2024": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/2q2024-ing-quarterly-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/files/2q2024-ing-press-release-download.pdf",
  },
  "Q3 2024": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/3q2024-ing-quarterly-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/press-releases/2024/3q2024-ing-press-release-31-october-2024.pdf",
  },
  "Q4 2024": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/4qfy2024-ing-quarterly-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/migrated-press-releases/2025/4qfy2024-ing-press-release-download.pdf",
  },
  "Q1 2025": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/1q2025_ing_results_presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/files/1q2025_press_release__download_.pdf",
  },
  "Q2 2025": {
    slides: "https://www.ing.com/binaries/content/assets/documents/files/2q2025_ing_results_presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/files/2q2025-press-release-download.pdf",
  },
  "Q3 2025": {
    slides: "https://www.ing.com/binaries/content/assets/documents/results/3q2025/3q2025-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/results/3q2025/3q2025-ing-press-release.pdf",
  },
  "Q4 2025": {
    slides: "https://www.ing.com/binaries/content/assets/documents/results/4qfy2025/4qfy2025-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/results/4qfy2025/4qfy2025-ing-press-release.pdf",
  },
  "Q1 2026": {
    slides: "https://www.ing.com/binaries/content/assets/documents/results/1q2026/1q2026-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/results/1q2026/1q2026-ing-press-release.pdf",
  },
  "Q2 2026": {
    slides: "https://www.ing.com/binaries/content/assets/documents/results/2q2026/2q2026-ing-results-presentation.pdf",
    filings: "https://www.ing.com/binaries/content/assets/documents/results/2q2026/2q2026-ing-press-release.pdf",
  },
};

export function isIngRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|annual.?report|sustainab|esg|climate|fact.?sheet/i.test(n);
}

export function isIngIrPdf(href: string | null | undefined): boolean {
  if (!href || isIngRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.ing.com" || host === "ing.com" || host.endsWith(".ing.com"))) return false;
    if (!(u.pathname.includes("/binaries/") || u.pathname.includes("/documents/") || u.pathname.includes("/results/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeIngKnownQuarterDocs(): Map<string, IngQuarterDocs> {
  return new Map(Object.entries(ING_KNOWN_QUARTER_DOCS));
}
