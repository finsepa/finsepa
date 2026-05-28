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
  // If the string already looks like an EODHD-qualified symbol (e.g. AAPL.US, BTC-USD.CC),
  // keep it as-is. Otherwise treat it as a raw ticker where '.' indicates share class
  // and must be converted to '-' before appending the default exchange.
  if (s.includes(".")) {
    const lastDot = s.lastIndexOf(".");
    const suffix = lastDot >= 0 ? s.slice(lastDot + 1) : "";
    if (/^[A-Za-z]{2,8}$/.test(suffix)) return s;
  }
  return `${s.replace(/\./g, "-")}.${defaultExchange}`;
}
