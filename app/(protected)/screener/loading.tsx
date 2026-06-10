import { ScreenerContentSkeleton } from "@/components/screener/screener-content-skeleton";

export default function ScreenerLoading() {
  return (
    <div className="min-w-0 w-full max-w-full max-md:px-4 max-md:pb-2 max-md:pt-0 md:px-9 md:py-6">
      <ScreenerContentSkeleton />
    </div>
  );
}
