import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";

function normalizeStockRouteKey(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return s;
  // Keep only the leading token (handles `NFLX (US)` from some imports/UIs).
  const head = s.split(/\s|\(/)[0] ?? s;
  // Keep ticker-ish characters.
  return head.replace(/[^A-Z0-9.\-]/g, "");
}

function normalizeStockHoldingSymbol(raw: string): string {
  const s = normalizeStockRouteKey(raw);
  // Allow provider-qualified symbols in ledger (NFLX.US) and dash/dot variants (BRK-B vs BRK.B).
  return s.replace(/\.(US|INDX)$/i, "").replace(/-/g, ".");
}

/** Match a ledger/holding `symbol` to the asset page route key (stock ticker or crypto base). */
export function portfolioSymbolMatchesAssetRoute(params: {
  holdingSymbol: string;
  routeKey: string;
  kind: "stock" | "crypto";
}): boolean {
  const key = params.kind === "stock" ? normalizeStockRouteKey(params.routeKey) : params.routeKey.trim().toUpperCase();
  if (!key) return false;
  if (params.kind === "stock") {
    return normalizeStockHoldingSymbol(params.holdingSymbol) === normalizeStockHoldingSymbol(key);
  }
  return cryptoRouteBase(params.holdingSymbol) === key;
}
