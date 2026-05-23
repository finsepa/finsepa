"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, Plus, Wallet, X } from "lucide-react";

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

const DESKTOP_WEB_MQ = "(min-width: 768px)";

/**
 * (+) quick menu — used on the global top bar and the Portfolio page header.
 */
export function PortfolioQuickAddMenu({
  triggerClassName,
  showDesktopLabel = false,
  desktopLabel = "Add/Create",
  "aria-label": ariaLabel = "Quick add",
  dwellTooltipLabel,
}: {
  triggerClassName?: string;
  /** Icon + label on `md+` (top bar); mobile stays icon-only. */
  showDesktopLabel?: boolean;
  desktopLabel?: string;
  "aria-label"?: string;
  /** Shown on mobile when `showDesktopLabel` is true; suppressed on desktop web. */
  dwellTooltipLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isDesktopWeb, setIsDesktopWeb] = useState(false);
  const { openNewTransaction, openCreatePortfolio, openAddCash, selectedPortfolioReadOnly } =
    usePortfolioWorkspace();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDesktopLabel) return;
    const mq = window.matchMedia(DESKTOP_WEB_MQ);
    const update = () => setIsDesktopWeb(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [showDesktopLabel]);

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

  const tooltipEnabled = Boolean(dwellTooltipLabel) && !(showDesktopLabel && isDesktopWeb);

  const trigger = (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={showDesktopLabel && isDesktopWeb ? undefined : ariaLabel}
      onClick={() => setOpen((v) => !v)}
      className={cn(
        showDesktopLabel ? topbarSquircleTextButtonClass : topbarSquircleIconClass,
        "justify-center",
        showDesktopLabel ? "w-9 gap-0 px-0 md:w-auto md:gap-1.5 md:px-3.5" : undefined,
        open && topbarSquircleActiveClass,
        triggerClassName,
      )}
    >
      <span className="relative grid h-5 w-5 shrink-0 place-items-center" aria-hidden>
        <Plus
          strokeWidth={2}
          className={cn(
            "pointer-events-none col-start-1 row-start-1 h-5 w-5 transition-all duration-200 ease-out motion-reduce:transition-none",
            open ? "rotate-45 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
        <X
          strokeWidth={2}
          className={cn(
            "pointer-events-none col-start-1 row-start-1 h-5 w-5 transition-all duration-200 ease-out motion-reduce:transition-none",
            open ? "rotate-0 scale-100 opacity-100" : "-rotate-45 scale-75 opacity-0",
          )}
        />
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
      </TopbarDropdownPortal>
    </div>
  );
}
