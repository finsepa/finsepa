import "server-only";

import { formatMarketCapCompactNoCurrency, formatPeCompact } from "@/lib/screener/eod-derived-metrics";
import type { Top10Ticker } from "@/lib/screener/top10-config";

/** Static display caps for screener tables (live prices come from EODHD). Amounts chosen so M Cap shows varied T/B with two decimals. */
export const REDUCED_STOCKS: Record<
  Top10Ticker,
  { ticker: Top10Ticker; name: string; marketCapUsd: number; pe: number }
> = {
  AAPL: { ticker: "AAPL", name: "Apple", marketCapUsd: 3.2 * 1e12, pe: 30 },
  MSFT: { ticker: "MSFT", name: "Microsoft", marketCapUsd: 3.05 * 1e12, pe: 32 },
  NVDA: { ticker: "NVDA", name: "NVIDIA", marketCapUsd: 2.12 * 1e12, pe: 65 },
  GOOGL: { ticker: "GOOGL", name: "Alphabet", marketCapUsd: 1.88 * 1e12, pe: 23 },
  AMZN: { ticker: "AMZN", name: "Amazon", marketCapUsd: 1.94 * 1e12, pe: 42 },
  META: { ticker: "META", name: "Meta Platforms", marketCapUsd: 1.17 * 1e12, pe: 26 },
  "BRK-B": { ticker: "BRK-B", name: "Berkshire Hathaway", marketCapUsd: 1.02 * 1e12, pe: 14 },
  TSM: { ticker: "TSM", name: "TSMC", marketCapUsd: 900.25 * 1e9, pe: 31 },
  LLY: { ticker: "LLY", name: "Eli Lilly", marketCapUsd: 958.4 * 1e9, pe: 114 },
  TSLA: { ticker: "TSLA", name: "Tesla", marketCapUsd: 783.65 * 1e9, pe: 66 },
};

/** Matches `CRYPTO_TOP10` order in eodhd-crypto (display-only market caps). */
export const REDUCED_CRYPTO: Record<string, { symbol: string; name: string; marketCapUsd: number }> = {
  BTC: { symbol: "BTC", name: "Bitcoin", marketCapUsd: 1.65 * 1e12 },
  ETH: { symbol: "ETH", name: "Ethereum", marketCapUsd: 385.5 * 1e9 },
  XRP: { symbol: "XRP", name: "XRP", marketCapUsd: 118.35 * 1e9 },
  BNB: { symbol: "BNB", name: "BNB", marketCapUsd: 92.08 * 1e9 },
  SOL: { symbol: "SOL", name: "Solana", marketCapUsd: 81.42 * 1e9 },
  DOGE: { symbol: "DOGE", name: "Dogecoin", marketCapUsd: 24.6 * 1e9 },
  ADA: { symbol: "ADA", name: "Cardano", marketCapUsd: 19.85 * 1e9 },
  TRX: { symbol: "TRX", name: "TRON", marketCapUsd: 17.22 * 1e9 },
  LINK: { symbol: "LINK", name: "Chainlink", marketCapUsd: 11.95 * 1e9 },
  AVAX: { symbol: "AVAX", name: "Avalanche", marketCapUsd: 9.88 * 1e9 },
  /** Screener page 2 — display-only caps aligned with {@link CRYPTO_SCREENER_PAGE2}. */
  TON: { symbol: "TON", name: "Toncoin", marketCapUsd: 8.2 * 1e9 },
  POL: { symbol: "POL", name: "Polygon", marketCapUsd: 2.1 * 1e9 },
  DOT: { symbol: "DOT", name: "Polkadot", marketCapUsd: 6.5 * 1e9 },
  ATOM: { symbol: "ATOM", name: "Cosmos", marketCapUsd: 2.8 * 1e9 },
  LTC: { symbol: "LTC", name: "Litecoin", marketCapUsd: 7.1 * 1e9 },
  BCH: { symbol: "BCH", name: "Bitcoin Cash", marketCapUsd: 6.9 * 1e9 },
  NEAR: { symbol: "NEAR", name: "NEAR Protocol", marketCapUsd: 3.4 * 1e9 },
  UNI: { symbol: "UNI", name: "Uniswap", marketCapUsd: 4.2 * 1e9 },
  XLM: { symbol: "XLM", name: "Stellar", marketCapUsd: 2.9 * 1e9 },
  FIL: { symbol: "FIL", name: "Filecoin", marketCapUsd: 1.9 * 1e9 },
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
