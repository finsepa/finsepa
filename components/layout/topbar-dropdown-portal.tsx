"use client";

import { createPortal } from "react-dom";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  dropdownMenuMobileSheetBodyClassName,
  dropdownMenuMobileSheetStripPanelClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";
import { useMobileSheet } from "@/lib/layout/use-mobile-sheet";
import { cn } from "@/lib/utils";

/** Above topbar (`z-30`), bottom nav (`z-[43]`), and sheet backdrop (`z-[41]`). */
const TOPBAR_DROPDOWN_PORTAL_Z = 220;

type HorizontalAlign = "trailing" | "leading" | "center" | "auto";

type TopbarDropdownPortalProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  /**
   * `trailing`: fixed box’s right edge matches anchor’s right (top bar menus).
   * `leading`: fixed box’s left edge matches anchor’s left (e.g. portfolio title row).
   * `center`: horizontally centered under the anchor.
   * `auto`: prefer leading, flip to trailing when there is not enough room on the right.
   */
  align?: HorizontalAlign;
  /** Match the anchor element width (full-width form dropdowns). */
  matchAnchorWidth?: boolean;
  /**
   * `below` — opens under the anchor (default).
   * `above` — opens above the anchor.
   * `auto` — opens above when there is not enough room below.
   */
  placement?: "below" | "above" | "auto";
  /** Mobile modal sheet title (omit for menus without a heading). */
  sheetTitle?: ReactNode;
  /** Called when the mobile modal sheet backdrop is tapped or Escape is pressed. */
  onRequestClose?: () => void;
};

type PortalPos = { width?: number; top?: number; bottom?: number } & (
  | { right: number; left?: undefined; centerX?: undefined }
  | { left: number; right?: undefined; centerX?: undefined }
  | { centerX: number; left?: undefined; right?: undefined }
);

const DROPDOWN_ANCHOR_GAP_PX = 4;
/** Matches tall searchable metric menus (`max-h-[min(400px,…)]`). */
const DROPDOWN_AUTO_FLIP_ESTIMATE_PX = 320;
const DROPDOWN_VIEWPORT_EDGE_PAD_PX = 16;
/** Max width used by charting / comparison metric pickers. */
const DROPDOWN_H_WIDTH_ESTIMATE_PX = 520;

function resolveDropdownOpensAbove(
  placement: "below" | "above" | "auto",
  anchorRect: DOMRect,
  viewportHeight: number,
): boolean {
  if (placement === "above") return true;
  if (placement === "below") return false;
  const spaceBelow = viewportHeight - anchorRect.bottom - DROPDOWN_ANCHOR_GAP_PX;
  const spaceAbove = anchorRect.top - DROPDOWN_ANCHOR_GAP_PX;
  return spaceBelow < DROPDOWN_AUTO_FLIP_ESTIMATE_PX && spaceAbove >= spaceBelow;
}

function resolveMenuWidthEstimate(viewportWidth: number, matchAnchorWidth: boolean, anchorWidth: number): number {
  if (matchAnchorWidth) return anchorWidth;
  return Math.min(DROPDOWN_H_WIDTH_ESTIMATE_PX, Math.max(0, viewportWidth - DROPDOWN_VIEWPORT_EDGE_PAD_PX * 2));
}

/**
 * Prefer the requested edge, but flip horizontally when the menu would overflow the viewport.
 * Prevents body horizontal scroll (e.g. “Add Metric” near the right edge).
 */
function resolveEffectiveAlign(
  align: HorizontalAlign,
  anchorRect: DOMRect,
  viewportWidth: number,
  menuWidth: number,
): Exclude<HorizontalAlign, "auto"> {
  if (align === "center") return "center";

  const pad = DROPDOWN_VIEWPORT_EDGE_PAD_PX;
  const spaceRightFromLeft = viewportWidth - anchorRect.left - pad;
  const spaceLeftFromRight = anchorRect.right - pad;

  if (align === "auto") {
    if (spaceRightFromLeft >= menuWidth) return "leading";
    if (spaceLeftFromRight >= menuWidth) return "trailing";
    return spaceLeftFromRight >= spaceRightFromLeft ? "trailing" : "leading";
  }

  if (align === "leading") {
    if (spaceRightFromLeft >= menuWidth) return "leading";
    if (spaceLeftFromRight > spaceRightFromLeft) return "trailing";
    return "leading";
  }

  if (spaceLeftFromRight >= menuWidth) return "trailing";
  if (spaceRightFromLeft > spaceLeftFromRight) return "leading";
  return "trailing";
}

