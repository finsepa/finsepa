"use client";

import { cn } from "@/lib/utils";

export const TABLE_PAGE_SIZE = 20;

/** Matches Screener markets/crypto pagination buttons (see `markets-section.tsx`). */
export const SCREENER_TABLE_PAGINATION_BTN =
  "h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60";

export function tablePageCount(total: number): number {
  if (total <= 0) return 1;
  return Math.ceil(total / TABLE_PAGE_SIZE);
}

/**
 * Prev / Page n of m / next — same layout & button styling as Screener (20 rows per page).
 */
export function TablePaginationBar({
  page,
  totalItems,
  onPageChange,
  className,
}: {
  /** 1-based */
  page: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
  className?: string;
}) {
  const pageCount = tablePageCount(totalItems);
  if (totalItems <= TABLE_PAGE_SIZE) return null;

  const safePage = Math.min(Math.max(1, page), pageCount);
  const canPrev = safePage > 1;
  const canNext = safePage < pageCount;

  return (
    <div
      className={cn(
        "mt-4 flex min-w-0 flex-row flex-nowrap items-center justify-between gap-2 border-t border-[#E4E4E7] bg-white px-1 py-4 sm:gap-3 sm:px-4",
        className,
      )}
    >
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(safePage - 1)}
        className={cn(SCREENER_TABLE_PAGINATION_BTN, "shrink-0")}
        aria-label="Previous page"
      >
        Previous
      </button>

      <div className="min-w-0 flex-1 px-1 text-center text-sm font-medium text-[#71717A]">
        Page <span className="font-semibold text-[#09090B]">{safePage}</span> of{" "}
        <span className="font-semibold text-[#09090B]">{pageCount}</span>
      </div>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(safePage + 1)}
        className={cn(SCREENER_TABLE_PAGINATION_BTN, "shrink-0")}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}
