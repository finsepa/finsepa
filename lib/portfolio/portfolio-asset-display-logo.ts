import { getCryptoLogoUrl, isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { isCustomPortfolioSymbol } from "@/lib/portfolio/custom-asset-symbol";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";

/**
 * Logo URL for portfolio UI — Logo.dev (+ curated top-10 domains), same as screener / stock header.
 * Pure resolution (no backend calls). Ignores legacy persisted `logoUrl` in tables that use this.
 */
export function displayLogoUrlForPortfolioSymbol(symbol: string): string {
  const sym = symbol.trim().toUpperCase();
  if (!sym || sym === "USD") return "";
  if (isCustomPortfolioSymbol(sym)) return "";
  if (isSupportedCryptoAssetSymbol(sym)) return getCryptoLogoUrl(sym);
  return resolveEquityLogoUrlFromTicker(sym);
}
