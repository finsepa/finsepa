import { SkeletonBox } from "@/components/markets/skeleton";

function MacroGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[16px] border border-[#E4E4E7] bg-white px-4 py-4">
          <div className="space-y-2">
            <SkeletonBox className="h-4 w-40 rounded-md" />
            <div className="flex items-baseline gap-2">
              <SkeletonBox className="h-6 w-24 rounded-md" />
              <SkeletonBox className="h-4 w-28 rounded-md" />
            </div>
          </div>
          <div className="mt-4">
            <SkeletonBox className="h-32 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-5 px-9 py-6">
      <div className="space-y-1">
        <div className="text-[20px] font-semibold tracking-tight text-[#09090B]">Macro</div>
        <div className="text-[13px] leading-5 text-[#71717A]">Last 5 years</div>
      </div>
      <MacroGridSkeleton />
    </div>
  );
}

