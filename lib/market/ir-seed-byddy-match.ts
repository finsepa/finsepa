/**
 * BYDDY IR seed — 12-31.
 * BYD ADR calendar FY. Filings-only HKEX results announcements on www1.hkexnews.hk (no decks). Latest Q2 2026. Scope stats: 0 green / 18 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type ByddyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BYDDY_IR_PAGES = [
  "https://www.bydglobal.com/en/Investor/InvestorAnnals.html",
] as const;

export const BYDDY_KNOWN_QUARTER_DOCS: Readonly<Record<string, ByddyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2022/0427/2022042702316.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2022/0829/2022082901334.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2022/1028/2022102801267.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2023/0328/2023032802287.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2023/0427/2023042703863.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2023/0828/2023082801173.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2023/1030/2023103001032.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2024/0326/2024032602559.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2024/0429/2024042903767.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2024/0828/2024082800846.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2024/1030/2024103001350.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2025/0324/2025032401228.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2025/0425/2025042502125.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2025/0829/2025082902216.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2025/1030/2025103001667.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0327/2026032702644.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0428/2026042803001.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0828/2026082801633.pdf",
  },
};

export function isByddyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isByddyIrPdf(href: string | null | undefined): boolean {
  if (!href || isByddyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www1.hkexnews.hk" || host.endsWith(".hkexnews.hk"))) return false;
    if (!u.pathname.includes("/listedco/listconews/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeByddyKnownQuarterDocs(): Map<string, ByddyQuarterDocs> {
  return new Map(Object.entries(BYDDY_KNOWN_QUARTER_DOCS));
}
