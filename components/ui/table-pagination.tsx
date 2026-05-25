"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export const TABLE_PAGE_SIZE = 20;

/** Square prev/next icon buttons (Screener + portfolio tables). */
export const SCREENER_TABLE_PAGINATION_BTN =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2";

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
 * Screener: prev/next icon buttons (left/right) · page numbers (centered).
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
            className={cn(SCREENER_TABLE_PAGINATION_BTN, "pointer-events-auto")}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="pointer-events-none z-[1] flex min-w-0 flex-1 justify-end pl-1">
          <button
            type="button"
            disabled={!canNext || disabled}
            onClick={() => onPageChange(safePage + 1)}
            className={cn(SCREENER_TABLE_PAGINATION_BTN, "pointer-events-auto")}
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
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

  return (
    <ScreenerPagination
      page={page}
      totalPages={pageCount}
      onPageChange={onPageChange}
      className={className}
      aria-label="Table page navigation"
    />
  );
}
