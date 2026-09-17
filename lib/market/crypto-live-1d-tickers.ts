/**
 * Allowlist gate for the live crypto 1D pipeline.
 *
 * Scope: top coins by market cap (stables excluded) for rolling-24h ~60s 1D charts.
 * Intentionally NOT a generic crypto-live abstraction — client- and server-safe
 * (no server-only imports).
 */

export const CRYPTO_LIVE_1D_DEFAULT_TICKERS = [
  "BTC",
  "ETH",
  "BNB",
  "XRP",
  "SOL",
  "TRX",
  "HYPE",
  "ZEC",
  "DOGE",
  "XMR",
  "LEO",
  "ADA",
  "BCH",
  "LINK",
  "TON",
] as const;

function parseTickerList(raw: string | undefined): string[] {
  if (raw == null) return [];
  return raw
    .split(",")
    .map((s) => normalizeCryptoBaseSymbol(s))
    .filter(Boolean);
}

/**
 * Normalize any crypto symbol form to its base ticker.
 * `BTC-USD.CC` | `BTC-USD` | `btc` | `BTC.CC` → `BTC`
 */
export function normalizeCryptoBaseSymbol(symbol: string): string {
  const up = String(symbol ?? "").trim().toUpperCase();
  if (!up) return "";
  const noSuffix = up.replace(/\.(CC|US)$/i, "");
  const base = noSuffix.split("-")[0] ?? noSuffix;
  return /^[A-Z0-9]{1,12}$/.test(base) ? base : "";
}

/** Env override: `CRYPTO_LIVE_1D_TICKERS=""` disables; a CSV list replaces the default. */
export function cryptoLive1DTickers(): readonly string[] {
  const raw = process.env.CRYPTO_LIVE_1D_TICKERS;
  if (raw === "") return [];
  const fromEnv = parseTickerList(raw);
  if (fromEnv.length) return fromEnv;
  return [...CRYPTO_LIVE_1D_DEFAULT_TICKERS];
}

export function isCryptoLive1DSymbol(symbol: string): boolean {
  const base = normalizeCryptoBaseSymbol(symbol);
  if (!base) return false;
  return cryptoLive1DTickers().includes(base);
}

/**
 * Long-range crypto charts (5Y / ALL) span many orders of magnitude,
 * which collapses years of early history into a flat line on a linear axis. Use a logarithmic
 * price axis for those ranges so the full history reads clearly — like most crypto platforms.
 *
 * Scope: live-1D allowlist (top coins by mcap), price/marketCap series only.
 */
export function usesCryptoLogPriceScale(symbol: string, range: string): boolean {
  if (range !== "5Y" && range !== "ALL") return false;
  return isCryptoLive1DSymbol(symbol);
}
