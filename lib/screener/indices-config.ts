export type MarketIndexKey = "sp500" | "nasdaq100" | "dowjones" | "russell2000" | "vix";

export type MarketIndexConfig = {
  name: string;
  /** Fully qualified provider symbol, e.g. GSPC.INDX or IWM.US */
  eodhdSymbol: string;
};

export const MARKET_INDICES_TODAY: MarketIndexConfig[] = [
  {
    name: "S&P 500",
    eodhdSymbol: "GSPC.INDX",
  },
  {
    name: "Nasdaq 100",
    eodhdSymbol: "NDX.INDX",
  },
  {
    name: "Dow Jones",
    eodhdSymbol: "DJI.INDX",
  },
  {
    name: "Russell 2000",
    // EODHD INDX feed does not expose a reliable Russell 2000 index symbol on this plan.
    // Use IWM as liquid Russell 2000 ETF proxy so cards still show real market movement.
    eodhdSymbol: "IWM.US",
  },
  {
    name: "VIX",
    eodhdSymbol: "VIX.INDX",
  },
];

