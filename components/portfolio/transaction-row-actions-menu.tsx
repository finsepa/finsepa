"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { cn } from "@/lib/utils";

const ghostSquareBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-[#09090B] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2";

export function TransactionRowActionsMenu({
  transaction,
  isOpen,
  onOpenChange,
  onEdit,
  onRequestDelete,
  align = "end",
}: {
  transaction: PortfolioTransaction;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (t: PortfolioTransaction) => void;
  onRequestDelete: (t: PortfolioTransaction) => void;
  /** Menu horizontal alignment to the trigger (table vs grid layouts). */
  align?: "end" | "start";
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !btnRef.current) {
      // Menu portal must clear coords in the layout phase (before paint); deferring breaks under Strict Mode.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional layout-phase sync for portal position
      setCoords(null);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const menuWidth = 152;
    const left =
      align === "end" ? Math.max(8, r.right - menuWidth) : Math.min(r.left, window.innerWidth - menuWidth - 8);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional layout-phase sync for portal position
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
          className="fixed z-[200] min-w-[9.5rem] rounded-lg border border-[#E4E4E7] bg-white py-1 shadow-[0px_4px_12px_rgba(10,10,10,0.12)]"
          style={{ top: coords.top, left: coords.left }}
        >
          <button
            type="button"
            role="menuitem"
            className={cn(
              "flex w-full px-3 py-2 text-left text-sm font-medium text-[#09090B]",
              "hover:bg-[#F4F4F5] focus-visible:bg-[#F4F4F5] focus-visible:outline-none",
            )}
            onClick={() => {
              onEdit(transaction);
              onOpenChange(false);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(
              "flex w-full px-3 py-2 text-left text-sm font-medium text-[#DC2626]",
              "hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none",
            )}
            onClick={() => {
              onRequestDelete(transaction);
              onOpenChange(false);
            }}
          >
            Delete
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
        aria-label="Transaction actions"
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
