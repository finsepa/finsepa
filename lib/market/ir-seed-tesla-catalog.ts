/**
 * Tesla IR docs: shareholder Update PDF (Slides) + Form 10-Q / 10-K HTML (Filings).
 * Cloudinary hosts Updates through Q2 2025; later quarters live on assets-ir.tesla.com.
 * Tesla does not publish a separate IR press PDF — 10-Q/10-K is the distinct second doc.
 */

export type TeslaQuarterDocs = { slides?: string; filings?: string };

const CLOUDINARY = "https://digitalassets.tesla.com/tesla-contents/image/upload/IR";
const ASSETS_IR = "https://assets-ir.tesla.com/tesla-contents/IR";
const TSLA_EDGAR = "https://www.sec.gov/Archives/edgar/data/1318605";

function tslaTenQ(accn: string, file: string): string {
  return `${TSLA_EDGAR}/${accn}/${file}`;
}

export function teslaCloudinaryUpdateUrl(fq: number, fy: number): string {
  return `${CLOUDINARY}/TSLA-Q${fq}-${fy}-Update.pdf`;
}

export function teslaAssetsIrUpdateUrl(fq: number, fy: number): string {
  return `${ASSETS_IR}/TSLA-Q${fq}-${fy}-Update.pdf`;
}

/**
 * GET/browser-verified Update PDFs that Cloudinary 404s, plus every in-scope 10-Q/10-K.
 * Accession dirs are unhyphenated EDGAR accession numbers.
 */
export const TESLA_KNOWN_QUARTER_DOCS: Readonly<Record<string, TeslaQuarterDocs>> = {
  "Q1 2022": { filings: tslaTenQ("000095017022006034", "tsla-20220331.htm") },
  "Q2 2022": { filings: tslaTenQ("000095017022012936", "tsla-20220630.htm") },
  "Q3 2022": { filings: tslaTenQ("000095017022019867", "tsla-20220930.htm") },
  "Q4 2022": { filings: tslaTenQ("000095017023001409", "tsla-20221231.htm") },
  "Q1 2023": { filings: tslaTenQ("000095017023013890", "tsla-20230331.htm") },
  "Q2 2023": { filings: tslaTenQ("000095017023033872", "tsla-20230630.htm") },
  "Q3 2023": { filings: tslaTenQ("000162828023034847", "tsla-20230930.htm") },
  "Q4 2023": { filings: tslaTenQ("000162828024002390", "tsla-20231231.htm") },
  "Q1 2024": { filings: tslaTenQ("000162828024017503", "tsla-20240331.htm") },
  "Q2 2024": { filings: tslaTenQ("000162828024032662", "tsla-20240630.htm") },
  "Q3 2024": { filings: tslaTenQ("000162828024043486", "tsla-20240930.htm") },
  "Q4 2024": { filings: tslaTenQ("000162828025003063", "tsla-20241231.htm") },
  "Q1 2025": { filings: tslaTenQ("000162828025018911", "tsla-20250331.htm") },
  "Q2 2025": { filings: tslaTenQ("000162828025035806", "tsla-20250630.htm") },
  "Q3 2025": {
    slides: teslaAssetsIrUpdateUrl(3, 2025),
    filings: tslaTenQ("000162828025045968", "tsla-20250930.htm"),
  },
  "Q4 2025": {
    slides: teslaAssetsIrUpdateUrl(4, 2025),
    filings: tslaTenQ("000162828026003952", "tsla-20251231.htm"),
  },
  "Q1 2026": {
    slides: teslaAssetsIrUpdateUrl(1, 2026),
    filings: tslaTenQ("000162828026026673", "tsla-20260331.htm"),
  },
  "Q2 2026": {
    slides: teslaAssetsIrUpdateUrl(2, 2026),
    filings: tslaTenQ("000162828026049270", "tsla-20260630.htm"),
  },
};

export function teslaKnownDocsForQuarter(fq: number, fy: number): TeslaQuarterDocs | undefined {
  return TESLA_KNOWN_QUARTER_DOCS[`Q${fq} ${fy}`];
}
