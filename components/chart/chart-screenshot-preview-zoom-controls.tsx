"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DropdownScrollArea } from "@/components/design-system/dropdown-scroll-area";
import {
  dropdownMenuPlainItemRowClassName,
  dropdownMenuSurfaceClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { secondaryOutlineButtonClassName, whiteSurfaceButtonChromeClass } from "@/components/design-system";
import {
  CHART_SCREENSHOT_PREVIEW_ZOOM_MAX_PERCENT,
  CHART_SCREENSHOT_PREVIEW_ZOOM_MIN_PERCENT,
  CHART_SCREENSHOT_PREVIEW_ZOOM_OPTIONS,
  CHART_SCREENSHOT_PREVIEW_ZOOM_STEP_PERCENT,
  clampChartScreenshotPreviewZoomPercent,
} from "@/lib/chart/chart-screenshot-constants";
import { Check, ChevronDown, Minus, Plus } from "@/lib/icons";
import { cn } from "@/lib/utils";

const zoomIconButtonClass = cn(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-40",
  whiteSurfaceButtonChromeClass,
);

export function ChartScreenshotPreviewZoomControls({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const clamped = clampChartScreenshotPreviewZoomPercent(value);

  const step = useCallback(
    (delta: number) => {
      onChange(clampChartScreenshotPreviewZoomPercent(clamped + delta));
    },
    [clamped, onChange],
  );

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div ref={wrapRef} className="flex items-center gap-1.5">
      <button
        type="button"
        className={zoomIconButtonClass}
        onClick={() => step(-CHART_SCREENSHOT_PREVIEW_ZOOM_STEP_PERCENT)}
        disabled={disabled || clamped <= CHART_SCREENSHOT_PREVIEW_ZOOM_MIN_PERCENT}
        aria-label="Zoom preview out"
      >
        <Minus className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>

      <div className="relative min-w-[5.5rem]">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            secondaryOutlineButtonClassName,
            "h-9 w-full justify-between gap-1 px-3 text-sm font-medium",
          )}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-label={`Preview zoom ${clamped}%`}
        >
          <span className="tabular-nums">{clamped}%</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[#71717A] transition-transform",
              menuOpen && "rotate-180",
            )}
            strokeWidth={2}
            aria-hidden
          />
        </button>
        {menuOpen ? (
          <div
            role="listbox"
            aria-label="Preview zoom"
            className={cn(
              dropdownMenuSurfaceClassName(),
              "absolute bottom-full left-0 z-20 mb-1.5 w-full min-w-[5.5rem]",
            )}
          >
            <DropdownScrollArea className="flex max-h-52 flex-col gap-1 p-1">
              {CHART_SCREENSHOT_PREVIEW_ZOOM_OPTIONS.map((option) => {
                const selected = option === clamped;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={dropdownMenuPlainItemRowClassName({ selected })}
                    onClick={() => {
                      onChange(option);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 text-left tabular-nums">{option}%</span>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                      {selected ? (
                        <Check className="h-4 w-4 text-[#09090B]" strokeWidth={2} />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </DropdownScrollArea>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={zoomIconButtonClass}
        onClick={() => step(CHART_SCREENSHOT_PREVIEW_ZOOM_STEP_PERCENT)}
        disabled={disabled || clamped >= CHART_SCREENSHOT_PREVIEW_ZOOM_MAX_PERCENT}
        aria-label="Zoom preview in"
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
