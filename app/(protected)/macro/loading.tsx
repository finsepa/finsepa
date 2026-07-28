import { SkeletonBox } from "@/components/markets/skeleton";
import { SIDEBAR_OUTER_EXPANDED_PX } from "@/components/layout/sidebar-layout-context";

export default function Loading() {
  return (
    <div className="flex min-w-0 flex-col gap-5 px-4 py-4 sm:px-9 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        <SkeletonBox className="h-9 w-28 rounded-md sm:flex-1" />
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <SkeletonBox className="h-9 w-[180px] rounded-[10px]" />
          <SkeletonBox className="h-9 w-20 rounded-[10px]" />
        </div>
      </div>

      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <SkeletonBox className="mb-2 h-7 w-40 rounded" />
          <SkeletonBox className="h-9 w-36 rounded" />
          <SkeletonBox className="mt-1 h-4 w-48 rounded" />
          <SkeletonBox className="mt-6 h-[420px] w-full rounded-md" />
        </div>

        <aside
          className="hidden w-[240px] shrink-0 self-start md:block"
          style={{ maxWidth: `${SIDEBAR_OUTER_EXPANDED_PX}px` }}
          aria-hidden
        >
          <div className="overflow-hidden rounded-2xl border border-[#EBEBEC] bg-white p-2 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, section) => (
                <div key={section} className="flex flex-col gap-0.5">
                  <SkeletonBox className="mb-1 ml-3 h-5 w-16 rounded" />
                  {Array.from({ length: 4 }).map((_, row) => (
                    <SkeletonBox key={row} className="h-9 w-full rounded-lg" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
