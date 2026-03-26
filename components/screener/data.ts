import { TOP10_TICKERS } from "@/lib/screener/top10-config";
import { screenerStaticByTicker } from "@/lib/screener/screener-static";

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

/** Legacy mock table shape — only top 10 tickers, same order as live screener. */
export const screenerData: ScreData[] = TOP10_TICKERS.map((t, index) => {
  const r = screenerStaticByTicker[t];
  return {
    id: r.id,
    name: r.name,
    ticker: r.ticker,
    price: r.price,
    change1D: r.change1D,
    change1M: r.change1M,
    changeYTD: r.changeYTD,
    marketCap: r.marketCap,
    pe: r.pe,
    trend: r.trend,
    starred: index === 0,
  };
});

export const logoColors: Record<string, { bg: string; text: string; border: string }> = {
  Apple: { bg: "bg-neutral-800", text: "text-white", border: "border-neutral-700" },
  Microsoft: { bg: "bg-[#00a4ef]", text: "text-white", border: "border-blue-300" },
  NVIDIA: { bg: "bg-[#76b900]", text: "text-white", border: "border-green-400" },
  Alphabet: { bg: "bg-white", text: "text-blue-500", border: "border-neutral-200" },
  Amazon: { bg: "bg-[#ff9900]", text: "text-white", border: "border-orange-300" },
  "Meta Platforms": { bg: "bg-[#0668E1]", text: "text-white", border: "border-blue-400" },
  "Berkshire Hathaway": { bg: "bg-neutral-700", text: "text-white", border: "border-neutral-600" },
  TSMC: { bg: "bg-[#e8002d]", text: "text-white", border: "border-red-300" },
  "Eli Lilly": { bg: "bg-[#d52b1e]", text: "text-white", border: "border-red-300" },
  Tesla: { bg: "bg-[#cc0000]", text: "text-white", border: "border-red-400" },
};
