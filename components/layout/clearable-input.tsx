"use client";

import type { InputHTMLAttributes } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const baseInputClass =
  "h-9 w-full rounded-[10px] border-0 bg-[#F4F4F5] text-sm text-[#09090B] placeholder:text-[#71717A] outline-none focus:ring-2 focus:ring-[#09090B]/10";

type ClearableInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type: "text" | "number";
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  step?: string;
  min?: string;
  "aria-label"?: string;
  clearLabel?: string;
};

export function ClearableInput({
  id,
  value,
  onChange,
  placeholder,
  type,
  inputMode,
  step,
  min,
  "aria-label": ariaLabel,
  clearLabel = "Clear",
}: ClearableInputProps) {
  const hasValue = value.length > 0;

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        step={type === "number" ? step ?? "any" : undefined}
        min={type === "number" ? min : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          baseInputClass,
          hasValue ? "pl-4 pr-10" : "px-4",
          type === "number" &&
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
      {hasValue ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-black/5 hover:text-[#09090B]"
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
