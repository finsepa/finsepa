export type ScreenerIndustryRow = {
  rank: number;
  sector: string;
  industry: string;
  marketCapUsd: number;
  marketCapDisplay: string;
  /** Market-cap-weighted 1D % from EODHD screener snapshot (`refund1dP`). */
  change1D: number | null;
  /** Market-cap-weighted YTD % from snapshot when present. */
  changeYTD: number | null;
};
