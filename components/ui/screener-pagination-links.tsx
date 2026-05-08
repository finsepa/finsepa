import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { SCREENER_TABLE_PAGINATION_BTN } from "@/components/ui/table-pagination";

// Inline copy (same as `SCREENER_TABLE_PAGINATION_BTN`) to avoid any styling drift when used on links.
const PAGINATION_BTN_LINK_BASE =
  "h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]";

const PAGE_NUM_INACTIVE =
  "inline-flex h-9 min-w-9 max-w-12 shrink-0 items-center justify-center rounded-[10px] px-2 text-sm font-medium text-[#09090B] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2";

const PAGE_NUM_ACTIVE =
  "inline-flex h-9 min-w-9 max-w-12 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white px-2 text-sm font-semibold tabular-nums text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2";

/** 1-based page list with at most one ellipsis on each side when `last` is large. */
function buildPageItems(current: number, last: number): (number | "ellipsis")[] {
  if (last < 1) return [];
  if (last <= 5) return Array.from({ length: last }, (_, i) => i + 1);

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
      if (p - prev === 2) out.push(prev + 1);
      else if (p - prev > 2) out.push("ellipsis");
    }
    out.push(p);
  }
  return out;
}

export function ScreenerPaginationLinks({
  page,
  totalPages,
  hrefForPage,
  className,
  "aria-label": ariaLabel = "Page navigation",
}: {
  /** 1-based */
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  className?: string;
  "aria-label"?: string;
}) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;
  const items = buildPageItems(safePage, totalPages);

  return (
    <nav className={cn("relative mt-4 w-full min-w-0", className)} aria-label={ariaLabel}>
      <div className="flex min-h-9 w-full min-w-0 items-center">
        <div className="pointer-events-none z-[1] flex min-w-0 flex-1 justify-start pr-1">
          <Link
            href={hrefForPage(canPrev ? safePage - 1 : safePage)}
            aria-disabled={!canPrev}
            tabIndex={canPrev ? 0 : -1}
            className={cn(
              // Prefer explicit base for <a> so the visual matches numbered tiles consistently.
              PAGINATION_BTN_LINK_BASE,
              "pointer-events-auto inline-flex shrink-0 items-center gap-0.5 px-2.5 no-underline sm:px-3 hover:no-underline",
              !canPrev && "pointer-events-none opacity-60",
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span>Previous</span>
          </Link>
        </div>

        <div className="pointer-events-none z-[1] flex min-w-0 flex-1 justify-end pl-1">
          <Link
            href={hrefForPage(canNext ? safePage + 1 : safePage)}
            aria-disabled={!canNext}
            tabIndex={canNext ? 0 : -1}
            className={cn(
              PAGINATION_BTN_LINK_BASE,
              "pointer-events-auto inline-flex shrink-0 items-center gap-0.5 px-2.5 no-underline sm:px-3 hover:no-underline",
              !canNext && "pointer-events-none opacity-60",
            )}
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          </Link>
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
              it === safePage ? (
                <span
                  key={it}
                  className={cn("tabular-nums", PAGE_NUM_ACTIVE)}
                  aria-label={`Page ${it}`}
                  aria-current="page"
                >
                  {it}
                </span>
              ) : (
                <Link
                  key={it}
                  href={hrefForPage(it)}
                  className={cn("tabular-nums", PAGE_NUM_INACTIVE)}
                  aria-label={`Page ${it}`}
                >
                  {it}
                </Link>
              )
            ),
          )}
        </div>
      </div>
    </nav>
  );
}

