import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Column label row — sticks to the top of the app main scroll area while rows scroll beneath. */
export const SCREENER_TABLE_HEADER_STICKY_CLASS =
  "sticky top-0 z-20 border-b border-solid border-[#E4E4E7] bg-white";

/** Row separators (keep header outside this so the header/rule line is exactly 1px). */
export const SCREENER_TABLE_BODY_DIVIDE_CLASS = "divide-y divide-solid divide-[#E4E4E7]";

/**
 * Wraps screener tables. Below `md`, content fits the viewport (no 720px horizontal strip).
 * Pass `mobileScroll` for wide grids (e.g. income statement) that need pan on small screens.
 * Pass `viewportScroll` with `mobileScroll` on tall wide tables (Financials) so the horizontal
 * scrollbar stays at the bottom of the visible viewport while rows scroll inside.
 */
export function ScreenerTableScroll({
  children,
  className,
  minWidthClassName = "min-w-0",
  mobileScroll = false,
  viewportScroll = false,
  /** When set, inner table keeps this width so extra columns scroll instead of squashing. */
  tableMinWidthPx,
}: {
  children: ReactNode;
  className?: string;
  minWidthClassName?: string;
  mobileScroll?: boolean;
  viewportScroll?: boolean;
  tableMinWidthPx?: number;
}) {
  const scrollWide = mobileScroll || (tableMinWidthPx != null && tableMinWidthPx > 0);
  const useViewportScroll = viewportScroll && scrollWide;

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full border-x-0 border-y border-solid border-[#E4E4E7]",
        useViewportScroll ?
          "max-h-[var(--financials-table-max-h)] overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
        : scrollWide ?
          "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
        : "overflow-x-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "w-full",
          tableMinWidthPx == null && "min-w-0 max-w-full",
          mobileScroll && tableMinWidthPx == null && "max-md:min-w-[720px]",
          minWidthClassName,
        )}
        style={tableMinWidthPx != null ? { minWidth: tableMinWidthPx } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
