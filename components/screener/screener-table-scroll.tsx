import type { ReactNode } from "react";

import { MOBILE_CARD_SURFACE_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";

/** Column label row — sticky in desktop `<main>`; static on mobile (avoids topbar-offset gap in card). */
export const SCREENER_TABLE_HEADER_STICKY_CLASS =
  "z-20 border-b border-solid border-[#E4E4E7] bg-white max-md:static max-md:border-b-[0.5px] md:sticky md:top-0";

/** Row separators (keep header outside this so the header/rule line is exactly 1px on desktop). */
export const SCREENER_TABLE_BODY_DIVIDE_CLASS =
  "divide-y divide-solid divide-[#E4E4E7] max-md:divide-y-[0.5px]";

/** Bottom rule on individual rows (e.g. industries drill). */
export const SCREENER_TABLE_ROW_BORDER_B_CLASS =
  "border-b border-solid border-[#E4E4E7] max-md:border-b-[0.5px]";

/** Top/bottom frame on desktop; borderless on mobile (card shadow instead). */
export const SCREENER_TABLE_OUTER_BORDER_CLASS =
  "max-md:border-0 md:border-x-0 md:border-y md:border-solid md:border-[#E4E4E7]";

/** Matches index cards — rounded surface + stacked shadow on mobile only. */
export const SCREENER_TABLE_MOBILE_SURFACE_CLASS = cn(
  "max-md:overflow-hidden max-md:rounded-2xl max-md:bg-white",
  MOBILE_CARD_SURFACE_CLASS,
);

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
  /** Parent {@link ScreenerStocksSubTabMobileCard} already provides mobile card chrome. */
  embeddedInMobileCard = false,
}: {
  children: ReactNode;
  className?: string;
  minWidthClassName?: string;
  mobileScroll?: boolean;
  viewportScroll?: boolean;
  tableMinWidthPx?: number;
  embeddedInMobileCard?: boolean;
}) {
  const scrollWide = mobileScroll || (tableMinWidthPx != null && tableMinWidthPx > 0);
  const useViewportScroll = viewportScroll && scrollWide;
  /** Horizontal pan on small screens only — avoid `overflow-x` on desktop so sticky headers work in `<main>`. */
  const mobileHorizontalPan = mobileScroll && tableMinWidthPx == null;

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full",
        !embeddedInMobileCard && SCREENER_TABLE_OUTER_BORDER_CLASS,
        !embeddedInMobileCard && SCREENER_TABLE_MOBILE_SURFACE_CLASS,
        embeddedInMobileCard &&
          "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none",
        useViewportScroll ?
          "max-h-[var(--financials-table-max-h)] overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
        : mobileHorizontalPan ?
          "max-md:overflow-x-auto max-md:overscroll-x-contain max-md:[-webkit-overflow-scrolling:touch]"
        : undefined,
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
