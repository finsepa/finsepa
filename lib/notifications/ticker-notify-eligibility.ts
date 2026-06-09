import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { isCustomPortfolioSymbol } from "@/lib/portfolio/custom-asset-symbol";
import { WATCHLIST_CRYPTO_PREFIX, WATCHLIST_INDEX_PREFIX } from "@/lib/watchlist/constants";
import { earningsScopeKey } from "@/lib/market/earnings-scope-filter";

/** US equity tickers we can query on EODHD calendar (excludes crypto, indices, custom assets). */
export function isEarningsNotifiableTicker(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (isCustomPortfolioSymbol(s)) return false;
  const upper = s.toUpperCase();
  if (upper.startsWith(WATCHLIST_CRYPTO_PREFIX) || upper.startsWith(WATCHLIST_INDEX_PREFIX)) {
    return false;
  }
  if (isSupportedCryptoAssetSymbol(upper) || isSupportedCryptoAssetSymbol(upper.replace(/-(USD|USDT|US)$/i, ""))) {
    return false;
  }
  if (upper.includes(":")) return false;
  return /^[A-Z0-9][A-Z0-9.\-]{0,14}$/i.test(upper);
}

/**
 * Listing ticker for EODHD calendar + notification fan-out (e.g. `BF.B`, `CHWY`).
 * Do **not** use {@link canonicalEarningsScopeKey} here — collapsing `BF.B` → `BF` queries the wrong symbol (`BF.US`).
 */
export function canonicalNotifyTicker(raw: string): string {
  return earningsScopeKey(raw);
}

/** EODHD listing code for calendar batch (`BRK.B` → `BRK-B.US`). */
export function eodhdCalendarCodeFromTicker(ticker: string): string {
  return `${ticker.trim().toUpperCase().replace(/\./g, "-")}.US`;
}
