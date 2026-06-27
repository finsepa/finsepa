const pulse = "animate-pulse rounded-md bg-neutral-200/80";

function SkeletonRow({ mobile }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(4.75rem,auto)] gap-x-3 px-4 py-3 sm:hidden">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`h-10 w-10 shrink-0 rounded-full ${pulse}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={`h-4 w-32 ${pulse}`} />
            <div className={`h-3.5 w-40 ${pulse}`} />
          </div>
        </div>
        <div className={`mt-1 h-4 w-16 justify-self-end ${pulse}`} />
      </div>
    );
  }

  return (
    <div className="hidden h-[60px] grid-cols-[40px_48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-x-3 px-4 sm:grid">
      <div className={`mx-auto h-4 w-4 ${pulse}`} />
      <div className={`mx-auto h-10 w-10 rounded-full ${pulse}`} />
      <div className={`h-4 w-36 ${pulse}`} />
      <div className={`ml-auto h-4 w-16 ${pulse}`} />
      <div className={`ml-auto h-4 w-14 ${pulse}`} />
      <div className={`ml-auto h-4 w-20 ${pulse}`} />
      <div className="flex justify-end gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`h-7 w-7 rounded-md ${pulse}`} />
        ))}
      </div>
    </div>
  );
}

export function SuperinvestorsFundTableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="min-w-0 -mx-4 sm:mx-0" aria-busy aria-label="Loading superinvestors">
      <div className="divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7] bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(4.75rem,auto)] gap-x-3 px-4 py-3 text-[14px] font-medium text-[#71717A] sm:hidden">
          <div>Fund</div>
          <div className="text-right">Last updated</div>
        </div>
        <div className="hidden min-h-[44px] grid-cols-[40px_48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-x-3 px-4 text-[14px] font-medium text-[#71717A] sm:grid">
          <div aria-hidden />
          <div className="col-span-2 col-start-2 pl-1">Fund</div>
          <div className="text-right">Size</div>
          <div className="text-right">No. of stocks</div>
          <div className="text-right">Last updated</div>
          <div className="text-right">Top 5 holdings</div>
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i}>
            <SkeletonRow mobile />
            <SkeletonRow />
          </div>
        ))}
      </div>
    </div>
  );
}
