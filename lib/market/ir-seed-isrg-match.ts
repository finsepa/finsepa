/**
 * Intuitive Surgical (ISRG) IR — calendar FY.
 * Slides = Investor Presentation on isrg.intuitive.com/static-files.
 * Filings = earnings press PDF via GCS `/node/{nid}/pdf` (no `.pdf` suffix).
 * Never financial data tables / JPM conference / proxy / SEC HTML.
 */

export type IsrgQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const ISRG = "https://isrg.intuitive.com";
const ISRG_STATIC = `${ISRG}/static-files`;

function staticFiles(uuid: string): string {
  return `${ISRG_STATIC}/${uuid}`;
}

function nodePdf(nid: number): string {
  return `${ISRG}/node/${nid}/pdf`;
}

export const ISRG_IR_PAGES = [
  "https://isrg.intuitive.com/",
  "https://isrg.intuitive.com/events-and-presentations",
  "https://isrg.intuitive.com/press-releases",
] as const;

/**
 * Event-detail / archive Investor Presentation UUIDs + press `/node/N/pdf`
 * (Q1 2022 → Q2 2026). Quarters without a published doc stay null (yellow).
 */
export const ISRG_KNOWN_QUARTER_DOCS: Readonly<Record<string, IsrgQuarterDocs>> = {
  "Q2 2026": {
    slides: staticFiles("76f7007b-e586-4661-82fb-0409f15b83d5"),
    filings: nodePdf(23231),
  },
  "Q1 2026": {
    slides: staticFiles("0526442c-18d2-485f-af74-3faa9c6744c0"),
    filings: nodePdf(23036),
  },
  "Q4 2025": { slides: null, filings: nodePdf(22616) },
  "Q3 2025": {
    slides: staticFiles("7bb532d6-7423-43c8-9681-a4787514cd9c"),
    filings: nodePdf(22381),
  },
  "Q2 2025": { slides: null, filings: nodePdf(22271) },
  "Q1 2025": {
    slides: staticFiles("996d1dcf-346b-47b7-9806-6c2fa91bf6e7"),
    filings: nodePdf(21931),
  },
  "Q4 2024": { slides: null, filings: nodePdf(21546) },
  "Q3 2024": {
    slides: staticFiles("c164a46a-a4ba-4936-b5c2-a6dc8f0f4f90"),
    filings: null,
  },
  "Q2 2024": {
    slides: staticFiles("d9b874f7-3fff-4849-bf28-b78f924061e1"),
    filings: null,
  },
  "Q1 2024": {
    slides: staticFiles("0a8f35e5-e8dd-48b6-8204-4bb71962878b"),
    filings: null,
  },
  "Q4 2023": { slides: null, filings: null },
  "Q3 2023": {
    slides: staticFiles("dd0f7e46-db67-4f10-90d9-d826df00554e"),
    filings: null,
  },
  "Q2 2023": {
    slides: staticFiles("7cb161c9-d8cc-40ff-89ab-74b148704728"),
    filings: null,
  },
  "Q1 2023": {
    slides: staticFiles("45f1021c-5658-4eb2-91bb-ad33417ffc6e"),
    filings: null,
  },
  "Q4 2022": { slides: null, filings: null },
  "Q3 2022": { slides: null, filings: null },
  "Q2 2022": { slides: null, filings: null },
  "Q1 2022": { slides: null, filings: null },
};

export function isIsrgRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|financial[-_\s]*data[-_\s]*tables|j\.?p\.?\s*morgan|conference|webcast|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isIsrgIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "isrg.intuitive.com" ||
        host === "isrg.gcs-web.com" ||
        host.endsWith(".intuitive.com")
      )
    ) {
      return false;
    }
    const path = u.pathname;
    if (/\/static-files\/[a-f0-9-]{36}/i.test(path)) return !isIsrgRejected(url);
    if (/\/node\/\d+\/pdf\/?$/i.test(path)) return !isIsrgRejected(url);
    return false;
  } catch {
    return false;
  }
}

export function mergeIsrgKnownQuarterDocs(): Map<string, IsrgQuarterDocs> {
  return new Map(Object.entries(ISRG_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
