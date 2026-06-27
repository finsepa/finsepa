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

type TopbarDropdownPortalProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  /**
   * `trailing`: fixed box’s right edge matches anchor’s right (top bar menus).
   * `leading`: fixed box’s left edge matches anchor’s left (e.g. portfolio title row).
   * `center`: horizontally centered under the anchor.
   */
  align?: "trailing" | "leading" | "center";
  /** Match the anchor element width (full-width form dropdowns). */
  matchAnchorWidth?: boolean;
  /** Mobile modal sheet title (omit for menus without a heading). */
  sheetTitle?: ReactNode;
  /** Called when the mobile modal sheet backdrop is tapped or Escape is pressed. */
  onRequestClose?: () => void;
};

type PortalPos = { top: number; width?: number } & (
  | { right: number; left?: undefined; centerX?: undefined }
  | { left: number; right?: undefined; centerX?: undefined }
  | { centerX: number; left?: undefined; right?: undefined }
);

/**
 * Renders a fixed-position layer in `document.body` aligned under the anchor,
 * so parent `overflow` on the top bar (or other shells) does not clip dropdowns.
 */
export const TopbarDropdownPortal = forwardRef<HTMLDivElement, TopbarDropdownPortalProps>(
  function TopbarDropdownPortal(
    { open, anchorRef, children, className, align = "trailing", matchAnchorWidth = false, sheetTitle, onRequestClose },
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
      const width = matchAnchorWidth ? r.width : undefined;
      if (align === "leading") {
        setPos({ top: r.bottom + 4, left: r.left, width });
      } else if (align === "center") {
        setPos({ top: r.bottom + 4, centerX: r.left + r.width / 2, width });
      } else {
        setPos({ top: r.bottom + 4, right: vw - r.right, width });
      }
    }, [anchorRef, align, matchAnchorWidth]);

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
          zIndex: TOPBAR_DROPDOWN_PORTAL_Z,
          width: pos.width,
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
