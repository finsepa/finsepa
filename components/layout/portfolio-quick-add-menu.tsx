"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, Plus, Wallet } from "lucide-react";

import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { cn } from "@/lib/utils";

const ITEMS = [
  { id: "trade" as const, label: "New Trade / Holding", Icon: Plus, disabled: false },
  { id: "dividend" as const, label: "New Dividend Income", Icon: Plus, disabled: true },
  { id: "cash" as const, label: "Add Cash", Icon: Wallet, disabled: false },
  { id: "portfolio" as const, label: "New Portfolio", Icon: Briefcase, disabled: false },
];

/**
 * (+) quick menu — used on the global top bar and the Portfolio page header.
 */
export function PortfolioQuickAddMenu({
  triggerClassName,
  "aria-label": ariaLabel = "Quick add",
}: {
  triggerClassName?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const { openNewTransaction, openCreatePortfolio, openAddCash } = usePortfolioWorkspace();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          open
            ? "flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-[#09090B] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]"
            : "flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]",
          triggerClassName,
        )}
      >
        <Plus className="h-5 w-5" strokeWidth={open ? 2.25 : 2} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-1 w-max min-w-[260px] max-w-[min(calc(100vw-2rem),320px)] rounded-[10px] border border-[#E4E4E7] bg-white py-1 shadow-[0px_4px_12px_0px_rgba(10,10,10,0.08)]"
        >
          {ITEMS.map(({ id, label, Icon, disabled }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setOpen(false);
                if (id === "trade") openNewTransaction();
                if (id === "cash") openAddCash();
                if (id === "portfolio") openCreatePortfolio();
              }}
              className={cn(
                "flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium leading-5 whitespace-nowrap transition-colors",
                disabled
                  ? "cursor-not-allowed text-[#A1A1AA]"
                  : "text-[#09090B] hover:bg-[#F4F4F5]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">{label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
