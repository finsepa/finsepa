"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { dropdownMenuSurfaceClassName } from "@/components/design-system/dropdown-menu-styles";
import { whiteSurfaceButtonChromeClass } from "@/components/design-system/secondary-button-styles";
import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import { Smartphone } from "@/lib/icons";
import { cn } from "@/lib/utils";

const APP_STORE_URL = "https://apps.apple.com/app/finsepa/id6801018314";
const QR_SRC = "/mobile-app-qr.png";

const SHOW_MS = 120;
const HIDE_MS = 140;
const POPOVER_GAP_PX = 8;

/**
 * Bottom sidebar control — circle icon; hover opens App Store QR above, opening to the right.
 */
export function SidebarMobileAppNav() {
  const { collapsed } = useSidebarLayout();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** Fixed: above the button, left-aligned so the panel opens to the right. */
  const [pos, setPos] = useState({ left: 0, bottom: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearShow = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearShow();
      clearHide();
    };
  }, [clearHide, clearShow]);

  const updatePosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: r.left,
      bottom: Math.max(POPOVER_GAP_PX, window.innerHeight - r.top + POPOVER_GAP_PX),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  const scheduleShow = useCallback(() => {
    clearHide();
    clearShow();
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      updatePosition();
      setOpen(true);
    }, SHOW_MS);
  }, [clearHide, clearShow, updatePosition]);

  const scheduleHide = useCallback(() => {
    clearShow();
    clearHide();
    hideTimerRef.current = setTimeout(() => setOpen(false), HIDE_MS);
  }, [clearHide, clearShow]);

  const cancelAndHide = useCallback(() => {
    clearShow();
    clearHide();
    setOpen(false);
  }, [clearHide, clearShow]);

  const popover =
    open && mounted ? (
      <div
        className="fixed z-[200]"
        style={{ left: pos.left, bottom: pos.bottom }}
        role="dialog"
        aria-label="Download iOS Finsepa app"
        onPointerEnter={scheduleShow}
        onPointerLeave={scheduleHide}
      >
        <div className={cn(dropdownMenuSurfaceClassName(), "flex items-center gap-4 p-4")}>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static public QR asset */}
            <img
              src={QR_SRC}
              alt="QR code to download the Finsepa iOS app"
              width={112}
              height={112}
              className="h-28 w-28 rounded-xl bg-white object-cover"
              draggable={false}
            />
          </a>
          <div className="min-w-0 max-w-[11rem] pr-1">
            <p className="text-[15px] font-semibold leading-5 text-fg">iOS Finsepa app</p>
            <p className="mt-1 text-sm font-normal leading-5 text-fg-muted">
              Scan the QR code to download now
            </p>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "mt-auto flex shrink-0 pt-2",
        collapsed ? "w-full justify-center px-0" : "justify-start px-1",
      )}
      onPointerEnter={scheduleShow}
      onPointerLeave={scheduleHide}
    >
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-icon transition-all duration-100",
          whiteSurfaceButtonChromeClass,
          "hover:bg-surface-muted dark:hover:bg-dropdown-item-hover",
          open && "bg-surface-muted dark:bg-dropdown-item-hover",
        )}
        aria-label="Mobile app"
        aria-expanded={open}
        aria-haspopup="dialog"
        onFocus={scheduleShow}
        onBlur={scheduleHide}
        onClick={(e) => {
          e.preventDefault();
          if (open) cancelAndHide();
          else {
            updatePosition();
            setOpen(true);
          }
        }}
      >
        <Smartphone className="h-5 w-5" aria-hidden />
      </button>
      {mounted && popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
