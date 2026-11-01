import { MOBILE_ELEVATED_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { SkeletonBox } from "@/components/markets/skeleton";
import { cn } from "@/lib/utils";

export default function HeatmapsLoading() {
  return (
    <div className="min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SkeletonBox className="h-9 w-[160px] rounded-full" />
        <SkeletonBox className="h-9 w-[200px] rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn("space-y-2 p-1", MOBILE_ELEVATED_CARD_CLASS)}>
            <SkeletonBox className="mx-auto mt-1.5 h-4 w-28 rounded" />
            <SkeletonBox className="h-[200px] w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
