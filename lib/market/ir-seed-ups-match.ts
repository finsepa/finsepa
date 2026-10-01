/**
 * UPS IR seed — 12-31.
 * United Parcel Service calendar FY. Slides=Earnings/Webcast Deck; Filings=UPS Releases news PDF on investors.ups.com/_assets. Reject proxy/10-K/annual report/XLSX. Scope: 18 g / 0 y / 0 r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type UpsQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const UPS_IR_PAGES = [
  "https://investors.ups.com/financials/quarterly-results",
] as const;

export const UPS_KNOWN_QUARTER_DOCS: Readonly<Record<string, UpsQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10637/file/1Q22+Webcast+Deck+_+FINAL2.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2022-04-26_UPS_Releases_1Q_2022_2068.pdf",
  },
  "Q2 2022": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10658/file/2Q22+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2022-07-26_UPS_Releases_2Q_2022_2075.pdf",
  },
  "Q3 2022": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10679/file/3Q22+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2022-10-25_UPS_Releases_3Q_2022_2081.pdf",
  },
  "Q4 2022": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10693/file/4Q22+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2023-01-31_UPS_Releases_4Q_2022_2087.pdf",
  },
  "Q1 2023": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10738/file/1Q23+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2023-04-25_UPS_Releases_1Q_2023_2090.pdf",
  },
  "Q2 2023": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10754/file/2Q23+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2023-08-08_UPS_Releases_2Q_2023_2099.pdf",
  },
  "Q3 2023": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10783/file/3Q23+Webcast+Deck_FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2023-10-26_UPS_Releases_3Q_2023_2108.pdf",
  },
  "Q4 2023": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10794/file/4Q23+Webcast+Deck_FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2024-01-30_UPS_Releases_4Q_2023_2114.pdf",
  },
  "Q1 2024": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10825/file/UPS+1Q24+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2024-04-23_UPS_Releases_1Q_2024_2119.pdf",
  },
  "Q2 2024": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10846/file/UPS+2Q24+Webcast+Deck+7.22.24+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2024-07-23_UPS_Releases_2Q_2024_2127.pdf",
  },
  "Q3 2024": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10864/file/UPS+3Q24+Webcast+Deck.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2024-10-24_UPS_Releases_3Q_2024_2131.pdf",
  },
  "Q4 2024": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10896/file/UPS+4Q24+Earnings+Webcast+Deck.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2025-01-30_UPS_Releases_4Q_2024_Earnings_and_Provides_2025_2135.pdf",
  },
  "Q1 2025": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10927/file/UPS+1Q25+Earnings+Webcast+Deck.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2025-04-29_UPS_Releases_1Q_2025_2142.pdf",
  },
  "Q2 2025": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10944/file/UPS+2Q25+Earnings+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2025-07-29_UPS_Releases_2Q_2025_2146.pdf",
  },
  "Q3 2025": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10959/file/UPS+3Q25+Earnings+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2025-10-28_UPS_Releases_3Q_2025_2150.pdf",
  },
  "Q4 2025": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/10971/file/UPS+4Q25+Earnings+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2026-01-27_UPS_Releases_4Q_2025_Earnings_and_Provides_2026_2154.pdf",
  },
  "Q1 2026": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/11000/file/1Q26+Earnings+Webcast+Deck+FINAL.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2026-04-28_UPS_Releases_1Q_2026_2158.pdf",
  },
  "Q2 2026": {
    slides: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/db/1111/11034/file/2Q26+Earnings+Webcast+Deck+07.28.26.pdf",
    filings: "https://investors.ups.com/_assets/_cbffdd678bee71af9d0e23f1ba62cd9d/ups/news/2026-07-28_UPS_Releases_2Q_2026_2164.pdf",
  },
};

export function isUpsRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  // UPS names earnings decks "*Webcast*Deck*" — do not reject those as webcast pages.
  if (/earnings|deck|presentation|supplement/i.test(n) && /\.pdf(?:$|[?#\s])/i.test(n)) {
    return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#\s])|sustainab|xbrl/i.test(n);
  }
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#\s])|sustainab|xbrl/i.test(n);
}

export function isUpsIrPdf(href: string | null | undefined): boolean {
  if (!href || isUpsRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.ups.com" || host.endsWith(".ups.com"))) return false;
    if (!u.pathname.includes("/_assets/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeUpsKnownQuarterDocs(): Map<string, UpsQuarterDocs> {
  return new Map(Object.entries(UPS_KNOWN_QUARTER_DOCS));
}
