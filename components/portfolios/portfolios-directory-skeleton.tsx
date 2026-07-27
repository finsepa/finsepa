import { MOBILE_PANEL_CARD_CLASS } from "@/components/design-system/card-surface-styles";
import { SkeletonBox } from "@/components/markets/skeleton";
import {
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

const cardShell = cn(MOBILE_PANEL_CARD_CLASS, "mb-5 p-5");

const tableColLayout =
  "grid w-full min-w-0 grid-cols-[minmax(0,2fr)_minmax(5.5rem,1fr)_minmax(6.5rem,1fr)_minmax(5.5rem,1fr)_minmax(0,1.35fr)] gap-x-3";

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
          <SkeletonBox className="h-9 w-9 rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}

/** Table rows while listings load or individual rows recompute metrics. */
export function PortfoliosDirectoryTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading public portfolios…</span>
      <ScreenerTableScroll>
        <div
          className={cn(
            SCREENER_TABLE_HEADER_STICKY_CLASS,
            SCREENER_TABLE_ROUNDED_HEADER_CLASS,
            SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
            "md:border-b-0",
          )}
        >
          <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
            <div className={cn(tableColLayout, "hidden min-h-[44px] items-center py-0 sm:grid")}>
              <SkeletonBox className={cn("h-5 w-20 rounded", TABLE_START_ALIGNED_PAD_CLASS)} />
              <SkeletonBox className={cn("ml-auto h-5 w-14 rounded", TABLE_END_ALIGNED_PAD_CLASS)} />
              <SkeletonBox className={cn("ml-auto h-5 w-20 rounded", TABLE_END_ALIGNED_PAD_CLASS)} />
              <SkeletonBox className={cn("ml-auto h-5 w-12 rounded", TABLE_END_ALIGNED_PAD_CLASS)} />
              <SkeletonBox className={cn("ml-auto h-5 w-24 rounded", TABLE_END_ALIGNED_PAD_CLASS)} />
            </div>
          </div>
          <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={SCREENER_TABLE_DATA_ROW_CLASS}>
            <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
              <div
                className={cn(
                  tableColLayout,
                  "hidden h-[60px] items-center sm:grid",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
              >
                <div className={cn("flex min-w-0 items-center gap-3", TABLE_START_ALIGNED_PAD_CLASS)}>
                  <SkeletonBox className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBox className="h-4 w-40 max-w-full rounded-md" />
                    <SkeletonBox className="h-3 w-24 rounded-md" />
                  </div>
                </div>
                <SkeletonBox className={cn("ml-auto h-4 w-16 rounded-md", TABLE_END_ALIGNED_PAD_CLASS)} />
                <SkeletonBox className={cn("ml-auto h-4 w-12 rounded-md", TABLE_END_ALIGNED_PAD_CLASS)} />
                <SkeletonBox className={cn("ml-auto h-4 w-14 rounded-md", TABLE_END_ALIGNED_PAD_CLASS)} />
                <div className={cn("flex flex-row items-center justify-end", TABLE_END_ALIGNED_PAD_CLASS)}>
                  {[0, 1, 2, 3, 4].map((j) => (
                    <SkeletonBox key={j} className="-ml-1 h-7 w-7 shrink-0 rounded-full first:ml-0" />
                  ))}
                </div>
              </div>
              <div
                className={cn(
                  "flex h-[60px] items-center gap-3 sm:hidden",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                  TABLE_START_ALIGNED_PAD_CLASS,
                )}
              >
                <SkeletonBox className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBox className="h-4 w-40 max-w-full rounded-md" />
                  <SkeletonBox className="h-3 w-24 rounded-md" />
                </div>
                <SkeletonBox className={cn("h-4 w-14 rounded-md", TABLE_END_ALIGNED_PAD_CLASS)} />
              </div>
            </div>
            {i < rows - 1 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
          </div>
        ))}
      </ScreenerTableScroll>
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
