/**
 * Allowlist gate for the live crypto 1D pipeline.
 *
 * Scope: BTC only for now. This is intentionally NOT a generic crypto-live abstraction —
 * it exists so we can ship a rolling-24h, ~60s-updating 1D chart for Bitcoin without
 * touching stocks or other crypto assets. Client- and server-safe (no server-only imports).
 */

export const CRYPTO_LIVE_1D_DEFAULT_TICKERS = ["BTC"] as const;

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
 * Long-range crypto charts (5Y / ALL) span many orders of magnitude (BTC: $0.06 → $150k),
 * which collapses years of early history into a flat line on a linear axis. Use a logarithmic
 * price axis for those ranges so the full history reads clearly — like most crypto platforms.
 *
 * Scope: BTC only for now (reuses the live-1D allowlist), price/marketCap series only.
 */
export function usesCryptoLogPriceScale(symbol: string, range: string): boolean {
  if (range !== "5Y" && range !== "ALL") return false;
  return isCryptoLive1DSymbol(symbol);
}
