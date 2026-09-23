/**
 * ENB IR seed — 12-31.
 * Enbridge calendar FY (Dec 31). Slides={year}_Q{n}_Earnings_Presentation_Final.pdf on enbridge.com media. Filings=null: earnings news releases are HTML on enbridge.com/media-center and enbridge.mediaroom.com — no first-party press PDF pattern found (probed News_Release/Press_Release/Earnings_Release variants). Reject Financial_Statements_MDA / Supplemental_Package / Transcript / 10-Q. Scope Q1 2022→Q2 2026. 0 green / 18 yellow / 0 red. All slides Range-GET %PDF. Ticker YELLOW.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type EnbQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ENB_IR_PAGES = [
  "https://www.enbridge.com/investment-center",
] as const;

export const ENB_KNOWN_QUARTER_DOCS: Readonly<Record<string, EnbQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2022/2022_Q1_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2022/2022_Q2_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q3 2022": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2022/2022_Q3_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2022/2022_Q4_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q1 2023": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2023/2023_Q1_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2023/2023_Q2_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2023/2023_Q3_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2023/2023_Q4_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q1 2024": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2024/2024_Q1_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2024/2024_Q2_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q3 2024": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2024/2024_Q3_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2024/2024_Q4_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q1 2025": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2025/2025_Q1_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2025/2025_Q2_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q3 2025": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2025/2025_Q3_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2025/2025_Q4_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q1 2026": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2026/2026_Q1_Earnings_Presentation_Final.pdf",
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www.enbridge.com/~/media/Enb/Documents/Investor-Relations/2026/2026_Q2_Earnings_Presentation_Final.pdf",
    filings: null,
  }
};

export function isEnbRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isEnbIrPdf(href: string | null | undefined): boolean {
  if (!href || isEnbRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.enbridge.com" || host.endsWith(".enbridge.com"))) return false;
    if (!(/\/investor-relations\//i.test(u.pathname) || u.pathname.includes("/~/media/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeEnbKnownQuarterDocs(): Map<string, EnbQuarterDocs> {
  return new Map(Object.entries(ENB_KNOWN_QUARTER_DOCS));
}
