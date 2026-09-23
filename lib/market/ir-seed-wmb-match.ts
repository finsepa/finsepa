/**
 * WMB IR seed — 12-31.
 * Williams Companies calendar FY. Slides=WMB Earnings Presentation (Webcast Presentation in 2022); Filings=WMB Earnings Release on investor.williams.com/static-files. Q2 2023 filings HTML-only (left null). Q4 2025 webcast replaced by Analyst Day — slides null. Reject Analyst Day/conference/transcripts. Scope: 16g / 2y / 0r. Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type WmbQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const WMB_IR_PAGES = [
  "https://investor.williams.com/financials/quarterly-results/default.aspx",
] as const;

export const WMB_KNOWN_QUARTER_DOCS: Readonly<Record<string, WmbQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://investor.williams.com/static-files/62a8f5de-831a-428e-9327-05d444c8d859",
    filings: "https://investor.williams.com/static-files/1e692fd5-c42b-480e-9733-0263f91b67d2",
  },
  "Q2 2022": {
    slides: "https://investor.williams.com/static-files/fa3e9b76-c68a-4129-b31d-92b79d2e834b",
    filings: "https://investor.williams.com/static-files/0d11483e-7e93-4dec-90da-209fa0e30dcd",
  },
  "Q3 2022": {
    slides: "https://investor.williams.com/static-files/7ff71893-7d73-4833-8fc6-9c5b189ad42e",
    filings: "https://investor.williams.com/static-files/4f6fe5b4-53ae-4327-ad1a-2d7a60034b95",
  },
  "Q4 2022": {
    slides: "https://investor.williams.com/static-files/58ebd325-bd10-4ba2-abc4-3fe67a222a95",
    filings: "https://investor.williams.com/static-files/5f69824b-9609-4095-bffd-80cd91f9fa63",
  },
  "Q1 2023": {
    slides: "https://investor.williams.com/static-files/94d16fae-f4cb-4da1-9097-31a0f2c1cd22",
    filings: "https://investor.williams.com/static-files/b56fb851-7d5a-4808-aa13-c972e66a945d",
  },
  "Q2 2023": {
    slides: "https://investor.williams.com/static-files/a0b640dd-b931-4ad6-87fe-7aae1c2b676b",
    filings: null,
  },
  "Q3 2023": {
    slides: "https://investor.williams.com/static-files/bb69785a-cb42-4222-a933-83a10c5d27a8",
    filings: "https://investor.williams.com/static-files/c34ce284-a5ec-4803-b618-937e4259285f",
  },
  "Q4 2023": {
    slides: "https://investor.williams.com/static-files/e4234feb-476d-43bf-a7ed-fb8cf8fd97b1",
    filings: "https://investor.williams.com/static-files/19bcd8ae-6076-44b3-b631-9fcd536a6c17",
  },
  "Q1 2024": {
    slides: "https://investor.williams.com/static-files/4c5bc340-6376-4df6-8f36-a41a57b47019",
    filings: "https://investor.williams.com/static-files/635dd967-5a0f-4248-9b84-d6811dc74e7e",
  },
  "Q2 2024": {
    slides: "https://investor.williams.com/static-files/a43f8a54-1b1f-41da-a9aa-e6ae6189444c",
    filings: "https://investor.williams.com/static-files/59072672-d3fd-421d-8ace-38cc942c5ce1",
  },
  "Q3 2024": {
    slides: "https://investor.williams.com/static-files/f4813134-b0a3-436f-8d28-b5bd7860307b",
    filings: "https://investor.williams.com/static-files/1e4881ec-bd72-4c86-a030-65176c057a01",
  },
  "Q4 2024": {
    slides: "https://investor.williams.com/static-files/8f5dabc9-719d-41c6-a0cd-ca1baa072cc4",
    filings: "https://investor.williams.com/static-files/f4c786c6-7d30-410c-9490-77676a16887c",
  },
  "Q1 2025": {
    slides: "https://investor.williams.com/static-files/672114a5-9813-461d-a604-dadd6be871e0",
    filings: "https://investor.williams.com/static-files/675bca23-c189-4edb-b141-f252faa3786d",
  },
  "Q2 2025": {
    slides: "https://investor.williams.com/static-files/3a216bf1-8609-4913-aa13-2732c91e5a28",
    filings: "https://investor.williams.com/static-files/e6c0a4b3-8952-405a-ba4d-12a3efdff2e3",
  },
  "Q3 2025": {
    slides: "https://investor.williams.com/static-files/81894832-7443-44df-a5ad-f3be80333a77",
    filings: "https://investor.williams.com/static-files/6ccfa77e-69ad-4bea-a56e-42f2f13bf8e8",
  },
  "Q4 2025": {
    slides: null,
    filings: "https://investor.williams.com/static-files/2613a69f-03b2-4357-b588-ca7d897628b6",
  },
  "Q1 2026": {
    slides: "https://investor.williams.com/static-files/5bc0ca98-e364-4013-ade5-aba965b6bb5f",
    filings: "https://investor.williams.com/static-files/5b2479d6-95f9-4583-87c4-6d32eb85c9ae",
  },
  "Q2 2026": {
    slides: "https://investor.williams.com/static-files/f614f046-cccf-4f74-91e9-5202008eeafc",
    filings: "https://investor.williams.com/static-files/dde1b8eb-5802-4e4c-aa89-84c4d8611d56",
  },
};

export function isWmbRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|xbrl/i.test(n);
}

export function isWmbIrPdf(href: string | null | undefined): boolean {
  if (!href || isWmbRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "investor.williams.com" || host.endsWith(".williams.com"))) return false;
    return /\/static-files\/[a-f0-9-]{36}/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeWmbKnownQuarterDocs(): Map<string, WmbQuarterDocs> {
  return new Map(Object.entries(WMB_KNOWN_QUARTER_DOCS));
}
