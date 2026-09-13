/**
 * AT&T (T) IR — calendar FY.
 * Slides = Earnings_Slides when present, else Highlights PDF (issuer deck substitute).
 * Filings = Earnings_Release / News_Release / Press_Release / Release.
 * Never transcript / SEC HTML / xlsx / trending schedule / 8-K shell.
 */

export type TQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const ATT_BASE =
  "https://investors.att.com/~media/Files/A/ATT-IR-V2/financial-reports/quarterly-earnings";

function att(path: string): string {
  return `${ATT_BASE}/${path}`;
}

export const T_IR_PAGES = [
  "https://investors.att.com/financial-reports/quarterly-earnings",
] as const;

/** Browser-verified from investors.att.com quarterly-earnings media paths. */
export const T_KNOWN_QUARTER_DOCS: Readonly<Record<string, TQuarterDocs>> = {
  "Q2 2026": {
    slides: att("2026/2Q-2026/2Q26_ATT_Earnings_Slides.pdf"),
    filings: att("2026/2Q-2026/2Q26_ATT_Earnings_Release.pdf"),
  },
  "Q1 2026": {
    slides: att("2026/1Q-2026/1Q26_ATT_Earnings_Slides.pdf"),
    filings: att("2026/1Q-2026/ATT_1Q26_Earnings_Release.pdf"),
  },
  "Q3 2026": {
    slides: null,
    filings: att("2026/3Q-2026/3q26-att-investor-news-items.pdf"),
  },
  "Q4 2025": {
    slides: att("2025/4Q-2025/4Q25_ATT_Earnings_Slides.pdf"),
    filings: att("2025/4Q-2025/ATT_4Q25_Earnings_Release.pdf"),
  },
  "Q3 2025": {
    slides: att("2025/3Q-2025/3Q25_ATT_Highlights.pdf"),
    filings: att("2025/3Q-2025/3Q25_ATT_News_Release.pdf"),
  },
  "Q2 2025": {
    slides: att("2025/2Q-2025/2Q25_ATT_Highlights.pdf"),
    filings: att("2025/2Q-2025/2Q25_ATT_Earnings_News_Release.pdf"),
  },
  "Q1 2025": {
    slides: att("2025/1Q-2025/1Q25_ATT_Highlights.pdf"),
    filings: att("2025/1Q-2025/1Q25_ATT_News_Release.pdf"),
  },
  "Q4 2024": {
    slides: att("2024/4Q24/4Q24_ATT_Highlights.pdf"),
    filings: att("2024/4Q24/4Q24_Earnings_Press_Release.pdf"),
  },
  "Q3 2024": {
    slides: att("2024/3Q24/3Q24_ATT_Highlights.pdf"),
    filings: att("2024/3Q24/3Q24_ATT_Earnings_Release.pdf"),
  },
  "Q2 2024": {
    slides: att("2024/2Q24/2Q24_ATT_Highlights.pdf"),
    filings: att("2024/2Q24/2Q24_ATT_News_Release.pdf"),
  },
  "Q1 2024": {
    slides: att("2024/1Q24/1Q24_Highlights.pdf"),
    filings: att("2024/1Q24/1Q24_ATT_News_Release.pdf"),
  },
  "Q4 2023": {
    slides: att("2023/4q-2023/4Q23_ATT_Highlights.pdf"),
    filings: att("2023/4q-2023/4Q23_ATT_Earnings_Release.pdf"),
  },
  "Q3 2023": {
    slides: att("2023/3q-2023/3Q23_Highlights.pdf"),
    filings: att("2023/3q-2023/3Q23_ATT_Earnings_Release.pdf"),
  },
  "Q2 2023": {
    slides: att("2023/2q-2023/ATT_2Q23_Highlights.pdf"),
    filings: att("2023/2q-2023/ATT_2Q23_Earnings_Release.pdf"),
  },
  "Q1 2023": {
    slides: att("2023/1Q23/ATT_1Q23_Highlights.pdf"),
    filings: att("2023/1Q23/ATT_1Q23_Earnings_Release.pdf"),
  },
  "Q4 2022": {
    slides: att("2022/4Q22/ATT_4Q22_Highlights.pdf"),
    filings: att("2022/4Q22/ATT_4Q22_Earnings_Release.pdf"),
  },
  "Q3 2022": {
    slides: att("2022/3Q22/ATT_3Q22_Highlights.pdf"),
    filings: att("2022/3Q22/ATT_3Q22_Earnings_Release.pdf"),
  },
  "Q2 2022": {
    slides: att("2022/2Q22/T_2Q22_Highlights.pdf"),
    filings: att("2022/2Q22/ATT_2Q22_Release.pdf"),
  },
  "Q1 2022": {
    slides: att("2022/1Q22/ATT_1Q22_Highlights.pdf"),
    filings: att("2022/1Q22/ATT_1Q22_Earnings_Release.pdf"),
  },
};

export function isTRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|\.xlsx?|trending[-_\s]*schedule|8-?k|10-?q|10-?k/i.test(n);
}

export function isTIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "investors.att.com" || u.hostname.endsWith(".att.com"))) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return (
      u.pathname.includes("/ATT-IR-V2/financial-reports/quarterly-earnings/") && !isTRejected(url)
    );
  } catch {
    return false;
  }
}

export function mergeTKnownQuarterDocs(): Map<string, TQuarterDocs> {
  return new Map(Object.entries(T_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
