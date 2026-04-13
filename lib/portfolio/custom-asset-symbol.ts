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

/**
 * Short unit label for the holdings quantity line (e.g. `1.20 BTC`, `15 AAPL`).
 * Custom assets return `null` so the UI can show digits only.
 */
export function portfolioSharesUnitTicker(symbol: string): string | null {
  if (isCustomPortfolioSymbol(symbol)) return null;
  const s = symbol.trim().toUpperCase();
  /** Spot-style pairs always show base ticker (works even if asset is outside supported logo list). */
  const sansQuote = s.replace(/-(USD|USDT|US)$/i, "");
  if (sansQuote !== s && sansQuote.length > 0) {
    return sansQuote;
  }

  const caption = portfolioAssetSymbolCaption(symbol);
  if (!caption) return null;

  const withoutUsdPair = caption.replace(/-USD$/i, "");
  if (withoutUsdPair !== caption && withoutUsdPair.length > 0) {
    return withoutUsdPair;
  }

  const dot = caption.indexOf(".");
  if (dot > 0) return caption.slice(0, dot);
  return caption;
}
