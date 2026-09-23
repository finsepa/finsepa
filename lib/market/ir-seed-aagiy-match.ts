/**
 * AAGIY IR seed — 12-31.
 * AIA Group (AAGIY) calendar FY, semi-annual. HY→Q2, FY→Q4. Slides=Analyst Presentation; Filings=Results Announcement. Q1/Q3 empty (new-business only). Latest Q2 2026 / FY 2025. Scope stats: 9 green / 0 yellow / 9 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type AagiyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const AAGIY_IR_PAGES = [
  "https://www.aia.com/en/investor-relations/results-presentations",
] as const;

export const AAGIY_KNOWN_QUARTER_DOCS: Readonly<Record<string, AagiyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: null,
  },
  "Q2 2022": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2022/AIA%20Group%201H%202022%20Analyst%20Presentation%20Final.pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2022/AIA%20Group%202022%20Interim%20Results%20Ann%20(Eng).pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2023/AIA%20Group%20FY%202022%20Analyst%20Presentation%20Final.pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2023/AIA%20Group%202022%20Annual%20Results%20Ann%20(Eng).pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2023/AIA%20Group%201H%202023%20Analyst%20Presentation%20Final.pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2023/AIA%20Group%202023%20Interim%20Results%20Ann%20(Eng).pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2024/AIA%20Group%20FY%202023%20Analyst%20Presentation%20Final.pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2024/AIA%20Group%202023%20Annual%20Results%20Ann%20(Eng).pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: null,
  },
  "Q2 2024": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2024/AIA%20Group%201H%202024%20Analyst%20Presentation%20Final.pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2024/AIA%20Group%202024%20Interim%20Results%20Ann%20(Eng).pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: null,
  },
  "Q4 2024": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2025/AIA%20Group%202024%20Annual%20Results%20Analyst%20Presentation%20(Final).pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2025/AIA%20Group%202024%20Annual%20Results%20Ann%20(Eng).pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: null,
  },
  "Q2 2025": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2025/AIA%20Group%202025%20Interim%20Results%20Analyst%20Presentation%20(Final).pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2025/AIA%20Group%202025%20Interim%20Results%20Ann%20(Eng).pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2026/AIA%20Group%20FY%202025%20Analyst%20Presentation%20Final.pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2026/AIA%20Group%202025%20Annual%20Results%20Ann%20(Eng).pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2026/AIA%20Group%202026%20Interim%20Results%20Analyst%20Presentation%20Final.pdf",
    filings: "https://www.aia.com/content/dam/group-wise/en/docs/investor-relations/2026/AIA%20Group%202026%20Interim%20Results%20Ann_Eng.pdf",
  },
};

export function isAagiyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|interim.?report|new.?business|supplementary/i.test(n);
}

export function isAagiyIrPdf(href: string | null | undefined): boolean {
  if (!href || isAagiyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.aia.com" || host.endsWith(".aia.com"))) return false;
    if (!(u.pathname.includes("/investor-relations/") || u.pathname.includes("/content/dam/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAagiyKnownQuarterDocs(): Map<string, AagiyQuarterDocs> {
  return new Map(Object.entries(AAGIY_KNOWN_QUARTER_DOCS));
}
