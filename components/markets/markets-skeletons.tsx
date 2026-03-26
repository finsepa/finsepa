"use client";

import { LogoSkeleton, PillSkeleton, SkeletonBox, SparklineSkeleton, TextSkeleton } from "@/components/markets/skeleton";

const stocksColLayout = "grid-cols-[40px_48px_2fr_1fr_1fr_1fr_1fr_1fr_80px_96px] gap-x-2";
// rank + coin + price + 1D + 1M + YTD + market cap + sparkline
const cryptoColLayout = "grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_96px]";
const indicesColLayout = "grid-cols-[2fr_1fr_1fr_1fr_1fr_96px]";

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
    <div className={`grid ${stocksColLayout} h-[60px] max-h-[60px] items-center border-b border-[#E4E4E7] px-1`}>
      <div className="flex w-10 shrink-0 items-center justify-center px-3">
        <SkeletonBox className="h-4 w-4 rounded" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-4" hClass="h-3.5" />
      </div>
      <div className="flex min-w-0 items-center gap-3 pr-4">
        <LogoSkeleton />
        <div className="min-w-0 flex-1 space-y-1.5">
          <TextSkeleton wClass="w-[45%] max-w-[140px]" />
          <TextSkeleton wClass="w-10" hClass="h-3" />
        </div>
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex justify-center">
          <TextSkeleton wClass={i === 5 ? "w-10" : "w-12"} />
        </div>
      ))}
    </div>
  );
}

export function StocksTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className={`grid ${stocksColLayout} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3 [&>div]:text-center`}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex justify-center">
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
    <div className="group grid h-[60px] max-h-[60px] grid-cols-[48px_2fr_1fr_1fr_1fr_1fr_1fr_96px] items-center border-b border-[#E4E4E7] px-1 last:border-b-0">
      <div className="flex justify-center">
        <TextSkeleton wClass="w-4" hClass="h-3.5" />
      </div>
      <div className="flex min-w-0 items-center gap-3 pr-4">
        <LogoSkeleton />
        <div className="min-w-0 flex-1 space-y-1.5">
          <TextSkeleton wClass="w-[40%] max-w-[160px]" />
          <TextSkeleton wClass="w-10" hClass="h-3" />
        </div>
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-16" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-14" />
      </div>
      <div className="flex items-center justify-center">
        <SkeletonBox className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function CryptoTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className={`grid ${cryptoColLayout} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3 text-[14px] font-semibold leading-5 text-[#71717A] [&>div]:text-center`}>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-6 rounded" /></div>
        <div className="flex justify-start"><SkeletonBox className="h-3 w-16 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-16 rounded" /></div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <CryptoRowSkeleton key={i} />
      ))}
    </div>
  );
}

function IndicesRowSkeleton() {
  return (
    <div className="group grid h-[60px] max-h-[60px] grid-cols-[2fr_1fr_1fr_1fr_1fr_96px] items-center border-b border-[#E4E4E7] px-1 last:border-b-0">
      <div className="px-4">
        <TextSkeleton wClass="w-[45%] max-w-[180px]" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-20" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex justify-center">
        <TextSkeleton wClass="w-12" />
      </div>
      <div className="flex items-center justify-center">
        <SkeletonBox className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function IndicesTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className={`grid ${indicesColLayout} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3 text-[14px] font-semibold leading-5 text-[#71717A] [&>div]:text-center`}>
        <div className="flex justify-start"><SkeletonBox className="h-3 w-12 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-10 rounded" /></div>
        <div className="flex justify-center"><SkeletonBox className="h-3 w-16 rounded" /></div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <IndicesRowSkeleton key={i} />
      ))}
    </div>
  );
}

