import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { portfolioSymbolMatchesAssetRoute } from "@/lib/portfolio/portfolio-asset-route-match";

export function assetRouteKeyForHolding(holding: PortfolioHolding): {
  routeKey: string;
  kind: "stock" | "crypto";
} {
  const cryptoKey = cryptoRouteBase(holding.symbol);
  const kind: "stock" | "crypto" = isSupportedCryptoAssetSymbol(cryptoKey) ? "crypto" : "stock";
  const routeKey = kind === "crypto" ? cryptoKey : holding.symbol.trim().toUpperCase();
  return { routeKey, kind };
}

function isDisplayTradeRow(t: PortfolioTransaction): boolean {
  if (t.kind !== "trade") return false;
  const op = t.operation.trim().toLowerCase();
  return op === "buy" || op === "sell";
}

/** Trade rows for one holding, newest first. */
export function tradeTransactionsForHolding(
  transactions: readonly PortfolioTransaction[],
  holding: PortfolioHolding,
  limit?: number,
): PortfolioTransaction[] {
  const { routeKey, kind } = assetRouteKeyForHolding(holding);
  const rows = transactions.filter(
    (t) =>
      isDisplayTradeRow(t) &&
      portfolioSymbolMatchesAssetRoute({ holdingSymbol: t.symbol, routeKey, kind }),
  );
  rows.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return b.id.localeCompare(a.id);
  });
  return limit != null ? rows.slice(0, limit) : rows;
}
