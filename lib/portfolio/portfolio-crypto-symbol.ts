import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { toSupportedCryptoTicker } from "@/lib/market/crypto-meta";

/** Holding / ledger symbol priced as crypto (same rule on server marks and client live overlay). */
export function isPortfolioCryptoSymbol(sym: string): boolean {
  if (toSupportedCryptoTicker(sym)) return true;
  return isSupportedCryptoAssetSymbol(cryptoRouteBase(sym));
}
