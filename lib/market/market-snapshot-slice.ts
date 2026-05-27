import "server-only";

import { isTop10Ticker, type Top10Ticker } from "@/lib/screener/top10-config";
import type {
  SimpleMarketData,
  SimpleScreenerDerived,
  SimpleScreenerStockDerived,
} from "@/lib/market/simple-market-layer";

/** Subset of {@link SimpleMarketData} for watchlist / page-2 slice without extra EODHD batches. */
export function sliceSimpleMarketDataForStockTickers(
  full: SimpleMarketData,
  stockTickers: string[],
): SimpleMarketData {
  const normalized = [...new Set(stockTickers.map((t) => t.trim().toUpperCase()).filter(Boolean))].sort();
  const stocks = {} as SimpleMarketData["stocks"];
  const extraScreenerStocks: Record<string, SimpleMarketData["extraScreenerStocks"][string]> = {};
  const page2: string[] = [];

  for (const tk of normalized) {
    if (isTop10Ticker(tk)) {
      stocks[tk as Top10Ticker] = full.stocks[tk as Top10Ticker];
      continue;
    }
    const d = full.extraScreenerStocks[tk];
    if (d) {
      extraScreenerStocks[tk] = d;
      page2.push(tk);
    }
  }

  return {
    stocks,
    screenerStocksPage2Tickers: page2,
    extraScreenerStocks,
    crypto: {},
    indices: {},
  };
}

/** Page-1 screener stocks tab: TOP10 quotes only. */
export function sliceSimpleMarketDataScreenerStocksPage1(full: SimpleMarketData): SimpleMarketData {
  return {
    stocks: { ...full.stocks },
    screenerStocksPage2Tickers: [],
    extraScreenerStocks: {},
    crypto: {},
    indices: {},
  };
}

export function pickScreenerDerivedForTickers(
  full: SimpleScreenerDerived,
  tickers: string[],
): Record<string, SimpleScreenerStockDerived> {
  const out: Record<string, SimpleScreenerStockDerived> = {};
  for (const raw of tickers) {
    const tk = raw.trim().toUpperCase();
    if (!tk) continue;
    if (isTop10Ticker(tk)) {
      const d = full.top10[tk as Top10Ticker];
      if (d) out[tk] = d;
      continue;
    }
    const d = full.page2[tk];
    if (d) out[tk] = d;
  }
  return out;
}
