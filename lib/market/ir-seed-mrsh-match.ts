/**
 * MRSH IR seed — 12-31.
 * Marsh (ex-Marsh McLennan / MMC→MRSH) calendar FY. Slides=Investor Presentation on marsh.com content/dam (files-for-download + v2); Filings=News Release PDF same host. Slides solid Q1'24→Q2'26; Q1'22–Q4'23 filings-only (no lockable historical deck URLs found). Reject annual report/proxy/transcripts. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type MrshQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MRSH_IR_PAGES = [
  "https://www.marsh.com/en/about/investor-relations.html",
] as const;

export const MRSH_KNOWN_QUARTER_DOCS: Readonly<Record<string, MrshQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2022/MMC1Q2022NewsRelease.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2022/MMC2Q2022NewsRelease.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2022/MMC3Q2022NewsRelease.pdf",
  },
  "Q4 2022": {
    slides: null,
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2022/MMC4Q2022NewsRelease.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2023/MMC1Q2023NewsRelease.pdf",
  },
  "Q2 2023": {
    slides: null,
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2023/MMC2Q2023NewsRelease.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2023/MMC3Q2023NewsRelease.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2023/MMC-4Q-2023-Earnings-News-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2024/MMC_External_Investor_Presentation_1Q24_vF.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2024/MMC_1Q_2024_News_Release.pdf",
  },
  "Q2 2024": {
    slides: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2024/mmc_external_investor_presentation_2q24.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2024/MMC_2Q_2024_News_Release.pdf",
  },
  "Q3 2024": {
    slides: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2024/mmc-external-investor-presentation-3q24.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/v2/investors/2024/mmc-3q-2024-news-release.pdf",
  },
  "Q4 2024": {
    slides: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2025/pdf-2024-4q-mmc-external-investor-presentation.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2025/mmc-4q-2024-news-release.pdf",
  },
  "Q1 2025": {
    slides: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2025/pdf-2025-marsh-mclennan-1q-investor-presentation.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2025/pdf-2025-marsh-mclennan-investors-1q-news-release.pdf",
  },
  "Q2 2025": {
    slides: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2025/pdf-2025-marsh-mclennan-2q-investor-presentation.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2025/pdf-2025-marsh-mclennan-investors-2q-news-release.pdf",
  },
  "Q3 2025": {
    slides: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2025/pdf-2025-marsh-mclennan-3q-investor-presentation.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2025/pdf-2025-marsh-mclennan-investors-3q-news-release.pdf",
  },
  "Q4 2025": {
    slides: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2026/pdf-2025-marsh-4q-investor-presentation.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2026/pdf-2025-marsh-investors-4q-news-release.pdf",
  },
  "Q1 2026": {
    slides: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2026/pdf-marsh-1q-investor-presentation-2026.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2026/pdf-marsh-investors-1q-news-release-2026.pdf",
  },
  "Q2 2026": {
    slides: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2026/pdf-marsh-2q-investor-presentation-2026.pdf",
    filings: "https://www.marsh.com/content/dam/mmc-web/files-for-download/investors/2026/pdf-marsh-investors-2q-news-release-2026.pdf",
  },
};

export function isMrshRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isMrshIrPdf(href: string | null | undefined): boolean {
  if (!href || isMrshRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.marsh.com" || host === "marsh.com" || host.endsWith(".marsh.com"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeMrshKnownQuarterDocs(): Map<string, MrshQuarterDocs> {
  return new Map(Object.entries(MRSH_KNOWN_QUARTER_DOCS));
}
