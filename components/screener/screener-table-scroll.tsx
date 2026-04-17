import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Wraps wide screener grids on small viewports: horizontal pan without squashing columns.
 * From `lg` up, min-width is cleared so the grid can use the full content width.
 */
export function ScreenerTableScroll({
  children,
  className,
  /** Tailwind min-width for scrollable strip (default matches Companies/Crypto tables). */
  minWidthClassName = "min-w-[720px] lg:min-w-0",
}: {
  children: ReactNode;
  className?: string;
  minWidthClassName?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-1 overflow-x-auto overscroll-x-contain rounded-lg border border-[#E4E4E7] [-webkit-overflow-scrolling:touch] sm:-mx-0 sm:rounded-none sm:border-x-0 sm:border-t sm:border-b",
        className,
      )}
    >
      <div className={minWidthClassName}>{children}</div>
    </div>
  );
}
