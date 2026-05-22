"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";

import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemRowClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

const ghostSquareBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-[#09090B] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2";

export function HoldingRowActionsMenu({
  holding,
  isOpen,
  onOpenChange,
  onAddTransactions,
  onRemoveAsset,
  align = "end",
}: {
  holding: PortfolioHolding;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransactions: (holding: PortfolioHolding) => void;
  onRemoveAsset: (holding: PortfolioHolding) => void;
  align?: "end" | "start";
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !btnRef.current) {
      setCoords(null);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const menuWidth = 196;
    const left =
      align === "end" ? Math.max(8, r.right - menuWidth) : Math.min(r.left, window.innerWidth - menuWidth - 8);
    setCoords({ top: r.bottom + 6, left });
  }, [isOpen, align]);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    function onScroll() {
      onOpenChange(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen, onOpenChange]);

  const menu =
    isOpen && coords ?
      createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          className={cn(dropdownMenuPanelClassName(), "fixed z-[200] min-w-[12.25rem] py-1")}
          style={{ top: coords.top, left: coords.left }}
        >
          <button
            type="button"
            role="menuitem"
            className={cn(dropdownMenuPlainItemRowClassName(), "gap-2")}
            onClick={() => {
              onAddTransactions(holding);
              onOpenChange(false);
            }}
          >
            <Plus className="h-4 w-4 shrink-0 text-[#09090B]" strokeWidth={2} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">Add Transactions</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(dropdownMenuPlainItemRowClassName(), "gap-2 text-[#DC2626] hover:text-[#DC2626]")}
            onClick={() => {
              onRemoveAsset(holding);
              onOpenChange(false);
            }}
          >
            <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">Remove asset</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={ghostSquareBtn}
        aria-label={`Actions for ${holding.name}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!isOpen)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden strokeWidth={2} />
      </button>
      {menu}
    </>
  );
}
