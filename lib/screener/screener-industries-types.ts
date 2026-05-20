export type ScreenerIndustryRow = {
  rank: number;
  sector: string;
  industry: string;
  marketCapUsd: number;
  marketCapDisplay: string;
  /** Market-cap-weighted 1D % from EODHD screener snapshot (`refund1dP`). */
  change1D: number | null;
  /**
   * Market-cap-weighted YTD %: EODHD screener `refundYtdP` per name when present, else YTD from
   * cached daily EOD bars for that industry’s universe constituents.
   */
  changeYTD: number | null;
};
