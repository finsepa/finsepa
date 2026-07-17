import { SkeletonBox } from "@/components/markets/skeleton";

/**
 * Lightweight Earnings tab shell for `next/dynamic` — kept in a separate module so the
 * parent stock page does not pull the full earnings tab bundle for a loading fallback.
 */
export function StockEarningsTabLoading() {
  return (
    <div className="min-w-0 space-y-6 pt-1" aria-busy aria-label="Loading earnings">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-stretch gap-6">
          <div className="flex flex-col gap-1.5 border-r border-[#E4E4E7] pr-6">
            <SkeletonBox className="h-4 w-24 rounded" />
            <SkeletonBox className="h-7 w-20 rounded" />
          </div>
          <div className="flex flex-col gap-1.5">
            <SkeletonBox className="h-4 w-16 rounded" />
            <SkeletonBox className="h-7 w-28 rounded" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <SkeletonBox className="h-10 w-[200px] rounded-[10px]" />
          <SkeletonBox className="h-10 w-[200px] rounded-[10px]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex h-fit flex-col gap-2 overflow-hidden rounded-xl border border-[#E4E4E7] bg-white px-4 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
          >
            <SkeletonBox className="h-5 w-32 rounded" />
            <SkeletonBox className="h-9 w-36 rounded" />
          </div>
        ))}
      </div>
      <SkeletonBox className="h-[320px] w-full rounded" />
      <h3 className="text-[18px] font-semibold leading-7 tracking-tight text-[#09090B]">Reports</h3>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBox key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    </div>
  );
}
