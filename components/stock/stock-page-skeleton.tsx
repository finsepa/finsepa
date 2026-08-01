import { MOBILE_INSET_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { SkeletonBox } from "@/components/markets/skeleton";
import { KeyIndicatorsSkeleton } from "@/components/stock/key-indicators-skeleton";
import { cn } from "@/lib/utils";

/** Shared loading chrome for `/stock/[ticker]` — route `loading.tsx` and client shell. */
export function StockPageSkeleton() {
  return (
    <div
      className="relative w-full min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6"
      aria-busy
      aria-label="Loading stock page"
    >
      <div className="space-y-2">
        <SkeletonBox className="h-4 w-56 max-w-full rounded-md" />
        <SkeletonBox className="h-9 w-72 max-w-full rounded-md" />
        <SkeletonBox className="h-6 w-40 max-w-full rounded-md" />
      </div>
      <SkeletonBox className="h-10 w-full rounded-md" />
      <div className="flex gap-2">
        <SkeletonBox className="h-9 w-24 rounded-[10px]" />
        <SkeletonBox className="h-9 w-28 rounded-[10px]" />
        <SkeletonBox className="h-9 w-20 rounded-[10px]" />
      </div>
      <SkeletonBox className="h-[min(420px,50vh)] w-full rounded-lg" />
      <KeyIndicatorsSkeleton />
      <div className="grid w-full gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn(MOBILE_INSET_CARD_CLASS, "space-y-3 p-4")}>
            <SkeletonBox className="h-4 w-24 rounded" />
            <div className="space-y-2.5">
              <SkeletonBox className="h-3.5 w-full rounded" />
              <SkeletonBox className="h-3.5 w-[85%] rounded" />
              <SkeletonBox className="h-3.5 w-[70%] rounded" />
              <SkeletonBox className="h-3.5 w-[90%] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
