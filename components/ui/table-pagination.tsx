"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export const TABLE_PAGE_SIZE = 20;

/** Prev/next + numbered tiles use this on the Screener; portfolio tables use it on `TablePaginationBar`. */
export const SCREENER_TABLE_PAGINATION_BTN =
  "h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60";

export function tablePageCount(total: number): number {
  if (total <= 0) return 1;
  return Math.ceil(total / TABLE_PAGE_SIZE);
}

/** 1-based page list with at most one ellipsis on each side when `last` is large. */
function buildScreenerPageItems(current: number, last: number): (number | "ellipsis")[] {
  if (last < 1) return [];
  if (last <= 5) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  const s = new Set([1, last, current, current - 1, current + 1]);
  for (const p of [...s]) {
    if (p < 1 || p > last) s.delete(p);
  }
  const sorted = [...s].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (p - prev === 2) {
        out.push(prev + 1);
      } else if (p - prev > 2) {
        out.push("ellipsis");
      }
    }
    out.push(p);
  }
  return out;
}

const PAGE_NUM_INACTIVE =
  "inline-flex h-9 min-w-9 max-w-12 shrink-0 items-center justify-center rounded-[10px] px-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2";

/** Active page: bordered tile (same family as `SCREENER_TABLE_PAGINATION_BTN`, no fill). */
const PAGE_NUM_ACTIVE =
  "inline-flex h-9 min-w-9 max-w-12 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white px-2 text-sm font-semibold tabular-nums text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2";

/**
 * Screener: `Previous` (left) · page numbers (centered) · `Next` (right).
 * — reuses `SCREENER_TABLE_PAGINATION_BTN` for prev/next and active page.
 */
export function ScreenerPagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Page navigation",
}: {
  /** 1-based */
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;
  const items = buildScreenerPageItems(safePage, totalPages);

  return (
    <nav
      className={cn("relative mt-4 w-full min-w-0", className)}
      aria-label={ariaLabel}
    >
      <div className="flex min-h-9 w-full min-w-0 items-center">
        <div className="pointer-events-none z-[1] flex min-w-0 flex-1 justify-start pr-1">
          <button
            type="button"
            disabled={!canPrev || disabled}
            onClick={() => onPageChange(safePage - 1)}
            className={cn(
              SCREENER_TABLE_PAGINATION_BTN,
              "pointer-events-auto inline-flex shrink-0 items-center gap-0.5 px-2.5 sm:px-3",
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span>Previous</span>
          </button>
        </div>
        <div className="pointer-events-none z-[1] flex min-w-0 flex-1 justify-end pl-1">
          <button
            type="button"
            disabled={!canNext || disabled}
            onClick={() => onPageChange(safePage + 1)}
            className={cn(
              SCREENER_TABLE_PAGINATION_BTN,
              "pointer-events-auto inline-flex shrink-0 items-center gap-0.5 px-2.5 sm:px-3",
            )}
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>

      <div className="absolute inset-0 z-0 flex min-h-9 items-center justify-center overflow-visible">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {items.map((it, i) =>
            it === "ellipsis" ? (
              <span
                key={`e-${i}`}
                className="inline-flex h-9 min-w-6 select-none items-center justify-center text-sm font-medium text-[#09090B] tabular-nums"
                aria-hidden
              >
                ...
              </span>
            ) : (
              <button
                key={it}
                type="button"
                disabled={disabled}
                onClick={() => onPageChange(it)}
                className={cn(
                  "tabular-nums",
                  it === safePage
                    ? PAGE_NUM_ACTIVE
                    : PAGE_NUM_INACTIVE,
                )}
                aria-label={`Page ${it}`}
                aria-current={it === safePage ? "page" : undefined}
              >
                {it}
              </button>
            ),
          )}
        </div>
      </div>
    </nav>
  );
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
