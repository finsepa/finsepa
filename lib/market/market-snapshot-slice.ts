import "server-only";

import { isTop10Ticker, TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";
import type {
  SimpleMarketData,
  SimpleMarketDatum,
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

function stockQuoteDatum(full: SimpleMarketData, tk: string): SimpleMarketDatum | undefined {
  if (isTop10Ticker(tk)) return full.stocks[tk as Top10Ticker];
  return full.extraScreenerStocks[tk];
}

function stockQuoteHasUsableData(d: SimpleMarketDatum | undefined): boolean {
  return (
    (d?.price != null && Number.isFinite(d.price)) ||
    (d?.changePercent1D != null && Number.isFinite(d.changePercent1D))
  );
}

/** Watchlist tickers absent from the screener snapshot or with empty quote cells. */
export function stockTickersMissingFromMarketSlice(full: SimpleMarketData, stockTickers: string[]): string[] {
  const normalized = [...new Set(stockTickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  return normalized.filter((tk) => !stockQuoteHasUsableData(stockQuoteDatum(full, tk)));
}

/** Merge on-demand watchlist quotes into a snapshot slice. */
export function mergeWatchlistStockMarketSlice(base: SimpleMarketData, extra: SimpleMarketData): SimpleMarketData {
  const extraScreenerStocks = { ...base.extraScreenerStocks, ...extra.extraScreenerStocks };
  const page2 = [
    ...new Set([...base.screenerStocksPage2Tickers, ...extra.screenerStocksPage2Tickers]),
  ].sort();
  const stocks = { ...base.stocks };
  for (const tk of TOP10_TICKERS) {
    const fetched = extra.stocks[tk];
    if (stockQuoteHasUsableData(fetched)) stocks[tk] = fetched;
  }
  return {
    stocks,
    screenerStocksPage2Tickers: page2,
    extraScreenerStocks,
    crypto: base.crypto,
    indices: base.indices,
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
