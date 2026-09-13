/** Marvell (MRVL) IR — Jan FY. Slides = Financial and Business Results; Filings = Additional Earnings Information. Never HTML press, 10-Q, or M&A decks. */

export type MrvlQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** Issuer FY ends ~Jan 31. */
export const MRVL_FY_END = "01-31";

export const MRVL_IR_PAGES = [
  "https://investor.marvell.com/financial-information/financial-results",
] as const;

const CDN = "https://d1io3yog0oux5.cloudfront.net/_955449e79cdc39fc2ca8c27164bb5c67/marvell";

/**
 * Browser-verified catalog (issuer FY labels). Exact CDN hrefs from IR financial-results.
 * Empty slides when only Additional Information was published. Never Celestial AI / HTML press.
 */
export const MRVL_KNOWN_QUARTER_DOCS: Readonly<Record<string, MrvlQuarterDocs>> = {
  "Q2 2027": {
    slides: `${CDN}/db/3734/35391/presentation/2026_08_27_Marvell_Q2_FY27_financial_business_results_FINAL+%281%29.pdf`,
    filings: `${CDN}/db/3734/35391/additional_earnings_information/MRVL+Q2%2727+Additional+Information_FINAL+v2.pdf`,
  },
  "Q1 2027": {
    slides: `${CDN}/db/3734/35382/presentation/2026_05_27_Marvell_Q1_FY27_financial_business_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35382/additional_earnings_information/MRVL+Q1%2727+Additional+Information_FINAL.pdf`,
  },
  "Q4 2026": {
    slides: `${CDN}/db/3735/35341/file/2026_03_05_Marvell_Q4_FY26_financial_business_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35338/additional_earnings_information/MRVL+Q4%2726+Additional+Information_FINAL_V2.pdf`,
  },
  "Q3 2026": {
    slides: `${CDN}/db/3734/35296/presentation/2025_12_02_Marvell_Q3_FY26_financial_business_results.pdf`,
    filings: `${CDN}/db/3734/35296/additional_earnings_information/MRVL+Q3%2726+Additional+Information_FINAL_V2.pdf`,
  },
  "Q2 2026": {
    slides: `${CDN}/db/3734/35216/presentation/2025_8_28_Marvell_Q2_FY26_financial_business_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35216/additional_earnings_information/MRVL_Q226_Additional_Information_FINAL.pdf`,
  },
  "Q1 2026": {
    slides: `${CDN}/db/3734/35088/presentation/2025_5_29_Marvell_Q1_FY26_financial_business_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35088/additional_earnings_information/MRVL_Q126_Additional_Information_FINAL.pdf`,
  },
  "Q4 2025": {
    slides: `${CDN}/db/3734/35087/presentation/2025_3_05_Marvell_Q4_FY25_financial_business_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35087/additional_earnings_information/MRVL_Q425_Additional_Information_FINAL.pdf`,
  },
  "Q3 2025": {
    slides: `${CDN}/db/3734/35086/presentation/2024_12_03_Marvell_Q3_FY25_financial_business_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35086/additional_earnings_information/MRVL_Q3-25_Additional_Information.pdf`,
  },
  "Q2 2025": {
    slides: `${CDN}/db/3734/35085/presentation/2025_08_29_Marvell_Q2_FY25_financial_business_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35085/additional_earnings_information/MRVL_Q2-25_Additional_Information_FINAL.pdf`,
  },
  "Q1 2025": {
    slides: `${CDN}/db/3734/35084/presentation/2025_05_30_marvell_q1_fy25_financial_business_results.pdf`,
    filings: `${CDN}/db/3734/35084/additional_earnings_information/MRVL%2520Q1%2725%2520Additional%2520Information_FINAL.pdf`,
  },
  "Q4 2024": {
    slides: `${CDN}/db/3734/35083/presentation/2024_03_07_marvell_q4_fy24_highlights_financial_results.pdf`,
    filings: `${CDN}/db/3734/35083/additional_earnings_information/MRVL_Q4-24_Additional_Information_FINAL.pdf`,
  },
  "Q3 2024": {
    slides: `${CDN}/db/3734/35082/presentation/2023_11_30_Marvell_Q3_FY24_highlights_financial_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35082/additional_earnings_information/MRVL_Q3%2724_Additional_Information_FINAL.pdf`,
  },
  "Q2 2024": {
    slides: `${CDN}/db/3734/35081/presentation/2023_08_24_Marvell_Q2_FY24_highlights_financial_results_FINAL.pdf`,
    filings: `${CDN}/db/3734/35081/additional_earnings_information/MRVL%2520Q2%2724%2520Additional%2520Information_FINAL.pdf`,
  },
  "Q1 2024": {
    slides: `${CDN}/db/3734/35080/presentation/marvell-q1-fy24-highlights-financial-results.pdf`,
    filings: `${CDN}/db/3734/35080/additional_earnings_information/mrvl-q124-additional-information.pdf`,
  },
  "Q4 2023": {
    slides: null,
    filings: `${CDN}/db/3734/35079/additional_earnings_information/mrvl-q423-additional-information.pdf`,
  },
  "Q3 2023": {
    slides: null,
    filings: `${CDN}/db/3734/35078/additional_earnings_information/MRVL%2BQ3%2723%2BAdditional%2BInformation%2BFINAL.pdf`,
  },
  "Q2 2023": {
    slides: null,
    filings: `${CDN}/db/3734/35077/additional_earnings_information/MRVL_Q2%2723_Additional_Information_FINAL.pdf`,
  },
  "Q1 2023": {
    slides: null,
    filings: `${CDN}/db/3734/35076/additional_earnings_information/MRVL%2BQ1%2723%2BAdditional%2BInformation%2BFINAL%2Bv3.pdf`,
  },
  "Q4 2022": {
    slides: null,
    filings: `${CDN}/db/3734/35075/additional_earnings_information/MRVL%2BQ4%252722%2BAdditional%2BInformation_FINAL.pdf`,
  },
  "Q3 2022": {
    slides: null,
    filings: `${CDN}/db/3734/35074/additional_earnings_information/MRVL_Q3%252722_Additional_Information_FINAL.pdf`,
  },
  "Q2 2022": {
    slides: null,
    filings: `${CDN}/db/3734/35073/additional_earnings_information/MRVL_Q2%2722_Additional_Information_FINAL.pdf`,
  },
  "Q1 2022": {
    slides: null,
    filings: `${CDN}/db/3734/35072/additional_earnings_information/MRVL%2BQ1%252722%2BAdditional%2BInformation%2BFINAL.pdf`,
  },
};

export function isMrvlRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return (
    /sec\.gov|8-?k|10-?q|10-?k|transcript|celestial|acquire|acquisition/i.test(n) ||
    /press-releases\/detail/i.test(n)
  );
}

export function isMrvlIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    /d1io3yog0oux5\.cloudfront\.net\/.*\/marvell\//i.test(url) &&
    /\.pdf(?:$|[?#])/i.test(url) &&
    !isMrvlRejected(url)
  );
}

export function mergeMrvlKnownQuarterDocs(): Map<string, MrvlQuarterDocs> {
  return new Map(Object.entries(MRVL_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
