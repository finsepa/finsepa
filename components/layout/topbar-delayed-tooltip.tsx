"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Above app chrome (sidebar `z-20`, topbar `z-30`, menus `z-[120]`) so hints are never clipped by `overflow-hidden`. */
const TOOLTIP_PORTAL_Z = 280;

/** Shared dwell time for top bar + collapsed sidebar rail tooltips. */
export const DWELL_TOOLTIP_DELAY_MS = 1000;

const DEFAULT_DELAY_MS = DWELL_TOOLTIP_DELAY_MS;

type TopbarDelayedTooltipAlign = "center" | "trailing";
type TopbarDelayedTooltipPlacement = "bottom" | "left" | "right";

type TopbarDelayedTooltipProps = {
  label: string;
  /** Hover / focus dwell time before the tooltip shows (avoids flashes on quick pass-through and clicks). */
  delayMs?: number;
  /** Portal z-index — raise above modals (e.g. `350` when nested in `AppModalOverlay`). */
  zIndex?: number;
  /** When false, hover/focus hints are suppressed (e.g. while search dropdown is open). */
  enabled?: boolean;
  /** `trailing` anchors to the control's right edge so the pill extends left (right-rail controls). */
  align?: TopbarDelayedTooltipAlign;
  /** `bottom` = pill below control (default). `right` = pill to the right (collapsed sidebar). `left` = pill to the left (right-rail controls). */
  placement?: TopbarDelayedTooltipPlacement;
  /** When true, tooltip text may span multiple lines (`\n`). */
  multiline?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Figma-style hint: dark pill with a caret (`placement="bottom"`, `"left"`, or `"right"`).
 * Appears only after {@link delayMs} of continuous hover or keyboard focus.
 * Rendered in a **portal** so it is not clipped by sidebar `overflow-y-auto` or stacked under the top bar (`z-30`).
 */
export function TopbarDelayedTooltip({
  label,
  delayMs = DEFAULT_DELAY_MS,
  zIndex = TOOLTIP_PORTAL_Z,
  enabled = true,
  align = "center",
  placement = "bottom",
  multiline = false,
  children,
  className,
}: TopbarDelayedTooltipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, transform: "translateX(-50%)" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tooltipsDisabled = useCallback(() => {
    // Disable tooltips on touch devices (mobile) to avoid accidental popovers on tap/scroll.
    if (typeof window === "undefined") return true;
    return window.matchMedia("(hover: none), (pointer: coarse)").matches;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const start = useCallback(() => {
    if (!enabled || tooltipsDisabled()) return;
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(true), delayMs);
  }, [clearTimer, delayMs, enabled, tooltipsDisabled]);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (placement === "right") {
      setPos({ left: r.right + 6, top: r.top + r.height / 2, transform: "translateY(-50%)" });
      return;
    }
    if (placement === "left") {
      setPos({ left: r.left - 6, top: r.top + r.height / 2, transform: "translate(-100%, -50%)" });
      return;
    }
    if (align === "trailing") {
      setPos({ left: r.right, top: r.bottom + 6, transform: "translateX(-100%)" });
      return;
    }
    setPos({ left: r.left + r.width / 2, top: r.bottom + 6, transform: "translateX(-50%)" });
  }, [align, placement]);

  useLayoutEffect(() => {
    if (!visible) return;
    updatePosition();
  }, [visible, updatePosition]);

  useEffect(() => {
    if (!visible) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [visible, updatePosition]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);

  const tooltip =
    visible && mounted ? (
      <div
        className={cn(
          "pointer-events-none fixed flex",
          placement === "right" || placement === "left"
            ? "flex-row items-center"
            : cn("flex-col", align === "trailing" ? "items-end" : "items-center"),
        )}
        style={{ left: pos.left, top: pos.top, transform: pos.transform, zIndex }}
        role="tooltip"
      >
        {placement === "right" ? (
          <div
            className="h-0 w-0 border-y-[6px] border-r-[7px] border-y-transparent border-r-[#0F0F0F]"
            aria-hidden
          />
        ) : null}
        {placement === "bottom" ? (
          <div
            className="h-0 w-0 border-x-[6px] border-b-[7px] border-x-transparent border-b-[#0F0F0F]"
            aria-hidden
          />
        ) : null}
        <div
          className={cn(
            "rounded-md bg-[#0F0F0F] px-2.5 py-1.5 text-xs font-medium leading-4 text-white",
            multiline ? "max-w-[min(calc(100vw-2rem),16rem)] whitespace-pre-line text-left" : "whitespace-nowrap text-center",
            placement === "right" ? "-ml-px" : placement === "left" ? "-mr-px" : "-mt-px",
          )}
        >
          {label}
        </div>
        {placement === "left" ? (
          <div
            className="h-0 w-0 border-y-[6px] border-l-[7px] border-y-transparent border-l-[#0F0F0F]"
            aria-hidden
          />
        ) : null}
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex max-w-full", className)}
      onMouseEnter={start}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocusCapture={start}
      onBlurCapture={hide}
    >
      {children}
      {mounted && tooltip ? createPortal(tooltip, document.body) : null}
    </div>
  );
}
