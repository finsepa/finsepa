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
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

const pulse = "animate-pulse rounded-md bg-skeleton";

const colLayout =
  "grid w-full min-w-0 grid-cols-[40px_48px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-x-2";

const mobileColLayout = "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(4.75rem,auto)] gap-x-2";

const numericHeaderClass = cn("min-w-0 text-right", TABLE_END_ALIGNED_PAD_CLASS);

function SkeletonRow({ mobile }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div
        className={cn(
          mobileColLayout,
          "items-start py-3 sm:hidden",
          SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className={`h-10 w-10 shrink-0 rounded-full ${pulse}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={`h-4 w-32 ${pulse}`} />
            <div className={`h-3.5 w-40 ${pulse}`} />
          </div>
        </div>
        <div className={cn(`mt-1 h-4 w-16 justify-self-end ${pulse}`, TABLE_END_ALIGNED_PAD_CLASS)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "hidden h-[60px] max-h-[60px] items-center sm:grid",
        colLayout,
        SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
      )}
    >
      <div className={`mx-auto h-4 w-4 ${pulse}`} />
      <div className={`mx-auto h-10 w-10 rounded-full ${pulse}`} />
      <div className={`h-4 w-36 ${pulse}`} />
      <div className={cn(`ml-auto h-4 w-16 ${pulse}`, TABLE_END_ALIGNED_PAD_CLASS)} />
      <div className={cn(`ml-auto h-4 w-14 ${pulse}`, TABLE_END_ALIGNED_PAD_CLASS)} />
      <div className={cn(`ml-auto h-4 w-14 ${pulse}`, TABLE_END_ALIGNED_PAD_CLASS)} />
      <div className={cn(`ml-auto h-4 w-20 ${pulse}`, TABLE_END_ALIGNED_PAD_CLASS)} />
      <div className={cn("flex justify-end gap-1", TABLE_END_ALIGNED_PAD_CLASS)}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`h-7 w-7 rounded-md ${pulse}`} />
        ))}
      </div>
    </div>
  );
}

export function SuperinvestorsFundTableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <ScreenerTableScroll aria-busy aria-label="Loading superinvestors">
      <div
        className={cn(
          SCREENER_TABLE_HEADER_STICKY_CLASS,
          SCREENER_TABLE_ROUNDED_HEADER_CLASS,
          SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
          "md:border-b-0",
        )}
      >
        <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
          <div
            className={cn(
              mobileColLayout,
              "min-h-[44px] items-center py-0 text-[14px] font-medium leading-5 text-fg-muted sm:hidden",
            )}
          >
            <div>Fund</div>
            <div className={numericHeaderClass}>Last updated</div>
          </div>
          <div
            className={cn(
              colLayout,
              "hidden min-h-[44px] items-center py-0 text-[14px] font-medium leading-5 text-fg-muted sm:grid",
            )}
          >
            <div aria-hidden />
            <div className="col-span-2 col-start-2 pl-1">Fund</div>
            <div className={numericHeaderClass}>Size</div>
            <div className={numericHeaderClass}>1Y perf</div>
            <div className={numericHeaderClass}>No. of stocks</div>
            <div className={numericHeaderClass}>Last updated</div>
            <div className={numericHeaderClass}>Top 5 holdings</div>
          </div>
        </div>
        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={SCREENER_TABLE_DATA_ROW_CLASS}>
          <div className={SCREENER_TABLE_ROW_HOVER_PAD_CLASS}>
            <SkeletonRow mobile />
            <SkeletonRow />
          </div>
          {i < rows - 1 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
        </div>
      ))}
    </ScreenerTableScroll>
  );
}
