"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Info, Lock } from "@/lib/icons";

import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import type { PortfolioPrivacy } from "@/components/portfolio/portfolio-types";
import { dropdownTriggerFieldClassName } from "@/components/design-system/text-input-styles";
import { cn } from "@/lib/utils";

const OPTIONS: { value: PortfolioPrivacy; label: string; Icon: typeof Lock }[] = [
  { value: "private", label: "Private", Icon: Lock },
  { value: "public", label: "Public", Icon: Globe },
];

function optionByValue(v: PortfolioPrivacy) {
  return OPTIONS.find((o) => o.value === v) ?? OPTIONS[0]!;
}

export const PORTFOLIO_PRIVACY_TOOLTIP =
  "Private — Only you can view this portfolio.\nPublic — Others can discover and view your holdings on Finsepa.";

/** Privacy field label with info tooltip (Create / Edit / Connect brokerage modals). */
export function PortfolioPrivacyFieldLabel() {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-medium leading-5 text-fg">Privacy</span>
      <TopbarDelayedTooltip
        label={PORTFOLIO_PRIVACY_TOOLTIP}
        multiline
        delayMs={400}
        placement="right"
        zIndex={350}
      >
        <span
          className="inline-flex cursor-default text-fg-subtle transition-colors hover:text-fg-muted"
          tabIndex={0}
          role="img"
          aria-label="About portfolio privacy"
        >
          <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        </span>
      </TopbarDelayedTooltip>
    </div>
  );
}

/** Lock / Globe privacy indicator (used near portfolio title). */
export function PortfolioPrivacyStatus({ privacy }: { privacy: PortfolioPrivacy }) {
  const o = optionByValue(privacy);
  const Icon = o.Icon;
  return (
    <div className="inline-flex items-center text-fg-muted" aria-label={o.label} title={o.label}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="sr-only">{o.label}</span>
    </div>
  );
}

/**
 * Privacy control for Edit / Create portfolio modals — custom dropdown (same chrome as portfolio picker menus).
 */
export function PortfolioPrivacySelect({
  id,
  value,
  onChange,
  disabled = false,
  "aria-label": ariaLabel = "Portfolio privacy",
}: {
  id?: string;
  value: PortfolioPrivacy;
  onChange: (next: PortfolioPrivacy) => void;
  /** When true, trigger is non-interactive (e.g. empty portfolio cannot be public). */
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const active = optionByValue(value);
  const ActiveIcon = active.Icon;

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
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
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={disabled ? "Add transactions before changing privacy" : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "relative flex w-full cursor-pointer items-center gap-2 rounded-[10px] py-2 pl-4 pr-10 text-left text-sm font-normal text-fg focus-visible:ring-2 focus-visible:ring-fg/10",
          dropdownTriggerFieldClassName,
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <ActiveIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span className="min-w-0 flex-1">{active.label}</span>
      </button>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-fg transition-transform",
          open && "rotate-180",
          disabled && "opacity-50",
        )}
        strokeWidth={2}
        aria-hidden
      />
      {open && !disabled ? (
        <TopbarDropdownPortal
          open={open}
          anchorRef={containerRef}
          ref={menuPortalRef}
          align="leading"
          matchAnchorWidth
          sheetTitle={ariaLabel}
          onRequestClose={() => setOpen(false)}
        >
          <div className={dropdownMenuPanelClassName()} role="listbox" aria-label={ariaLabel}>
            {OPTIONS.map((opt) => {
              const OptIcon = opt.Icon;
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
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <OptIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
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
          </div>
        </TopbarDropdownPortal>
      ) : null}
    </div>
  );
}
