import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";

/**
 * EODHD-style spot pair label for UI (aligned with list-supported-crypto-currencies): `BTC-USD`, `TRX-USD`.
 * Internal routes and APIs keep the base ticker (e.g. `/crypto/BTC`); use this only for display.
 */
export function eodhdCryptoSpotTickerDisplay(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (!s || s === "USD") return s;
  const base = s.replace(/-(USD|USDT|US)$/i, "");
  if (!isSupportedCryptoAssetSymbol(base) && !isSupportedCryptoAssetSymbol(s)) {
    return s;
  }
  return `${base}-USD`;
}
