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
};

/**
 * Renders a fixed-position layer in `document.body` aligned to the anchor’s bottom-right,
 * so parent `overflow` on the top bar does not clip dropdowns.
 */
export const TopbarDropdownPortal = forwardRef<HTMLDivElement, TopbarDropdownPortalProps>(
  function TopbarDropdownPortal({ open, anchorRef, children, className }, ref) {
    const [mounted, setMounted] = useState(false);
    const [pos, setPos] = useState({ top: 0, right: 0 });

    useEffect(() => {
      setMounted(true);
    }, []);

    const update = useCallback(() => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.visualViewport?.width ?? window.innerWidth;
      setPos({ top: r.bottom + 4, right: vw - r.right });
    }, [anchorRef]);

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

    return createPortal(
      <div
        ref={ref}
        style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: TOPBAR_DROPDOWN_PORTAL_Z }}
        className={cn(className)}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
