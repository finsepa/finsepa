import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  netCashUsd,
  normalizeUsdForDisplay,
  totalNetWorth,
  unrealizedProfitPct,
} from "@/lib/portfolio/overview-metrics";
import { lifetimeEquityProfitUsd } from "@/lib/portfolio/realized-pnl-from-trades";

/** Snapshot fields for `/portfolios` cards (stored in `public_portfolio_listings.metrics` jsonb). */
export type PublicPortfolioListingMetrics = {
  valueUsd?: number | null;
  totalProfitUsd?: number | null;
  totalProfitPct?: number | null;
  spyReturnPct?: number | null;
  dividendsYieldPct?: number | null;
  /** Count of non-cash positions (and cash row if present). */
  holdingCount?: number | null;
  /** Up to 5 tickers by current value (desc). */
  topSymbols?: string[];
  /** Shown as “Returns (ATH)” on the directory card; uses open P/L % until a true ATH snapshot is wired. */
  returnsAthPct?: number | null;
  ownerDisplayName?: string | null;
  ownerAvatarUrl?: string | null;
};

function topSymbolsByValue(holdings: PortfolioHolding[], limit: number): string[] {
  return [...holdings]
    .filter((h) => h.symbol.trim().toUpperCase() !== "USD")
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, limit)
    .map((h) => h.symbol.trim().toUpperCase());
}

export function computePublicPortfolioListingMetrics(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): PublicPortfolioListingMetrics {
  const cash = netCashUsd(transactions);
  const nw = totalNetWorth(holdings, cash);
  const valueUsd = Number.isFinite(nw) ? normalizeUsdForDisplay(nw) : null;

  const profitRaw = lifetimeEquityProfitUsd(holdings, transactions);
  const totalProfitUsd =
    profitRaw != null && Number.isFinite(profitRaw) ? normalizeUsdForDisplay(profitRaw) : null;

  const pct = unrealizedProfitPct(holdings);
  const totalProfitPct = pct != null && Number.isFinite(pct) ? pct : null;

  const holdingCount = holdings.length;

  return {
    valueUsd,
    totalProfitUsd,
    totalProfitPct,
    spyReturnPct: null,
    dividendsYieldPct: null,
    holdingCount,
    topSymbols: topSymbolsByValue(holdings, 5),
    returnsAthPct: totalProfitPct,
  };
}

export function withListingOwner(
  metrics: PublicPortfolioListingMetrics,
  owner: { displayName: string; avatarUrl: string | null },
): PublicPortfolioListingMetrics {
  return {
    ...metrics,
    ownerDisplayName: owner.displayName.trim() || undefined,
    ownerAvatarUrl: owner.avatarUrl,
  };
}
