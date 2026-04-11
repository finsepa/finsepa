import { SkeletonBox } from "@/components/markets/skeleton";

const cardShell =
  "mb-6 rounded-[12px] border border-[#E4E4E7] bg-white p-[20px] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08)]";

/** Mirrors `PublicPortfolioBlock`: header (avatar + titles, returns), stats row + chevron, Top 5 icon stack. */
function PublicPortfolioCardSkeleton() {
  return (
    <div className={cardShell}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SkeletonBox className="h-14 w-14 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-col gap-[4px]">
            <SkeletonBox className="h-7 w-[min(200px,55vw)] max-w-full rounded-md" />
            <SkeletonBox className="h-6 w-24 rounded-md" />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[4px]">
          <SkeletonBox className="h-6 w-[4.5rem] rounded-md" />
          <SkeletonBox className="h-6 w-28 rounded-md" />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          {[
            { labelW: "w-12", valW: "w-28" },
            { labelW: "w-24", valW: "w-20" },
            { labelW: "w-24", valW: "w-28" },
            { labelW: "w-28", valW: "w-full max-w-[120px]" },
          ].map((row, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-[4px]">
              <SkeletonBox className={`h-5 ${row.labelW} rounded`} />
              {i < 3 ? (
                <SkeletonBox className={`h-5 ${row.valW} rounded-md`} />
              ) : (
                <div className="flex flex-row items-center pt-0">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <div
                      key={j}
                      className="-ml-1 first:ml-0"
                      style={{ zIndex: 5 - j }}
                    >
                      <SkeletonBox className="h-5 w-5 shrink-0 rounded-full ring-2 ring-white" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 justify-end md:justify-center">
          <SkeletonBox className="h-8 w-8 rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}

/** Shown while `/api/portfolios/listings` is in flight — matches public portfolio card layout. */
export function PortfoliosDirectorySkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex w-full min-h-[min(50vh,420px)] flex-col"
    >
      <span className="sr-only">Loading public portfolios…</span>
      {Array.from({ length: cards }, (_, i) => (
        <PublicPortfolioCardSkeleton key={i} />
      ))}
    </div>
  );
}
