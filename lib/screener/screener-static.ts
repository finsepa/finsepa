import type { Top10Ticker } from "@/lib/screener/top10-config";

/** Mock / fallback fields when live quote is unavailable. */
export type ScreenerStaticRow = {
  id: number;
  name: string;
  ticker: string;
  price: number;
  change1D: number;
  change1M: number;
  changeYTD: number;
  marketCap: string;
  pe: number;
  trend: number[];
};

/** UI + API row (live or fallback). PE and market cap are display strings ("-" when unknown). */
export type ScreenerTableRow = {
  id: number;
  name: string;
  ticker: string;
  logoUrl: string;
  price: number;
  change1D: number;
  change1M: number;
  changeYTD: number;
  marketCap: string;
  pe: string;
  trend: number[];
};

export const screenerStaticByTicker: Record<Top10Ticker, ScreenerStaticRow> = {
  AAPL: {
    id: 1,
    name: "Apple",
    ticker: "AAPL",
    price: 207.23,
    change1D: 0.36,
    change1M: -1.48,
    changeYTD: 16.06,
    marketCap: "$3.22 T",
    pe: 34.35,
    trend: [3, 4, 3, 5, 4, 6, 5, 7],
  },
  MSFT: {
    id: 2,
    name: "Microsoft",
    ticker: "MSFT",
    price: 417.14,
    change1D: 0.18,
    change1M: -1.11,
    changeYTD: 9.42,
    marketCap: "$3.00 T",
    pe: 32.1,
    trend: [4, 3, 5, 4, 5, 4, 6, 5],
  },
  NVDA: {
    id: 3,
    name: "NVIDIA",
    ticker: "NVDA",
    price: 123.61,
    change1D: 0.18,
    change1M: 12.0,
    changeYTD: 183.0,
    marketCap: "$2.928 T",
    pe: 72.85,
    trend: [2, 3, 4, 5, 5, 6, 7, 8],
  },
  GOOGL: {
    id: 4,
    name: "Alphabet",
    ticker: "GOOGL",
    price: 104.25,
    change1D: 0.05,
    change1M: 1.6,
    changeYTD: 21.51,
    marketCap: "$2.021 T",
    pe: 23.38,
    trend: [5, 4, 6, 5, 6, 5, 7, 6],
  },
  AMZN: {
    id: 5,
    name: "Amazon",
    ticker: "AMZN",
    price: 161.93,
    change1D: 0.24,
    change1M: 6.96,
    changeYTD: 31.3,
    marketCap: "$1.873 T",
    pe: 42.16,
    trend: [4, 5, 4, 6, 5, 7, 6, 8],
  },
  META: {
    id: 6,
    name: "Meta Platforms",
    ticker: "META",
    price: 485.0,
    change1D: 0.12,
    change1M: 2.5,
    changeYTD: 15.0,
    marketCap: "$1.2 T",
    pe: 26.0,
    trend: [5, 5, 6, 5, 6, 6, 7, 7],
  },
  "BRK-B": {
    id: 7,
    name: "Berkshire Hathaway",
    ticker: "BRK-B",
    price: 444.51,
    change1D: 0.24,
    change1M: -3.66,
    changeYTD: 24.79,
    marketCap: "$1.025 T",
    pe: 14.12,
    trend: [6, 5, 5, 4, 4, 3, 4, 3],
  },
  TSM: {
    id: 8,
    name: "TSMC",
    ticker: "TSM",
    price: 174.54,
    change1D: 0.05,
    change1M: 8.06,
    changeYTD: 88.23,
    marketCap: "$890.44 B",
    pe: 30.95,
    trend: [5, 4, 4, 3, 3, 2, 3, 2],
  },
  LLY: {
    id: 9,
    name: "Eli Lilly",
    ticker: "LLY",
    price: 165.72,
    change1D: -0.78,
    change1M: -9.14,
    changeYTD: 38.28,
    marketCap: "$960.02 B",
    pe: 113.7,
    trend: [6, 5, 5, 4, 3, 3, 2, 2],
  },
  TSLA: {
    id: 10,
    name: "Tesla",
    ticker: "TSLA",
    price: 248.5,
    change1D: 1.15,
    change1M: -5.23,
    changeYTD: 44.6,
    marketCap: "$791.20 B",
    pe: 66.4,
    trend: [3, 4, 5, 3, 5, 6, 5, 7],
  },
};
