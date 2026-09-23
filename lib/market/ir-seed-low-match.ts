/**
 * LOW IR seed — late January (01-31).
 * Lowe's late-Jan FY. Filings=earnings/press release PDFs on corporate.lowes.com. Slides=null — IR only publishes infographics (not locked as decks). Never 10-Q/transcript/nongaap. Labels follow IR year folders Q1 2022→Q2 2026.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type LowQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const LOW_IR_PAGES = [
  "https://corporate.lowes.com/investors/financial-information/quarterly-earnings/year/2026",
] as const;

export const LOW_KNOWN_QUARTER_DOCS: Readonly<Record<string, LowQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2022-05/lowes-q1-press-release-final.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/q2-2022-earnings-release-08-17-2022.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2022-11/q3-2022-earnings-press-release.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/q4-2022-earnings-press-release-v1.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2023-05/q1-2023-earnings-press-release.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2023-08/q2-2023-earnings-press-release.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2023-11/q3-2023-earnings-release.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2024-02/q4-2023-earnings-release.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2024-05/q1-2024-earnings-release.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/q2-2024-earnings-release.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2024-11/q3-2024-earnings-release.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/2025-02/q4-2024-earnings-release.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/lowes-q1-2025-press-release-updated.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/lowes-q2-2025-press-release.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/lowes-q3-2025-press-release.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/Quaterly-results/Lowes-Q4-2025-Press-Release-Final.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/q1-2026-earnings/lowes-q1-2026-press-release-final.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://corporate.lowes.com/sites/lowes-corp/files/q2-2026-earnings/lowes-q2-2026-press-release_0.pdf",
  }
};

export function isLowRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|infographic|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isLowIrPdf(href: string | null | undefined): boolean {
  if (!href || isLowRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "corporate.lowes.com" || host.endsWith(".lowes.com"))) return false;
    if (!u.pathname.includes("/sites/lowes-corp/files/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeLowKnownQuarterDocs(): Map<string, LowQuarterDocs> {
  return new Map(Object.entries(LOW_KNOWN_QUARTER_DOCS));
}
