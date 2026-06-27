const pulse = "animate-pulse rounded-md bg-neutral-200/80";

function HoldingsTableSkeleton() {
  return (
    <div className="mt-6 min-w-0" aria-busy aria-label="Loading holdings">
      <div className="mb-3 flex gap-6 border-b border-[#E4E4E7] pb-2">
        <div className={`h-5 w-20 ${pulse}`} />
        <div className={`h-5 w-16 ${pulse}`} />
      </div>
      <div className={`mb-2 h-11 w-full ${pulse}`} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={`my-2 h-12 w-full ${pulse}`} />
      ))}
    </div>
  );
}

export function SuperinvestorProfileSkeleton() {
  return (
    <div className="relative min-w-0" aria-busy aria-label="Loading superinvestor profile">
      <nav
        aria-hidden
        className="flex items-center gap-2 px-4 py-3 text-[14px] sm:px-9 md:border-b md:border-[#E4E4E7]"
      >
        <div className={`h-4 w-24 ${pulse}`} />
        <span className="text-[#E4E4E7]">/</span>
        <div className={`h-4 w-32 ${pulse}`} />
      </nav>

      <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
        <header>
          <div className="sm:hidden">
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 shrink-0 rounded-full ${pulse}`} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className={`h-7 w-48 ${pulse}`} />
                <div className={`h-4 w-36 ${pulse}`} />
              </div>
            </div>
            <div className="mt-4 flex gap-0">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex flex-1 flex-col gap-2 border-r border-[#E4E4E7] px-4 last:border-r-0">
                  <div className={`h-3.5 w-16 ${pulse}`} />
                  <div className={`h-6 w-20 ${pulse}`} />
                </div>
              ))}
            </div>
            <div className={`mt-4 h-10 w-full rounded-[10px] ${pulse}`} />
          </div>

          <div className="hidden sm:block">
            <div className={`h-8 w-56 ${pulse}`} />
            <div className={`mt-1 h-4 w-40 ${pulse}`} />
            <div className="mt-5 flex max-w-3xl gap-0">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex flex-1 flex-col gap-2 border-r border-[#E4E4E7] px-8 first:pl-0 last:border-r-0">
                  <div className={`h-3.5 w-20 ${pulse}`} />
                  <div className={`h-7 w-24 ${pulse}`} />
                </div>
              ))}
            </div>
            <div className={`mt-4 h-9 w-28 rounded-[10px] ${pulse}`} />
          </div>
        </header>

        <HoldingsTableSkeleton />
      </div>
    </div>
  );
}
