/**
 * APP IR seed — 12-31.
 * AppLovin calendar FY. Slides=Earnings Presentation else Shareholder Letter / Financial Update; Filings=Press Release. Never 10-Q/10-K/conference decks. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type AppQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const APP_IR_PAGES = [
  "https://investors.applovin.com/",
] as const;

export const APP_KNOWN_QUARTER_DOCS: Readonly<Record<string, AppQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2022/q1/1Q22-Financial-Update-FINAL-2022-05-10.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2022/q1/1Q22_Earnings_Press_Release-v1.pdf",
  },
  "Q2 2022": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2022/q2/APP_2Q22_FINAL_Shareholder_Letter_v2.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2022/q2/2Q22_Earnings_Press_Release_FINAL.pdf",
  },
  "Q3 2022": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2022/q3/AppLovin-3Q22-Shareholder-Letter.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2022/q3/3Q22_Earnings_Press_Release.pdf",
  },
  "Q4 2022": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2022/q4/4Q22-Shareholder-Letter.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2022/q4/4Q22_Earnings_Press_Release.pdf",
  },
  "Q1 2023": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2023/q1/AppLovin_1Q23_Shareholder_Letter.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2023/q1/1Q23-Earnings-Press-Release.pdf",
  },
  "Q2 2023": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2023/q2/AppLovin-2Q23-Shareholder-Letter.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2023/q2/2Q23-AppLovin-Earnings-Press-Release.pdf",
  },
  "Q3 2023": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2023/q3/AppLovin-3Q23-Shareholder-Letter.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2023/q3/3Q23-AppLovin-Earnings-Press-Release.pdf",
  },
  "Q4 2023": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2023/q4/Q4-2023-AppLovin-Earnings-Presentation.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2023/q4/4Q23-AppLovin-Press-Release.pdf",
  },
  "Q1 2024": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2024/q1/1Q24-AppLovin-Shareholder-Letter.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2024/q1/1Q24-AppLovin-Press-Release.pdf",
  },
  "Q2 2024": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2024/q2/2Q24-AppLovin-Shareholder-Letter.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2024/q2/2Q24-AppLovin-Press-Release.pdf",
  },
  "Q3 2024": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2024/q3/Q3-2024-AppLovin-Earnings-Presentation.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2024/q3/3Q24-AppLovin-Press-Release.pdf",
  },
  "Q4 2024": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2024/q4/4Q24-AppLovin-Financial-Update.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2024/q4/4Q24-AppLovin-Press-Release.pdf",
  },
  "Q1 2025": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2025/q1/1Q25-AppLovin-Financial-Update.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2025/q1/1Q25-AppLovin-Press-Release.pdf",
  },
  "Q2 2025": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2025/q2/2Q25-AppLovin-Financial-Update.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2025/q2/2Q25-AppLovin-Press-Release.pdf",
  },
  "Q3 2025": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2025/q3/3Q25-AppLovin-Financial-Update.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2025/q3/3Q25-AppLovin-Press-Release.pdf",
  },
  "Q4 2025": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2025/q4/Financial-Update-Q4-2025.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2025/q4/v2/4Q25-AppLovin-Press-Release.pdf",
  },
  "Q1 2026": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2026/q1/Financial-Update-Q1-2026.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2026/q1/1Q26-Earnings-Press-Release.pdf",
  },
  "Q2 2026": {
    slides: "https://s21.q4cdn.com/165405286/files/doc_financials/2026/q2/Financial-Update-Q2-2026.pdf",
    filings: "https://s21.q4cdn.com/165405286/files/doc_financials/2026/q2/AppLovin-2Q26-Earnings-Press-Release.pdf",
  },
};

export function isAppRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|shareholder.?day|form.?10|conference.?deck/i.test(n);
}

export function isAppIrPdf(href: string | null | undefined): boolean {
  if (!href || isAppRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "s21.q4cdn.com" || host.endsWith(".q4cdn.com"))) return false;
    if (!(u.pathname.includes("/165405286/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeAppKnownQuarterDocs(): Map<string, AppQuarterDocs> {
  return new Map(Object.entries(APP_KNOWN_QUARTER_DOCS));
}
