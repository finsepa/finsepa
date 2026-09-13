/** Seagate (STX) IR — FY ends ~early July. Slides = Supplemental Financial Information; Filings = Press Release. Never transcript / SEC HTML. */

export type StxQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends ~June/early July (Q4 FY26 ended 2026-07-03). */
export const STX_FY_END = "06-30";

const CDN = "https://s24.q4cdn.com/101481333/files/doc_financials";

export const STX_IR_PAGES = [
  "https://investors.seagate.com/financials/quarterly-results/default.aspx",
] as const;

/** Browser-verified q4cdn catalog (issuer FY labels). Prefer canonical Supplemental paths. */
export const STX_KNOWN_QUARTER_DOCS: Readonly<Record<string, StxQuarterDocs>> = {
  "Q4 2026": {
    slides: `${CDN}/2026/q4/v2/STX-FQ4-26-Supplemental.pdf`,
    filings: `${CDN}/2026/q4/STX-FQ4-26-Press-Release.pdf`,
  },
  "Q3 2026": {
    slides: `${CDN}/2026/q3/STX-FQ3-26-Supplemental.pdf`,
    filings: `${CDN}/2026/q3/STX-FQ3-26-Press-Release.pdf`,
  },
  "Q2 2026": {
    slides: `${CDN}/2026/q2/STX-FQ2-26-Supplemental.pdf`,
    filings: `${CDN}/2026/q2/STX-FQ2-26-Press-Release.pdf`,
  },
  "Q1 2026": {
    slides: `${CDN}/2026/q1/supplemental/STX-FQ1-26-Supplemental.pdf`,
    filings: `${CDN}/2026/q1/STX-FQ1-26-Press-Release.pdf`,
  },
  "Q4 2025": {
    slides: `${CDN}/2025/q4/STX-FQ4-25-Supplemental.pdf`,
    filings: `${CDN}/2025/q4/STX-FQ4-25-Press-Release.pdf`,
  },
  "Q3 2025": {
    slides: `${CDN}/2025/q3/STX-FQ3-25-Supplemental-vF.pdf`,
    filings: `${CDN}/2025/q3/STX-FQ3-25-Press-Release.pdf`,
  },
  "Q2 2025": {
    slides: `${CDN}/2025/q2/STX-FQ2-25-Supplemental.pdf`,
    filings: `${CDN}/2025/q2/STX-FQ2-25-Press-Release.pdf`,
  },
  "Q1 2025": {
    slides: `${CDN}/2025/q1/STX-FQ1-25-Supplemental.pdf`,
    filings: `${CDN}/2025/q1/STX-FQ1-25-Press-Release.pdf`,
  },
  "Q4 2024": {
    slides: `${CDN}/2024/q4/v2/STX-FQ4-24-Supplemental.pdf`,
    filings: `${CDN}/2024/q4/STX-FQ4-24-Press-Release.pdf`,
  },
  "Q3 2024": {
    slides: `${CDN}/2024/q3/STX-FQ3-24-Supplemental.pdf`,
    filings: `${CDN}/2024/q3/STX-FQ3-24-Press-Release.pdf`,
  },
  "Q2 2024": {
    slides: `${CDN}/2024/q2/STX-FQ2-24-Supplemental.pdf`,
    filings: `${CDN}/2024/q2/STX-FQ2-24-Press-Release.pdf`,
  },
  "Q1 2024": {
    slides: `${CDN}/2024/q1/STX-Supplemental-FQ1-24.pdf`,
    filings: `${CDN}/2024/q1/STX-FQ1-24-Press-Release.pdf`,
  },
  "Q4 2023": {
    slides: `${CDN}/2023/q4/STX-Supplemental-FQ4-23.pdf`,
    filings: `${CDN}/2023/q4/STX-Q4-23-Press-Release.pdf`,
  },
  "Q3 2023": {
    slides: `${CDN}/2023/q3/STX-Supplemental-FQ323.pdf`,
    filings: `${CDN}/2023/q3/STX-Q323-Press-Release.pdf`,
  },
  "Q2 2023": {
    slides: `${CDN}/2023/q2/STX-Supplemental-FQ2'23.pdf`,
    filings: `${CDN}/2023/q2/STX-Q2'23-Press-Release.pdf`,
  },
  "Q1 2023": {
    slides: `${CDN}/2023/q1/STX-Supplemental-FQ1'23.pdf`,
    filings: `${CDN}/2023/q1/STX-Q1'23-Press-Release.pdf`,
  },
  "Q4 2022": {
    slides: null,
    filings: `${CDN}/2022/q4/STX-Q4'2022-Press-Release.pdf`,
  },
  "Q3 2022": {
    slides: null,
    filings: `${CDN}/2022/q3/STX-Q3'22-Press-Release.pdf`,
  },
  "Q2 2022": {
    slides: `${CDN}/2022/q2/STX-Supplemental-FQ2'22-FINAL.pdf`,
    filings: `${CDN}/2022/q2/STX-Q2-22-Press-Release-Financials-FINAL.pdf`,
  },
  "Q1 2022": {
    slides: `${CDN}/2022/q1/STX-Supplemental-FQ1'22-FINAL.pdf`,
    filings: `${CDN}/2022/q1/STX-Q1'22-Press-Release-Financials-FINAL.pdf`,
  },
};

export function isStxRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|10-?q|10-?k|8-?k/i.test(n);
}

export function isStxIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "s24.q4cdn.com" || u.hostname.endsWith(".q4cdn.com"))) return false;
    return u.pathname.includes("/101481333/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeStxKnownQuarterDocs(): Map<string, StxQuarterDocs> {
  return new Map(Object.entries(STX_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
