import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
        "w-full min-w-0 max-w-full border-y border-[#E4E4E7] border-x-0",
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
