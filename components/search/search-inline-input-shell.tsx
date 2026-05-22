"use client";

import { useCallback, type RefObject } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export const SEARCH_SHELL_MOTION_MS = 280;
export const SEARCH_SHELL_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

const SEARCH_ICON_SIZE_PX = 20;
const SEARCH_ICON_GAP_PX = 8;
const SEARCH_ICON_INSET_PX = 16;
const SEARCH_INPUT_COLLAPSED_PL_PX = SEARCH_ICON_INSET_PX + SEARCH_ICON_SIZE_PX + SEARCH_ICON_GAP_PX;
const SEARCH_INPUT_OPEN_PL_PX = SEARCH_ICON_INSET_PX;

const motionStyle = {
  transitionDuration: `${SEARCH_SHELL_MOTION_MS}ms`,
  transitionTimingFunction: SEARCH_SHELL_MOTION_EASE,
} as const;

export function SearchInlineInputShell({
  open,
  onOpenChange,
  inputRef,
  value,
  onChange,
  placeholder,
  disabled,
  shellClassName,
  trailingReservePx = 40,
  showTrailingClear = false,
  onTrailingClear,
  ariaLabel,
  ariaControls,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  disabled?: boolean;
  shellClassName?: string;
  /** Right padding when open (close button). */
  trailingReservePx?: number;
  /** When closed with a selection — show clear control in the trailing slot. */
  showTrailingClear?: boolean;
  onTrailingClear?: () => void;
  ariaLabel: string;
  ariaControls?: string;
}) {
  const focusInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.readOnly = false;
    input.focus({ preventScroll: true });
  }, [inputRef]);

  const activate = useCallback(() => {
    if (disabled) return;
    focusInput();
    onOpenChange(true);
  }, [disabled, focusInput, onOpenChange]);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleShellPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-search-shell-close]")) return;
      if ((e.target as HTMLElement).closest("[data-search-shell-clear]")) return;
      if (open) {
        focusInput();
        return;
      }
      activate();
    },
    [activate, disabled, focusInput, open],
  );

  const trailingActive = open || showTrailingClear;

  return (
    <div
      role="search"
      data-open={open ? "true" : "false"}
      className={cn(
        "relative flex h-9 min-w-0 w-full cursor-text items-center overflow-hidden bg-[#F4F4F5] pl-4 pr-3",
        "transition-colors motion-reduce:transition-none",
        !open && !disabled && "hover:bg-[#EBEBEB]",
        disabled && "cursor-not-allowed opacity-50",
        shellClassName,
      )}
      style={motionStyle}
      onPointerDown={handleShellPointerDown}
    >
      <span
        className="pointer-events-none absolute top-1/2 z-10 flex h-5 w-5 items-center justify-center text-[#09090B] motion-reduce:transition-none"
        style={{
          left: SEARCH_ICON_INSET_PX,
          ...motionStyle,
          transitionProperty: "transform",
          transform: open
            ? `translate(calc(-${SEARCH_ICON_INSET_PX}px - 100% - ${SEARCH_ICON_GAP_PX}px), -50%)`
            : "translateY(-50%)",
        }}
        aria-hidden
      >
        <Search className="h-5 w-5" strokeWidth={2} />
      </span>

      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        readOnly={!open}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "absolute inset-0 z-[1] h-full w-full min-w-0 cursor-text bg-transparent text-sm leading-5 text-[#09090B] outline-none placeholder:text-[#A1A1AA] caret-[#09090B] read-only:cursor-text transition-[padding] motion-reduce:transition-none",
          !open && "pointer-events-none",
          value && !open && "font-medium",
        )}
        style={{
          ...motionStyle,
          paddingLeft: open ? SEARCH_INPUT_OPEN_PL_PX : SEARCH_INPUT_COLLAPSED_PL_PX,
          paddingRight: trailingActive ? trailingReservePx : 12,
          clipPath: open ? undefined : `inset(-1px ${trailingActive ? trailingReservePx : 12}px -1px 0)`,
        }}
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="search"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={ariaControls}
        aria-autocomplete="list"
      />

      {!open ? (
        <div
          className="absolute inset-0 z-[2] cursor-text"
          aria-hidden
          onPointerDown={(e) => {
            if (disabled || e.button !== 0) return;
            e.preventDefault();
            activate();
          }}
        />
      ) : null}

      <div className="pointer-events-none absolute right-3 top-1/2 z-[3] flex h-7 w-7 -translate-y-1/2 items-center justify-center">
        {showTrailingClear && !open ? (
          <button
            type="button"
            data-search-shell-clear
            tabIndex={0}
            disabled={disabled}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onTrailingClear?.();
            }}
            className="pointer-events-auto absolute inset-0 flex items-center justify-center rounded-md text-[#09090B] hover:bg-[#EBEBEB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/10"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            data-search-shell-close
            tabIndex={open ? 0 : -1}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className={cn(
              "pointer-events-auto absolute inset-0 flex items-center justify-center rounded-md text-[#71717A]",
              "transition-opacity motion-reduce:transition-none",
              "hover:bg-[#EBEBEB] hover:text-[#09090B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/10",
              open ? "opacity-100" : "opacity-0",
            )}
            style={motionStyle}
            aria-label="Close"
            aria-hidden={!open}
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
