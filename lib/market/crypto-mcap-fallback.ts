/**
 * Approximate USD market caps for screener ranking/display when `crypto_derived` is missing a symbol.
 * Kept free of `server-only` so client-safe sorters can import it.
 */
export const CRYPTO_MCAP_FALLBACK_USD: Readonly<Record<string, number>> = {
  BTC: 1.62e12,
  ETH: 306e9,
  USDT: 183e9,
  BNB: 96e9,
  XRP: 91e9,
  USDC: 74e9,
  SOL: 61e9,
  TRX: 31e9,
  HYPE: 22e9,
  ZEC: 16e9,
  DOGE: 14e9,
  XMR: 9.4e9,
  LINK: 8.9e9,
  LEO: 8.6e9,
  ADA: 8.1e9,
  TON: 3.8e9,
  AVAX: 3.8e9,
  BCH: 5.1e9,
  LTC: 4.0e9,
  DOT: 6.5e9,
  SUI: 5.0e9,
  UNI: 3.9e9,
  POL: 2.1e9,
  ATOM: 2.8e9,
  NEAR: 3.4e9,
  XLM: 6.4e9,
  FIL: 1.9e9,
  MNT: 2.3e9,
  SEI: 1.7e9,
  PYTH: 1.4e9,
  JUP: 1.9e9,
  STRK: 1.6e9,
  WLD: 2.6e9,
  ONDO: 3.2e9,
};

export function cryptoMcapFallbackUsd(symbol: string): number | null {
  const n = CRYPTO_MCAP_FALLBACK_USD[symbol.trim().toUpperCase()];
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}
