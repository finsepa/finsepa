/** T-Mobile (TMUS) IR — calendar FY. Slides = Investor Factbook; Filings = Earnings Release. Never transcript / 10-Q / XLS / SEC HTML. */

export type TmusQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const TMUS_CDN = "https://s29.q4cdn.com/310188824/files/doc_financials";

function doc(fy: number, fq: number, name: string): string {
  return `${TMUS_CDN}/${fy}/q${fq}/${name}`;
}

export const TMUS_IR_PAGES = [
  "https://investor.t-mobile.com/events-and-presentations/events/default.aspx",
] as const;

/** Browser/HTTP-verified Factbook + Earnings Release PDFs (naming varies by quarter). */
export const TMUS_KNOWN_QUARTER_DOCS: Readonly<Record<string, TmusQuarterDocs>> = {
  "Q2 2026": {
    slides: doc(2026, 2, "Q2-2026-Investor-Factbook-vFinal.pdf"),
    filings: doc(2026, 2, "Q2-2026-Earnings-Release-vFinal.pdf"),
  },
  "Q1 2026": {
    slides: doc(2026, 1, "Q1-2026-Investor-Factbook-vFinal.pdf"),
    filings: doc(2026, 1, "Q1-2026-Earnings-Release-vFinal.pdf"),
  },
  "Q4 2025": {
    slides: doc(2025, 4, "Q4-2025-Investor-Factbook.pdf"),
    filings: doc(2025, 4, "Q4-2025-Earnings-Release.pdf"),
  },
  "Q3 2025": {
    slides: doc(2025, 3, "Q3-2025-Investor-Factbook-vFinal.pdf"),
    filings: doc(2025, 3, "Q3-2025-Earnings-Release-vFinal.pdf"),
  },
  "Q2 2025": {
    slides: doc(2025, 2, "Q2-2025-Investor-Factbook-vFinal.pdf"),
    filings: doc(2025, 2, "Q2-2025-Earnings-Release-vFinal.pdf"),
  },
  "Q1 2025": {
    slides: doc(2025, 1, "Q1-2025-Investor-Factbook-vFinal.pdf"),
    filings: doc(2025, 1, "Q1-2025-Earnings-Release-vFinal.pdf"),
  },
  "Q4 2024": {
    slides: doc(2024, 4, "Q4-2024-Investor-Factbook-vFinal.pdf"),
    filings: doc(2024, 4, "Q4-2024-Earnings-Release-vFinal.pdf"),
  },
  "Q3 2024": {
    slides: doc(2024, 3, "TMUS-Q3-2024-Investor-Factbook.pdf"),
    filings: doc(2024, 3, "TMUS-Q3-2024-Earnings-Release.pdf"),
  },
  "Q2 2024": {
    slides: doc(2024, 2, "Q2-2024-Investor-Factbook-vFinal.pdf"),
    filings: doc(2024, 2, "Q2-2024-Earnings-Release-vFinal.pdf"),
  },
  "Q1 2024": {
    slides: doc(2024, 1, "Q1-2024-Investor-Factbook-vFinal.pdf"),
    filings: doc(2024, 1, "Q1-2024-Earnings-Release-vFinal.pdf"),
  },
  "Q4 2023": {
    slides: doc(2023, 4, "Q4-2023-TMUS-Investor-Factbook.pdf"),
    filings: doc(2023, 4, "Q4-2023-TMUS-Earnings-Release.pdf"),
  },
  "Q3 2023": {
    slides: doc(2023, 3, "Q3-2023-Investor-Factbook-vFinal.pdf"),
    filings: doc(2023, 3, "Q3-2023-Earnings-Release-vFinal.pdf"),
  },
  "Q2 2023": {
    slides: doc(2023, 2, "Q2-2023-Investor-Factbook-vFinal.pdf"),
    filings: doc(2023, 2, "Q2-2023-Earnings-Release-vFinal.pdf"),
  },
  "Q1 2023": {
    slides: doc(2023, 1, "Q1-2023-Investor-Factbook.pdf"),
    filings: doc(2023, 1, "Q1-2023-Earnings-Release.pdf"),
  },
  "Q4 2022": {
    slides: doc(2022, 4, "Q4-2022-Investor-Factbook.pdf"),
    filings: doc(2022, 4, "Q4-2022-Earnings-Release.pdf"),
  },
  "Q3 2022": {
    slides: doc(2022, 3, "TMUS-09_30_2022-EX-99.2-vFinal.pdf"),
    filings: doc(2022, 3, "TMUS-09_30_2022-EX-99.1-vFinal.pdf"),
  },
  "Q2 2022": {
    slides: doc(2022, 2, "Q2-2022-Investor-Factbook-vFinal.pdf"),
    filings: doc(2022, 2, "Q2-2022-Earnings-Release-vFinal.pdf"),
  },
  "Q1 2022": {
    slides: doc(2022, 1, "TMUS-03_31_2022-EX-99.2-FINAL.pdf"),
    filings: doc(2022, 1, "TMUS-03_31_2022-EX-99.1-FINAL.pdf"),
  },
};

export function isTmusRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|10-?q|10-?k|8-?k|\.xls|reconcil/i.test(n);
}

export function isTmusIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "s29.q4cdn.com" || u.hostname.endsWith(".q4cdn.com"))) return false;
    return u.pathname.includes("/310188824/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeTmusKnownQuarterDocs(): Map<string, TmusQuarterDocs> {
  return new Map(Object.entries(TMUS_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
