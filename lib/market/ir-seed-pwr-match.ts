/**
 * PWR IR seed — 12-31.
 * Quanta Services calendar FY. Slides=Earnings Deck / Operational and Financial Highlights; Filings=press release. Q1 2023 slides-only. Latest Q2 2026. Scope stats: 17 green / 1 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type PwrQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const PWR_IR_PAGES = [
  "https://investors.quantaservices.com/",
] as const;

export const PWR_KNOWN_QUARTER_DOCS: Readonly<Record<string, PwrQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/9671/presentation/PWR_03-31-2022_Earnings_Deck_vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2022-05-05_QUANTA_SERVICES_REPORTS_FIRST_QUARTER_2022_318.pdf",
  },
  "Q2 2022": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/9673/presentation/PWR_06-30-2022_Earnings_Deck_vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2022-08-04_QUANTA_SERVICES_REPORTS_SECOND_QUARTER_2022_324.pdf",
  },
  "Q3 2022": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/9674/presentation/PWR_09-30-2022_Earnings_Deck_vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2022-11-03_QUANTA_SERVICES_REPORTS_THIRD_QUARTER_2022_329.pdf",
  },
  "Q4 2022": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/9676/presentation/PWR_12.31.2022_Earnings_Deck_vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2023-02-23_QUANTA_SERVICES_REPORTS_FOURTH_QUARTER_AND_FULL_334.pdf",
  },
  "Q1 2023": {
    slides: null,
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2023-05-04_QUANTA_SERVICES_REPORTS_FIRST_QUARTER_2023_337.pdf",
  },
  "Q2 2023": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/9679/presentation/PWR_06-30-2023_Earnings_Deck.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2023-08-03_QUANTA_SERVICES_REPORTS_SECOND_QUARTER_2023_344.pdf",
  },
  "Q3 2023": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/9681/presentation/PWR_09-30-2023_Earnings_Deck_vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2023-11-02_QUANTA_SERVICES_REPORTS_THIRD_QUARTER_2023_348.pdf",
  },
  "Q4 2023": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10293/operational_and_financial_commentary/PWR+-+12.31.2023+ER+Operational+and+Financial+Summary+vFF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2024-02-22_QUANTA_SERVICES_REPORTS_FOURTH_QUARTER_AND_FULL_351.pdf",
  },
  "Q1 2024": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10309/operational_and_financial_commentary/PWR+-+03.31.2024+ER+Operational+and+Financial+Summary+vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2024-05-02_QUANTA_SERVICES_REPORTS_FIRST_QUARTER_2024_355.pdf",
  },
  "Q2 2024": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10332/operational_and_financial_commentary/PWR+-+06-30-2024+ER+Operational+and+Financial+Summary+vF2%28clean%29_PDF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2024-08-01_QUANTA_SERVICES_REPORTS_SECOND_QUARTER_2024_361.pdf",
  },
  "Q3 2024": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10346/operational_and_financial_commentary/PWR+09-30-2024+ER+Operational+and+Financial+Summary+vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2024-10-31_QUANTA_SERVICES_REPORTS_THIRD_QUARTER_2024_367.pdf",
  },
  "Q4 2024": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10365/operational_and_financial_commentary/PWR+-+12.31.2024+ER+Operational+and+Financial+Summary+vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2025-02-20_QUANTA_SERVICES_REPORTS_FOURTH_QUARTER_AND_FULL_371.pdf",
  },
  "Q1 2025": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10374/operational_and_financial_commentary/PWR+03-31-2025+ER+Operational+and+Financial+Summary+vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2025-05-01_QUANTA_SERVICES_REPORTS_FIRST_QUARTER_2025_374.pdf",
  },
  "Q2 2025": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10389/operational_and_financial_commentary/PWR+06-30-2025+ER+Operational+and+Financial+Summary+vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2025-07-31_QUANTA_SERVICES_REPORTS_SECOND_QUARTER_2025_379.pdf",
  },
  "Q3 2025": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10412/operational_and_financial_commentary/PWR+09-30-2025+ER+Operational+and+Financial+Summary+vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2025-10-30_QUANTA_SERVICES_REPORTS_THIRD_QUARTER_2025_385.pdf",
  },
  "Q4 2025": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10418/operational_and_financial_commentary/PWR+-+12.31.2025+ER+Operational+and+Financial+Summary.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2026-02-19_QUANTA_SERVICES_REPORTS_FOURTH_QUARTER_AND_FULL_390.pdf",
  },
  "Q1 2026": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10453/operational_and_financial_commentary/PWR+03-31-2026+ER+Operational+and+Financial+Summary+vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2026-04-30_QUANTA_SERVICES_REPORTS_FIRST_QUARTER_2026_396.pdf",
  },
  "Q2 2026": {
    slides: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/db/917/10536/operational_and_financial_commentary/PWR+06-30-2026+ER+Operational+and+Financial+Summary+vF.pdf",
    filings: "https://investors.quantaservices.com/_assets/_ddfb2ac5b061bfc7c286a30a42c87331/quantaservices/news/2026-07-30_QUANTA_SERVICES_REPORTS_SECOND_QUARTER_2026_402.pdf",
  },
};

export function isPwrRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|investor.?day|sustainab|esg|10-?q|10-?k/i.test(n);
}

export function isPwrIrPdf(href: string | null | undefined): boolean {
  if (!href || isPwrRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investors.quantaservices.com" || host.endsWith(".quantaservices.com"))) return false;
    if (!(u.pathname.includes("/_assets/") || u.pathname.includes("/quantaservices/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergePwrKnownQuarterDocs(): Map<string, PwrQuarterDocs> {
  return new Map(Object.entries(PWR_KNOWN_QUARTER_DOCS));
}
