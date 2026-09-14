/**
 * Boeing (BA) IR — calendar FY.
 * Slides = quarterly Presentation; Filings = Earnings / Press Release PDF (incl. Ex 99.1 on CDN).
 * Never transcript / 10-Q / 10-K / webcast / SEC HTML / cloudfront.
 */

export type BaQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const BA_CDN = "https://s2.q4cdn.com/661678649/files/doc_financials";

export const BA_IR_PAGES = [
  "https://investors.boeing.com/investors/financial-reports/default.aspx",
  "https://investors.boeing.com/",
] as const;

/** From FinancialReport.svc (DocumentCategory Presentation + News Release / Earnings Release). */
export const BA_KNOWN_QUARTER_DOCS: Readonly<Record<string, BaQuarterDocs>> = {
  "Q2 2026": {
    slides: `${BA_CDN}/2026/q2/Presentation.pdf`,
    filings: `${BA_CDN}/2026/q2/Press-Release.pdf`,
  },
  "Q1 2026": {
    slides: `${BA_CDN}/2026/q1/Presentation.pdf`,
    filings: `${BA_CDN}/2026/q1/Press-Release.pdf`,
  },
  "Q4 2025": {
    slides: `${BA_CDN}/2025/q4/updated/Presentation.pdf`,
    filings: `${BA_CDN}/2025/q4/Press-Release.pdf`,
  },
  "Q3 2025": {
    slides: `${BA_CDN}/2025/q3/3Q25-Presentation.pdf`,
    filings: `${BA_CDN}/2025/q3/3Q25-Press-Release.pdf`,
  },
  "Q2 2025": {
    slides: `${BA_CDN}/2025/q2/2Q25-Presentation.pdf`,
    filings: `${BA_CDN}/2025/q2/2Q25-Press-Release.pdf`,
  },
  "Q1 2025": {
    slides: `${BA_CDN}/2025/q1/1Q25-Presentation.pdf`,
    filings: `${BA_CDN}/2025/q1/1Q25-Press-Release.pdf`,
  },
  "Q4 2024": {
    slides: `${BA_CDN}/2024/q4/4Q24-Presentation.pdf`,
    filings: `${BA_CDN}/2024/q4/4Q24-Press-Release.pdf`,
  },
  "Q3 2024": {
    slides: `${BA_CDN}/2024/q3/3Q24-Presentation.pdf`,
    filings: `${BA_CDN}/2024/q3/3Q24-Press-Release.pdf`,
  },
  "Q2 2024": {
    slides: `${BA_CDN}/2024/q2/2Q24-Earnings-Presentation.pdf`,
    filings: `${BA_CDN}/2024/q2/2024-06-Jun-30-8K-PR-Ex-99-1.pdf`,
  },
  "Q1 2024": {
    slides: `${BA_CDN}/2024/q1/1Q24-Earnings-Presentation.pdf`,
    filings: `${BA_CDN}/2024/q1/2024-03-Mar-31-8K-PR-Ex-99-1.pdf`,
  },
  "Q4 2023": {
    slides: `${BA_CDN}/2023/q4/Q423-Earnings-Presentation.pdf`,
    filings: `${BA_CDN}/2023/q4/2023-12-Dec-31-8K-PR-Ex-99-1.pdf`,
  },
  "Q3 2023": {
    slides: `${BA_CDN}/2023/q3/3Q23-Presentation.pdf`,
    filings: `${BA_CDN}/2023/q3/2023-09-Sep-30-8K-PR-Ex-99-1.pdf`,
  },
  "Q2 2023": {
    slides: `${BA_CDN}/2023/q2/2Q23-Presentation.pdf`,
    filings: `${BA_CDN}/2023/q2/2023-06-Jun-30-8K-PR-Ex-99-1.pdf`,
  },
  "Q1 2023": {
    slides: `${BA_CDN}/2023/q1/1Q23-Earnings-Presentation.pdf`,
    filings: `${BA_CDN}/2023/q1/2023-03-Mar-31-8K-PR-Ex-99-1.pdf`,
  },
  "Q4 2022": {
    slides: `${BA_CDN}/2022/q4/4Q22-Presentation.pdf`,
    filings: `${BA_CDN}/2022/q4/4Q22-Press-Release.pdf`,
  },
  "Q3 2022": {
    slides: `${BA_CDN}/2022/q3/3Q22_Presentation.pdf`,
    filings: `${BA_CDN}/2022/q3/3Q22-Press-Release.pdf`,
  },
  "Q2 2022": {
    slides: `${BA_CDN}/2022/q2/2Q22-Presentation.pdf`,
    filings: `${BA_CDN}/2022/q2/2Q22-Press-Release.pdf`,
  },
  "Q1 2022": {
    slides: `${BA_CDN}/2022/q1/1Q22-Presentation.pdf`,
    filings: `${BA_CDN}/2022/q1/1Q22-Press-Release.pdf`,
  },
};

export function isBaRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|cloudfront\.net|transcript|webcast|10-?q|10-?k|proxy|annual[-_\s]*report|sustainability|\.xls/i.test(
    n,
  );
}

export function isBaIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "s2.q4cdn.com" || host.endsWith(".q4cdn.com") || host.endsWith(".boeing.com"))) {
      return false;
    }
    if (host.includes("q4cdn") && !u.pathname.includes("/661678649/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isBaRejected(url);
  } catch {
    return false;
  }
}

export function mergeBaKnownQuarterDocs(): Map<string, BaQuarterDocs> {
  return new Map(Object.entries(BA_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
