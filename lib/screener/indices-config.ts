export type MarketIndexKey = "sp500" | "nasdaq100" | "dowjones" | "russell2000" | "vix";

export type MarketIndexConfig = {
  name: string;
  /** Fully qualified provider symbol, e.g. GSPC.INDX or IWM.US */
  eodhdSymbol: string;
  /** Fallback values (used only if EODHD fails). */
  fallbackPrice: number;
  fallbackChangePercent1D: number;
  fallbackSparklineToday: number[];
};

export const MARKET_INDICES_TODAY: MarketIndexConfig[] = [
  {
    name: "S&P 500",
    eodhdSymbol: "GSPC.INDX",
    fallbackPrice: 5648.4,
    fallbackChangePercent1D: 0.44,
    fallbackSparklineToday: [30, 32, 29, 33, 31, 34, 32, 35, 34, 37, 36, 38],
  },
  {
    name: "Nasdaq 100",
    eodhdSymbol: "NDX.INDX",
    fallbackPrice: 17713.53,
    fallbackChangePercent1D: 1.13,
    fallbackSparklineToday: [28, 30, 27, 32, 30, 33, 32, 36, 34, 38, 37, 40],
  },
  {
    name: "Dow Jones",
    eodhdSymbol: "DJI.INDX",
    fallbackPrice: 41563.08,
    fallbackChangePercent1D: 0.55,
    fallbackSparklineToday: [32, 31, 33, 30, 34, 32, 35, 33, 36, 35, 37, 38],
  },
  {
    name: "Russell 2000",
    // EODHD INDX feed does not expose a reliable Russell 2000 index symbol on this plan.
    // Use IWM as liquid Russell 2000 ETF proxy so cards still show real market movement.
    eodhdSymbol: "IWM.US",
    fallbackPrice: 2217.63,
    fallbackChangePercent1D: 0.67,
    fallbackSparklineToday: [25, 27, 24, 28, 26, 29, 27, 30, 28, 31, 30, 32],
  },
  {
    name: "VIX",
    eodhdSymbol: "VIX.INDX",
    fallbackPrice: 15.0,
    fallbackChangePercent1D: -4.15,
    fallbackSparklineToday: [38, 36, 37, 34, 35, 32, 33, 30, 31, 28, 27, 25],
  },
];

