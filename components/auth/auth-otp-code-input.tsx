"use client";

import {
  useEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { textInputShellClassName } from "@/components/design-system/text-input-styles";
import { cn } from "@/lib/utils";

const LENGTH = 6;

function digitsOnly(raw: string, max = LENGTH): string {
  return raw.replace(/\D/g, "").slice(0, max);
}

export function AuthOtpCodeInput({
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  id = "otp",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const firstEmpty = Math.min(value.length, LENGTH - 1);
    const el = inputsRef.current[firstEmpty];
    el?.focus();
    el?.select();
    // Focus once when the code step mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled]);

  function focusAt(index: number) {
    const el = inputsRef.current[Math.max(0, Math.min(LENGTH - 1, index))];
    el?.focus();
    el?.select();
  }

  function replaceFrom(index: number, incoming: string) {
    const next = digitsOnly(value.slice(0, index) + incoming);
    onChange(next);
    focusAt(Math.min(next.length, LENGTH - 1));
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const cleaned = digitsOnly(e.target.value, LENGTH);
    if (!cleaned) {
      const chars = value.split("");
      chars[index] = "";
      onChange(digitsOnly(chars.join("")));
      return;
    }
    if (cleaned.length > 1) {
      replaceFrom(index, cleaned);
      return;
    }
    const chars = value.padEnd(LENGTH, " ").split("");
    chars[index] = cleaned;
    const next = digitsOnly(chars.join(""));
    onChange(next);
    if (index < LENGTH - 1) focusAt(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        const chars = value.split("");
        chars[index] = "";
        onChange(digitsOnly(chars.join("")));
        focusAt(index);
      } else if (index > 0) {
        const chars = value.split("");
        chars[index - 1] = "";
        onChange(digitsOnly(chars.join("")));
        focusAt(index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(index - 1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(index + 1);
      return;
    }
    if (e.key === "Delete" && digits[index]) {
      e.preventDefault();
      const chars = value.split("");
      chars[index] = "";
      onChange(digitsOnly(chars.join("")));
    }
  }

  function handlePaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = digitsOnly(e.clipboardData.getData("text"));
    if (!pasted) return;
    replaceFrom(index, pasted);
  }

  return (
    <div
      role="group"
      aria-label="Login code"
      className="flex w-full items-center justify-between gap-2 sm:gap-2.5"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          id={index === 0 ? id : `${id}-${index}`}
          name={index === 0 ? "otp" : undefined}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCorrect="off"
          spellCheck={false}
          pattern="[0-9]*"
          maxLength={index === 0 ? LENGTH : 1}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          disabled={disabled}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 min-w-0 flex-1 basis-0 rounded-[10px] text-center text-lg font-semibold tabular-nums text-fg",
            "dark:bg-panel",
            textInputShellClassName,
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
      ))}
    </div>
  );
}
