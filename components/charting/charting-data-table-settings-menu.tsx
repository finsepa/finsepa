"use client";

import { useEffect, useRef, useState } from "react";
import { Settings } from "@/lib/icons";

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
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
        pressed ? "bg-[#2563EB]" : "bg-[#E4E4E7]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
          pressed && "translate-x-4",
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
};

export function ChartingDataTableSettingsMenu({
  showBarValues,
  onShowBarValuesChange,
  metricLabel,
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
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-[#71717A]",
          "transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15",
          open && "bg-[#F4F4F5] text-[#09090B]",
        )}
      >
        <Settings className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <TopbarDropdownPortal
          open={open}
          anchorRef={triggerRef}
          ref={menuPortalRef}
          align="trailing"
          className="w-[min(calc(100vw-2rem),240px)]"
        >
          <div
            className={dropdownMenuPanelClassName()}
            role="menu"
            aria-label={metricLabel ? `${metricLabel} settings` : "Metric settings"}
          >
            <div role="menuitem" className={dropdownMenuPlainItemRowClassName()}>
              <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-[#09090B]">Show values</span>
              <PillSwitch
                pressed={showBarValues}
                onPressedChange={onShowBarValuesChange}
                aria-label="Show values above bars"
              />
            </div>
          </div>
        </TopbarDropdownPortal>
      ) : null}
    </>
  );
}
