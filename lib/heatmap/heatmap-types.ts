export type HeatmapMarket = "stocks" | "crypto";

/** Performance window for coloring tiles. */
export type HeatmapMetric = "1d" | "5d" | "1m" | "ytd";

export type HeatmapLeaf = {
  id: string;
  ticker: string;
  name: string;
  /** Sector for stocks; for crypto, a single grouping label (e.g. "Cryptocurrencies"). */
  sector: string;
  /**
   * Industry / sub-sector for stocks (EODHD). For crypto, matches sector so the treemap stays one level deep.
   */
  industry: string;
  marketCapUsd: number;
  changePct: number | null;
  /** Last price / spot for tooltip (USD). */
  price: number | null;
  /** Up to 5 recent closes for mini sparkline (oldest → newest). */
  sparkline5d: number[];
};

export type HeatmapPagePayload = {
  market: HeatmapMarket;
  metric: HeatmapMetric;
  leaves: HeatmapLeaf[];
};
