import { format, parseISO, subDays } from "date-fns";

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type { PublicPortfolioListingSnapshot } from "@/lib/portfolio/public-listing-snapshot";
import { portfolioDietzForWindow } from "@/lib/portfolio/benchmark/benchmark-engine";
import {
  lifetimeEquityProfitPct,
  netCashUsd,
  normalizeUsdForDisplay,
  totalNetWorth,
} from "@/lib/portfolio/overview-metrics";
import { parsePublicListingSnapshotFromMetrics } from "@/lib/portfolio/public-listing-snapshot";
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
  /**
   * Legacy cost-based open P/L %. Kept for older listings; directory UI prefers
   * {@link timeWeightedReturnPct}.
   */
  returnsAthPct?: number | null;
  /**
   * Inception Modified Dietz % (same methodology as overview “Time-weighted return”),
   * using current net worth as V_end and V_start = 0 before first activity.
   */
  timeWeightedReturnPct?: number | null;
  ownerDisplayName?: string | null;
  ownerAvatarUrl?: string | null;
  /** Read-only community detail view (`/portfolios/[id]`). */
  snapshot?: PublicPortfolioListingSnapshot;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Inception Dietz % from ledger + current NAV — no historical EOD bars required. */
export function inceptionTimeWeightedReturnPct(
  transactions: readonly PortfolioTransaction[],
  portfolioValueEnd: number,
): number | null {
  if (!Number.isFinite(portfolioValueEnd)) return null;
  let firstYmd: string | null = null;
  for (const t of transactions) {
    if (!YMD_RE.test(t.date)) continue;
    if (firstYmd == null || t.date < firstYmd) firstYmd = t.date;
  }
  if (!firstYmd) return null;
  const firstDt = parseISO(firstYmd);
  if (Number.isNaN(firstDt.getTime())) return null;
  const startYmd = format(subDays(firstDt, 1), "yyyy-MM-dd");
  const endYmd = format(new Date(), "yyyy-MM-dd");
  if (startYmd >= endYmd) return null;
  const { pct } = portfolioDietzForWindow({
    transactions,
    vStart: 0,
    vEnd: portfolioValueEnd,
    startYmd,
    endYmd,
  });
  return pct != null && Number.isFinite(pct) ? pct : null;
}

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

  const pct = lifetimeEquityProfitPct(holdings, transactions);
  const totalProfitPct = pct != null && Number.isFinite(pct) ? pct : null;
  const timeWeightedReturnPct =
    valueUsd != null ? inceptionTimeWeightedReturnPct(transactions, valueUsd) : null;

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
    timeWeightedReturnPct,
  };
}

function metricNum(metrics: Record<string, unknown>, key: string): number | null {
  const v = metrics[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** True when directory card scalars are present (legacy rows without a snapshot). */
export function publicListingCardMetricsReady(metrics: Record<string, unknown>): boolean {
  if (parsePublicListingSnapshotFromMetrics(metrics)) return true;
  const valueUsd = metricNum(metrics, "valueUsd");
  const returnPct =
    metricNum(metrics, "timeWeightedReturnPct") ??
    metricNum(metrics, "returnsAthPct") ??
    metricNum(metrics, "totalProfitPct");
  const holdingCount = metricNum(metrics, "holdingCount");
  return valueUsd != null && returnPct != null && holdingCount != null;
}

/**
 * Recomputes card scalars from an embedded snapshot so `/portfolios` cards stay aligned with
 * the published holdings even when stored jsonb metrics are stale.
 */
export function enrichPublicListingCardMetrics(metrics: Record<string, unknown>): {
  metrics: Record<string, unknown>;
  ready: boolean;
} {
  const snapshot = parsePublicListingSnapshotFromMetrics(metrics);
  if (snapshot) {
    const computed = computePublicPortfolioListingMetrics(snapshot.holdings, snapshot.transactions);
    return {
      metrics: {
        ...computed,
        ownerDisplayName: metrics.ownerDisplayName,
        ownerAvatarUrl: metrics.ownerAvatarUrl,
        snapshot: metrics.snapshot,
      },
      ready: true,
    };
  }
  return { metrics, ready: publicListingCardMetricsReady(metrics) };
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
