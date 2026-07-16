import { SkeletonBox } from "@/components/markets/skeleton";
import { SIDEBAR_OUTER_EXPANDED_PX } from "@/components/layout/sidebar-layout-context";

export default function Loading() {
  return (
    <div className="flex min-w-0 max-md:flex-col md:absolute md:inset-0 md:overflow-hidden">
      <aside
        className="hidden min-h-0 shrink-0 flex-col overflow-hidden border-r border-[#E4E4E7] bg-white md:flex"
        style={{ width: SIDEBAR_OUTER_EXPANDED_PX }}
        aria-hidden
      >
        <div className="px-3 pt-3 pb-2">
          <SkeletonBox className="h-4 w-16 rounded" />
        </div>
        <div className="flex flex-col gap-1 px-2 pb-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonBox key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SkeletonBox className="h-8 w-40 rounded-md" />
            <div className="flex flex-wrap gap-2">
              <SkeletonBox className="h-9 w-[180px] rounded-[10px]" />
              <SkeletonBox className="h-9 w-20 rounded-[10px]" />
            </div>
          </div>
          <div className="min-w-0">
            <SkeletonBox className="h-9 w-36 rounded" />
            <SkeletonBox className="mt-1 h-4 w-48 rounded" />
            <SkeletonBox className="mt-6 h-[420px] w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
