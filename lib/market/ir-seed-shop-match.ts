/**
 * Shopify (SHOP) IR — calendar FY.
 * Slides = Investor Presentation; Filings = Press Release PDF.
 * Host: shopifyinvestors.gcs-web.com/static-files. Never 10-Q / supplemental / SEC HTML.
 */

export type ShopQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const SHOP_STATIC = "https://shopifyinvestors.gcs-web.com/static-files";

function staticFiles(uuid: string): string {
  return `${SHOP_STATIC}/${uuid}`;
}

export const SHOP_IR_PAGES = [
  "https://www.shopify.com/investors/financial-reports",
  "https://www.shopify.com/investors/quarterly-results",
  "https://investors.shopify.com/",
] as const;

/**
 * From financial-reports / quarterly-results stream (Press → 10-Q → Supplemental → Presentation).
 * Investor Presentation PDFs published for recent quarters only; older leave slides empty (yellow).
 */
export const SHOP_KNOWN_QUARTER_DOCS: Readonly<Record<string, ShopQuarterDocs>> = {
  "Q2 2026": {
    slides: staticFiles("70766772-a69c-4361-9d43-ce4729f27a96"),
    filings: staticFiles("d47589d4-20d8-4612-b6e8-1dafa745f3c7"),
  },
  "Q1 2026": {
    slides: staticFiles("a7aed01c-9a85-4879-a427-532fa76908fc"),
    filings: staticFiles("537b23bc-2687-4b5d-821e-1477025efaa9"),
  },
  "Q4 2025": {
    slides: staticFiles("d1c7204c-4c36-45cc-a582-8c0a3fd4d84c"),
    filings: staticFiles("7b18a6a9-1ebd-42ad-a026-1b4358f6a172"),
  },
  "Q3 2025": {
    slides: staticFiles("4adf86e2-0475-4fe2-a64a-3160b97f7642"),
    filings: staticFiles("3ffb9614-95b8-470f-88d0-e95271951d09"),
  },
  "Q2 2025": {
    slides: null,
    filings: staticFiles("77464e3d-9a3f-4328-8931-cc46aeffa007"),
  },
  "Q1 2025": {
    slides: null,
    filings: staticFiles("ab1c2f19-d876-4724-8b6a-94ef268db0dd"),
  },
  "Q4 2024": {
    slides: null,
    filings: staticFiles("32c4d4ed-9bbb-4ad1-8b98-882fa495aaeb"),
  },
  "Q3 2024": {
    slides: null,
    filings: staticFiles("f38ea150-4a56-4a49-a194-4f7cc307d2c3"),
  },
  "Q2 2024": {
    slides: null,
    filings: staticFiles("ccb36463-8c76-48c3-b015-0002220da659"),
  },
  "Q1 2024": {
    slides: null,
    filings: staticFiles("11faa4bb-7b7b-4fe2-8453-a51fc5f2c946"),
  },
  "Q4 2023": {
    slides: null,
    filings: staticFiles("a6d6b678-4cec-4315-a1c1-a63666f3cb6e"),
  },
  "Q3 2023": {
    slides: null,
    filings: staticFiles("5c212952-6da7-4460-99e4-0fdfc7384c3e"),
  },
  "Q2 2023": {
    slides: null,
    filings: staticFiles("3bfc5b3d-d58e-4b4f-bf4a-ff89017f1327"),
  },
  "Q1 2023": {
    slides: null,
    filings: staticFiles("11079737-a6a5-4b47-a47b-7470b0691582"),
  },
  "Q4 2022": {
    slides: null,
    filings: staticFiles("e8177f3c-c955-4ceb-81cd-f6795cc84841"),
  },
  "Q3 2022": {
    slides: null,
    filings: staticFiles("662dd2e2-83fe-4e59-a852-49f9695dea09"),
  },
  "Q2 2022": {
    slides: null,
    filings: staticFiles("f19cc988-29ac-4895-b07a-fc730b41e8a7"),
  },
  "Q1 2022": {
    slides: null,
    filings: staticFiles("5bc632b7-b603-4f17-b34b-9bfb27814409"),
  },
};

export function isShopRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|supplemental|transcript|webcast|investor[-_\s]*day|\.xls/i.test(
    n,
  );
}

export function isShopIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (
      !(
        host === "shopifyinvestors.gcs-web.com" ||
        host === "investors.shopify.com" ||
        host.endsWith(".shopify.com")
      )
    ) {
      return false;
    }
    if (!/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)) return false;
    return !isShopRejected(url);
  } catch {
    return false;
  }
}

export function mergeShopKnownQuarterDocs(): Map<string, ShopQuarterDocs> {
  return new Map(Object.entries(SHOP_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
