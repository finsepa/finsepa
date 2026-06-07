import {
  MarketTabsSkeleton,
  ScreenerMarketTabSkeleton,
  type ScreenerMarketTabSkeletonVariant,
} from "@/components/markets/markets-skeletons";

/** In-page skeleton while screener market data streams (no outer page padding). */
export function ScreenerContentSkeleton({
  market = "Stocks",
}: {
  market?: ScreenerMarketTabSkeletonVariant;
}) {
  return (
    <div className="min-w-0 w-full max-w-full">
      <MarketTabsSkeleton />
      <ScreenerMarketTabSkeleton tab={market} />
    </div>
  );
}
