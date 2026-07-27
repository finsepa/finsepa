"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { MOBILE_CARD_SURFACE_CLASS } from "@/components/design-system/card-surface-styles";
import { cn } from "@/lib/utils";

/** Column label row — sticky in desktop `<main>`; static on mobile (avoids topbar-offset gap in card). */
export const SCREENER_TABLE_HEADER_STICKY_CLASS =
  "z-30 isolate bg-white max-md:static md:sticky md:top-0 md:border-b md:border-solid md:border-[#EFEFEF]";

/** Top corners for the header inside a 16px-radius screener table card. */
export const SCREENER_TABLE_ROUNDED_HEADER_CLASS = "md:rounded-t-2xl";

/**
 * Sticky header inside an overflow scroller (e.g. Financials viewport table).
 * Opaque cells + isolation keep body values from painting through on scroll.
 */
export const SCREENER_TABLE_HEADER_STICKY_SCROLLPORT_CLASS =
  "sticky top-0 z-30 isolate bg-white border-b border-solid border-[#EFEFEF]";

/** Row separators (keep header outside this so the header/rule line is exactly 1px on desktop). */
export const SCREENER_TABLE_BODY_DIVIDE_CLASS =
  "md:divide-y md:divide-solid md:divide-[#EFEFEF]";

/** Bottom rule on individual rows (e.g. industries drill). */
export const SCREENER_TABLE_ROW_BORDER_B_CLASS =
  "md:border-b md:border-solid md:border-[#EFEFEF]";

/**
 * Companies table desktop: hover fill inset 8px from the card; stroke inset 20px
 * so the rule sits inside the hover area. Strokes hide above/below the hovered row.
 */
export const SCREENER_TABLE_DATA_ROW_CLASS = cn(
  "screener-data-row group/row relative bg-white max-md:hover:bg-neutral-50",
  // Hide this row's bottom stroke while hovered.
  "[&:hover_.screener-row-stroke]:opacity-0",
  // Hide this row's bottom stroke when the next row is hovered (top rule of hovered row).
  "has-[+.screener-data-row:hover]:[&_.screener-row-stroke]:opacity-0",
);

/**
 * Desktop row inset from the card edge — **8px** (`md:px-2`), matching Companies screener.
 * End-aligned metric cells may add another 12px ({@link TABLE_END_ALIGNED_PAD_CLASS}) → 20px total on the right.
 * Non-screener tables also pad the first left cell with {@link TABLE_START_ALIGNED_PAD_CLASS} (12px).
 * Mobile keeps 16px (`max-md:px-4`).
 */
export const SCREENER_TABLE_ROW_HOVER_PAD_CLASS = "max-md:px-4 md:px-2";

/**
 * Alias of {@link SCREENER_TABLE_ROW_HOVER_PAD_CLASS} — same 8px desktop inset for all data tables
 * (portfolio, charting, news, earnings reports, etc.).
 */
export const DEFAULT_TABLE_ROW_HOVER_PAD_CLASS = SCREENER_TABLE_ROW_HOVER_PAD_CLASS;

