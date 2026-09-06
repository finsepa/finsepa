"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact pill toggle. On hover, the thumb grows 2px toward the open side
 * (right when off, left when on).
 */
export function PillSwitch({
  pressed,
  onPressedChange,
  disabled,
  className,
  title,
  stopPropagation,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  /** Stop click bubbling (e.g. inside a clickable notification row). */
  stopPropagation?: boolean;
  "aria-label": string;
}) {
  const [hot, setHot] = useState(false);
  const showStretch = hot && !disabled;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        if (disabled) return;
        onPressedChange(!pressed);
      }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
        pressed ? "bg-accent" : "bg-stroke",
        disabled ? "cursor-not-allowed opacity-50" : null,
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 h-4 -translate-y-1/2 rounded-full shadow-sm transition-[width,background-color] duration-150 ease-out motion-reduce:transition-none",
          // 16px idle → 18px on hover (+2px toward the open side).
          showStretch ? "w-[18px]" : "w-4",
          pressed
            ? "right-0.5 bg-switch-thumb"
            : "left-0.5 bg-switch-thumb-off",
        )}
        aria-hidden
      />
    </button>
  );
}
