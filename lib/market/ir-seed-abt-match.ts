/**
 * Abbott (ABT) IR — calendar FY.
 * Filings-only: quarterly earnings press-release PDFs on abbottinvestor.com/static-files.
 * No dedicated quarterly earnings slide decks (infographics are marketing one-pagers, not Slides).
 * Never SEC HTML / JP Morgan conference decks.
 */

export type AbtQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const GCS = "https://www.abbottinvestor.com/static-files";

function sf(uuid: string): string {
  return `${GCS}/${uuid}`;
}

export const ABT_IR_PAGES = [
  "https://www.abbottinvestor.com/news-and-events/events",
  "https://www.abbott.com/en-us/investors",
] as const;

/** Press Release → Filings; Slides always null. */
export const ABT_KNOWN_QUARTER_DOCS: Readonly<Record<string, AbtQuarterDocs>> = {
  "Q2 2026": { slides: null, filings: sf("6050fc59-d0ce-4bd6-afea-8a2f2ab80208") },
  "Q1 2026": { slides: null, filings: sf("040a2210-05dd-4a47-a6a2-3ff50a0690ee") },
  "Q4 2025": { slides: null, filings: sf("e7102a55-9033-47da-a653-0cebb2a1fcdd") },
  "Q3 2025": { slides: null, filings: sf("71d60ac6-cb57-4670-9090-cd93f6dd6047") },
  "Q2 2025": { slides: null, filings: sf("d29680e6-bfbf-49ef-91f5-1edcf357e7ca") },
  "Q1 2025": { slides: null, filings: sf("63889d6b-1d90-4674-9c97-9ed46f225aad") },
  "Q4 2024": { slides: null, filings: sf("3dcb47ba-03c7-45df-88c0-5ca586292984") },
  "Q3 2024": { slides: null, filings: sf("92eef1fb-fdaf-4e1f-8b1e-30822718ef64") },
  "Q2 2024": { slides: null, filings: sf("1c377df8-3b8d-4a1f-8392-40cbf0f5ef83") },
  "Q1 2024": { slides: null, filings: sf("7429a42b-4e0b-419b-99ac-0fedd39920df") },
  "Q4 2023": { slides: null, filings: sf("d62c72af-f479-4d79-9746-8934204a6587") },
  "Q3 2023": { slides: null, filings: sf("caff7f02-591b-40db-b9e7-6668d29072c3") },
  "Q2 2023": { slides: null, filings: sf("96d2d088-4656-4bc5-94b1-bbaab50e8d40") },
  "Q1 2023": { slides: null, filings: sf("584bf51b-bd96-47f0-822b-ffb913b5cc01") },
  "Q4 2022": { slides: null, filings: sf("d502f92e-e4ec-49de-96ce-3a96c2513f54") },
  "Q3 2022": { slides: null, filings: sf("8e421525-22d5-42a3-8c9a-a1345fd4d2f5") },
  "Q2 2022": { slides: null, filings: sf("e0f3de7d-de44-4c89-9ba8-df6d34e6ce70") },
  "Q1 2022": { slides: null, filings: sf("daee226f-455f-4193-aaaa-293cbf082608") },
};

export function isAbtRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|form\s*8-?k|8-?k\b|10-?q|10-?k|j\.?p\.?\s*morgan|conference(?!\s*call)|transcript|webcast|infographic/i.test(
    n,
  );
}

export function isAbtIrStaticFiles(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    /(?:www\.)?abbottinvestor\.com\/static-files\/[a-f0-9-]{36}/i.test(url) && !isAbtRejected(url)
  );
}

export function mergeAbtKnownQuarterDocs(): Map<string, AbtQuarterDocs> {
  return new Map(Object.entries(ABT_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
