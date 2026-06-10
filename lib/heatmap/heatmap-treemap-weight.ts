import type { HeatmapLeaf, HeatmapMarket } from "@/lib/heatmap/heatmap-types";

/**
 * Visual-only treemap weight for crypto. BTC dominates by market cap; compress it slightly
 * so alt tiles stay readable. Tooltips and data still use true `marketCapUsd`.
 */
const CRYPTO_BTC_TREEMAP_FACTOR = 0.72;

export function heatmapTreemapLayoutWeight(leaf: HeatmapLeaf, market: HeatmapMarket): number {
  const cap = leaf.marketCapUsd;
  if (!Number.isFinite(cap) || cap <= 0) return 1;
  if (market === "crypto" && leaf.ticker.toUpperCase() === "BTC") {
    return cap * CRYPTO_BTC_TREEMAP_FACTOR;
  }
  return cap;
}

export function heatmapLeavesForTreemapLayout(
  leaves: HeatmapLeaf[],
  market: HeatmapMarket,
): HeatmapLeaf[] {
  if (market !== "crypto") return leaves;
  return leaves.map((leaf) => ({
    ...leaf,
    marketCapUsd: heatmapTreemapLayoutWeight(leaf, market),
  }));
}
