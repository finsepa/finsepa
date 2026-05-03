export type ScreenerSectorRow = {
  rank: number;
  sector: string;
  marketCapUsd: number;
  marketCapDisplay: string;
  /** Market-cap-weighted 1D % from EODHD screener snapshot (`refund1dP`) for names in this sector. */
  change1D: number | null;
  /**
   * Market-cap-weighted YTD % from EODHD screener snapshot (`refundYtdP`) when present on rows;
   * otherwise filled from a matching SPDR Select Sector ETF (see `screener-sector-etf-ytd.ts`).
   */
  changeYTD: number | null;
};