export {
  TABLE_END_ALIGNED_PAD_CLASS,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-pad";

export const SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS =
  "md:rounded-[10px] md:transition-colors md:duration-75 md:group-hover/row:bg-neutral-50";

export const SCREENER_TABLE_STROKE_INSET_CLASS =
  "screener-row-stroke mx-5 hidden border-b border-solid border-[#EFEFEF] transition-opacity duration-75 md:block";

/** Hide header rule when the first data row is hovered. */
export const SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS =
  "has-[+*_.screener-data-row:first-child:hover]:[&_.screener-row-stroke]:opacity-0";

/** Full frame on desktop; borderless on mobile (card shadow instead). */
export const SCREENER_TABLE_OUTER_BORDER_CLASS =
  "max-md:border-0 md:border md:border-solid md:border-[#EBEBEC]";

/** 16px rounded white surface — mobile elevation, desktop border + shadow. */
export const SCREENER_TABLE_MOBILE_SURFACE_CLASS = cn(
  "overflow-hidden rounded-2xl bg-white md:shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]",
  MOBILE_CARD_SURFACE_CLASS,
);

/**
 * Always-visible classic scrollbars (both axes) for Financials viewport scroll.
 * Styled webkit bars avoid macOS overlay auto-hide so the horizontal track stays put.
 */
export const FINANCIALS_TABLE_VIEWPORT_SCROLLBAR_CLASS =
  "financials-table-viewport-scroll [scrollbar-width:thin] [scrollbar-color:#A1A1AA_#F4F4F5]";

const MIN_VIEWPORT_SCROLL_H_PX = 240;

/** Bottom inset inside the window for the financials scrollport (shell padding + a little air). */
function financialsBottomInsetPx(): number {
  if (typeof window === "undefined") return 16;
  const rootStyle = getComputedStyle(document.documentElement);
  const shellPad = Number.parseFloat(rootStyle.getPropertyValue("--shell-desktop-padding-bottom")) || 8;
  const mobileClearance =
    window.matchMedia("(max-width: 767px)").matches ?
      Number.parseFloat(rootStyle.getPropertyValue("--mobile-bottom-nav-main-clearance")) || 0
    : 0;
  return shellPad + mobileClearance + 8;
}

/**
 * Caps height to the remaining viewport so both scrollbars sit on the visible frame
 * (horizontal at the bottom, vertical on the right) — not below the fold of a tall table.
 *
 * Outer shell owns border / radius / shadow so the scroll-fade mask never clips the
 * container stroke. Inner port scrolls, fades, and shows classic scrollbars.
 */
function FinancialsViewportScrollFrame({
  children,
  className,
  embeddedInMobileCard,
}: {
  children: ReactNode;
  className?: string;
  embeddedInMobileCard: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null);
  const [canScrollX, setCanScrollX] = useState(false);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root || root.getClientRects().length === 0) return;
    const top = root.getBoundingClientRect().top;
    const available = Math.floor(window.innerHeight - top - financialsBottomInsetPx());
    setMaxHeightPx(Math.max(MIN_VIEWPORT_SCROLL_H_PX, available));
    setCanScrollX(root.scrollWidth > root.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, children]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const first = root.firstElementChild;
    if (first) ro.observe(first);
    // Remeasure when the Financials tab becomes visible (panel uses `hidden`).
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) measure();
      },
      { threshold: 0 },
    );
    io.observe(root);

    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      ro.disconnect();
      io.disconnect();
    };
  }, [measure]);

  return (
    <div
      className={cn(
        // Border / radius / shadow live outside the scroll mask so the right stroke stays visible.
        "w-full min-w-0 max-w-full rounded-2xl bg-white",
        SCREENER_TABLE_OUTER_BORDER_CLASS,
        "md:shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]",
        MOBILE_CARD_SURFACE_CLASS,
        embeddedInMobileCard &&
          "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none",
        className,
      )}
    >
      <div
        ref={rootRef}
        className={cn(
          "w-full min-w-0 overflow-auto overscroll-contain rounded-2xl [-webkit-overflow-scrolling:touch]",
          FINANCIALS_TABLE_VIEWPORT_SCROLLBAR_CLASS,
          // Fade content only — offset right so the scrollbar track stays fully opaque.
          canScrollX &&
            "scroll-fade-effect-x [--mask-width:2.5rem] [--scroll-buffer:1.5rem] [--mask-offset-right:10px]",
          embeddedInMobileCard && "max-md:rounded-none",
        )}
        style={{
          maxHeight: maxHeightPx ?? "var(--financials-table-max-h)",
          ...(canScrollX
            ? ({
                // Match sticky label col (`STOCK_TABLE_LABEL_COL_WIDTH`) so the left fade starts after labels.
                ["--mask-offset-left" as string]: "14rem",
              } as CSSProperties)
            : null),
        }}
      >
        {children}
      </div>
    </div>
  );
}

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
  /** Pin horizontal scroll to the end (latest / forecast columns) on mount and content change. */
  scrollAlignEnd = false,
  /** Remount/pin key — e.g. period mode or column count. */
  scrollAlignKey,
  /** Min inner width on small screens only — keeps columns from squashing when `scrollAlignEnd`. */
  mobileTableMinWidthPx,
}: {
  children: ReactNode;
  className?: string;
  minWidthClassName?: string;
  mobileScroll?: boolean;
  viewportScroll?: boolean;
  tableMinWidthPx?: number;
  embeddedInMobileCard?: boolean;
  scrollAlignEnd?: boolean;
  scrollAlignKey?: string | number;
  mobileTableMinWidthPx?: number;
}) {
  const scrollWide = mobileScroll || (tableMinWidthPx != null && tableMinWidthPx > 0);
  const useViewportScroll = viewportScroll && scrollWide;
  /** Horizontal pan on small screens only — avoid `overflow-x` on desktop so sticky headers work in `<main>`. */
  const mobileHorizontalPan = mobileScroll && tableMinWidthPx == null;
  const scrollRef = useRef<HTMLDivElement>(null);

  const pinScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
  }, []);

  useLayoutEffect(() => {
    if (!scrollAlignEnd || useViewportScroll) return;
    pinScrollEnd();
    const raf1 = requestAnimationFrame(() => {
      pinScrollEnd();
      requestAnimationFrame(pinScrollEnd);
    });
    return () => cancelAnimationFrame(raf1);
  }, [scrollAlignEnd, scrollAlignKey, useViewportScroll, pinScrollEnd, children]);

  useEffect(() => {
    if (!scrollAlignEnd || useViewportScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // Keep the end pinned while the table is still at (or beyond) the previous end —
      // avoids fighting the user after they scroll left to older columns.
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      if (el.scrollLeft >= max - 2) pinScrollEnd();
    });
    ro.observe(el);
    const first = el.firstElementChild;
    if (first) ro.observe(first);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) pinScrollEnd();
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [scrollAlignEnd, scrollAlignKey, useViewportScroll, pinScrollEnd, children]);

  const innerStyle =
    tableMinWidthPx != null || mobileTableMinWidthPx != null
      ? ({
          ...(tableMinWidthPx != null ? { minWidth: tableMinWidthPx } : undefined),
          ...(mobileTableMinWidthPx != null
            ? { "--stock-table-mobile-min-w": `${mobileTableMinWidthPx}px` }
            : undefined),
        } as CSSProperties)
      : undefined;

  const inner = (
    <div
      className={cn(
        "w-full",
        tableMinWidthPx == null && mobileTableMinWidthPx == null && "min-w-0 max-w-full",
        mobileScroll &&
          tableMinWidthPx == null &&
          mobileTableMinWidthPx == null &&
          "max-md:min-w-[720px]",
        mobileTableMinWidthPx != null && "max-md:min-w-[var(--stock-table-mobile-min-w)]",
        minWidthClassName,
      )}
      style={innerStyle}
    >
      {children}
    </div>
  );

  if (useViewportScroll) {
    return (
      <FinancialsViewportScrollFrame className={className} embeddedInMobileCard={embeddedInMobileCard}>
        {inner}
      </FinancialsViewportScrollFrame>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "w-full min-w-0 max-w-full",
        SCREENER_TABLE_OUTER_BORDER_CLASS,
        SCREENER_TABLE_MOBILE_SURFACE_CLASS,
        !scrollAlignEnd && "max-md:overflow-hidden",
        embeddedInMobileCard &&
          "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none",
        // `mobile-scroll-x` is mobile-only in CSS; earnings summary needs pan on all breakpoints.
        scrollAlignEnd
          ? "overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:#A1A1AA_transparent] max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none]"
          : mobileHorizontalPan
            ? "mobile-scroll-x"
            : undefined,
        className,
      )}
    >
      {inner}
    </div>
  );
}
