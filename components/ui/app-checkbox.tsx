"use client";

import type { RefObject } from "react";
import { Check, Minus } from "@/lib/icons";

import { cn } from "@/lib/utils";

/** Figma: 16×16, radius 4px; default white + #E4E4E7 stroke; hover #F4F4F5; active #2563EB + check. */
export function AppCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  inputRef,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  "aria-label": string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const on = checked || !!indeterminate;
  return (
    <span
      className={cn(
        "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-[#2563EB]/30 focus-within:ring-offset-2",
        on
          ? "border-[#2563EB] bg-[#2563EB] hover:bg-[#1D4ED8]"
          : "border-[#E4E4E7] bg-white hover:bg-[#F4F4F5]",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
        {...(indeterminate ? { "aria-checked": "mixed" as const } : {})}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      {checked ? (
        <Check className="pointer-events-none h-2.5 w-2.5 text-white" strokeWidth={2.75} aria-hidden />
      ) : indeterminate ? (
        <Minus className="pointer-events-none h-2.5 w-2.5 text-white" strokeWidth={2.75} aria-hidden />
      ) : null}
    </span>
  );
}
