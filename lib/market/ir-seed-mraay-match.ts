/**
 * MRAAY IR seed — 03-31.
 * Murata ADR March FY. Slides=*-e-speach.ashx; Filings=*-e-fls.ashx on corporate.murata.com. Latest Q1 2027. Scope stats: 21 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export const MRAAY_FY_END = "03-31" as const;

export type MraayQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MRAAY_IR_PAGES = [
  "https://corporate.murata.com/en-global/ir",
] as const;

export const MRAAY_KNOWN_QUARTER_DOCS: Readonly<Record<string, MraayQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2021/0729c/21q1-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2021/0729/21q1-e-fls.ashx",
  },
  "Q2 2022": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2021/1029b/21q2-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2021/1029/21q2-e-fls.ashx",
  },
  "Q3 2022": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2022/0201b/21q3-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2022/0201/21q3-e-fls.ashx",
  },
  "Q4 2022": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2022/0428b/21q4-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2022/0428/21q4-e-fls.ashx",
  },
  "Q1 2023": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2022/0728b/22q1-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2022/0728/22q1-e-fls.ashx",
  },
  "Q2 2023": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2022/1031b/22q2-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2022/1031/22q2-e-fls.ashx",
  },
  "Q3 2023": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2023/0202b/22q3-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2023/0202/22q3-e-fls.ashx",
  },
  "Q4 2023": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2023/0428b/22q4-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2023/0428/22q4-e-fls.ashx",
  },
  "Q1 2024": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2023/0731b/23q1-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2023/0731/23q1-e-fls.ashx",
  },
  "Q2 2024": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2023/1031b/23q2-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2023/1031/23q2-e-fls.ashx",
  },
  "Q3 2024": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2024/0202b/23q3-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2024/0202/23q3-e-fls.ashx",
  },
  "Q4 2024": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2024/0426b/23q4-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2024/0426/23q4-e-fls.ashx",
  },
  "Q1 2025": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2024/0730b/24q1-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2024/0730/24q1-e-fls.ashx",
  },
  "Q2 2025": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2024/1102b/24q2-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2024/1101/24q2-e-fls.ashx",
  },
  "Q3 2025": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2025/0203b/24q3-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2025/0203/24q3-e-fls.ashx",
  },
  "Q4 2025": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2025/0430b/24q4-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2025/0430/24q4-e-fls.ashx",
  },
  "Q1 2026": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2025/0730b/25q1-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2025/0730/25q1-e-fls.ashx",
  },
  "Q2 2026": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2025/1031b/25q2-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2025/1031/25q2-e-fls.ashx",
  },
  "Q3 2026": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2026/0202b/25q3-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2026/0202/25q3-e-fls.ashx",
  },
  "Q4 2026": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2026/0430b/25q4-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2026/0430/25q4-e-fls.ashx",
  },
  "Q1 2027": {
    slides: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2026/0731d/26q1-e-speach.ashx",
    filings: "https://corporate.murata.com/-/media/corporate/about/newsroom/news/irnews/irnews/2026/0731/26q1-e-fls.ashx",
  },
};

export function isMraayRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|calpine|acquisition|factbook|securities.?report/i.test(n);
}

export function isMraayIrPdf(href: string | null | undefined): boolean {
  if (!href || isMraayRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "corporate.murata.com" || host.endsWith(".murata.com"))) return false;
    if (!u.pathname.includes("/irnews/")) return false;
    return /-(?:e-speach|e-fls)\.ashx(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeMraayKnownQuarterDocs(): Map<string, MraayQuarterDocs> {
  return new Map(Object.entries(MRAAY_KNOWN_QUARTER_DOCS));
}
