"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "@/lib/icons";

import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";
import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";
import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { newTradeMenuIconAnimation } from "@/lib/lottie/quick-add-menu-animations";
import { deleteMenuIconAnimation } from "@/lib/lottie/watchlist-menu-animations";
import { cn } from "@/lib/utils";

const ghostSquareBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-[#0F0F0F] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2";

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
  const [addTransactionsIconPlaying, setAddTransactionsIconPlaying] = useState(false);
  const [removeIconPlaying, setRemoveIconPlaying] = useState(false);

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
    if (!isOpen) {
      setAddTransactionsIconPlaying(false);
      setRemoveIconPlaying(false);
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
          className={cn(dropdownMenuPanelClassName(), "fixed z-[200] min-w-[12.25rem]")}
          style={{ top: coords.top, left: coords.left }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className={cn(dropdownMenuPlainItemClassName(), "justify-start gap-2")}
            onMouseEnter={() => setAddTransactionsIconPlaying(true)}
            onMouseLeave={() => setAddTransactionsIconPlaying(false)}
            onFocus={() => setAddTransactionsIconPlaying(true)}
            onBlur={() => setAddTransactionsIconPlaying(false)}
            onClick={(e) => {
              e.stopPropagation();
              onAddTransactions(holding);
              onOpenChange(false);
            }}
          >
            <DropdownMenuLottieIcon animationData={newTradeMenuIconAnimation} playing={addTransactionsIconPlaying} />
            <span className="min-w-0 flex-1 truncate text-left">Add Transactions</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(
              dropdownMenuPlainItemClassName(),
              "justify-start gap-2 text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#B91C1C]",
            )}
            onMouseEnter={() => setRemoveIconPlaying(true)}
            onMouseLeave={() => setRemoveIconPlaying(false)}
            onFocus={() => setRemoveIconPlaying(true)}
            onBlur={() => setRemoveIconPlaying(false)}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveAsset(holding);
              onOpenChange(false);
            }}
          >
            <DropdownMenuLottieIcon animationData={deleteMenuIconAnimation} playing={removeIconPlaying} />
            <span className="min-w-0 flex-1 truncate text-left">Remove Asset</span>
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
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!isOpen);
        }}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden strokeWidth={2} />
      </button>
      {menu}
    </>
  );
}
