"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Lock } from "lucide-react";

import type { PortfolioPrivacy } from "@/components/portfolio/portfolio-types";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

const OPTIONS: { value: PortfolioPrivacy; label: string; Icon: typeof Lock }[] = [
  { value: "private", label: "Private", Icon: Lock },
  { value: "public", label: "Public", Icon: Globe },
];

function optionByValue(v: PortfolioPrivacy) {
  return OPTIONS.find((o) => o.value === v) ?? OPTIONS[0]!;
}

/** Lock + Private / Globe + Public · Portfolios hint — under the portfolio title. */
export function PortfolioPrivacyStatus({ privacy }: { privacy: PortfolioPrivacy }) {
  const o = optionByValue(privacy);
  const Icon = o.Icon;
  return (
    <div className="flex items-center gap-1.5 text-sm font-medium leading-5 text-[#71717A]">
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span>
        {o.label}
        {privacy === "public" ? (
          <>
            <span className="text-[#A1A1AA]" aria-hidden>
              {" "}
              ·{" "}
            </span>
            visible on Portfolios tab
          </>
        ) : null}
      </span>
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
  "aria-label": ariaLabel = "Portfolio privacy",
}: {
  id?: string;
  value: PortfolioPrivacy;
  onChange: (next: PortfolioPrivacy) => void;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = optionByValue(value);
  const ActiveIcon = active.Icon;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative z-10 w-full">
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-full cursor-pointer items-center gap-2 rounded-[10px] bg-[#F4F4F5] py-2 pl-4 pr-10 text-left text-sm font-normal text-[#09090B] outline-none transition-colors hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#09090B]/10",
        )}
      >
        <ActiveIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span className="min-w-0 flex-1">{active.label}</span>
      </button>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#09090B] transition-transform",
          open && "rotate-180",
        )}
        strokeWidth={2}
        aria-hidden
      />
      {open ? (
        <div
          className={cn(
            dropdownMenuPanelClassName(),
            "absolute left-0 right-0 top-[calc(100%+4px)] z-[120]",
          )}
          role="listbox"
          aria-label={ariaLabel}
        >
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
                  {selected ? <Check className="h-4 w-4 text-[#09090B]" strokeWidth={2} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
