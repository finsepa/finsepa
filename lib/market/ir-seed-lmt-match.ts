/**
 * Lockheed Martin (LMT) IR — calendar FY.
 * Slides = Conf-Call-Charts on filecache.mediaroom.com;
 * Filings = Earnings-Release / Press-Release PDF (MediaRoom or investors static-files).
 * Filenames may contain 8-K — still IR PDF. Never financial-tables-only / transcript / SEC HTML.
 */

export type LmtQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const LMT_IR_PAGES = [
  "https://investors.lockheedmartin.com/",
  "https://news.lockheedmartin.com/",
] as const;

/** Catalog Q1 2022 → Q2 2026 (gaps left null). */
export const LMT_KNOWN_QUARTER_DOCS: Readonly<Record<string, LmtQuarterDocs>> = {
  "Q2 2026": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/183969/2Q-2026-Earnings-Conf-Call-Charts-v2.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/183966/download/2Q-2026-Earnings-Release-8-K.pdf",
  },
  "Q1 2026": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/183507/download/1Q-2026-Earnings-Conf-Call-Charts.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/183506/download/1Q-2026-Earnings-Release-8-K.pdf",
  },
  "Q4 2025": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/183154/4Q-2025-Earnings-Conf-Call-Charts.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/183163/download/4Q-2025-Earnings-Release-8-K.pdf",
  },
  "Q3 2025": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/182881/download/3Q-2025-Earnings-Conf-Call-Charts.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/182855/download/3Q-2025-Earnings-Release-8-K.pdf",
  },
  "Q2 2025": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/182590/download/2Q-2025-Earnings-Conf-Call-Charts.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/182588/download/2Q-2025-Earnings-Release-8-K.pdf",
  },
  "Q1 2025": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/182368/download/1Q-2025-Earnings-Conf-Call-Charts.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/182366/download/1Q-2025-Earnings-Release-8-K.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: null,
  },
  "Q3 2024": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/181866/download/3Q-2024-Earnings-Conf-Call-Charts.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/181864/download/3Q-2024-Earnings-Release-8-K.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: null,
  },
  "Q1 2024": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/181566/download/1Q-2024-Earnings-Conf-Call-Charts.pdf",
    filings: null,
  },
  "Q4 2023": {
    slides: null,
    filings: null,
  },
  "Q3 2023": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/181037/download/LMT-October-2023-Conf-Call-Charts.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/181035/download/3Q-2023-Earnings-Release-8-K.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/180844/download/2Q-2023-Earnings-Release-8-K.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/180579/download/LMT-January-2023-Conf-Call-Charts.pdf",
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/180577/download/4Q-2022-Earnings-Release-8-K.pdf",
  },
  "Q3 2022": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/180434/download/2022-Q3-Conf-Call-Charts.pdf",
    filings: null,
  },
  "Q2 2022": {
    slides: null,
    filings: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/180231/download/2022-Q2-8-K-Press-Release.pdf",
  },
  "Q1 2022": {
    slides: "https://filecache.mediaroom.com/mr5mr_lockheedmartin/180060/download/LMT%201Q%202022%20Apr%202022%20Conf%20Call%20Webcharts%20FINAL.pdf",
    filings: null,
  },
};

export function isLmtRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  // Allow Earnings-Release-8-K / Press-Release PDFs (IR exhibit), reject SEC HTML + tables-only.
  if (/earnings[-_\s]*release|press[-_\s]*release|conf[-_\s]*call[-_\s]*charts|webcharts/i.test(n)) {
    return /sec\.gov|transcript|financial[-_\s]*tables|10-?q|10-?k|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
  }
  return /sec\.gov|10-?q|10-?k|proxy|transcript|financial[-_\s]*tables|investor[-_\s]*day|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isLmtIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "filecache.mediaroom.com" && /\/mr5mr_lockheedmartin\//i.test(u.pathname)) {
      return /\.pdf(?:$|[?#])/i.test(u.pathname) && !isLmtRejected(url);
    }
    if (
      (host === "investors.lockheedmartin.com" || host.endsWith(".lockheedmartin.com")) &&
      /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)
    ) {
      return !isLmtRejected(url);
    }
    return false;
  } catch {
    return false;
  }
}

export function mergeLmtKnownQuarterDocs(): Map<string, LmtQuarterDocs> {
  return new Map(Object.entries(LMT_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
