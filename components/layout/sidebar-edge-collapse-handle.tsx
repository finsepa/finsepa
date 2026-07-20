"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import { cn } from "@/lib/utils";

const HOVER_LEAVE_MS = 120;
const IGNORE_LEAVE_AFTER_ACTIVATE_MS = 180;
const IGNORE_HOVER_AFTER_CLICK_MS = 200;

/**
 * Stripe-style collapse/expand control — one component for hit target + bar/chevron + tooltip.
 * Absolutely positioned on the main panel’s left edge (not the sidebar) so it stays
 * clickable and tracks the panel’s hover nudge in both expanded and collapsed states.
 */
export function SidebarEdgeCollapseHandle({
  onActiveChange,
}: {
  onActiveChange?: (active: boolean) => void;
}) {
  const { collapsed, toggleCollapsed } = useSidebarLayout();
  const [hovered, setHovered] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreHoverRef = useRef(false);
  const activatedAtRef = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const active = hovered;
  const label = collapsed ? "Expand" : "Collapse";

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current != null) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  function clearLeaveTimer() {
    if (leaveTimerRef.current != null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }

  function handleEnter() {
    if (ignoreHoverRef.current) return;
    clearLeaveTimer();
    if (!hovered) activatedAtRef.current = Date.now();
    setHovered(true);
  }

  function handleLeave() {
    // Panel nudges under the cursor on activate — ignore the spurious leave.
    if (Date.now() - activatedAtRef.current < IGNORE_LEAVE_AFTER_ACTIVATE_MS) {
      return;
    }
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false);
      leaveTimerRef.current = null;
    }, HOVER_LEAVE_MS);
  }

  function handleClick() {
    clearLeaveTimer();
    setHovered(false);
    buttonRef.current?.blur();
    ignoreHoverRef.current = true;
    toggleCollapsed();
    window.setTimeout(() => {
      ignoreHoverRef.current = false;
    }, IGNORE_HOVER_AFTER_CLICK_MS);
  }

  return (
    <div
      className="pointer-events-auto absolute top-1/2 left-0 z-50 hidden h-10 w-8 -translate-y-1/2 md:block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand Menu" : "Collapse Menu"}
        className={cn(
          "absolute inset-0 cursor-pointer border-0 bg-transparent p-0 outline-none",
          "focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-1",
        )}
      >
        {/* Bar + chevron sit just inside the main panel, clear of the divider line */}
        <span className="pointer-events-none absolute top-1/2 left-1.5 flex h-5 w-4 -translate-y-1/2 items-center justify-start">
          <span
            aria-hidden
            className={cn(
              "absolute left-0 h-4 w-[3px] rounded-full bg-[#A1A1AA]",
              "transition-opacity duration-100 ease-out",
              active ? "opacity-0" : "opacity-100",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 flex items-center justify-start",
              "transition-opacity duration-100 ease-out",
              active ? "opacity-100" : "opacity-0",
            )}
          >
            {collapsed ? (
              <ChevronRight className="size-4 text-[#52525B]" strokeWidth={2.5} />
            ) : (
              <ChevronLeft className="size-4 text-[#52525B]" strokeWidth={2.5} />
            )}
          </span>
        </span>
      </button>

      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-5.5 -translate-y-1/2 pl-1.5",
          "transition-opacity duration-100 ease-out",
          active ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <span className="whitespace-nowrap rounded-md bg-[#18181B] px-2 py-1 text-[12px] font-medium leading-4 text-white shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
          {label}
        </span>
      </span>
    </div>
  );
}
