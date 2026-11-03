import type { OhlcBar } from "@/lib/market/eodhd-ohlc";

export const CRYPTO_CANDLE_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"] as const;

export type CryptoCandleInterval = (typeof CRYPTO_CANDLE_INTERVALS)[number];

/** Coins without a live minute feed only get daily/weekly candles (EODHD intraday lags ~15–18h). */
export const CRYPTO_DAILY_CANDLE_INTERVALS: readonly CryptoCandleInterval[] = ["1D", "1W"];

export function isCryptoCandleInterval(v: string | null | undefined): v is CryptoCandleInterval {
  return v != null && (CRYPTO_CANDLE_INTERVALS as readonly string[]).includes(v);
}

export function isCryptoIntradayCandleInterval(interval: CryptoCandleInterval): boolean {
  return interval !== "1D" && interval !== "1W";
}

export type CryptoCandlesResponse = {
  symbol: string;
  interval: CryptoCandleInterval;
  candles: OhlcBar[];
  /** Latest candles come from the live minute feed — clients poll and patch the forming candle. */
  live: boolean;
};
