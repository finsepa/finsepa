import { MOBILE_INSET_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { SkeletonBox } from "@/components/markets/skeleton";
import { KeyIndicatorsSkeleton } from "@/components/stock/key-indicators-skeleton";
import { cn } from "@/lib/utils";

function KeyStatsCardsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading key stats">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className={cn("p-4", MOBILE_INSET_CARD_CLASS)}>
          <SkeletonBox className="mb-3 h-4 w-28 rounded" />
          <div className="space-y-2.5">
            <SkeletonBox className="h-3.5 w-full rounded" />
            <SkeletonBox className="h-3.5 w-[90%] rounded" />
            <SkeletonBox className="h-3.5 w-[75%] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LatestNewsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading news">
      <SkeletonBox className="h-5 w-32 rounded" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2 border-b border-stroke-muted py-3 last:border-b-0">
          <SkeletonBox className="h-3 w-40 rounded" />
          <SkeletonBox className="h-4 w-full max-w-xl rounded" />
          <SkeletonBox className="h-4 w-[85%] max-w-lg rounded" />
        </div>
      ))}
    </div>
  );
}

/** Suspense fallback while overview below-fold (KI / key stats / news) streams. */
export function StockOverviewBelowFoldSkeleton({ isEtf = false }: { isEtf?: boolean }) {
  if (isEtf) return null;
  return (
    <div className="space-y-5">
      <div>
        <KeyIndicatorsSkeleton />
        <KeyStatsCardsSkeleton />
      </div>
      <LatestNewsSkeleton />
    </div>
  );
}
