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
   */
  align?: "trailing" | "leading";
};

type PortalPos = { top: number } & ({ right: number; left?: undefined } | { left: number; right?: undefined });

/**
 * Renders a fixed-position layer in `document.body` aligned under the anchor,
 * so parent `overflow` on the top bar (or other shells) does not clip dropdowns.
 */
export const TopbarDropdownPortal = forwardRef<HTMLDivElement, TopbarDropdownPortalProps>(
  function TopbarDropdownPortal({ open, anchorRef, children, className, align = "trailing" }, ref) {
    const [mounted, setMounted] = useState(false);
    const [pos, setPos] = useState<PortalPos>({ top: 0, right: 0 });

    useEffect(() => {
      setMounted(true);
    }, []);

    const update = useCallback(() => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.visualViewport?.width ?? window.innerWidth;
      if (align === "leading") {
        setPos({ top: r.bottom + 4, left: r.left });
      } else {
        setPos({ top: r.bottom + 4, right: vw - r.right });
      }
    }, [anchorRef, align]);

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

    const horizontal =
      "left" in pos && pos.left != null ? { left: pos.left } : { right: pos.right as number };

    return createPortal(
      <div
        ref={ref}
        style={{ position: "fixed", top: pos.top, zIndex: TOPBAR_DROPDOWN_PORTAL_Z, ...horizontal }}
        className={cn(className)}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
