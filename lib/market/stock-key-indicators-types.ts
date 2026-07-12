export type StockKeyIndicatorId =
  | "vs_sp500_ytd"
  | "vs_analyst_target"
  | "eps_growth_forecast"
  | "revenue_yoy"
  | "forward_vs_trailing_pe"
  | "beta"
  | "earnings_countdown";

export type StockKeyIndicatorDirection = "up" | "down" | "neutral";

export type StockKeyIndicatorPart = {
  kind: "text" | "emphasis";
  value: string;
};

export type StockKeyIndicator = {
  id: StockKeyIndicatorId;
  direction: StockKeyIndicatorDirection;
  parts: StockKeyIndicatorPart[];
};

/** Persisted snapshot — hot and slow tiers merged at read time. */
export type StockKeyIndicatorsSnapshot = {
  ticker: string;
  slow: {
    computedAt: string;
    indicators: StockKeyIndicator[];
    price: number | null;
  } | null;
  hot: {
    computedAt: string;
    indicator: StockKeyIndicator | null;
    stockYtd: number | null;
    benchYtd: number | null;
  } | null;
};

export type StockKeyIndicatorsResponse = {
  ticker: string;
  computedAt: string | null;
  indicators: StockKeyIndicator[];
};
