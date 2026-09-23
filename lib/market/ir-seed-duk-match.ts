/**
 * DUK IR seed — 12-31.
 * Duke Energy calendar FY. Slides=Earnings Presentation; Filings=Earnings Release on s201.q4cdn.com/583395453. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type DukQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const DUK_IR_PAGES = [
  "https://www.duke-energy.com/our-company/investors",
] as const;

export const DUK_KNOWN_QUARTER_DOCS: Readonly<Record<string, DukQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_presentation/2022/05/1q22-earnings-presentation-reg-g-copy.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_events/2022/05/09/1q22-earnings-release.pdf",
  },
  "Q2 2022": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_presentation/2022/08/q2-2022-earnings-presentation.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2022/q2/q2-2022-earnings-release.pdf",
  },
  "Q3 2022": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2022/q3/Q3-2022-Earnings-Presentation-vFINAL-(with-Reg-G).pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2022/q3/Q3-2022-Earnings-Release.pdf",
  },
  "Q4 2022": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2022/q4/q4-2022-earnings-presentation-vfinal-(w-reg-g)vF.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2022/q4/Q4-2022-Earnings-Release-Final.pdf",
  },
  "Q1 2023": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2023/q1/Q1-2023-Earnings-Presentation-vFinal-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2023/q1/Q1-2023-Earnings-Release-Final.pdf",
  },
  "Q2 2023": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2023/q2/Q2-2023-Earnings-Presentation-vFinal-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2023/q2/Q2-2023-Earnings-Release-Final.pdf",
  },
  "Q3 2023": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2023/q3/Q3-2023-Earnings-Presentation-vFinal-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2023/q3/Q3-2023-Earnings-Release-Final.pdf",
  },
  "Q4 2023": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2023/q4/Q4-2023-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2023/q4/Q4-2023-Earnings-Release-Final.pdf",
  },
  "Q1 2024": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2024/q1/Q1-2024-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2024/q1/Q1-2024-Earnings-Release-Final.pdf",
  },
  "Q2 2024": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2024/q2/Q2-2024-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2024/q2/Q2-2024-DUK-Earnings-Release_vF.pdf",
  },
  "Q3 2024": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2024/q3/Q3-2024-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2024/q3/Q3-2024-DUK-Earnings-Release_vF.pdf",
  },
  "Q4 2024": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2024/q4/Q4-2024-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2024/q4/Q4-2024-DUK-Earnings-Release_vF.pdf",
  },
  "Q1 2025": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2025/q1/Q1-2025-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2025/q1/Q1-2025-DUK-Earnings-Release_vF.pdf",
  },
  "Q2 2025": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2025/q2/Q2-2025-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2025/q2/Q2-2025-DUK-Earnings-Release_vF.pdf",
  },
  "Q3 2025": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2025/q3/Q3-2025-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2025/q3/Q3-2025-DUK-Earnings-Release_vF.pdf",
  },
  "Q4 2025": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2025/q4/Q4-2025-Earnings-Presentation_vF-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2025/q4/Q4-2025-Earnings-Release-vF.pdf",
  },
  "Q1 2026": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2026/q1/Q1-2026-Earnings-Presentation-w-Reg-G.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2026/q1/Q1-2026-Earnings-Release.pdf",
  },
  "Q2 2026": {
    slides: "https://s201.q4cdn.com/583395453/files/doc_financials/2026/q2/Q2-2026-Earnings-Presentation_vF-w-Reg-G-FINAL.pdf",
    filings: "https://s201.q4cdn.com/583395453/files/doc_financials/2026/q2/Q2-2026-Earnings-Release_vF.pdf",
  },
};

export function isDukRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isDukIrPdf(href: string | null | undefined): boolean {
  if (!href || isDukRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s201.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!u.pathname.includes("/583395453/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeDukKnownQuarterDocs(): Map<string, DukQuarterDocs> {
  return new Map(Object.entries(DUK_KNOWN_QUARTER_DOCS));
}
