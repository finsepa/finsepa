"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, Plus, Wallet } from "lucide-react";

import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { cn } from "@/lib/utils";

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
  const { openNewTransaction, openCreatePortfolio, openAddCash, selectedPortfolioReadOnly } =
    usePortfolioWorkspace();
  const rootRef = useRef<HTMLDivElement>(null);

  const items = [
    {
      id: "trade" as const,
      label: "New Trade / Holding",
      Icon: Plus,
      disabled: selectedPortfolioReadOnly,
    },
    { id: "dividend" as const, label: "New Dividend Income", Icon: Plus, disabled: true },
    {
      id: "cash" as const,
      label: "Add Cash",
      Icon: Wallet,
      disabled: selectedPortfolioReadOnly,
    },
    { id: "portfolio" as const, label: "New Portfolio", Icon: Briefcase, disabled: false },
  ];

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
            ? "flex h-8 w-8 items-center justify-center rounded-[10px] border-2 border-[#09090B] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] sm:h-9 sm:w-9"
            : "flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] sm:h-9 sm:w-9",
          triggerClassName,
        )}
      >
        <Plus className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={open ? 2.25 : 2} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            dropdownMenuPanelClassName(),
            "absolute right-0 top-full z-[120] mt-1 w-max min-w-[260px] max-w-[min(calc(100vw-2rem),320px)]",
          )}
        >
          {items.map(({ id, label, Icon, disabled }) => (
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
                dropdownMenuPlainItemClassName(),
                "font-medium whitespace-nowrap",
                disabled
                  ? "cursor-not-allowed text-[#A1A1AA] hover:bg-white"
                  : "text-[#09090B]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
