/** TD Bank Group (TD) IR — issuer FY ends Oct 31. Slides = Quarterly Results Presentation; Filings = Earnings News Release. Never transcript / supplemental / SEC HTML. */

export type TdQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const TD_DAM = "https://www.td.com/content/dam/tdcom/canada/about-td/pdf";

function pdf(path: string): string {
  return `${TD_DAM}/${path}`;
}

/** Issuer FY ends October 31. */
export const TD_FY_END = "10-31";

export const TD_IR_PAGES = [
  "https://www.td.com/ca/en/about-td/for-investors/investor-relations/financial-information/financial-reports/quarterly-results",
] as const;

/**
 * HTTP-verified catalog. Filename stems vary heavily by year — do not construct blindly.
 * Base: /content/dam/tdcom/canada/about-td/pdf/
 */
export const TD_KNOWN_QUARTER_DOCS: Readonly<Record<string, TdQuarterDocs>> = {
  "Q3 2026": {
    slides: pdf("quarterly-results/2026/q3/2026-q3-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2026/q3/2026-q3-earnings-newsrelease-en.pdf"),
  },
  "Q2 2026": {
    slides: pdf("quarterly-results/2026/q2/2026-q2-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2026/q2/2026-q2-earnings-newsrelease-en.pdf"),
  },
  "Q1 2026": {
    slides: pdf("quarterly-results/2026/q1/2026-q1-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2026/q1/2026-q1-earnings-newsrelease-en.pdf"),
  },
  "Q4 2025": {
    slides: pdf("quarterly-results/2025/q4/2025-q4-quarterly-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2025/q4/q4-2025-news-release-en.pdf"),
  },
  "Q3 2025": {
    slides: pdf("quarterly-results/2025/q3/2025-q3-quarterly-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2025/q3/2025-q3-earnings-news-release-en.pdf"),
  },
  "Q2 2025": {
    slides: pdf("quarterly-results/2025/q2/2025-q2-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2025/q2/2025-q2-earnings-newsrelease-en.pdf"),
  },
  "Q1 2025": {
    slides: pdf("quarterly-results/2025/q1/2025-q1-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2025/q1/2025-q1-earnings-newsrelease-en.pdf"),
  },
  "Q4 2024": {
    slides: pdf("quarterly-results/2024/q4/2024-q4-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2024/q4/2024-q4-earnings-newsrelease-en.pdf"),
  },
  "Q3 2024": {
    slides: pdf("quarterly-results/2024/q3/2024-q3-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2024/q3/2024-q3-earnings-newsrelease-en.pdf"),
  },
  "Q2 2024": {
    slides: pdf("quarterly-results/2024/q2/2024-q2-results-presentation-en.pdf"),
    filings: pdf("quarterly-results/2024/q2/2024-q2-earnings-newsrelease-en.pdf"),
  },
  "Q1 2024": {
    // Singular "result" in filename.
    slides: pdf("quarterly-results/2024/q1/2024-q1-result-presentation-en.pdf"),
    filings: pdf("quarterly-results/2024/q1/2024-q1-earnings-newsrelease-en.pdf"),
  },
  "Q4 2023": {
    slides: pdf("quarterly-results/2023/q4/2023-q4-results-presentation.pdf"),
    filings: pdf("quarterly-results/2023/q4/2023-q4-news-release-en.pdf"),
  },
  "Q3 2023": {
    slides: pdf("quarterly-results/2023/2023-q3-td-investor-presentation-en.pdf"),
    // Lives outside quarterly-results/ folder.
    filings: pdf("2023-q3-earnings-news-release-en.pdf"),
  },
  "Q2 2023": {
    slides: pdf("quarterly-results/2023/2023-q2-investor-presentation.pdf"),
    filings: pdf("quarterly-results/2023/2023-q2-earnings-news-release-en.pdf"),
  },
  "Q1 2023": {
    slides: pdf("quarterly-results/2023/2023-q1-td-investor-presentation-en.pdf"),
    filings: pdf("quarterly-results/2023/2023-Q1_Earnings_News_Release_F_EN.pdf"),
  },
  "Q4 2022": {
    slides: pdf("quarterly-results/2022/2022_Q4_Quarterly_Results_Presentation_F_EN.pdf"),
    filings: pdf("quarterly-results/2022/2022-Q4_Earnings_News_Release_F_EN.pdf"),
  },
  "Q3 2022": {
    slides: pdf("quarterly-results/2022/2022-Q3_Quarterly_Results_Presentation_F_EN.pdf"),
    filings: pdf("quarterly-results/2022/2022-Q3_Earnings_News_Release_F_EN.pdf"),
  },
  "Q2 2022": {
    slides: pdf("quarterly-results/2022/2022-Q2_Quarterly_Results_Presentation_F_EN.pdf"),
    filings: pdf("quarterly-results/2022/2022-Q2_Earnings_News_Release_F_EN.pdf"),
  },
  "Q1 2022": {
    slides: pdf("quarterly-results/2022/2022-Q1_Quarterly_Results_Presentation_F_EN.pdf"),
    filings: pdf("quarterly-results/2022/2022-Q1_Earnings_News_Release_F_EN.pdf"),
  },
};

export function isTdRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  // 2023 quarterly decks are titled "investor-presentation" — allow those.
  // Reject transcripts, supplements, fact sheets, call details, XLS, SEC.
  return /sec\.gov|transcript|supp(?:lemental|pack)|regulatory|shareholders|fact[-_\s]?sheet|call[-_\s]?details|\.xls/i.test(
    n,
  );
}

export function isTdIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "www.td.com" || u.hostname === "td.com" || u.hostname.endsWith(".td.com"))) {
      return false;
    }
    if (!u.pathname.includes("/content/dam/tdcom/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    // Quarterly results area OR flat earnings news release under /pdf/.
    return (
      u.pathname.includes("/quarterly-results/") ||
      /earnings[-_]?news[-_]?release|news[-_]?release/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export function mergeTdKnownQuarterDocs(): Map<string, TdQuarterDocs> {
  return new Map(Object.entries(TD_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
