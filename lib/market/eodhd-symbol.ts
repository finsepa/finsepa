import "server-only";

/** EODHD US composite: BRK-B → BRK-B.US */
export function toEodhdUsSymbol(ticker: string): string {
  return `${ticker.replace(/\./g, "-")}.US`;
}

/**
 * Accepts either:
 * - raw ticker (e.g. AAPL, BRK-B) => default exchange suffix appended
 * - fully qualified symbol (e.g. GSPC.INDX, IWM.US) => used as-is
 */
export function toEodhdSymbol(symbolOrTicker: string, defaultExchange = "US"): string {
  const s = symbolOrTicker.trim();
  if (!s) return s;
  if (s.includes(".")) return s;
  return `${s.replace(/\./g, "-")}.${defaultExchange}`;
}
