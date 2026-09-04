import "server-only";

import { formatMarketCapCompactNoCurrency, formatPeCompact } from "@/lib/screener/eod-derived-metrics";
import type { Top10Ticker } from "@/lib/screener/top10-config";

/**
 * Display-only market caps for screener page 1. Must be strictly descending in the fixed top-10 row
 * order (`top10-config` tickers) so the M Cap column matches a largest-first ranking.
 */
export const REDUCED_STOCKS: Record<
  Top10Ticker,
  { ticker: Top10Ticker; name: string; marketCapUsd: number; pe: number }
> = {
  AAPL: { ticker: "AAPL", name: "Apple", marketCapUsd: 3.2 * 1e12, pe: 30 },
  MSFT: { ticker: "MSFT", name: "Microsoft", marketCapUsd: 3.05 * 1e12, pe: 32 },
  NVDA: { ticker: "NVDA", name: "NVIDIA", marketCapUsd: 2.12 * 1e12, pe: 65 },
  GOOGL: { ticker: "GOOGL", name: "Alphabet", marketCapUsd: 1.94 * 1e12, pe: 23 },
  AMZN: { ticker: "AMZN", name: "Amazon", marketCapUsd: 1.88 * 1e12, pe: 42 },
  META: { ticker: "META", name: "Meta Platforms", marketCapUsd: 1.17 * 1e12, pe: 26 },
  "BRK-B": { ticker: "BRK-B", name: "Berkshire Hathaway", marketCapUsd: 1.02 * 1e12, pe: 14 },
  TSM: { ticker: "TSM", name: "TSMC", marketCapUsd: 958.4 * 1e9, pe: 31 },
  LLY: { ticker: "LLY", name: "Eli Lilly", marketCapUsd: 900.25 * 1e9, pe: 114 },
  TSLA: { ticker: "TSLA", name: "Tesla", marketCapUsd: 783.65 * 1e9, pe: 66 },
};

/** Matches liquid screener universe (display-only caps when provider/snapshot miss). */
export const REDUCED_CRYPTO: Record<string, { symbol: string; name: string; marketCapUsd: number }> = {
  BTC: { symbol: "BTC", name: "Bitcoin", marketCapUsd: 1.62 * 1e12 },
  ETH: { symbol: "ETH", name: "Ethereum", marketCapUsd: 306 * 1e9 },
  USDT: { symbol: "USDT", name: "Tether", marketCapUsd: 183 * 1e9 },
  BNB: { symbol: "BNB", name: "BNB", marketCapUsd: 96 * 1e9 },
  XRP: { symbol: "XRP", name: "XRP", marketCapUsd: 91 * 1e9 },
  USDC: { symbol: "USDC", name: "USD Coin", marketCapUsd: 74 * 1e9 },
  SOL: { symbol: "SOL", name: "Solana", marketCapUsd: 61 * 1e9 },
  TRX: { symbol: "TRX", name: "TRON", marketCapUsd: 31 * 1e9 },
  HYPE: { symbol: "HYPE", name: "Hyperliquid", marketCapUsd: 22 * 1e9 },
  ZEC: { symbol: "ZEC", name: "Zcash", marketCapUsd: 16 * 1e9 },
  DOGE: { symbol: "DOGE", name: "Dogecoin", marketCapUsd: 14 * 1e9 },
  XMR: { symbol: "XMR", name: "Monero", marketCapUsd: 9.4 * 1e9 },
  LINK: { symbol: "LINK", name: "Chainlink", marketCapUsd: 8.9 * 1e9 },
  LEO: { symbol: "LEO", name: "UNUS SED LEO", marketCapUsd: 8.6 * 1e9 },
  ADA: { symbol: "ADA", name: "Cardano", marketCapUsd: 8.1 * 1e9 },
  TON: { symbol: "TON", name: "Toncoin", marketCapUsd: 3.8 * 1e9 },
  AVAX: { symbol: "AVAX", name: "Avalanche", marketCapUsd: 3.8 * 1e9 },
  BCH: { symbol: "BCH", name: "Bitcoin Cash", marketCapUsd: 5.1 * 1e9 },
  LTC: { symbol: "LTC", name: "Litecoin", marketCapUsd: 4.0 * 1e9 },
  DOT: { symbol: "DOT", name: "Polkadot", marketCapUsd: 6.5 * 1e9 },
  DAI: { symbol: "DAI", name: "Dai", marketCapUsd: 4.6 * 1e9 },
  SUI: { symbol: "SUI", name: "Sui", marketCapUsd: 5.0 * 1e9 },
  UNI: { symbol: "UNI", name: "Uniswap", marketCapUsd: 3.9 * 1e9 },
  POL: { symbol: "POL", name: "Polygon", marketCapUsd: 2.1 * 1e9 },
  ATOM: { symbol: "ATOM", name: "Cosmos", marketCapUsd: 2.8 * 1e9 },
  NEAR: { symbol: "NEAR", name: "NEAR Protocol", marketCapUsd: 3.4 * 1e9 },
  XLM: { symbol: "XLM", name: "Stellar", marketCapUsd: 6.4 * 1e9 },
  FIL: { symbol: "FIL", name: "Filecoin", marketCapUsd: 1.9 * 1e9 },
  MNT: { symbol: "MNT", name: "Mantle", marketCapUsd: 2.3 * 1e9 },
  SEI: { symbol: "SEI", name: "Sei", marketCapUsd: 1.7 * 1e9 },
  PYTH: { symbol: "PYTH", name: "Pyth Network", marketCapUsd: 1.4 * 1e9 },
  JUP: { symbol: "JUP", name: "Jupiter", marketCapUsd: 1.9 * 1e9 },
  STRK: { symbol: "STRK", name: "Starknet", marketCapUsd: 1.6 * 1e9 },
  WLD: { symbol: "WLD", name: "Worldcoin", marketCapUsd: 2.6 * 1e9 },
  ONDO: { symbol: "ONDO", name: "Ondo", marketCapUsd: 3.2 * 1e9 },
};

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

export function reducedStockMarketCapDisplay(ticker: Top10Ticker): string {
  return formatMarketCapCompactNoCurrency(REDUCED_STOCKS[ticker].marketCapUsd);
}

export function reducedStockPeDisplay(ticker: Top10Ticker): string {
  return formatPeCompact(REDUCED_STOCKS[ticker].pe);
}

export function reducedCryptoMarketCapDisplay(symbol: string): string {
  const row = REDUCED_CRYPTO[symbol.toUpperCase()];
  if (!row) return "—";
  return formatMarketCapCompactNoCurrency(row.marketCapUsd);
}
