export type ScreenerIndustryRow = {
  rank: number;
  sector: string;
  industry: string;
  marketCapUsd: number;
  marketCapDisplay: string;
  /** Market-cap-weighted 1D % from EODHD screener snapshot (`refund1dP`). */
  change1D: number | null;
  /**
   * Market-cap-weighted YTD % from EODHD screener snapshot when present;
   * otherwise the parent sector’s SPDR Select Sector ETF YTD proxy (same source as Sectors tab).
   */
  changeYTD: number | null;
};