/**
 * Renders a fixed-position layer in `document.body` aligned under the anchor,
 * so parent `overflow` on the top bar (or other shells) does not clip dropdowns.
 */
export const TopbarDropdownPortal = forwardRef<HTMLDivElement, TopbarDropdownPortalProps>(
  function TopbarDropdownPortal(
    {
      open,
      anchorRef,
      children,
      className,
      align = "trailing",
      matchAnchorWidth = false,
      placement = "below",
      sheetTitle,
      onRequestClose,
    },
    ref,
  ) {
    const [mounted, setMounted] = useState(false);
    const [pos, setPos] = useState<PortalPos>({ top: 0, right: 0 });
    const isMobileSheet = useMobileSheet();

    useEffect(() => {
      setMounted(true);
    }, []);

    const update = useCallback(() => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const width = matchAnchorWidth ? r.width : undefined;
      const opensAbove = resolveDropdownOpensAbove(placement, r, vh);
      const vertical = opensAbove
        ? { bottom: vh - r.top + DROPDOWN_ANCHOR_GAP_PX, top: undefined }
        : { top: r.bottom + DROPDOWN_ANCHOR_GAP_PX, bottom: undefined };

      const menuW = resolveMenuWidthEstimate(vw, matchAnchorWidth, r.width);
      const effective = resolveEffectiveAlign(align, r, vw, menuW);
      const pad = DROPDOWN_VIEWPORT_EDGE_PAD_PX;

      if (effective === "leading") {
        const maxLeft = Math.max(pad, vw - menuW - pad);
        const left = Math.min(Math.max(pad, r.left), maxLeft);
        setPos({ ...vertical, left, width });
      } else if (effective === "center") {
        setPos({ ...vertical, centerX: r.left + r.width / 2, width });
      } else {
        const maxRight = Math.max(pad, vw - menuW - pad);
        const right = Math.min(Math.max(pad, vw - r.right), maxRight);
        setPos({ ...vertical, right, width });
      }
    }, [anchorRef, align, matchAnchorWidth, placement]);

    useLayoutEffect(() => {
      if (!open) return;
      update();
    }, [open, update]);

    useEffect(() => {
      if (!open) return;
      const onScrollOrResize = () => update();
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
      const vv = window.visualViewport;
      vv?.addEventListener("resize", onScrollOrResize);
      vv?.addEventListener("scroll", onScrollOrResize);
      return () => {
        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize);
        vv?.removeEventListener("resize", onScrollOrResize);
        vv?.removeEventListener("scroll", onScrollOrResize);
      };
    }, [open, update]);

    if (!open || !mounted) return null;

    if (isMobileSheet) {
      return createPortal(
        <MobileBottomSheet
          open={open}
          onClose={() => onRequestClose?.()}
          title={sheetTitle}
          zIndex={TOPBAR_DROPDOWN_PORTAL_Z}
        >
          <div
            ref={ref}
            className={cn(
              dropdownMenuMobileSheetBodyClassName,
              dropdownMenuMobileSheetStripPanelClassName,
              "!rounded-none !border-0 !bg-transparent !shadow-none",
              className,
              "w-full min-w-0 max-w-none",
            )}
          >
            {children}
          </div>
        </MobileBottomSheet>,
        document.body,
      );
    }

    const horizontal =
      "centerX" in pos && pos.centerX != null
        ? { left: pos.centerX, transform: "translateX(-50%)" as const }
        : "left" in pos && pos.left != null
          ? { left: pos.left }
          : { right: pos.right as number };

    return createPortal(
      <div
        ref={ref}
        style={{
          position: "fixed",
          top: pos.top,
          bottom: pos.bottom,
          zIndex: TOPBAR_DROPDOWN_PORTAL_Z,
          width: pos.width,
          maxWidth: `calc(100vw - ${DROPDOWN_VIEWPORT_EDGE_PAD_PX * 2}px)`,
          ...horizontal,
        }}
        className={cn(className)}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
