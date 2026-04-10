import { eodhdCryptoSpotTickerDisplay } from "@/lib/crypto/eodhd-crypto-ticker-display";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";

const PREFIX = "CUST:";

export function isCustomPortfolioSymbol(symbol: string): boolean {
  return symbol.trim().toUpperCase().startsWith(PREFIX);
}

/**
 * Deterministic symbol from the display name so multiple buys of the same custom asset merge.
 */
export function customPortfolioSymbolFromName(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  let h = 5381;
  for (let i = 0; i < n.length; i++) {
    h = Math.imul(h, 33) ^ n.charCodeAt(i);
  }
  return `${PREFIX}${(h >>> 0).toString(16)}`;
}

/** Second line under the asset name in portfolio tables (hide opaque `CUST:` ids). */
export function portfolioAssetSymbolCaption(symbol: string): string {
  if (isCustomPortfolioSymbol(symbol)) return "Custom asset";
  const s = symbol.trim().toUpperCase();
  const base = s.replace(/-(USD|USDT|US)$/i, "");
  if (isSupportedCryptoAssetSymbol(base) || isSupportedCryptoAssetSymbol(s)) {
    return eodhdCryptoSpotTickerDisplay(symbol);
  }
  return symbol;
}
