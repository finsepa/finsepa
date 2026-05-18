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
 */
export function ScreenerTableScroll({
  children,
  className,
  minWidthClassName = "min-w-0",
  mobileScroll = false,
}: {
  children: ReactNode;
  className?: string;
  minWidthClassName?: string;
  mobileScroll?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full border-x-0 border-y border-solid border-[#E4E4E7]",
        mobileScroll ?
          "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
        : "max-md:overflow-x-hidden md:overflow-x-auto md:overscroll-x-contain md:[-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      <div
        className={cn(
          "w-full min-w-0 max-w-full",
          mobileScroll && "max-md:min-w-[720px]",
          minWidthClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
