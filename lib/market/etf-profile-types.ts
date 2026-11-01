export type EtfWeight = { label: string; pct: number };

export type EtfHolding = {
  code: string;
  name: string;
  sector: string | null;
  weightPct: number;
  /** Weight × fund AUM (EODHD does not report position market value). */
  valueUsd: number | null;
  logoUrl: string;
  href: string | null;
};

export type EtfProfile = {
  ticker: string;
  name: string | null;
  issuer: string | null;
  indexName: string | null;
  category: string | null;
  inceptionDate: string | null;
  aumUsd: number | null;
  expenseRatioPct: number | null;
  turnoverPct: number | null;
  yieldPct: number | null;
  dividendFrequency: string | null;
  /** EODHD `Holdings_Count` — equals the listed rows (often capped at 10 for large funds). */
  holdingsCount: number | null;
  holdings: EtfHolding[];
  /**
   * Wrapper funds (e.g. an income overlay that holds ~100% of one ETF): the underlying fund's
   * holdings, with weights/values scaled to this fund's exposure.
   */
  lookThrough: { viaCode: string; viaName: string; holdings: EtfHolding[] } | null;
  sectors: EtfWeight[];
  assetAllocation: EtfWeight[];
  regions: EtfWeight[];
  marketCap: EtfWeight[];
  returns: { ytd: number | null; y1: number | null; y3: number | null; y5: number | null; y10: number | null };
  volatility1y: number | null;
  volatility3y: number | null;
  beta: number | null;
  high52w: number | null;
  low52w: number | null;
};
