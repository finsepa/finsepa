import { SkeletonBox } from "@/components/markets/skeleton";

function MacroGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="rounded-[16px] border border-[#E4E4E7] bg-white px-5 py-4 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
          <div className="space-y-2">
            <SkeletonBox className="h-4 w-48 rounded-md" />
            <div className="flex items-baseline gap-2">
              <SkeletonBox className="h-6 w-24 rounded-md" />
              <SkeletonBox className="h-4 w-28 rounded-md" />
            </div>
          </div>
          <div className="mt-4">
            <SkeletonBox className="h-[168px] w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-w-0 space-y-6 px-4 py-4 sm:px-9 sm:py-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SkeletonBox className="h-9 w-48 rounded-md" />
        <div className="flex flex-wrap gap-3">
          <SkeletonBox className="h-9 w-[76px] rounded-[10px]" />
          <SkeletonBox className="h-9 w-[min(100%,380px)] max-w-full rounded-[10px]" />
        </div>
      </div>
      <MacroGridSkeleton />
    </div>
  );
}
