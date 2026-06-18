import "server-only";

import {
  computePublicPortfolioListingMetrics,
  publicListingCardMetricsReady,
} from "@/lib/portfolio/public-listing-metrics";
import { parsePublicListingSnapshotFromMetrics } from "@/lib/portfolio/public-listing-snapshot";
import { quoteHoldingsToMarketServer } from "@/lib/portfolio/portfolio-live-quotes-server";

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
  return {
    metrics: {
      ...computed,
      ownerDisplayName: metrics.ownerDisplayName,
      ownerAvatarUrl: metrics.ownerAvatarUrl,
      snapshot: { holdings: quotedHoldings, transactions: snapshot.transactions },
    },
    ready: true,
  };
}
