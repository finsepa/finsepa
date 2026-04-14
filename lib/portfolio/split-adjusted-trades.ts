import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { portfolioSymbolMatchesAssetRoute } from "@/lib/portfolio/portfolio-asset-route-match";
import { splitRatioFromTransaction } from "@/lib/portfolio/split-ratio-from-transaction";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";

export type SplitAdjustedTrade = {
  shares: number;
  price: number;
};

function symbolKeyForSplitMath(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (!s) return s;
  // Handle things like `NFLX (US)` by taking the first token.
  const head = s.split(/\s|\(/)[0] ?? s;
  const cleaned = head.replace(/[^A-Z0-9.\-]/g, "");
  // Crypto pairs / .CC normalize via cryptoRouteBase.
  const cryptoKey = cryptoRouteBase(cleaned);
  if (cryptoKey !== cleaned) return cryptoKey;
  // Stocks: allow provider-qualified symbols (NFLX.US) and dash/dot variants (BRK-B vs BRK.B).
  return cleaned.replace(/\.(US|INDX)$/i, "").replace(/-/g, ".");
}

/**
 * Display-only split adjustment for trades.
 *
 * Split rows are stored as `kind="trade"`, `operation="Split"`, with `price` = forward split ratio
 * (new shares per 1 share held, e.g. 7 for a 7:1 split).
 *
 * We adjust earlier trades so historical prices/shares match today’s post-split units:
 * - shares *= product(ratio for splits after the trade date)
 * - price  /= product(ratio for splits after the trade date)
 */
export function splitAdjustedTradeForDisplay(
  t: PortfolioTransaction,
  allTransactions: readonly PortfolioTransaction[],
): SplitAdjustedTrade | null {
  if (t.kind !== "trade") return null;
  const op = t.operation.trim().toLowerCase();
  if (op !== "buy" && op !== "sell") return null;

  const sym = symbolKeyForSplitMath(t.symbol);
  const date = t.date;

  let factor = 1;
  for (const row of allTransactions) {
    if (row.kind !== "trade") continue;
    if (symbolKeyForSplitMath(row.symbol) !== sym) continue;
    const ratio = splitRatioFromTransaction(row);
    if (ratio == null) continue;
    // Apply splits that happen after the trade.
    if (row.date <= date) continue;
    factor *= ratio;
  }

  if (!(factor > 0) || factor === 1 || !Number.isFinite(factor)) {
    return { shares: t.shares, price: t.price };
  }

  return {
    shares: t.shares * factor,
    price: t.price / factor,
  };
}

/**
 * Pre-compute split-adjusted shares/price for every buy/sell trade row in {@link allTransactions}.
 * Returns a Map keyed by transaction id.
 */
export function buildSplitAdjustedTradeIndex(
  allTransactions: readonly PortfolioTransaction[],
): Map<string, SplitAdjustedTrade> {
  const splitsBySymbol = new Map<string, { date: string; ratio: number }[]>();
  for (const t of allTransactions) {
    if (t.kind !== "trade") continue;
    const ratio = splitRatioFromTransaction(t);
    if (ratio == null) continue;
    const sym = symbolKeyForSplitMath(t.symbol);
    const list = splitsBySymbol.get(sym) ?? [];
    list.push({ date: t.date, ratio });
    splitsBySymbol.set(sym, list);
  }
  for (const list of splitsBySymbol.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  const out = new Map<string, SplitAdjustedTrade>();
  for (const t of allTransactions) {
    if (t.kind !== "trade") continue;
    const op = t.operation.trim().toLowerCase();
    if (op !== "buy" && op !== "sell") continue;
    const sym = symbolKeyForSplitMath(t.symbol);
    const splits = splitsBySymbol.get(sym);
    if (!splits || splits.length === 0) continue;
    let factor = 1;
    for (const s of splits) {
      if (s.date <= t.date) continue;
      factor *= s.ratio;
    }
    if (!(factor > 0) || factor === 1 || !Number.isFinite(factor)) continue;
    out.set(t.id, { shares: t.shares * factor, price: t.price / factor });
  }
  return out;
}

/**
 * Like {@link buildSplitAdjustedTradeIndex}, but keyed to an asset route (handles symbol variants by using
 * {@link portfolioSymbolMatchesAssetRoute} instead of strict symbol equality).
 */
export function buildSplitAdjustedTradeIndexForAsset(
  allTransactions: readonly PortfolioTransaction[],
  routeKey: string,
  assetKind: "stock" | "crypto",
): Map<string, SplitAdjustedTrade> {
  const key = routeKey.trim().toUpperCase();
  if (!key) return new Map();

  const splits: { date: string; ratio: number }[] = [];
  for (const t of allTransactions) {
    const ratio = splitRatioFromTransaction(t);
    if (ratio == null) continue;
    if (!portfolioSymbolMatchesAssetRoute({ holdingSymbol: t.symbol, routeKey: key, kind: assetKind })) continue;
    splits.push({ date: t.date, ratio });
  }
  splits.sort((a, b) => a.date.localeCompare(b.date));
  if (splits.length === 0) return new Map();

  const out = new Map<string, SplitAdjustedTrade>();
  for (const t of allTransactions) {
    if (t.kind !== "trade") continue;
    const op = t.operation.trim().toLowerCase();
    if (op !== "buy" && op !== "sell") continue;
    if (!portfolioSymbolMatchesAssetRoute({ holdingSymbol: t.symbol, routeKey: key, kind: assetKind })) continue;

    let factor = 1;
    for (const s of splits) {
      if (s.date <= t.date) continue;
      factor *= s.ratio;
    }
    if (!(factor > 0) || factor === 1 || !Number.isFinite(factor)) continue;
    out.set(t.id, { shares: t.shares * factor, price: t.price / factor });
  }
  return out;
}

