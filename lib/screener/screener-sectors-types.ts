export type ScreenerSectorRow = {
  rank: number;
  sector: string;
  marketCapUsd: number;
  marketCapDisplay: string;
  /** Market-cap-weighted 1D % from EODHD screener snapshot (`refund1dP`) for names in this sector. */
  change1D: number | null;
};
