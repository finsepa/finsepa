"use client";

import { LogoSkeleton, PillSkeleton, SkeletonBox, SparklineSkeleton, TextSkeleton } from "@/components/markets/skeleton";

const stocksColLayout = "grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr_96px] gap-x-2";
// star + rank + company + price + 1D + 1M + YTD + M cap + PE (matches screener-table Companies)
const cryptoColLayout = "grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr] gap-x-2";
const indicesColLayout = "grid-cols-[40px_2fr_1fr_1fr_1fr_1fr] gap-x-2";

export function IndexCardSkeleton({ name }: { name: string }) {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-[#F4F4F5] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
      <div className="px-4 pt-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="text-[12px] font-medium text-neutral-500">{name}</span>
          <PillSkeleton wClass="w-14" />
        </div>
        <SkeletonBox className="h-7 w-28 rounded-md" />
      </div>
      <div className="px-4 pb-4">
        <SparklineSkeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

function StocksRowSkeleton() {
  return (
    <div className={`grid ${stocksColLayout} h-[60px] max-h-[60px] items-center border-b border-[#E4E4E7] px-4`}>
      <div className="flex w-10 shrink-0 items-center justify-center px-3">
        <SkeletonBox className="h-4 w-4 rounded" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-4" hClass="h-3.5" />
      </div>
      <div className="flex min-w-0 items-center justify-start gap-3 pr-4">
        <LogoSkeleton />
        <div className="min-w-0 flex-1 space-y-1.5">
          <TextSkeleton wClass="w-[45%] max-w-[140px]" />
          <TextSkeleton wClass="w-10" hClass="h-3" />
        </div>
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex justify-end">
          <TextSkeleton wClass={i === 4 ? "w-10" : "w-12"} />
        </div>
      ))}
    </div>
  );
}

export function StocksTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className={`grid ${stocksColLayout} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3`}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={`flex ${
              i === 0 || i === 1 ? "justify-center" : i === 2 ? "justify-start" : "justify-end"
            }`}
          >
            <SkeletonBox className="h-3 w-10 rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <StocksRowSkeleton key={i} />
      ))}
    </div>
  );
}

function CryptoRowSkeleton() {
  return (
    <div className={`group grid h-[60px] max-h-[60px] ${cryptoColLayout} items-center bg-white px-4`}>
      <div className="flex w-10 shrink-0 items-center justify-center px-3">
        <SkeletonBox className="h-4 w-4 rounded" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-4" hClass="h-3.5" />
      </div>
      <div className="flex min-w-0 items-center justify-start gap-3 pr-4">
        <LogoSkeleton />
        <div className="min-w-0 flex-1 space-y-1.5">
          <TextSkeleton wClass="w-[40%] max-w-[160px]" />
          <TextSkeleton wClass="w-10" hClass="h-3" />
        </div>
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-16" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-14" />
      </div>
    </div>
  );
}

export function CryptoTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
      <div
        className={`grid ${cryptoColLayout} min-h-[44px] items-center bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]`}
      >
        <div />
        <div className="flex justify-center">
          <SkeletonBox className="h-3 w-4 rounded" />
        </div>
        <div className="flex justify-start">
          <SkeletonBox className="h-3 w-16 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <CryptoRowSkeleton key={i} />
      ))}
    </div>
  );
}

function IndicesRowSkeleton() {
  return (
    <div className={`group grid h-[60px] max-h-[60px] ${indicesColLayout} items-center bg-white px-4`}>
      <div className="flex w-10 shrink-0 items-center justify-center px-3">
        <SkeletonBox className="h-4 w-4 rounded" />
      </div>
      <div className="flex min-w-0 justify-start px-4">
        <TextSkeleton wClass="w-[45%] max-w-[180px]" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-20" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-end">
        <TextSkeleton wClass="w-12" />
      </div>
    </div>
  );
}

export function IndicesTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
      <div
        className={`grid ${indicesColLayout} min-h-[44px] items-center bg-white px-4 py-0 text-[14px] font-medium leading-5 text-[#71717A]`}
      >
        <div />
        <div className="flex justify-start">
          <SkeletonBox className="h-3 w-12 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
        <div className="flex justify-end">
          <SkeletonBox className="h-3 w-10 rounded" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <IndicesRowSkeleton key={i} />
      ))}
    </div>
  );
}

