"use client";

import type { FocusEventHandler, InputHTMLAttributes, ReactNode } from "react";
import { X } from "@/lib/icons";

import {
  formFieldControlHeightClassName,
  textInputFieldClassName,
  textInputShellClassName,
} from "@/components/design-system/text-input-styles";
import { cn } from "@/lib/utils";

const baseInputClass = cn(
  "w-full rounded-[10px] text-sm",
  textInputFieldClassName,
);

const prefixedInputClass = cn(
  "min-w-0 flex-1 border-0 bg-transparent py-0 text-sm text-fg placeholder:text-fg-muted outline-none",
  "focus:shadow-none focus-visible:outline-none",
);

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
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  leadingAdornment?: ReactNode;
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
  onBlur,
  onFocus,
  leadingAdornment,
}: ClearableInputProps) {
  const hasValue = value.length > 0;

  if (leadingAdornment) {
    return (
      <div
        className={cn(
          "relative flex w-full items-center gap-0.5 rounded-[10px]",
          formFieldControlHeightClassName,
          textInputShellClassName,
        )}
      >
        <span className="shrink-0 pl-3 text-sm text-fg-muted">{leadingAdornment}</span>
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          step={type === "number" ? step ?? "any" : undefined}
          min={type === "number" ? min : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cn(
            prefixedInputClass,
            hasValue ? "pr-10" : "pr-3",
            type === "number" &&
              "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
        />
        {hasValue ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-black/5 hover:text-fg"
            aria-label={clearLabel}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    );
  }

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
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          baseInputClass,
          hasValue ? "pl-3 pr-10" : "px-3",
          type === "number" &&
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
      {hasValue ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-black/5 hover:text-fg"
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
