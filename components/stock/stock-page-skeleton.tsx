import { MOBILE_INSET_CARD_CLASS } from "@/components/design-system/card-surface-styles";
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
        <div className="h-4 w-56 max-w-full animate-pulse rounded-md bg-neutral-100" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded-md bg-neutral-100" />
        <div className="h-6 w-40 max-w-full animate-pulse rounded-md bg-neutral-100" />
      </div>
      <div className="h-10 w-full animate-pulse rounded-md bg-neutral-100" />
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded-[10px] bg-neutral-100" />
        <div className="h-9 w-28 animate-pulse rounded-[10px] bg-neutral-100" />
        <div className="h-9 w-20 animate-pulse rounded-[10px] bg-neutral-100" />
      </div>
      <div className="h-[min(420px,50vh)] w-full animate-pulse rounded-lg bg-neutral-100" />
      <KeyIndicatorsSkeleton />
      <div className="grid w-full gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn(MOBILE_INSET_CARD_CLASS, "space-y-3 p-4")}>
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
            <div className="space-y-2.5">
              <div className="h-3.5 w-full animate-pulse rounded bg-neutral-100" />
              <div className="h-3.5 w-[85%] animate-pulse rounded bg-neutral-100" />
              <div className="h-3.5 w-[70%] animate-pulse rounded bg-neutral-100" />
              <div className="h-3.5 w-[90%] animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
