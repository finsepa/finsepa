"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "@/lib/icons";

import {
  dropdownMenuFloatingScrollbarClassName,
  dropdownMenuMobileSheetBodyClassName,
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";
import { useMobileSheet } from "@/lib/layout/use-mobile-sheet";
import { dropdownTriggerFieldClassName } from "@/components/design-system/text-input-styles";
import { cn } from "@/lib/utils";

export type ListboxOption<V extends string = string> = { value: V; label: string };

/**
 * App-standard single-select listbox (use instead of native `<select>` for form fields).
 * Matches portfolio/benchmark dropdowns: gray trigger; menu uses shared `dropdownMenuPanelClassName`.
 */
export function FormListboxSelect<V extends string>({
  id,
  value,
  onChange,
  options,
  "aria-label": ariaLabel = "Choose option",
  className,
  listboxClassName,
  triggerClassName,
  menuClassName,
  truncateLabel = true,
  truncateOptions = true,
  disabled = false,
  leadingIcon,
  compact = false,
  /** Shrink-wrap trigger: label left, chevron inline with `gap-2` (8px), no absolute chevron reserve. */
  fitTrigger = false,
  menuAlign = "leading",
  /** Portal menu to `document.body` (avoids clipping inside modals / overflow shells). */
  portaled = false,
  /** Trigger-only option (e.g. “Select year”) — excluded from the open menu list. */
  placeholderOption,
}: {
  id?: string;
  value: V;
  onChange: (next: V) => void;
  options: readonly ListboxOption<V>[];
  /** Optional icon inside the trigger (e.g. search) — does not replace the chevron. */
  leadingIcon?: ReactNode;
  "aria-label"?: string;
  className?: string;
  /** Extra classes on the outer relative wrapper (e.g. z-index in stacked modals). */
  listboxClassName?: string;
  /** Merged with default trigger button classes (e.g. white surface + border). */
  triggerClassName?: string;
  /** Extra classes on the floating listbox panel (position is included by default). */
  menuClassName?: string;
  /** When false, label stays on one line without ellipsis (widen the outer `className` as needed). */
  truncateLabel?: boolean;
  /** When false, menu option rows do not ellipsis (use with a wide {@link menuClassName} if needed). */
  truncateOptions?: boolean;
  disabled?: boolean;
  /** When true, uses tighter horizontal padding; trigger still fills its container (chevron stays inside the fill). */
  compact?: boolean;
  fitTrigger?: boolean;
  /** `trailing` anchors the menu to the trigger’s right edge (opens toward the left). */
  menuAlign?: "leading" | "trailing";
  portaled?: boolean;
  placeholderOption?: ListboxOption<V>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const isMobileSheet = useMobileSheet();
  const active =
    options.find((o) => o.value === value) ??
    (placeholderOption != null && value === placeholderOption.value ? placeholderOption : undefined) ??
    options[0];

  const menuOptions =
    placeholderOption != null
      ? options.filter((o) => o.value !== placeholderOption.value)
      : options;

  useEffect(() => {
    if (!open || isMobileSheet) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, isMobileSheet]);

  useEffect(() => {
    if (!open || isMobileSheet) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMobileSheet]);

  const optionList = (
    <>
      {menuOptions.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
            }}
            className={dropdownMenuPlainItemRowClassName({ selected })}
          >
            <span
              className={cn(
                "min-w-0 flex-1 text-left",
                truncateOptions ? "truncate" : "whitespace-nowrap",
              )}
            >
              {opt.label}
            </span>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
              <Check
                className={cn("h-4 w-4 text-fg", !selected && "invisible")}
                strokeWidth={2}
              />
            </span>
          </button>
        );
      })}
    </>
  );

  if (!active) return null;

  const menuPanel = (
    <div
      className={cn(
        dropdownMenuPanelClassName(),
        "max-h-[min(400px,calc(100vh-12rem))] overflow-y-auto",
        dropdownMenuFloatingScrollbarClassName,
        !portaled &&
          cn(
            "absolute top-[calc(100%+4px)] z-[120] min-w-full w-max max-w-[min(24rem,calc(100vw-2rem))]",
            menuAlign === "trailing" ? "right-0" : "left-0",
          ),
        portaled && "w-full min-w-0",
        menuClassName,
      )}
      role="listbox"
      aria-label={ariaLabel}
    >
      {optionList}
    </div>
  );

  const triggerBaseClass = cn(
    "relative flex cursor-pointer items-center rounded-[10px] text-left text-sm font-normal text-fg transition-colors focus-visible:ring-2 focus-visible:ring-fg/10",
    dropdownTriggerFieldClassName,
    fitTrigger ? "w-auto gap-2 px-3" : "w-full",
    disabled && "cursor-not-allowed opacity-60 hover:bg-surface-subtle",
    triggerClassName,
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative z-20 min-w-0",
        // `fitTrigger` must not sit under `w-full` (string-join left both and the full width won).
        fitTrigger ? "w-auto shrink-0" : "w-full",
        listboxClassName,
        className,
      )}
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        suppressHydrationWarning
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={triggerBaseClass}
      >
        {leadingIcon ? (
          <span
            className={cn(
              "pointer-events-none flex h-5 w-5 shrink-0 items-center justify-center text-fg-muted",
              !fitTrigger && "absolute left-3 top-1/2 -translate-y-1/2",
            )}
            aria-hidden
          >
            {leadingIcon}
          </span>
        ) : null}
        {/* Horizontal padding lives here so `triggerClassName` can use `px-*` without hiding the chevron reserve. */}
        <span
          className={cn(
            fitTrigger
              ? cn("shrink-0 text-left", truncateLabel ? "truncate" : "whitespace-nowrap")
              : cn(
                  compact ? "min-w-0 flex-1 pr-8 text-left" : "min-w-0 flex-1 pr-11 text-left",
                  compact ? (leadingIcon ? "pl-9" : "pl-3") : leadingIcon ? "pl-10" : "pl-3",
                  truncateLabel ? "truncate" : "whitespace-nowrap",
                ),
          )}
        >
          {active.label}
        </span>
        {fitTrigger ? (
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-fg transition-transform",
              open && "rotate-180",
            )}
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
      </button>
      {!fitTrigger ? (
        <ChevronDown
          className={cn(
            cn(
              "pointer-events-none absolute top-1/2 h-5 w-5 shrink-0 -translate-y-1/2 text-fg transition-transform",
              compact ? "right-2.5" : "right-3",
            ),
            open && "rotate-180",
          )}
          strokeWidth={2}
          aria-hidden
        />
      ) : null}
      {open && isMobileSheet && !portaled ? (
        <MobileBottomSheet open={open} onClose={() => setOpen(false)}>
          <div
            className={cn(
              dropdownMenuMobileSheetBodyClassName,
              "max-h-[min(400px,calc(100vh-12rem))] overflow-y-auto",
              dropdownMenuFloatingScrollbarClassName,
            )}
            role="listbox"
            aria-label={ariaLabel}
          >
            {optionList}
          </div>
        </MobileBottomSheet>
      ) : null}
      {open && !isMobileSheet && !portaled ? menuPanel : null}
      {open && portaled ? (
        <TopbarDropdownPortal
          open={open}
          anchorRef={containerRef}
          ref={menuPortalRef}
          align={menuAlign}
          matchAnchorWidth
          placement="auto"
          sheetTitle={ariaLabel}
          onRequestClose={() => setOpen(false)}
        >
          {menuPanel}
        </TopbarDropdownPortal>
      ) : null}
    </div>
  );
}
