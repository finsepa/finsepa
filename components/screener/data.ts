export type ScreenerRow = {
  rank: string;
  name: string;
  ticker: string;
  price: string;
  d1: string;
  m1: string;
  ytd: string;
  mcap: string;
  pe: string;
  spark: readonly number[];
  positive: boolean;
};

export const rows: ScreenerRow[] = [
  { rank: "1",  name: "Apple",             ticker: "AAPL",  price: "$207.23", d1: "+0.36%",  m1: "-1.48%",  ytd: "+16.06%",  mcap: "$3.22T",    pe: "34.35",  spark: [30,28,32,27,29,33,31,35,34,38,36,40], positive: true  },
  { rank: "2",  name: "Microsoft",         ticker: "MSFT",  price: "$417.14", d1: "+0.18%",  m1: "-1.11%",  ytd: "+9.42%",   mcap: "$3.00T",    pe: "32.1",   spark: [40,36,38,34,32,35,33,36,34,37,35,38], positive: true  },
  { rank: "3",  name: "NVIDIA",            ticker: "NVDA",  price: "$123.61", d1: "+0.18%",  m1: "+12.00%", ytd: "+183.00%", mcap: "$2.93T",    pe: "72.85",  spark: [20,22,19,24,28,26,32,30,36,38,42,44], positive: true  },
  { rank: "4",  name: "Alphabet",          ticker: "GOOGL", price: "$104.25", d1: "+0.05%",  m1: "+1.6%",   ytd: "+21.51%",  mcap: "$2.02T",    pe: "23.38",  spark: [28,30,27,31,29,26,28,30,32,29,33,31], positive: true  },
];

export type ScreData = {
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
  starred?: boolean;
};

export const screenerData: ScreData[] = [
  { id: 1,  name: "Apple",             ticker: "AAPL",  price: 207.23,  change1D: 0.36,  change1M: -1.48,  changeYTD: 16.06,  marketCap: "$3.22 T",   pe: 34.35,  trend: [3,4,3,5,4,6,5,7],   starred: true  },
  { id: 2,  name: "Microsoft",         ticker: "MSFT",  price: 417.14,  change1D: 0.18,  change1M: -1.11,  changeYTD: 9.42,   marketCap: "$3.00 T",   pe: 32.1,   trend: [4,3,5,4,5,4,6,5]                  },
  { id: 3,  name: "NVIDIA",            ticker: "NVDA",  price: 123.61,  change1D: 0.18,  change1M: 12.0,   changeYTD: 183.0,  marketCap: "$2.928 T",  pe: 72.85,  trend: [2,3,4,5,5,6,7,8]                  },
  { id: 4,  name: "Alphabet",          ticker: "GOOG",  price: 104.25,  change1D: 0.05,  change1M: 1.6,    changeYTD: 21.51,  marketCap: "$2.021 T",  pe: 23.38,  trend: [5,4,6,5,6,5,7,6]                  },
  { id: 5,  name: "Amazon",            ticker: "AMZN",  price: 161.93,  change1D: 0.24,  change1M: 6.96,   changeYTD: 31.3,   marketCap: "$1.873 T",  pe: 42.16,  trend: [4,5,4,6,5,7,6,8]                  },
  { id: 6,  name: "PayPal",            ticker: "PYPL",  price: 81.65,   change1D: 0.05,  change1M: 13.17,  changeYTD: 17.94,  marketCap: "$66.17 B",  pe: 15.98,  trend: [5,4,4,3,3,2,3,4]                  },
  { id: 7,  name: "Berkshire Hathaway",ticker: "BRK-B", price: 444.51,  change1D: 0.24,  change1M: -3.66,  changeYTD: 24.79,  marketCap: "$1.025 T",  pe: 14.12,  trend: [6,5,5,4,4,3,4,3]                  },
  { id: 8,  name: "TSMC",              ticker: "TSM",   price: 174.54,  change1D: 0.05,  change1M: 8.06,   changeYTD: 88.23,  marketCap: "$890.44 B", pe: 30.95,  trend: [5,4,4,3,3,2,3,2]                  },
  { id: 9,  name: "Eli Lilly",         ticker: "LLY",   price: 165.72,  change1D: -0.78, change1M: -9.14,  changeYTD: 38.28,  marketCap: "$960.02 B", pe: 113.70, trend: [6,5,5,4,3,3,2,2]                  },
  { id: 10, name: "Tesla",             ticker: "TSLA",  price: 248.50,  change1D: 1.15,  change1M: -5.23,  changeYTD: 44.60,  marketCap: "$791.20 B", pe: 66.40,  trend: [3,4,5,3,5,6,5,7]                  },
];

export const logoColors: Record<string, { bg: string; text: string; border: string }> = {
  Apple:             { bg: "bg-neutral-800",  text: "text-white",       border: "border-neutral-700"  },
  Microsoft:         { bg: "bg-[#00a4ef]",    text: "text-white",       border: "border-blue-300"     },
  NVIDIA:            { bg: "bg-[#76b900]",    text: "text-white",       border: "border-green-400"    },
  Alphabet:          { bg: "bg-white",        text: "text-blue-500",    border: "border-neutral-200"  },
  Amazon:            { bg: "bg-[#ff9900]",    text: "text-white",       border: "border-orange-300"   },
  PayPal:            { bg: "bg-[#003087]",    text: "text-white",       border: "border-blue-800"     },
  "Berkshire Hathaway": { bg: "bg-neutral-700", text: "text-white",     border: "border-neutral-600"  },
  TSMC:              { bg: "bg-[#e8002d]",    text: "text-white",       border: "border-red-300"      },
  "Eli Lilly":       { bg: "bg-[#d52b1e]",    text: "text-white",       border: "border-red-300"      },
  Tesla:             { bg: "bg-[#cc0000]",    text: "text-white",       border: "border-red-400"      },
};
