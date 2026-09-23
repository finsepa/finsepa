/**
 * ICE IR seed — 12-31.
 * Intercontinental Exchange calendar FY. Slides=Earnings Presentation; Filings=Earnings Press Release on s2.q4cdn.com/154085107/files/doc_financials/{y}/q{n}/. Q2 2026 slides missing on CDN (press only). Reject transcripts/10-Q/10-K. Scope: 17g / 1y / 0r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type IceQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ICE_IR_PAGES = [
  "https://ir.theice.com/financials/quarterly-results/default.aspx",
] as const;

export const ICE_KNOWN_QUARTER_DOCS: Readonly<Record<string, IceQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2022/q1/1Q22-Earnings-Presentation_vF-2.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2022/q1/1Q22-Earnings-Press-Release_vF.pdf",
  },
  "Q2 2022": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2022/q2/2Q22-Earnings-Presentation_v11.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2022/q2/2Q22-Earnings-Press-Release_vF.pdf",
  },
  "Q3 2022": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2022/q3/3Q22-Earnings-Presentation_vF.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2022/q3/3Q22-Earnings-Press-Release_vF.pdf",
  },
  "Q4 2022": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2022/q4/4Q22-Earnings-Presentation_vF.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2022/q4/4Q22-Earnings-Press-Release_vF.pdf",
  },
  "Q1 2023": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2023/q1/1Q23-Earnings-Presentation_vFINAL.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2023/q1/1Q23-Earnings-Press-Release_vF.pdf",
  },
  "Q2 2023": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2023/q2/2Q23-Earnings-Presentation_vFINAL.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2023/q2/2Q23-Earnings-Press-Release_vF.pdf",
  },
  "Q3 2023": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2023/q3/3Q23-Earnings-Presentation_vFINAL.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2023/q3/3Q23-Earnings-Press-Release_vF.pdf",
  },
  "Q4 2023": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2023/q4/4Q23-Earnings-Presentation_vFINAL.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2023/q4/4Q23-Earnings-Press-Release_vFINAL.pdf",
  },
  "Q1 2024": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2024/q1/1Q24-Earnings-Presentation_vF.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2024/q1/1Q24-Earnings-Press-Release_vFINAL.pdf",
  },
  "Q2 2024": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2024/q2/2Q24-Earnings-Presentation_vF.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2024/q2/2Q24-Earnings-Press-Release_vF.pdf",
  },
  "Q3 2024": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2024/q3/3Q24-Earnings-Presentation_vFINAL.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2024/q3/3Q24-Earnings-Press-Release-vF.pdf",
  },
  "Q4 2024": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2024/q4/4Q24-Earnings-Presentation_vFinal.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2024/q4/4Q24-Earnings-Press-Release_vFinal.pdf",
  },
  "Q1 2025": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2025/q1/1Q25-Earnings-Presentation_vFINAL.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2025/q1/1Q25-Earnings-Press-Release_vFINAL.pdf",
  },
  "Q2 2025": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2025/q2/2Q25-Earnings-Presentation_vFINAL.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2025/q2/2Q25-Earnings-Press-Release_vFINAL.pdf",
  },
  "Q3 2025": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2025/q3/3Q25-Earnings-Presentation.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2025/q3/3Q25-Earnings-Press-Release_FINAL.pdf",
  },
  "Q4 2025": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2025/q4/4Q25-Earnings-Presentation_Final.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2025/q4/4Q25-Earnings-Press-Release_Final.pdf",
  },
  "Q1 2026": {
    slides: "https://s2.q4cdn.com/154085107/files/doc_financials/2026/q1/1Q26-Earnings-Presentation_Final.pdf",
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2026/q1/1Q26-Earnings-Press-Release_Final.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://s2.q4cdn.com/154085107/files/doc_financials/2026/q2/2Q26-Earnings-Press-Release_Final.pdf",
  },
};

export function isIceRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isIceIrPdf(href: string | null | undefined): boolean {
  if (!href || isIceRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s2.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/154085107/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeIceKnownQuarterDocs(): Map<string, IceQuarterDocs> {
  return new Map(Object.entries(ICE_KNOWN_QUARTER_DOCS));
}
