import { pickScreenerPage2Tickers } from "@/lib/screener/pick-screener-page2-tickers";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/** Same order as Screener stocks: curated top 10, then next N by market cap (page 2). */
export function listScreenerEquityTickersOrdered(universe: readonly { ticker: string }[]): string[] {
  return [...TOP10_TICKERS, ...pickScreenerPage2Tickers(universe)];
}
