import { MOBILE_ELEVATED_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";

const pulse = "animate-pulse rounded-md bg-skeleton";

function StatSkeleton({ valueWidth }: { valueWidth: string }) {
  return (
    <div className="space-y-1.5">
      <div className={cn("h-5", valueWidth, pulse)} />
      <div className={`h-3 w-12 ${pulse}`} />
    </div>
  );
}

/** Mirrors `FeaturedFundCard` — "Most popular" carousel slide. */
function FeaturedFundSkeleton() {
  return (
    <div className={cn(MOBILE_ELEVATED_CARD_CLASS, "grid gap-6 p-5 sm:p-6 lg:grid-cols-2 lg:gap-0")}>
      <div className="flex min-w-0 flex-col lg:pr-8">
        <div className="flex items-start justify-between">
          <div className={`h-5 w-24 ${pulse}`} />
          <div className={`h-5 w-5 ${pulse}`} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className={`h-12 w-12 shrink-0 rounded-full ${pulse}`} />
          <div className="space-y-2">
            <div className={`h-6 w-40 ${pulse}`} />
            <div className={`h-3.5 w-36 ${pulse}`} />
          </div>
        </div>
        <div className="mt-auto flex gap-8 pt-6">
          <StatSkeleton valueWidth="w-20" />
          <StatSkeleton valueWidth="w-14" />
          <StatSkeleton valueWidth="w-24" />
        </div>
      </div>
      <div className="min-w-0 border-stroke-subtle lg:border-l lg:pl-8">
        <div className={`h-3 w-24 ${pulse}`} />
        <div className="mt-3 flex flex-col gap-2.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-3 w-4 ${pulse}`} />
              <div className={`h-6 w-6 rounded-full ${pulse}`} />
              <div className={`h-4 w-12 ${pulse}`} />
              <div className={`h-3.5 w-36 ${pulse}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mirrors `FundCard`. */
function FundCardSkeleton() {
  return (
    <div className={cn(MOBILE_ELEVATED_CARD_CLASS, "flex flex-col p-4")}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-full ${pulse}`} />
        <div className="flex-1 space-y-1.5">
          <div className={`h-4 w-32 ${pulse}`} />
          <div className={`h-3 w-24 ${pulse}`} />
        </div>
        <div className={`h-5 w-5 shrink-0 ${pulse}`} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="flex">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={cn("-ml-1.5 h-6 w-6 rounded-full first:ml-0", pulse)} />
          ))}
        </div>
        <div className={`h-3 w-16 ${pulse}`} />
      </div>
      <div className="mt-5 flex items-end justify-between">
        <StatSkeleton valueWidth="w-20" />
        <div className="flex flex-col items-end space-y-1.5">
          <div className={`h-4 w-12 ${pulse}`} />
          <div className={`h-3 w-12 ${pulse}`} />
        </div>
      </div>
    </div>
  );
}

/** Loading state for the Superinvestors index: featured carousel + "N Funds" row + card grid. */
export function SuperinvestorsFundTableSkeleton({ cards = 9 }: { cards?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy aria-label="Loading superinvestors">
      <FeaturedFundSkeleton />
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className={`h-7 w-24 ${pulse}`} />
        <div className={`h-8 w-44 rounded-lg ${pulse}`} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <FundCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
