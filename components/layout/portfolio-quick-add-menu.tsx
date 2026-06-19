"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Plus, Wallet, X } from "@/lib/icons";

import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  topbarSquircleActiveClass,
  topbarSquircleIconClass,
  topbarSquircleTextButtonClass,
} from "@/components/design-system/topbar-control-classes";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { cn } from "@/lib/utils";

/**
 * (+) quick menu — used on the global top bar and the Portfolio page header.
 */
export function PortfolioQuickAddMenu({
  triggerClassName,
  showDesktopLabel = false,
  desktopLabel = "Add",
  "aria-label": ariaLabel = "Quick add",
  dwellTooltipLabel,
}: {
  triggerClassName?: string;
  /** Icon + label on `md+` (top bar); mobile stays icon-only. */
  showDesktopLabel?: boolean;
  desktopLabel?: string;
  "aria-label"?: string;
  /** Shown on mobile when `showDesktopLabel` is true; suppressed on touch via tooltip helper. */
  dwellTooltipLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const {
    openNewTransaction,
    openAddCash,
    openImportTransactions,
    selectedPortfolioReadOnly,
    selectedPortfolioId,
  } = usePortfolioWorkspace();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const items = [
    {
      id: "trade" as const,
      label: "New Trade / Holding",
      Icon: Plus,
      disabled: selectedPortfolioReadOnly,
    },
    {
      id: "cash" as const,
      label: "Add Cash",
      Icon: Wallet,
      disabled: selectedPortfolioReadOnly,
    },
    {
      id: "import" as const,
      label: "Import Transactions",
      Icon: FileSpreadsheet,
      disabled: selectedPortfolioReadOnly || selectedPortfolioId == null,
    },
  ];

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
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

  const tooltipEnabled = Boolean(dwellTooltipLabel);

  const trigger = (
    <button
      type="button"
      data-open={open ? "true" : "false"}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={ariaLabel}
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "quick-add-trigger",
        triggerClassName ?? (showDesktopLabel ? topbarSquircleTextButtonClass : topbarSquircleIconClass),
        "justify-center",
        showDesktopLabel ? "w-9 gap-0 px-0 md:w-auto md:gap-1.5 md:px-3.5" : undefined,
        open && topbarSquircleActiveClass,
      )}
    >
      <span className="quick-add-trigger-icons" aria-hidden>
        <Plus strokeWidth={2} className="h-5 w-5 quick-add-trigger-plus" />
        <X strokeWidth={2} className="h-5 w-5 quick-add-trigger-close" />
      </span>
      {showDesktopLabel ? (
        <span className="hidden text-[13px] font-medium leading-5 md:inline">{desktopLabel}</span>
      ) : null}
    </button>
  );

  const triggerWithTooltip =
    dwellTooltipLabel ? (
      <TopbarDelayedTooltip label={dwellTooltipLabel} enabled={tooltipEnabled}>
        {trigger}
      </TopbarDelayedTooltip>
    ) : (
      trigger
    );

  return (
    <div className="relative shrink-0" ref={rootRef}>
      {triggerWithTooltip}

      <TopbarDropdownPortal
        open={open}
        anchorRef={rootRef}
        ref={menuPortalRef}
        className="w-max min-w-[260px] max-w-[min(calc(100vw-2rem),320px)]"
      >
        <div
          role="menu"
          className={cn(
            dropdownMenuPanelClassName(),
            "origin-top-right [animation:quick-add-dropdown-in_220ms_ease-out_both] motion-reduce:[animation:none]",
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
                if (id === "import") openImportTransactions();
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
      </TopbarDropdownPortal>
    </div>
  );
}
