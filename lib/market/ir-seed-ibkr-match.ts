/**
 * Interactive Brokers (IBKR) IR — calendar FY.
 * Slides = Investor Presentation; Filings = Earnings Release PDF.
 * Host: ndcdyn.interactivebrokers.com/mkt/getFileNew.php?file=YYYYQn_*.pdf
 * Never transcript / 10-Q / SEC HTML / monthly metrics.
 */

export type IbkrQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const IBKR_FILE = "https://ndcdyn.interactivebrokers.com/mkt/getFileNew.php?file=";

function file(name: string): string {
  return `${IBKR_FILE}${name}`;
}

export const IBKR_IR_PAGES = [
  "https://investors.interactivebrokers.com/",
  "https://investors.interactivebrokers.com/ir/main.php",
] as const;

/** HEAD-verified Investor Presentation + Earnings Release (Q1 2022 → Q2 2026). */
export const IBKR_KNOWN_QUARTER_DOCS: Readonly<Record<string, IbkrQuarterDocs>> = {
  "Q2 2026": {
    slides: file("2026Q2_Investor_Presentation.pdf"),
    filings: file("2026Q2_Earnings_Release.pdf"),
  },
  "Q1 2026": {
    slides: file("2026Q1_Investor_Presentation.pdf"),
    filings: file("2026Q1_Earnings_Release.pdf"),
  },
  "Q4 2025": {
    slides: file("2025Q4_Investor_Presentation.pdf"),
    filings: file("2025Q4_Earnings_Release.pdf"),
  },
  "Q3 2025": {
    slides: file("2025Q3_Investor_Presentation.pdf"),
    filings: file("2025Q3_Earnings_Release.pdf"),
  },
  "Q2 2025": {
    slides: file("2025Q2_Investor_Presentation.pdf"),
    filings: file("2025Q2_Earnings_Release.pdf"),
  },
  "Q1 2025": {
    slides: file("2025Q1_Investor_Presentation.pdf"),
    filings: file("2025Q1_Earnings_Release.pdf"),
  },
  "Q4 2024": {
    slides: file("2024Q4_Investor_Presentation.pdf"),
    filings: file("2024Q4_Earnings_Release.pdf"),
  },
  "Q3 2024": {
    slides: file("2024Q3_Investor_Presentation.pdf"),
    filings: file("2024Q3_Earnings_Release.pdf"),
  },
  "Q2 2024": {
    slides: file("2024Q2_Investor_Presentation.pdf"),
    filings: file("2024Q2_Earnings_Release.pdf"),
  },
  "Q1 2024": {
    slides: file("2024Q1_Investor_Presentation.pdf"),
    filings: file("2024Q1_Earnings_Release.pdf"),
  },
  "Q4 2023": {
    slides: file("2023Q4_Investor_Presentation.pdf"),
    filings: file("2023Q4_Earnings_Release.pdf"),
  },
  "Q3 2023": {
    slides: file("2023Q3_Investor_Presentation.pdf"),
    filings: file("2023Q3_Earnings_Release.pdf"),
  },
  "Q2 2023": {
    slides: file("2023Q2_Investor_Presentation.pdf"),
    filings: file("2023Q2_Earnings_Release.pdf"),
  },
  "Q1 2023": {
    slides: file("2023Q1_Investor_Presentation.pdf"),
    filings: file("2023Q1_Earnings_Release.pdf"),
  },
  "Q4 2022": {
    slides: file("2022Q4_Investor_Presentation.pdf"),
    filings: file("2022Q4_Earnings_Release.pdf"),
  },
  "Q3 2022": {
    slides: file("2022Q3_Investor_Presentation.pdf"),
    filings: file("2022Q3_Earnings_Release.pdf"),
  },
  "Q2 2022": {
    slides: file("2022Q2_Investor_Presentation.pdf"),
    filings: file("2022Q2_Earnings_Release.pdf"),
  },
  "Q1 2022": {
    slides: file("2022Q1_Investor_Presentation.pdf"),
    filings: file("2022Q1_Earnings_Release.pdf"),
  },
};

export function isIbkrRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|10-?q|10-?k|monthly[-_\s]*metric|proxy|\.(xls|xlsx|csv)(?:$|[?#])/i.test(
    n,
  );
}

export function isIbkrIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "ndcdyn.interactivebrokers.com" ||
        host === "interactivebrokers.com" ||
        host.endsWith(".interactivebrokers.com")
      )
    ) {
      return false;
    }
    const fileParam = u.searchParams.get("file") ?? "";
    if (!/\.pdf$/i.test(fileParam) && !/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isIbkrRejected(url);
  } catch {
    return false;
  }
}

export function mergeIbkrKnownQuarterDocs(): Map<string, IbkrQuarterDocs> {
  return new Map(Object.entries(IBKR_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
