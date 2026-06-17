import { SkeletonBox } from "@/components/markets/skeleton";

const cardShell =
  "mb-6 rounded-[12px] border border-[#E4E4E7] bg-white p-[20px] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08)]";

/** Mirrors `PublicPortfolioBlock`: header (avatar + titles, returns), stats row + chevron, Top 5 icon stack. */
export function PublicPortfolioCardSkeleton() {
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

/** Table rows while listings load or individual rows recompute metrics. */
export function PortfoliosDirectoryTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="min-w-0 -mx-4 sm:mx-0" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading public portfolios…</span>
      <div className="min-w-0 overflow-x-auto">
        <div className="min-w-[720px] divide-y divide-[#E4E4E7] border-t border-b border-[#E4E4E7]">
          <div className="hidden min-h-[44px] items-center px-4 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(5.5rem,1fr)_minmax(6.5rem,1fr)_minmax(5.5rem,1fr)_minmax(0,1.35fr)] sm:gap-x-3">
            {["Investor", "Value", "No. of Holdings", "ATH", "Top 5 Holdings"].map((label) => (
              <SkeletonBox key={label} className="h-5 w-20 rounded" />
            ))}
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex h-[60px] items-center gap-3 px-4">
              <SkeletonBox className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBox className="h-4 w-40 max-w-full rounded-md" />
                <SkeletonBox className="h-3 w-24 rounded-md" />
              </div>
              <SkeletonBox className="hidden h-4 w-16 rounded-md sm:block" />
              <SkeletonBox className="hidden h-4 w-12 rounded-md sm:block" />
              <SkeletonBox className="hidden h-4 w-14 rounded-md sm:block" />
              <div className="hidden flex-row items-center sm:flex">
                {[0, 1, 2, 3, 4].map((j) => (
                  <SkeletonBox key={j} className="-ml-1 h-7 w-7 shrink-0 rounded-full first:ml-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Shown while `/api/portfolios/listings` is in flight — matches public portfolio card layout. */
export function PortfoliosDirectorySkeleton({
  cards = 2,
  variant = "cards",
}: {
  cards?: number;
  variant?: "cards" | "table";
}) {
  if (variant === "table") {
    return <PortfoliosDirectoryTableSkeleton rows={cards} />;
  }

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
