/**
 * MELI IR seed — 12-31.
 * MercadoLibre calendar FY. Slides=Letter to Shareholders (sparse); Filings=Financial Results on http2.mlstatic.com. Latest Q2 2026. Scope stats: 6 green / 10 yellow / 2 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type MeliQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MELI_IR_PAGES = [
  "https://investor.mercadolibre.com/",
] as const;

export const MELI_KNOWN_QUARTER_DOCS: Readonly<Record<string, MeliQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/9de71f68-fb4e-41e8-a86d-a8073f77ed7d/MercadoLibre_Inc._Reports_First_Quarter_2022_Financial_Results.pdf",
  },
  "Q2 2022": {
    slides: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/37e4a4ab-411d-49cb-ba2f-6e56ef9eba80/MercadoLibre_Inc._Second_Quarter_2022_Letter_to_Shareholders.pdf",
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/637297ea-cca0-4aaf-a333-6940a531d3f6/MercadoLibre_Inc._Reports_Second_Quarter_2022_Financial_Results.pdf",
  },
  "Q3 2022": {
    slides: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/f58653cd-8a9b-41e6-8db4-d444b1df826b/MercadoLibre_Inc._Third_Quarter_2022_Letter_to_Shareholders.pdf",
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/a3b7e464-ded7-4fe0-aae9-f1a2dfd9057d/MercadoLibre_Inc._Reports_Third_Quarter_2022_Financial_Results.pdf",
  },
  "Q4 2022": {
    slides: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/24fb2cbd-66f6-4a31-b66b-32387497451f/MercadoLibre_Inc._Fourth_Quarter_2022_Letter_to_Shareholders.pdf",
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/dc08bee0-0d13-42c0-bc6e-e9740a143e9c/MercadoLibre_Inc._Reports_Fourth_Quarter_2022_Financial_Results.pdf",
  },
  "Q1 2023": {
    slides: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/501b29a5-5039-4ca6-97c5-c6a1ff2b8d66/MercadoLibre_Inc._First_Quarter_2023_Letter_to_Shareholders.pdf",
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/93b47edd-d393-4d93-929a-920dc4e0a850/MercadoLibre_Inc._Reports_First_Quarter_2023_Financial_Results.pdf",
  },
  "Q2 2023": {
    slides: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/39a2da76-0650-4be5-9604-43f26d231049/MercadoLibre_Inc._Second_Quarter_2023_Letter_to_Shareholders.pdf",
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/95f40580-72ff-4fa8-977a-cf2bc79c94e7/MercadoLibre_Inc._Reports_Second_Quarter_2023_Financial_Results.pdf",
  },
  "Q3 2023": {
    slides: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/5bdf4dd9-b33f-43dd-9557-b374d1049524/MercadoLibre_Inc._Third_Quarter_2023_Letter_to_Shareholders.pdf",
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/f45c612e-eb67-4420-b36c-49204abb2cb3/MercadoLibre_Inc._Reports_Third_Quarter_2023_Financial_Results.pdf",
  },
  "Q4 2023": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/515c4d17-18a9-4ae7-b4c9-5a0c6555dfa0/MercadoLibre_Inc._Reports_Fourth_Quarter_2023_Financial_Results.pdf",
  },
  "Q1 2024": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/74cbd6d2-0a7e-4e40-87ec-dff8b0beda20/MercadoLibre_Inc._Reports_First_Quarter_2024_Financial_Results.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/dbdfa8ab-8b35-4662-bfad-ea2397229c21/MercadoLibre_Inc._Reports_Second_Quarter_2024_Financial_Results.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/7d98da11-7549-47ae-9822-8b81775f24c0/MercadoLibre_Inc._Reports_Third_Quarter_2024_Financial_Results.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/1063993a-101a-4733-b0f9-96932783d6a4/MercadoLibre_Inc._Reports_Fourth_Quarter_and_Full_Year_2024_Financial_Results.pdf",
  },
  "Q1 2025": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/00e853c9-fc94-40e3-9207-bb5e78c59ae3/MercadoLibre_Inc._Reports_First_Quarter_2025_Financial_Results.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/0bf07a7e-a122-4196-923c-619a00385a19/MercadoLibre_Inc._Reports_Second_Quarter_2025_Financial_Results.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/aedd43f2-4ece-4f4c-affa-546f442b5950/MercadoLibre_Inc._Reports_Third_Quarter_2025_Financial_Results.pdf",
  },
  "Q4 2025": {
    slides: null,
    filings: null,
  },
  "Q1 2026": {
    slides: null,
    filings: null,
  },
  "Q2 2026": {
    slides: null,
    filings: "https://http2.mlstatic.com/storage/ml-cms-backend/cms-documents-prod/5dbba919-721c-4916-bb91-c76a8713f7f0/bd60a342-c523-41b8-af7a-da2818fef5ff/MELI_Q2_2026_Press_Release.pdf",
  },
};

export function isMeliRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|\b10-?q\b|\b10-?k\b|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|sustainab|calpine|acquisition|factbook|securities.?report/i.test(n);
}

export function isMeliIrPdf(href: string | null | undefined): boolean {
  if (!href || isMeliRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "http2.mlstatic.com" || host.endsWith(".mlstatic.com"))) return false;
    if (!u.pathname.includes("/ml-cms-backend/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
  } catch {
    return false;
  }
}

export function mergeMeliKnownQuarterDocs(): Map<string, MeliQuarterDocs> {
  return new Map(Object.entries(MELI_KNOWN_QUARTER_DOCS));
}
