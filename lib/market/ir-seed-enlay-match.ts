/**
 * ENLAY IR seed — 12-31.
 * Enel SpA ADR (ENLAY) calendar FY. Slides=*-risultati.pdf; Filings=English press. Q4 2025/Q1 2026 slides-only; Q2 2026 empty. Latest Q1 2026. Scope stats: 15 green / 2 yellow / 1 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type EnlayQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ENLAY_IR_PAGES = [
  "https://www.enel.com/investors",
] as const;

export const ENLAY_KNOWN_QUARTER_DOCS: Readonly<Record<string, EnlayQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2022/trimestrali/1q-2022-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2022-may/Enel%20Results%20Q1%202022.pdf",
  },
  "Q2 2022": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2022/trimestrali/1h-2022-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2022-july/Enel%20Results%201H%202022.pdf",
  },
  "Q3 2022": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2022/trimestrali/9m-2022-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2022-november/Enel%20results%209M%202022.pdf",
  },
  "Q4 2022": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2022/trimestrali/fy-2022-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2023-march/Enel%20results%20FY%202022.pdf",
  },
  "Q1 2023": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2023/trimestrali/1q-2023-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2023-may/Enel%201Q%202023%20financial%20results.pdf",
  },
  "Q2 2023": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2023/trimestrali/1h-2023-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2023-july/Enel%20results%201H%202023.pdf",
  },
  "Q3 2023": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2023/trimestrali/9m-2023-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2023-november/Enel%20Results%209M%202023.pdf",
  },
  "Q4 2023": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2023/trimestrali/fy-2023-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2024-march/Enel%20FY%20Results%202023.pdf",
  },
  "Q1 2024": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2024/trimestrali/1q-2024-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2024-may/Enel%20results%201Q%202024.pdf",
  },
  "Q2 2024": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2024/trimestrali/1h-2024-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2024/interim/en/half-year-financial-report_30june2024.pdf",
  },
  "Q3 2024": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2024/trimestrali/9m-2024-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2024-november/Enel%20results%209M%202024.pdf",
  },
  "Q4 2024": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2024/trimestrali/fy-2024-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2025-march/Enel%20results%20FY%202024ENG.pdf",
  },
  "Q1 2025": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2025/trimestrali/1q-2025-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2025-may/Enel%20results%201Q%202025.pdf",
  },
  "Q2 2025": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2025/trimestrali/1h-2025-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2025-july/Enel%20results%201H%202025.pdf",
  },
  "Q3 2025": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2025/trimestrali/9m-2025-risultati.pdf",
    filings: "https://www.enel.com/content/dam/enel-common/press/en/2025-november/Enel%20results%209M%202025.pdf",
  },
  "Q4 2025": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2025/trimestrali/fy-2025-risultati.pdf",
    filings: null,
  },
  "Q1 2026": {
    slides: "https://www.enel.com/content/dam/enel-com/documenti/investitori/informazioni-finanziarie/2026/trimestrali/1q-2026-risultati.pdf",
    filings: null,
  },
  "Q2 2026": {
    slides: null,
    filings: null,
  },
};

export function isEnlayRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|esg|climate|annual.?report|integrated/i.test(n);
}

export function isEnlayIrPdf(href: string | null | undefined): boolean {
  if (!href || isEnlayRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.enel.com" || host.endsWith(".enel.com"))) return false;
    if (!(u.pathname.includes("/content/dam/") || u.pathname.includes("/documenti/") || u.pathname.includes("/press/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeEnlayKnownQuarterDocs(): Map<string, EnlayQuarterDocs> {
  return new Map(Object.entries(ENLAY_KNOWN_QUARTER_DOCS));
}
