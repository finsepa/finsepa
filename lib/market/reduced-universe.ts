import "server-only";

import { formatMarketCapCompactNoCurrency, formatPeCompact } from "@/lib/screener/eod-derived-metrics";

export const REDUCED_STOCKS = {
  NVDA: {
    ticker: "NVDA",
    name: "NVIDIA",
    pct7d: null as number | null,
    pct1m: null as number | null,
    ytd: null as number | null,
    marketCapUsd: 2_200_000_000_000,
    pe: 65,
    earningsDisplay: "—",
  },
  AAPL: {
    ticker: "AAPL",
    name: "Apple",
    pct7d: null as number | null,
    pct1m: null as number | null,
    ytd: null as number | null,
    marketCapUsd: 3_200_000_000_000,
    pe: 30,
    earningsDisplay: "—",
  },
} as const;

export const REDUCED_CRYPTO = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    pct7d: null as number | null,
    pct1m: null as number | null,
    ytd: null as number | null,
    marketCapUsd: 1_300_000_000_000,
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    pct7d: null as number | null,
    pct1m: null as number | null,
    ytd: null as number | null,
    marketCapUsd: 400_000_000_000,
  },
} as const;

export const REDUCED_INDICES = {
  SPX: {
    symbol: "GSPC.INDX",
    name: "S&P 500",
    pct7d: null as number | null,
    pct1m: null as number | null,
    ytd: null as number | null,
  },
  NDX: {
    symbol: "NDX.INDX",
    name: "Nasdaq 100",
    pct7d: null as number | null,
    pct1m: null as number | null,
    ytd: null as number | null,
  },
} as const;

export function reducedStockMarketCapDisplay(ticker: keyof typeof REDUCED_STOCKS): string {
  return formatMarketCapCompactNoCurrency(REDUCED_STOCKS[ticker].marketCapUsd);
}

export function reducedStockPeDisplay(ticker: keyof typeof REDUCED_STOCKS): string {
  return formatPeCompact(REDUCED_STOCKS[ticker].pe);
}

export function reducedCryptoMarketCapDisplay(symbol: keyof typeof REDUCED_CRYPTO): string {
  return formatMarketCapCompactNoCurrency(REDUCED_CRYPTO[symbol].marketCapUsd);
}

