"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Above app chrome (sidebar `z-20`, topbar `z-30`, menus `z-[120]`) so hints are never clipped by `overflow-hidden`. */
const TOOLTIP_PORTAL_Z = 280;

/** Shared dwell time for top bar + collapsed sidebar rail tooltips. */
export const DWELL_TOOLTIP_DELAY_MS = 1000;

const DEFAULT_DELAY_MS = DWELL_TOOLTIP_DELAY_MS;

type TopbarDelayedTooltipProps = {
  label: string;
  /** Hover / focus dwell time before the tooltip shows (avoids flashes on quick pass-through and clicks). */
  delayMs?: number;
  children: ReactNode;
  className?: string;
};

/**
 * Figma-style top bar hint: dark pill below the control with a small upward caret.
 * Appears only after {@link delayMs} of continuous hover or keyboard focus.
 * Rendered in a **portal** so it is not clipped by sidebar `overflow-y-auto` or stacked under the top bar (`z-30`).
 */
export function TopbarDelayedTooltip({
  label,
  delayMs = DEFAULT_DELAY_MS,
  children,
  className,
}: TopbarDelayedTooltipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
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
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(true), delayMs);
  }, [clearTimer, delayMs]);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: r.left + r.width / 2, top: r.bottom + 6 });
  }, []);

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

  const tooltip =
    visible && mounted ? (
      <div
        className="pointer-events-none fixed flex flex-col items-center"
        style={{ left: pos.left, top: pos.top, transform: "translateX(-50%)", zIndex: TOOLTIP_PORTAL_Z }}
        role="tooltip"
      >
        <div
          className="h-0 w-0 border-x-[6px] border-b-[7px] border-x-transparent border-b-[#09090B]"
          aria-hidden
        />
        <div className="-mt-px whitespace-nowrap rounded-md bg-[#09090B] px-2.5 py-1.5 text-center text-xs font-medium leading-4 text-white">
          {label}
        </div>
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
