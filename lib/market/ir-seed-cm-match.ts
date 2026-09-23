/**
 * CM IR seed — 10-31.
 * CIBC October 31 FY (like BNS/BMO). Slides=q{n}{yy}presentation-en.pdf; Filings=q{n}{yy}newsrelease-en.pdf under /content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/{year}/. Scope Q1 2022→Q3 2026 (latest published). Map: Q1=Nov–Jan, Q2=Feb–Apr, Q3=May–Jul, Q4=Aug–Oct. 19 green / 0 yellow / 0 red. All Range-GET %PDF. Never SEC HTML / Report to Shareholders / factsheet.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type CmQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const CM_IR_PAGES = [
  "https://www.cibc.com/en/about-cibc/investor-relations/quarterly-results.html",
] as const;

export const CM_KNOWN_QUARTER_DOCS: Readonly<Record<string, CmQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2022/q122presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2022/q122newsrelease-en.pdf",
  },
  "Q2 2022": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2022/q222presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2022/q222newsrelease-en.pdf",
  },
  "Q3 2022": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2022/q322presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2022/q322newsrelease-en.pdf",
  },
  "Q4 2022": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2022/q422presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2022/q422newsrelease-en.pdf",
  },
  "Q1 2023": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2023/q123presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2023/q123newsrelease-en.pdf",
  },
  "Q2 2023": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2023/q223presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2023/q223newsrelease-en.pdf",
  },
  "Q3 2023": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2023/q323presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2023/q323newsrelease-en.pdf",
  },
  "Q4 2023": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2023/q423presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2023/q423newsrelease-en.pdf",
  },
  "Q1 2024": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2024/q124presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2024/q124newsrelease-en.pdf",
  },
  "Q2 2024": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2024/q224presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2024/q224newsrelease-en.pdf",
  },
  "Q3 2024": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2024/q324presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2024/q324newsrelease-en.pdf",
  },
  "Q4 2024": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2024/q424presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2024/q424newsrelease-en.pdf",
  },
  "Q1 2025": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2025/q125presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2025/q125newsrelease-en.pdf",
  },
  "Q2 2025": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2025/q225presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2025/q225newsrelease-en.pdf",
  },
  "Q3 2025": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2025/q325presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2025/q325newsrelease-en.pdf",
  },
  "Q4 2025": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2025/q425presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2025/q425newsrelease-en.pdf",
  },
  "Q1 2026": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2026/q126presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2026/q126newsrelease-en.pdf",
  },
  "Q2 2026": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2026/q226presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2026/q226newsrelease-en.pdf",
  },
  "Q3 2026": {
    slides: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2026/q326presentation-en.pdf",
    filings: "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/2026/q326newsrelease-en.pdf",
  }
};

export function isCmRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isCmIrPdf(href: string | null | undefined): boolean {
  if (!href || isCmRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.cibc.com" || host.endsWith(".cibc.com"))) return false;
    if (!u.pathname.includes("/quarterly-results/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeCmKnownQuarterDocs(): Map<string, CmQuarterDocs> {
  return new Map(Object.entries(CM_KNOWN_QUARTER_DOCS));
}
