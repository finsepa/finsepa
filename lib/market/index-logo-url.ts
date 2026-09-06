/**
 * Bundled TradingView-style index marks (same assets as iOS `IndexLogoAssets`).
 * logo.dev coverage for indices is weak — prefer these static public PNGs.
 */

const INDEX_LOGO_BY_KEY: Record<string, string> = {
  GSPC: "/indices/logo-index-spx.png",
  SPX: "/indices/logo-index-spx.png",
  SP500: "/indices/logo-index-spx.png",
  INX: "/indices/logo-index-spx.png",
  NDX: "/indices/logo-index-ndx.png",
  NDAQ: "/indices/logo-index-ndx.png",
  COMP: "/indices/logo-index-ndx.png",
  DJI: "/indices/logo-index-dji.png",
  DJIA: "/indices/logo-index-dji.png",
  DJ: "/indices/logo-index-dji.png",
  RUT: "/indices/logo-index-rut.png",
  RTY: "/indices/logo-index-rut.png",
  IWM: "/indices/logo-index-rut.png",
  VIX: "/indices/logo-index-vix.png",
  HSI: "/indices/logo-index-hsi.png",
  FCHI: "/indices/logo-index-cac.png",
  CAC40: "/indices/logo-index-cac.png",
  CAC: "/indices/logo-index-cac.png",
  GDAXI: "/indices/logo-index-dax.png",
  DAX: "/indices/logo-index-dax.png",
  N225: "/indices/logo-index-n225.png",
  NKY: "/indices/logo-index-n225.png",
  BUK100P: "/indices/logo-index-ftse.png",
  FTSE: "/indices/logo-index-ftse.png",
  FTSE100: "/indices/logo-index-ftse.png",
  UKX: "/indices/logo-index-ftse.png",
};

/** Strip `INDEX:` / exchange suffix (`GSPC.INDX` → `GSPC`, `IWM.US` → `IWM`). */
export function normalizeIndexLogoKey(symbol: string): string {
  let raw = symbol.trim().toUpperCase();
  if (raw.startsWith("INDEX:")) raw = raw.slice("INDEX:".length).trim();
  const dot = raw.indexOf(".");
  if (dot > 0) return raw.slice(0, dot);
  return raw;
}

/** Public path for a known index mark, or `null` to fall back to remote / initials. */
export function indexLogoPublicPath(symbol: string | null | undefined): string | null {
  if (!symbol?.trim()) return null;
  return INDEX_LOGO_BY_KEY[normalizeIndexLogoKey(symbol)] ?? null;
}
