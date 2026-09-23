/**
 * Zurich Insurance (ZURVY) IR — calendar FY.
 * HY/FY: investor presentation + news release; Q1/Q3: news release only (slides null).
 * Host: www.zurich.com/-/media-assets/.... Never SEC HTML.
 */

export type ZurvyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ZURVY_IR_PAGES = [
  "https://www.zurich.com/en/investor-relations/results-and-reports",
  "https://www.zurich.com/en/investor-relations",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const ZURVY_KNOWN_QUARTER_DOCS: Readonly<Record<string, ZurvyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2022/docs/2022-0512-01.pdf",
  },
  "Q2 2022": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2022/investor-media-presentation-including-commentary-half-year-results-2022.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2022/docs/2022-0811-01.pdf?sc_lang=en",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2022/docs/2022-1110-01.pdf?sc_lang=en",
  },
  "Q4 2022": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2023/investor-presentation-including-commentary-annual-results-2022.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2023/docs/2023-0209-01.pdf?sc_lang=en",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2023/docs/2023-0517-01.pdf?sc_lang=en",
  },
  "Q2 2023": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2023/investor-presentation-including-commentary-half-year-results-2023.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2023/docs/2023-0810-01.pdf?sc_lang=en",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2023/docs/2023-1109-01.pdf?sc_lang=en",
  },
  "Q4 2023": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2024/investor-presentation-including-commentary-annual-results-2023.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2024/docs/2024-0222-01.pdf?sc_lang=en",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2024/docs/2024-0516-01.pdf?sc_lang=en",
  },
  "Q2 2024": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2024/investor-media-presentation-including-commentary-half-year-results-2024.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2024/docs/2024-0808-01.pdf?sc_lang=en",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2024/docs/2024-1107-01.pdf?sc_lang=en",
  },
  "Q4 2024": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2024/q4/investor-media-presentation-including-commentary-annual-results-2024.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2025/docs/2025-0220-01.pdf?sc_lang=en",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2025/docs/2025-0508-01.pdf?sc_lang=en",
  },
  "Q2 2025": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2025/q2/investor-media-presentation-including-commentary-half-year-results-2025.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2025/docs/2025-0807-01.pdf?sc_lang=en",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2025/docs/2025-1106-01.pdf?sc_lang=en",
  },
  "Q4 2025": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2025/q4/investor-media-presentation-including-commentary-annual-results-2025.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2026/docs/2026-0219-01.pdf?sc_lang=en",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2026/docs/2026-0513-01.pdf?sc_lang=en",
  },
  "Q2 2026": {
    slides: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/investor-relations/docs/results/2026/q2/investor-media-presentation-including-commentary-half-year-results-2026.pdf",
    filings: "https://www.zurich.com/-/media-assets/project/zurich/dotcom/media/news-releases/2026/docs/2026-0806-01.pdf?sc_lang=en",
  }
};

export function isZurvyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|annual.report|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isZurvyIrPdf(href: string | null | undefined): boolean {
  if (!href || isZurvyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.zurich.com" || host === "zurich.com" || host.endsWith(".zurich.com"))) return false;
    if (!u.pathname.includes("/media-assets/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeZurvyKnownQuarterDocs(): Map<string, ZurvyQuarterDocs> {
  return new Map(Object.entries(ZURVY_KNOWN_QUARTER_DOCS));
}
