import "server-only";

import {
  computePublicPortfolioListingMetrics,
  publicListingCardMetricsReady,
} from "@/lib/portfolio/public-listing-metrics";
import { parsePublicListingSnapshotFromMetrics } from "@/lib/portfolio/public-listing-snapshot";
import { quoteHoldingsToMarketServer } from "@/lib/portfolio/portfolio-live-quotes-server";
import { computePortfolioDietzPeriods } from "@/lib/portfolio/returns/portfolio-dietz-periods.server";

/** Like {@link enrichPublicListingCardMetrics} but marks snapshot holdings to market first. */
export async function enrichPublicListingCardMetricsLive(
  metrics: Record<string, unknown>,
): Promise<{ metrics: Record<string, unknown>; ready: boolean }> {
  const snapshot = parsePublicListingSnapshotFromMetrics(metrics);
  if (!snapshot) {
    return { metrics, ready: publicListingCardMetricsReady(metrics) };
  }

  const quotedHoldings = await quoteHoldingsToMarketServer(snapshot.holdings);
  const computed = computePublicPortfolioListingMetrics(quotedHoldings, snapshot.transactions);

  let return1YPct: number | null = null;
  try {
    const periods = await computePortfolioDietzPeriods(snapshot.transactions, ["y1"]);
    const pct = periods.y1?.pct;
    if (pct != null && Number.isFinite(pct)) return1YPct = pct;
  } catch {
    // Directory still usable without 1Y — client may fall back.
  }

  return {
    metrics: {
      ...computed,
      return1YPct,
      ownerDisplayName: metrics.ownerDisplayName,
      ownerAvatarUrl: metrics.ownerAvatarUrl,
      snapshot: { holdings: quotedHoldings, transactions: snapshot.transactions },
    },
    ready: true,
  };
}
