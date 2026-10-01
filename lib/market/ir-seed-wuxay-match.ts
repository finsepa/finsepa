/**
 * WUXAY IR seed — 12-31.
 * WuXi AppTec ADR (WUXAY); calendar FY. Slides=Results Presentation; Filings=English results announcement (fallback quarterly/interim/annual report PDF) on officialsite-static.wuxiapptec.com/upload via /api/ymkd/v1/irMaterial. Prefer announcement over profit-alert/report. Reject Investor Day / JPM conference decks. Scope Q1 2022→Q2 2026 (18 green / 0 yellow / 0 red). Range-GET %PDF verified. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type WuxayQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const WUXAY_IR_PAGES = [
  "https://www.wuxiapptec.com/investors",
] as const;

export const WUXAY_KNOWN_QUARTER_DOCS: Readonly<Record<string, WuxayQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/6a/20220425/WuXi%20AppTec%202022Q1%20Results%20Presentation_UPLOAD.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/b1/20220617/2022%20FIRST%20QUARTERLY%20REPORT.pdf",
  },
  "Q2 2022": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/f0/20221020/2022-1H%20Results%20Presentation%20EN_FINAL-v5.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/54/20220728/ANNOUNCEMENT%20OF%20THE%20UNAUDITED%20INTERIM%20RESULTS.pdf",
  },
  "Q3 2022": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/f0/20221026/2022-Q3%20Results%20Presentation%20EN_vF.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/ef/20221115/2022Q3%20Report-2022102601272.pdf",
  },
  "Q4 2022": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/cd/20230320/2022%20Annual%20Results%20Presentation%20EN_vF-UPLOAD.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/50/20230323/2023032001669.pdf",
  },
  "Q1 2023": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/14/20230505/2023Q1%20Results%20Presentation%20EN_v7.1%20final.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/73/20230505/2023042402410.pdf",
  },
  "Q2 2023": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/83/20230731/2023H1%E4%B8%9A%E7%BB%A9%E6%BC%94%E7%A4%BA%E6%9D%90%E6%96%99%20EN_vF%2020230731.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/df/20231130/ANNOUNCEMENT%20OF%20THE%20UNAUDITED%20INTERIM%20RESULTS%20FOR%20THE%20SIX%20MONTHS%20ENDED%20JUNE%2030%2C%202023.pdf",
  },
  "Q3 2023": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/96/20231030/WXAT%2023Q3%20Results%20Presentation%2020231030.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/1b/20231031/WXAT%202023Q3%20Report%2020231030.pdf",
  },
  "Q4 2023": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/fc/20240318/WXAT%202023%20Annual%20Results%20Presentation%2020240318.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/df/20240318/ANNOUNCEMENT%20OF%20THE%20ANNUAL%20RESULTS%20FOR%20THE%20YEAR%20ENDED%20DECEMBER%2031%2C%202023.pdf",
  },
  "Q1 2024": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/d9/20240429/2024Q1%E4%B8%9A%E7%BB%A9%E6%BC%94%E7%A4%BA%E6%9D%90%E6%96%99%20EN_vF.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/a5/20240429/2024%20FIRST%20QUARTERLY%20REPORT.pdf",
  },
  "Q2 2024": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/00/20240731/WXAT%202024%20Interim%20Results%20Presentation%2020240729.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/80/20240729/ANNOUNCEMENT%20OF%20THE%20UNAUDITED%20INTERIM%20RESULTS%20FOR%20THE%20SIX%20MONTHS%20ENDED%20JUNE%2030%2C%202024.pdf",
  },
  "Q3 2024": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/WXAT_2024_Q3_Results_Presentation_v_Final_018887e04c.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/2024_THIRD_QUARTERLY_REPORT_e66a02b345.pdf",
  },
  "Q4 2024": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/WXAT_2024_Annual_Results_Presentation_vfinal_77092fc2d1.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/ANNOUNCEMENT_OF_THE_ANNUAL_RESULTS_FOR_THE_YEAR_ENDED_DECEMBER_31_2024_ad696b95ad.pdf",
  },
  "Q1 2025": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/WXAT_2025_Q1_Results_Presentation_v_Final_5c8059b074.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/2025_FIRST_QUARTERLY_REPORT_84372c31fe.pdf",
  },
  "Q2 2025": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/WXAT_2025_H1_Results_Presentation_v_F_75ba855f4d.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/ANNOUNCEMENT_OF_THE_UNAUDITED_INTERIM_RESULTS_FOR_THE_SIX_MONTHS_ENDED_JUNE_30_2025_0c13c93fd7.pdf",
  },
  "Q3 2025": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/WXAT_2025_Q3_Results_Presentation_v_F_fba73ad256.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/2025_THIRD_QUARTERLY_REPORT_adbb600ce4.pdf",
  },
  "Q4 2025": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/WXAT_2025_Annual_Results_Presentation_b158bead6f.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/ANNOUNCEMENT_OF_THE_ANNUAL_RESULTS_FOR_THE_YEAR_ENDED_DECEMBER_31_2025_c767786fef.pdf",
  },
  "Q1 2026": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/WXAT_2026_Q1_Results_Presentation_2aaa77f0b4.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/2026_FIRST_QUARTERLY_REPORT_2e4756e97e.pdf",
  },
  "Q2 2026": {
    slides: "https://officialsite-static.wuxiapptec.com/upload/WXAT_2026_H1_Results_Presentation_4b5c257d31.pdf",
    filings: "https://officialsite-static.wuxiapptec.com/upload/Financial_Report_9281057073.pdf",
  },
};

export function isWuxayRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isWuxayIrPdf(href: string | null | undefined): boolean {
  if (!href || isWuxayRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "officialsite-static.wuxiapptec.com" || host.endsWith(".wuxiapptec.com"))) return false;
    if (!u.pathname.includes("/upload/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeWuxayKnownQuarterDocs(): Map<string, WuxayQuarterDocs> {
  return new Map(Object.entries(WUXAY_KNOWN_QUARTER_DOCS));
}
