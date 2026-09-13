/** Salesforce (CRM) IR — FY ends Jan 31. Slides = Quarterly Investor Deck / Earnings Presentation; Filings = Press Release. Never transcript / 10-Q UUID / SEC HTML. */

export type CrmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends Jan 31. */
export const CRM_FY_END = "01-31";

const CDN = "https://s205.q4cdn.com/626266368/files/doc_financials";

export const CRM_IR_PAGES = [
  "https://investor.salesforce.com/financials/quarterly-results/default.aspx",
] as const;

/** Browser-verified q4cdn catalog (issuer FY labels). */
export const CRM_KNOWN_QUARTER_DOCS: Readonly<Record<string, CrmQuarterDocs>> = {
  "Q2 2027": {
    slides: `${CDN}/2027/q2/CRM-Q2-FY27-Quarterly-Investor-Deck.pdf`,
    filings: `${CDN}/2027/q2/CRM-Q2-FY27-Earnings-Press-Release.pdf`,
  },
  "Q1 2027": {
    slides: `${CDN}/2027/q1/CRM-Q1-FY27-Quarterly-Investor-Deck.pdf`,
    filings: `${CDN}/2027/q1/CRM-Q1-FY27-Earnings-Press-Release.pdf`,
  },
  "Q4 2026": {
    slides: `${CDN}/2026/q4/CRM-Q4-FY26-Quarterly-Investor-Deck.pdf`,
    filings: `${CDN}/2026/q4/CRM-Q4-FY26-Earnings-Press-Release.pdf`,
  },
  "Q3 2026": {
    slides: `${CDN}/2026/q3/CRM-Q3-FY26-Quarterly-Investor-Deck.pdf`,
    filings: `${CDN}/2026/q3/CRM-Q3-FY26-Earnings-Press-Release.pdf`,
  },
  "Q2 2026": {
    slides: `${CDN}/2026/q2/CRM-Q2-FY26-Quarterly-Investor-Deck_FINAL.pdf`,
    filings: `${CDN}/2026/q2/CRM-Q2-FY26-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q1 2026": {
    slides: `${CDN}/2026/q1/CRM-Q1-FY26-Quarterly-Investor-Deck.pdf`,
    filings: `${CDN}/2026/q1/CRM-Q1-FY26-Press-Release.pdf`,
  },
  "Q4 2025": {
    slides: `${CDN}/2025/q4/CRM-Q4-FY25-Earnings-Presentation.pdf`,
    filings: `${CDN}/2025/q4/CRM-Q4-FY25-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q3 2025": {
    slides: `${CDN}/2025/q3/CRM-Q3-FY25-Earnings-Presentation.pdf`,
    filings: `${CDN}/2025/q3/CRM-Q3-FY25-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q2 2025": {
    slides: `${CDN}/2025/q2/CRM-Q2-FY25-Earnings-Presentation.pdf`,
    filings: `${CDN}/2025/q2/CRM-Q2-FY25-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q1 2025": {
    slides: `${CDN}/2025/q1/CRM-Q1-FY25-Earnings-Presentation.pdf`,
    filings: `${CDN}/2025/q1/CRM-Q1-FY25-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q4 2024": {
    slides: `${CDN}/2024/q4/CRM-Q4-FY24-Earnings-Presentation.pdf`,
    filings: `${CDN}/2024/q4/CRM-Q4-FY24-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q3 2024": {
    slides: `${CDN}/2024/q3/CRM-Q3-FY24-Earnings-Presentation.pdf`,
    filings: `${CDN}/2024/q3/CRM-Q3-FY24-Earnings-Press-Release-w-Financials.pdf`,
  },
  "Q2 2024": {
    slides: `${CDN}/2024/q2/CRM-Q2-FY24-Earnings-Presentation.pdf`,
    filings: `${CDN}/2024/q2/CRM-Q2-FY24-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q1 2024": {
    slides: `${CDN}/2024/q1/CRM-Q1-FY24-Earnings-Presentation.pdf`,
    filings: `${CDN}/2024/q1/CRM-Q1-FY24-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q4 2023": {
    slides: `${CDN}/2023/q4/CRM-Q4-FY23-Earnings-Presentation.pdf`,
    filings: `${CDN}/2023/q4/CRM-Q4-FY23-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q3 2023": {
    slides: `${CDN}/2023/q3/CRM-Q3-FY23-Earnings-Presentation.pdf`,
    filings: `${CDN}/2023/q3/CRM-Q3-FY23-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q2 2023": {
    slides: `${CDN}/2023/q2/CRM-Q2-FY23-Earnings-Presentation.pdf`,
    filings: `${CDN}/2023/q2/CRM-Q2-FY23-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q1 2023": {
    slides: `${CDN}/2023/q1/CRM-Q1-FY23-Earnings-Presentation.pdf`,
    filings: `${CDN}/2023/q1/CRM-Q1-FY23-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q4 2022": {
    slides: `${CDN}/2022/q4/CRM-Q4-FY22-Earnings-Presentation.pdf`,
    filings: `${CDN}/2022/q4/CRM-Q4-FY22-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q3 2022": {
    slides: `${CDN}/2022/q3/CRM-Q3-FY22-Earnings-Presentation.pdf`,
    filings: `${CDN}/2022/q3/CRM-Q3-FY22-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q2 2022": {
    slides: `${CDN}/2022/q2/CRM-Q2-FY22-Earnings-Presentation.pdf`,
    filings: `${CDN}/2022/q2/CRM-Q2-FY22-Earnings-Press-Release-w-financials.pdf`,
  },
  "Q1 2022": {
    slides: `${CDN}/2022/q1/CRM-Q1-FY22-Earnings-Presentation.pdf`,
    filings: `${CDN}/2022/q1/CRM-Q1-FY22-Earnings-Press-Release-w-financials.pdf`,
  },
};

export function isCrmRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|10-?q|10-?k|8-?k|cloudfront\.net\/cik-/i.test(n);
}

export function isCrmIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "s205.q4cdn.com" || u.hostname.endsWith(".q4cdn.com"))) return false;
    return u.pathname.includes("/626266368/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeCrmKnownQuarterDocs(): Map<string, CrmQuarterDocs> {
  return new Map(Object.entries(CRM_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
