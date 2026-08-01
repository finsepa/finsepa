"use client";

import { useEffect, useRef, useState } from "react";
import { Settings } from "@/lib/icons";

import { chartingRailRowActionButtonClass } from "@/components/charting/charting-rail-row-styles";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

function PillSwitch({
  pressed,
  onPressedChange,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
        pressed ? "bg-accent" : "bg-stroke",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-switch-thumb-off shadow-sm transition-[transform,background-color]",
          pressed && "translate-x-4 bg-switch-thumb",
        )}
        aria-hidden
      />
    </button>
  );
}

type Props = {
  showBarValues: boolean;
  onShowBarValuesChange: (next: boolean) => void;
  metricLabel?: string;
  /** `table` = data header; `rail` = company rail; `badge` = chart legend chip. */
  variant?: "table" | "rail" | "badge";
};

export function ChartingDataTableSettingsMenu({
  showBarValues,
  onShowBarValuesChange,
  metricLabel,
  variant = "table",
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (triggerRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={metricLabel ? `${metricLabel} settings` : "Metric settings"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          variant === "rail"
            ? cn(chartingRailRowActionButtonClass, open && "opacity-100")
            : variant === "badge"
              ? cn(
                  "inline-flex h-full shrink-0 items-center justify-center px-1.5 text-fg-muted",
                  "transition-colors hover:bg-canvas hover:text-fg",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fg/15",
                  open && "bg-surface-muted text-fg",
                )
              : cn(
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-fg-muted",
                  "transition-colors hover:bg-surface-muted hover:text-fg",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
                  open && "bg-surface-muted text-fg",
                ),
        )}
      >
        <Settings
          className={cn(
            "shrink-0",
            variant === "rail" || variant === "badge" ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {open ? (
        <TopbarDropdownPortal
          open={open}
          anchorRef={triggerRef}
          ref={menuPortalRef}
          align={variant === "rail" || variant === "badge" ? "leading" : "trailing"}
          placement={variant === "rail" || variant === "badge" ? "below" : "auto"}
          className="w-[min(calc(100vw-2rem),240px)]"
        >
          <div
            className={dropdownMenuPanelClassName()}
            role="menu"
            aria-label={metricLabel ? `${metricLabel} settings` : "Metric settings"}
          >
            <div role="menuitem" className={dropdownMenuPlainItemRowClassName()}>
              <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-fg">Show values</span>
              <PillSwitch
                pressed={showBarValues}
                onPressedChange={onShowBarValuesChange}
                aria-label="Show values on chart"
              />
            </div>
          </div>
        </TopbarDropdownPortal>
      ) : null}
    </>
  );
}
