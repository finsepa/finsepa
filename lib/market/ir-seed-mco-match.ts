/**
 * MCO IR seed — 12-31.
 * Moody's Corporation calendar FY. Slides=Earnings Presentation / Earnings Webcast / Earnings Supplemental Presentation; Filings=Earnings Release / Press Release on s203.q4cdn.com/694693571/files/doc_financials (plus occasional doc_presentations). Scope: 18 g / 0 y / 0 r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type McoQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MCO_IR_PAGES = [
  "https://ir.moodys.com/financials/quarterly-results/default.aspx",
] as const;

export const MCO_KNOWN_QUARTER_DOCS: Readonly<Record<string, McoQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2022/q1/1Q-2022-Earnings-Webcast-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2022/q1/1Q-2022-Earnings-Release-vFINAL.pdf",
  },
  "Q2 2022": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2022/q2/2Q-2022-Earnings-Webcast-vFINAL-7.26.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2022/q2/2Q-2022-Earnings-Release-vFINAL-_-7.26.pdf",
  },
  "Q3 2022": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2022/q3/3Q22-Earnings-Supplemental-Presentation-Final.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2022/q3/3Q-2022-Earnings-Release-vFINAL.pdf",
  },
  "Q4 2022": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2022/q4/4Q22-Earnings-Supplemental-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2022/q4/4Q-and-FY-2022-Earnings-Release-vFINAL-(1).pdf",
  },
  "Q1 2023": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2023/q1/1Q23-Earnings-Supplemental-Presentation-vFINALv.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2023/q1/1Q23-Earnings-Release-vFINALv.pdf",
  },
  "Q2 2023": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2023/q2/Updated/2q23-earnings-supplemental-presentation-vfinal.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2023/q2/2Q23-Earnings-PR-vFINAL.pdf",
  },
  "Q3 2023": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2023/q3/updated/3q23-earnings-supplemental-presentation-vfinal.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2023/q3/3Q23-Earnings-Release-vFinal.pdf",
  },
  "Q4 2023": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2023/q4/4Q23-Earnings-Supplemental-Presentation_vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2023/q4/4Q23-Earnings-Release-vFINAL.pdf",
  },
  "Q1 2024": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2024/q1/1Q24-Earnings-Supplemental-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2024/q1/1Q24-Earnings-Release-vFINAL.pdf",
  },
  "Q2 2024": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_presentations/2024/Jul/22/2q24-earnings-presentation-vfinal-oct-updt.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2024/q2/2Q24-Earnings-Release-vFINAL.pdf",
  },
  "Q3 2024": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2024/q3/3Q24-Earnings-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2024/q3/3Q24-Earnings-Release-vFINAL.pdf",
  },
  "Q4 2024": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2024/q4/4Q-and-FY-2024-Earnings-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2024/q4/4Q-and-FY-2024-Earnings-Release-vFINAL.pdf",
  },
  "Q1 2025": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2025/q1/1Q25-Earnings-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2025/q1/1Q25-Earnings-Release-vFINAL.pdf",
  },
  "Q2 2025": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2025/q2/2Q25-Earnings-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2025/q2/2Q25-Earnings-Release-vFINAL.pdf",
  },
  "Q3 2025": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2025/q3/3Q25-Earnings-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2025/q3/3Q25-Earnings-Release-vFINAL.pdf",
  },
  "Q4 2025": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2025/q4/4Q25-Earnings-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2025/q4/4Q25-Earnings-Release-vFINAL.pdf",
  },
  "Q1 2026": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2026/q1/1Q26-Earnings-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2026/q1/1Q26-Earnings-Release-vFINAL.pdf",
  },
  "Q2 2026": {
    slides: "https://s203.q4cdn.com/694693571/files/doc_financials/2026/q2/2Q26-Earnings-Presentation-vFINAL.pdf",
    filings: "https://s203.q4cdn.com/694693571/files/doc_financials/2026/q2/2Q26-Earnings-Release-vFINAL.pdf",
  },
};

export function isMcoRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isMcoIrPdf(href: string | null | undefined): boolean {
  if (!href || isMcoRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s203.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/694693571/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeMcoKnownQuarterDocs(): Map<string, McoQuarterDocs> {
  return new Map(Object.entries(MCO_KNOWN_QUARTER_DOCS));
}
