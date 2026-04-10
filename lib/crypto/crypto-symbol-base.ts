/**
 * Client-safe helpers: normalize `BASE-USD` / `BASE-USDT` / `.CC` tickers to a route/logo key.
 */

const USD_PAIR_RE = /^([A-Z0-9]+)-(USD|USDT|EUR|GBP)$/i;

/** If `symbol` is a fiat crypto pair, return the base (e.g. `FLOKI-USD` → `FLOKI`). */
export function cryptoUsdPairBase(symbol: string): string | null {
  const raw = symbol.trim().toUpperCase();
  const noCc = raw.replace(/\.CC$/i, "");
  const m = USD_PAIR_RE.exec(noCc);
  return m ? m[1]!.toUpperCase() : null;
}

/** Base ticker for `/crypto/[symbol]` and Logo.dev `kind=crypto` (strips pair / .CC). */
export function cryptoRouteBase(symbol: string): string {
  const u = symbol.trim().toUpperCase();
  return cryptoUsdPairBase(u) ?? u.replace(/\.CC$/i, "");
}
