/**
 * HWM IR seed — 12-31.
 * Howmet Aerospace calendar FY. Slides=Earnings Presentation; Filings=Results press on howmet.com. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type HwmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const HWM_IR_PAGES = [
  "https://www.howmet.com/investors/",
] as const;

export const HWM_KNOWN_QUARTER_DOCS: Readonly<Record<string, HwmQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2023/06/2022-1Q-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2022/05/Howmet-Aerospace-Reports-First-Quarter-2022-Results.pdf",
  },
  "Q2 2022": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2022/08/2022-2Q-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2022/08/Howmet-Aerospace-Reports-Second-Quarter-2022-Results.pdf",
  },
  "Q3 2022": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2023/06/2022-3Q-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2023/06/Howmet-Aerospace-Reports-Third-Quarter-2022-Results.pdf",
  },
  "Q4 2022": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2023/06/2022-4Q-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2023/06/Howmet-Aerospace-Reports-Fourth-Quarter-and-Full-Year-2022-Results.pdf",
  },
  "Q1 2023": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2023/05/2023-1Q-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2023/05/Howmet-Aerospace-Reports-First-Quarter-2023-Results.pdf",
  },
  "Q2 2023": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2023/08/2023-2Q-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2023/08/Howmet-Aerospace-Reports-Second-Quarter-2023-Results.pdf",
  },
  "Q3 2023": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2023/11/Q3-2023-Earnings-Presentation-Final.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2023/11/Q3-2023-Earnings-Press-Release-Final.pdf",
  },
  "Q4 2023": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2024/02/2023-Q4-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2024/02/2023-Q4-Earnings-Press-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2024/05/2024-Q1-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2024/05/2024-Q1-Earnings-Press-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2024/07/2024-Q2-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2024/07/2024-Q2-Earnings-Press-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2024/11/Howmet-Aerospace-2024-Q3-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2024/11/Howmet-Aerospace-Reports-Third-Quarter-2024-Results.pdf",
  },
  "Q4 2024": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2025/02/Howmet-Aerospace-2024-Q4-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2025/02/Howmet-Aerospace-Reports-Fourth-Quarter-and-Full-Year-2024-Results.pdf",
  },
  "Q1 2025": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2025/05/Howmet-Aerospace-2025-Q1-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2025/05/Howmet-Aerospace-Reports-First-Quarter-2025-Results.pdf",
  },
  "Q2 2025": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2025/07/2025-Q2-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2025/07/Howmet-Aerospace-Reports-Second-Quarter-2025-Results.pdf",
  },
  "Q3 2025": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2025/10/Howmet-Aerospace-2025-Q3-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2025/10/Howmet-Aerospace-Reports-Third-Quarter-2025-Results.pdf",
  },
  "Q4 2025": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2026/02/Howmet-Aerospace-2025-Q4-FY-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2026/02/Howmet-Aerospace-Reports-Fourth-Quarter-and-Full-Year-2025-Results.pdf",
  },
  "Q1 2026": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2026/05/2026-Q1-Earnings-Presentation-Final.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2026/05/Howmet-Aerospace-Reports-First-Quarter-2026-Results.pdf",
  },
  "Q2 2026": {
    slides: "https://www.howmet.com/wp-content/uploads/sites/3/2026/08/Howmet-Aerospace-2026-Q2-Earnings-Presentation.pdf",
    filings: "https://www.howmet.com/wp-content/uploads/sites/3/2026/08/Howmet-Aerospace-Reports-Second-Quarter-2026-Results.pdf",
  },
};

export function isHwmRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab/i.test(n);
}

export function isHwmIrPdf(href: string | null | undefined): boolean {
  if (!href || isHwmRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.howmet.com" || host.endsWith(".howmet.com"))) return false;
    if (!u.pathname.includes("/wp-content/uploads/sites/3/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeHwmKnownQuarterDocs(): Map<string, HwmQuarterDocs> {
  return new Map(Object.entries(HWM_KNOWN_QUARTER_DOCS));
}
