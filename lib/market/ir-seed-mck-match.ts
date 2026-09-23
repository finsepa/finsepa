/**
 * MCK IR seed — 03-31.
 * McKesson March 31 FY confirmed (Q1=Apr–Jun, Q4=YE Mar). Labels=issuer fiscal. Slides=DocumentCategory presentation; Filings=DocumentCategory news (Earnings/Press Release). From FinancialReport.svc. Reject transcript/10-Q/10-K/webcast. Latest Q1 2027. Never SEC HTML. Scope stats: 21 green / 0 yellow / 0 red quarter(s). All locked URLs Range-GET %PDF.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type MckQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MCK_IR_PAGES = [
  "https://investor.mckesson.com/overview/default.aspx",
] as const;

export const MCK_KNOWN_QUARTER_DOCS: Readonly<Record<string, MckQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2022/q1/MCK-Q1-FY22-Presentation-Final.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2022/q1/MCK-Q1FY22-Press-Release_FINAL.pdf",
  },
  "Q2 2022": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2022/q2/MCK-Q2-FY22-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2022/q2/MCK-Q2-FY22-Earnings-Press-Release_FINAL.pdf",
  },
  "Q3 2022": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2022/q3/MCK-Q3-FY22-Earnings-Presentation_FINAL-1.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2022/q3/MCK-Q3-FY22-Earnings-Release_FINAL.pdf",
  },
  "Q4 2022": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2022/q4/MCK-Q4-FY22-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2022/q4/MCK-Q4-FY22-Earnings-Release_FINAL.pdf",
  },
  "Q1 2023": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2023/q1/MCK-Q1-FY23-PresentationSlides_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2023/q1/MCK-Q1-FY23-Earnings-Release_FINAL.pdf",
  },
  "Q2 2023": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2023/q2/MCK-Q2-FY23-Earnings-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2023/q2/MCK-Q2-FY23-Earnings-Release_FINAL.pdf",
  },
  "Q3 2023": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2023/q3/MCK-Q3-FY23-Earnings-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2023/q3/MCK-Q3-FY23-Earnings-Release_FINAL.pdf",
  },
  "Q4 2023": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2023/q4/MCK-Q4-FY23-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2023/q4/MCK-Q4-FY23-Earnings-Release_FINAL.pdf",
  },
  "Q1 2024": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2024/q1/MCK-Q1-FY24-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2024/q1/MCK-Q1-FY24-Earnings-Release_FINAL.pdf",
  },
  "Q2 2024": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2024/q2/MCK-Q2-FY24-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2024/q2/MCK-Q2-FY24-Earnings-Release_FINAL-docx.pdf",
  },
  "Q3 2024": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2024/q3/MCK-Q3-FY24-Presentation_FINAL-v2.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2024/q3/MCK-Q3-FY24-Earnings-Release_FINAL.pdf",
  },
  "Q4 2024": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2024/q4/MCK-Q4-FY24-Earnings-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2024/q4/MCK-Q4-FY24-Earnings-Release_FINAL.pdf",
  },
  "Q1 2025": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2025/q1/MCK-Q1-FY25-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2025/q1/MCK-Q1-FY25-Earnings-Release_FINAL.pdf",
  },
  "Q2 2025": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2025/q2/MCK-Q2-FY25-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2025/q2/MCK-Q2-FY25-Earnings-Release_FINAL.pdf",
  },
  "Q3 2025": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2025/q3/MCK-Q3-FY25-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2025/q3/MCK-Q3-FY25-Earnings-Release_FINAL.pdf",
  },
  "Q4 2025": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2025/q4/MCK-Q4-FY25-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2025/q4/MCK-Q4-FY25-Earnings-Release_FINAL.pdf",
  },
  "Q1 2026": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2026/q1/MCK-Q1-FY26-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2026/q1/MCK-Q1-FY26-Earnings-Release_FINAL.pdf",
  },
  "Q2 2026": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2026/q2/MCK-Q2-FY26-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2026/q2/MCK-Q2-FY26-Earnings-Release_FINAL.pdf",
  },
  "Q3 2026": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2026/q3/MCK-Q3-FY26-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2026/q3/MCK-Q3-FY26-Earnings-Release_FINAL.pdf",
  },
  "Q4 2026": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2026/q4/MCK-Q4-FY26-Presentation.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2026/q4/MCK-Q4-FY26-Earnings-Release_FINAL.pdf",
  },
  "Q1 2027": {
    slides: "https://s24.q4cdn.com/128197368/files/doc_financials/2027/q1/MCK-Q1-FY27-Presentation_FINAL.pdf",
    filings: "https://s24.q4cdn.com/128197368/files/doc_financials/2027/q1/MCK-Q1-FY27-Earnings-Release_FINAL.pdf",
  }
};

export function isMckRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isMckIrPdf(href: string | null | undefined): boolean {
  if (!href || isMckRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s24.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/128197368/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeMckKnownQuarterDocs(): Map<string, MckQuarterDocs> {
  return new Map(Object.entries(MCK_KNOWN_QUARTER_DOCS));
}
