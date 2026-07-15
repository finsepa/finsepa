import { MOBILE_INSET_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";

const KEY_INDICATORS_CARD_CLASS = cn("mb-5 p-4 max-md:mb-0", MOBILE_INSET_CARD_CLASS);

function SkeletonLine() {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 size-4 shrink-0 animate-pulse rounded-full bg-neutral-100" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <div className="h-3.5 max-w-[92%] animate-pulse rounded bg-neutral-100" />
        <div className="h-3.5 w-[68%] animate-pulse rounded bg-neutral-100" />
      </div>
    </li>
  );
}

/** Two-column skeleton matching Key Indicators card layout. */
export function KeyIndicatorsSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(KEY_INDICATORS_CARD_CLASS, className)}
      aria-busy="true"
      aria-label="Loading key indicators"
    >
      <div className="mb-3 h-5 w-28 animate-pulse rounded bg-neutral-100" />
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="space-y-3">
          <SkeletonLine />
          <SkeletonLine />
          <SkeletonLine />
          <SkeletonLine />
        </ul>
        <ul className="hidden space-y-3 md:block">
          <SkeletonLine />
          <SkeletonLine />
        </ul>
      </div>
    </div>
  );
}
