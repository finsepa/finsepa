/**
 * SNHIY IR seed — 12-31.
 * Sany Heavy ADR calendar FY. Filings-only SSE/cninfo/dfcfw + HKEX English from Q4’25 (no decks). Latest Q2 2026. Scope stats: 0 green / 18 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type SnhiyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const SNHIY_IR_PAGES = [
  "https://www.sany.com.cn/en/relation",
] as const;

export const SNHIY_KNOWN_QUARTER_DOCS: Readonly<Record<string, SnhiyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://static.cninfo.com.cn/finalpage/2022-04-29/1213222802.PDF",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202208301577858187_1.pdf?1661925167000.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202210281579597752_1.pdf?1666986300000.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://static.cninfo.com.cn/finalpage/2023-04-01/1216302513.PDF",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202304251585835779_1.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://static.cninfo.com.cn/finalpage/2023-08-31/1217719259.PDF",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202310301605713920_1.pdf?1698695618000.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202404281631527637_1.pdf?1714323565000.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://static.cninfo.com.cn/finalpage/2024-04-29/1219890320.PDF",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202408291639569153_1.pdf?1724957113000.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://static.cninfo.com.cn/finalpage/2024-10-31/1221572403.PDF",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202504171658000039_1.pdf?1744921331000.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202504291664466527_1.pdf?1745943250000.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://static.cninfo.com.cn/finalpage/2025-08-22/1224536360.PDF",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://pdf.dfcfw.com/pdf/H2_AN202510301771918834_1.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0330/2026033002430.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042906196.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0828/2026082803636.pdf",
  },
};

export function isSnhiyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isSnhiyIrPdf(href: string | null | undefined): boolean {
  if (!href || isSnhiyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(
      host === "www1.hkexnews.hk" || host.endsWith(".hkexnews.hk") ||
      host === "static.cninfo.com.cn" || host.endsWith(".cninfo.com.cn") ||
      host === "pdf.dfcfw.com" || host.endsWith(".dfcfw.com")
    )) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeSnhiyKnownQuarterDocs(): Map<string, SnhiyQuarterDocs> {
  return new Map(Object.entries(SNHIY_KNOWN_QUARTER_DOCS));
}
