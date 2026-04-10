"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type ListboxOption<V extends string = string> = { value: V; label: string };

/**
 * App-standard single-select listbox (use instead of native `<select>` for form fields).
 * Matches portfolio/benchmark dropdowns: gray trigger, white `rounded-xl` menu, `divide-y`.
 */
export function FormListboxSelect<V extends string>({
  id,
  value,
  onChange,
  options,
  "aria-label": ariaLabel = "Choose option",
  className,
  listboxClassName,
}: {
  id?: string;
  value: V;
  onChange: (next: V) => void;
  options: readonly ListboxOption<V>[];
  "aria-label"?: string;
  className?: string;
  /** Extra classes on the outer relative wrapper (e.g. z-index in stacked modals). */
  listboxClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
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

  if (!active) return null;

  return (
    <div ref={containerRef} className={cn("relative z-10 w-full", listboxClassName, className)}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-full cursor-pointer items-center rounded-[10px] bg-[#F4F4F5] py-2 pl-4 pr-10 text-left text-sm font-normal text-[#09090B] outline-none transition-colors hover:bg-[#EBEBEB] focus-visible:ring-2 focus-visible:ring-[#09090B]/10",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{active.label}</span>
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
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[120] overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]"
          role="listbox"
          aria-label={ariaLabel}
        >
          <div className="divide-y divide-[#E4E4E7]">
            {options.map((opt) => {
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
                  className={cn(
                    "flex w-full cursor-pointer px-4 py-3 text-left text-sm text-[#09090B] transition-colors hover:bg-[#F4F4F5]",
                    selected && "bg-[#FAFAFA]",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
