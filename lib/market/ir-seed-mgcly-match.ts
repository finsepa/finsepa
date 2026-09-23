/**
 * MGCLY IR seed — 12-31.
 * Midea Group ADR calendar FY. Slides=Results Snapshot; Filings=press/financial reports on midea.com.cn/content/dam. Latest Q4 2025. Scope stats: 4 green / 12 yellow / 2 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type MgclyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MGCLY_IR_PAGES = [
  "https://www.midea.com.cn/en/Investors",
  "https://www.midea.com.cn/en/Investors/Financial_Reports",
] as const;

export const MGCLY_KNOWN_QUARTER_DOCS: Readonly<Record<string, MgclyQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2022/MideaGroup-Annual-Report-2021-Q1-2022-Snapshot-April2022-pdf-coredownload-inline-1-.pdf",
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BB/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BB%E6%96%87%E4%BB%B6%E6%80%BB%E8%A7%88/2022Q12022%E5%B9%B4%E7%AC%AC%E4%B8%80%E5%AD%A3%E5%BA%A6%E6%8A%A5%E5%91%8A%E5%85%A8%E6%96%87-pdf-coredownload-inline.pdf.coredownload.inline.pdf",
  },
  "Q2 2022": {
    slides: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2022/MideaGroup-Semi-Annual-Results-2022-Snapshot-October2022-pdf-pdf-coredownload-inline.pdf.coredownload.inline.pdf",
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BB/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BB%E6%96%87%E4%BB%B6%E6%80%BB%E8%A7%88/2022H1%E7%BE%8E%E7%9A%84%E9%9B%86%E5%9B%A22022%E5%B9%B4%E5%8D%8A%E5%B9%B4%E5%BA%A6%E6%8A%A5%E5%91%8A-PDF-coredownload-inline.pdf.coredownload.inline.pdf",
  },
  "Q3 2022": {
    slides: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2022/MideaGroup-Q3-Results-2022-Snapshot-November-2022-pdf-coredownload-inline.pdf.coredownload.inline.pdf",
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BB/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BB%E6%96%87%E4%BB%B6%E6%80%BB%E8%A7%88/2022Q3%E7%BE%8E%E7%9A%84%E9%9B%86%E5%9B%A22022%E5%B9%B4%E7%AC%AC%E4%B8%89%E5%AD%A3%E5%BA%A6%E6%8A%A5%E5%91%8A-PDF-coredownload-inline.pdf.coredownload.inline.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2022/MideaGroup-Annual-Report-2022-April-2023-pdf-coredownload-inline.pdf.coredownload.inline.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2023/Midea-Group-Q1-Financial-Report.pdf.coredownload.inline.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2023/Midea-Group-Semi-Annual-Report-2023.pdf.coredownload.inline.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2023/Midea-Group-Q3-Financial-Report.pdf.coredownload.inline.pdf",
  },
  "Q4 2023": {
    slides: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2023/MideaGroup-AnnualReport2023-Snapshot-March2024-pdf-pdf-coredownload-inline.pdf.coredownload.inline.pdf",
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2023/MideaGroup-Annual-Report-2023-April-2024-pdf-pdf-coredownload-inline.pdf.coredownload.inline.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2024/Midea-Group-Q1-Financial-Report-2024.PDF.coredownload.inline.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2024/Midea-Group-Semi-Annual-Financial-Report-2024.PDF.coredownload.inline.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2024/Midea-Group-Q3-Financial-Report-2024.PDF.coredownload.inline.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2024/%E7%BE%8E%E7%9A%84%E9%9B%86%E5%9B%A2-2024%E5%B9%B4%E5%B9%B4%E5%BA%A6%E6%8A%A5%E5%91%8A-%E8%8B%B1%E6%96%87%E7%89%88-.pdf.coredownload.inline.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2025/%E7%BE%8E%E7%9A%84%E9%9B%86%E5%9B%A2-2025%E5%B9%B4%E4%B8%80%E5%AD%A3%E5%BA%A6%E6%8A%A5%E5%91%8A-%E8%8B%B1%E6%96%87%E7%89%88-.pdf.coredownload.inline.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2025/%E7%BE%8E%E7%9A%84%E9%9B%86%E5%9B%A2-2025%E5%8D%8A%E5%B9%B4%E5%BA%A6%E6%8A%A5%E5%91%8A-%E8%8B%B1%E6%96%87%E7%89%88-.pdf.coredownload.inline.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BBen/%E8%8B%B1%E6%96%87%E8%B4%A2%E5%8A%A1%E6%8A%A5%E5%91%8A/2025/%E7%BE%8E%E7%9A%84%E9%9B%86%E5%9B%A2-2025%E5%B9%B4%E4%B8%89%E5%AD%A3%E5%BA%A6%E6%8A%A5%E5%91%8A-%E8%8B%B1%E6%96%87%E7%89%88-.pdf.coredownload.inline.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://www.midea.com.cn/content/dam/mideacn-aem/%E6%8A%95%E8%B5%84%E8%80%85%E5%85%B3%E7%B3%BB/2025%E5%B9%B4%E5%BA%A6%E6%8A%A5%E5%91%8A.pdf.coredownload.inline.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: null,
    filings: null,
  },
};

export function isMgclyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isMgclyIrPdf(href: string | null | undefined): boolean {
  if (!href || isMgclyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.midea.com.cn" || host.endsWith(".midea.com.cn"))) return false;
    if (!u.pathname.includes("/content/dam/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeMgclyKnownQuarterDocs(): Map<string, MgclyQuarterDocs> {
  return new Map(Object.entries(MGCLY_KNOWN_QUARTER_DOCS));
}
