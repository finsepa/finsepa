"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "@/lib/icons";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { deleteMenuIconAnimation, renameMenuIconAnimation } from "@/lib/lottie/watchlist-menu-animations";
import { cn } from "@/lib/utils";

const ghostSquareBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-[#0F0F0F] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2";

/** Matches `min-w-[11.5rem]` — icon + label rows. */
const MENU_WIDTH_PX = 184;

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
  const [editIconPlaying, setEditIconPlaying] = useState(false);
  const [deleteIconPlaying, setDeleteIconPlaying] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen || !btnRef.current) {
      // Menu portal must clear coords in the layout phase (before paint); deferring breaks under Strict Mode.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional layout-phase sync for portal position
      setCoords(null);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const left =
      align === "end" ? Math.max(8, r.right - MENU_WIDTH_PX) : Math.min(r.left, window.innerWidth - MENU_WIDTH_PX - 8);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional layout-phase sync for portal position
    setCoords({ top: r.bottom + 6, left });
  }, [isOpen, align]);

  useEffect(() => {
    if (!isOpen) {
      setEditIconPlaying(false);
      setDeleteIconPlaying(false);
    }
  }, [isOpen]);

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
          className={cn(dropdownMenuPanelClassName(), "fixed z-[200] min-w-[11.5rem]")}
          style={{ top: coords.top, left: coords.left }}
        >
          <button
            type="button"
            role="menuitem"
            className={dropdownMenuPlainItemClassName()}
            onMouseEnter={() => setEditIconPlaying(true)}
            onMouseLeave={() => setEditIconPlaying(false)}
            onFocus={() => setEditIconPlaying(true)}
            onBlur={() => setEditIconPlaying(false)}
            onClick={() => {
              onEdit(transaction);
              onOpenChange(false);
            }}
          >
            <DropdownMenuLottieIcon
              key={isOpen ? "edit-open" : "edit-closed"}
              animationData={renameMenuIconAnimation}
              playing={editIconPlaying}
            />
            <span className="min-w-0 flex-1 truncate text-left">Edit</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(
              dropdownMenuPlainItemClassName(),
              "text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#B91C1C]",
            )}
            onMouseEnter={() => setDeleteIconPlaying(true)}
            onMouseLeave={() => setDeleteIconPlaying(false)}
            onFocus={() => setDeleteIconPlaying(true)}
            onBlur={() => setDeleteIconPlaying(false)}
            onClick={() => {
              onRequestDelete(transaction);
              onOpenChange(false);
            }}
          >
            <DropdownMenuLottieIcon
              key={isOpen ? "delete-open" : "delete-closed"}
              animationData={deleteMenuIconAnimation}
              playing={deleteIconPlaying}
            />
            <span className="min-w-0 flex-1 truncate text-left">Delete</span>
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
