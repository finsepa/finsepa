import { SkeletonBox } from "@/components/markets/skeleton";

export default function HeatmapsLoading() {
  return (
    <div className="min-w-0 space-y-4 px-4 py-4 sm:px-9 sm:py-6">
      <div className="space-y-2">
        <SkeletonBox className="h-8 w-48 rounded-md" />
        <SkeletonBox className="h-4 w-full max-w-xl rounded-md" />
      </div>
      <div className="flex flex-wrap gap-2">
        <SkeletonBox className="h-9 w-[200px] rounded-[10px]" />
        <SkeletonBox className="h-9 w-[280px] rounded-[10px]" />
      </div>
      <SkeletonBox className="h-[480px] w-full max-w-[1200px] rounded-[10px]" />
    </div>
  );
}
