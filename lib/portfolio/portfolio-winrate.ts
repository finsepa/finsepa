/**
 * Insights Winrate — parity with iOS `PortfolioWinrateStats`.
 * Fully closed symbols by realized P/L; break-evens (|usd| < $0.005) excluded.
 */

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { portfolioHoldingAssetHref } from "@/lib/crypto/crypto-picker-universe";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { portfolioSymbolMatchesAssetRoute } from "@/lib/portfolio/portfolio-asset-route-match";
import { cumulativeRealizedStatsForAsset } from "@/lib/portfolio/realized-pnl-from-trades";

/** Same ±$0.005 cutoffs as iOS `PortfolioWinrateStats`. */
export const PORTFOLIO_WINRATE_EPS_USD = 0.005;

export type PortfolioWinratePosition = {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  realizedUsd: number;
  realizedPercent: number | null;
  assetHref: string | null;
};

export type PortfolioWinrateStats = {
  winners: PortfolioWinratePosition[];
  losers: PortfolioWinratePosition[];
  total: number;
  /** 0…1 share of winners among decisive closes. */
  winShare: number;
  winnersUsd: number;
  losersUsd: number;
  isEmpty: boolean;
};

function isCashLikeSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  return s === "USD" || s === "CASH" || s === "US DOLLAR";
}

function holdingStillOpen(
  holdings: readonly PortfolioHolding[],
  routeKey: string,
  assetKind: "stock" | "crypto",
): boolean {
  return holdings.some(
    (h) =>
      !isCashLikeSymbol(h.symbol) &&
      h.shares > 1e-9 &&
      portfolioSymbolMatchesAssetRoute({
        holdingSymbol: h.symbol,
        routeKey,
        kind: assetKind,
      }),
  );
}

/** Closed trade symbols (had a sell, no open lot) — same idea as holdings-performance stubs. */
export function closedWinrateCandidateSymbols(
  holdings: readonly PortfolioHolding[],
  transactions: readonly PortfolioTransaction[],
): { symbol: string; name: string }[] {
  const seen = new Set<string>();
  const out: { symbol: string; name: string }[] = [];

  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    const op = t.operation.trim().toLowerCase();
    if (op !== "sell") continue;
    const raw = t.symbol.trim();
    if (!raw || isCashLikeSymbol(raw)) continue;
    const routeKey = cryptoRouteBase(raw);
    if (seen.has(routeKey)) continue;
    const assetKind: "stock" | "crypto" = isSupportedCryptoAssetSymbol(routeKey) ? "crypto" : "stock";
    if (holdingStillOpen(holdings, routeKey, assetKind)) continue;
    // Need at least one matching buy/sell history for this asset.
    const hasTradeHistory = transactions.some(
      (x) =>
        x.kind === "trade" &&
        portfolioSymbolMatchesAssetRoute({
          holdingSymbol: x.symbol,
          routeKey,
          kind: assetKind,
        }),
    );
    if (!hasTradeHistory) continue;
    seen.add(routeKey);
    out.push({ symbol: raw.toUpperCase(), name: t.name?.trim() || raw.toUpperCase() });
  }
  return out;
}

export function formatWinratePercentLabel(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function buildPortfolioWinrateStats(
  holdings: readonly PortfolioHolding[],
  transactions: readonly PortfolioTransaction[],
): PortfolioWinrateStats {
  const positions: PortfolioWinratePosition[] = [];

  for (const cand of closedWinrateCandidateSymbols(holdings, transactions)) {
    const routeKey = cryptoRouteBase(cand.symbol);
    const assetKind: "stock" | "crypto" = isSupportedCryptoAssetSymbol(routeKey) ? "crypto" : "stock";
    const { realizedGainUsd, realizedCostBasisUsd } = cumulativeRealizedStatsForAsset(
      [...transactions],
      routeKey,
      assetKind,
    );
    if (!Number.isFinite(realizedGainUsd)) continue;
    // Skip empty noise (matches holdings-performance closed stub filter).
    if (
      Math.abs(realizedGainUsd) < PORTFOLIO_WINRATE_EPS_USD &&
      realizedCostBasisUsd < PORTFOLIO_WINRATE_EPS_USD
    ) {
      continue;
    }
    const realizedPercent =
      realizedCostBasisUsd > 0 ? (realizedGainUsd / realizedCostBasisUsd) * 100 : null;
    positions.push({
      id: `closed:${routeKey}`,
      symbol: cand.symbol,
      name: cand.name,
      logoUrl: displayLogoUrlForPortfolioSymbol(cand.symbol) || null,
      realizedUsd: realizedGainUsd,
      realizedPercent,
      assetHref: portfolioHoldingAssetHref(cand.symbol, { tab: "holdings" }),
    });
  }

  const winners = positions
    .filter((p) => p.realizedUsd >= PORTFOLIO_WINRATE_EPS_USD)
    .sort((a, b) => b.realizedUsd - a.realizedUsd);
  const losers = positions
    .filter((p) => p.realizedUsd <= -PORTFOLIO_WINRATE_EPS_USD)
    .sort((a, b) => a.realizedUsd - b.realizedUsd);

  const total = winners.length + losers.length;
  const winShare = total > 0 ? winners.length / total : 0;
  const winnersUsd = winners.reduce((s, p) => s + p.realizedUsd, 0);
  const losersUsd = losers.reduce((s, p) => s + p.realizedUsd, 0);

  return {
    winners,
    losers,
    total,
    winShare,
    winnersUsd,
    losersUsd,
    isEmpty: total === 0,
  };
}
