import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  netCashUsd,
  normalizeUsdForDisplay,
  totalNetWorth,
  unrealizedProfitPct,
} from "@/lib/portfolio/overview-metrics";
import { lifetimeEquityProfitUsd } from "@/lib/portfolio/realized-pnl-from-trades";

/** Snapshot fields for `/portfolios` cards; omit or null → UI shows "—". */
export type PublicPortfolioListingMetrics = {
  valueUsd?: number | null;
  totalProfitUsd?: number | null;
  totalProfitPct?: number | null;
  spyReturnPct?: number | null;
  dividendsYieldPct?: number | null;
};

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

  return {
    valueUsd,
    totalProfitUsd,
    totalProfitPct,
    spyReturnPct: null,
    dividendsYieldPct: null,
  };
}
