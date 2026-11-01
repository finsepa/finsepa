import {
  MOBILE_ELEVATED_CARD_CLASS,
  STOCK_OVERVIEW_SECTION_HEADING_CLASS,
} from "@/components/design-system/card-surface-styles";
import { SkeletonBox } from "@/components/markets/skeleton";
import { cn } from "@/lib/utils";

/**
 * Lightweight Earnings tab shell for `next/dynamic` — kept in a separate module so the
 * parent stock page does not pull the full earnings tab bundle for a loading fallback.
 */
export function StockEarningsTabLoading() {
  return (
    <div className="min-w-0 space-y-5" aria-busy aria-label="Loading earnings">
      <div className={cn("min-w-0 space-y-5 p-4 sm:p-5", MOBILE_ELEVATED_CARD_CLASS)}>
        <div className="flex flex-wrap items-stretch gap-x-6 gap-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("flex flex-col gap-1.5", i < 4 && "border-r border-stroke pr-6")}>
              <SkeletonBox className="h-4 w-24 rounded" />
              <SkeletonBox className="h-7 w-20 rounded" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <SkeletonBox className="h-9 w-40 rounded-full" />
          <SkeletonBox className="h-9 w-44 rounded-full" />
        </div>
        <SkeletonBox className="h-[320px] w-full rounded" />
      </div>
      <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>Earnings history</h2>
      <div className={cn("space-y-2 p-4 sm:p-5", MOBILE_ELEVATED_CARD_CLASS)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBox key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    </div>
  );
}
