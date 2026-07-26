"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "@/lib/icons";

import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";

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
import {
  createCombinedPortfolioMenuIconAnimation,
  createPortfolioMenuIconAnimation,
} from "@/lib/lottie/portfolio-menu-animations";
import {
  addCashMenuIconAnimation,
  importTransactionsMenuIconAnimation,
  newTradeMenuIconAnimation,
} from "@/lib/lottie/quick-add-menu-animations";
import { cn } from "@/lib/utils";

type QuickAddItemId = "trade" | "cash" | "import" | "createPortfolio" | "createCombined";

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
  const [playingId, setPlayingId] = useState<QuickAddItemId | null>(null);
  const {
    portfolios,
    openNewTransaction,
    openAddCash,
    openImportTransactions,
    openCreatePortfolio,
    openCreateCombinedPortfolio,
    selectedPortfolioReadOnly,
    selectedPortfolioId,
  } = usePortfolioWorkspace();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const canCreateCombinedPortfolio = portfolios.filter((p) => p.kind !== "combined").length >= 2;

  const activityItems: Array<{
    id: QuickAddItemId;
    label: string;
    disabled: boolean;
    title?: string;
  }> = [
    {
      id: "trade",
      label: "New Trade / Holding",
      disabled: selectedPortfolioReadOnly,
    },
    {
      id: "cash",
      label: "Add Cash",
      disabled: selectedPortfolioReadOnly,
    },
    {
      id: "import",
      label: "Import Transactions",
      disabled: selectedPortfolioReadOnly || selectedPortfolioId == null,
    },
  ];

  const createItems: Array<{
    id: QuickAddItemId;
    label: string;
    disabled: boolean;
    title?: string;
  }> = [
    {
      id: "createPortfolio",
      label: "Create New Portfolio",
      disabled: false,
    },
    {
      id: "createCombined",
      label: "Create Combined Portfolio",
      disabled: !canCreateCombinedPortfolio,
      title: canCreateCombinedPortfolio
        ? undefined
        : "Create at least two portfolios to combine them",
    },
  ];

  useEffect(() => {
    if (!open) setPlayingId(null);
  }, [open]);

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

  function runItem(id: QuickAddItemId) {
    if (id === "trade") openNewTransaction();
    else if (id === "cash") openAddCash();
    else if (id === "import") openImportTransactions();
    else if (id === "createPortfolio") openCreatePortfolio();
    else openCreateCombinedPortfolio();
  }

  function itemIcon(id: QuickAddItemId) {
    const playing = playingId === id;
    if (id === "trade") {
      return <DropdownMenuLottieIcon animationData={newTradeMenuIconAnimation} playing={playing} />;
    }
    if (id === "cash") {
      return <DropdownMenuLottieIcon animationData={addCashMenuIconAnimation} playing={playing} />;
    }
    if (id === "import") {
      return (
        <DropdownMenuLottieIcon animationData={importTransactionsMenuIconAnimation} playing={playing} />
      );
    }
    if (id === "createPortfolio") {
      return (
        <DropdownMenuLottieIcon animationData={createPortfolioMenuIconAnimation} playing={playing} />
      );
    }
    return (
      <DropdownMenuLottieIcon
        animationData={createCombinedPortfolioMenuIconAnimation}
        playing={playing}
      />
    );
  }

  function renderItem(item: (typeof activityItems)[number]) {
    const { id, label, disabled, title } = item;
    return (
      <button
        key={id}
        type="button"
        role="menuitem"
        disabled={disabled}
        title={title}
        onMouseEnter={() => setPlayingId(id)}
        onMouseLeave={() => setPlayingId(null)}
        onFocus={() => setPlayingId(id)}
        onBlur={() => setPlayingId(null)}
        onClick={() => {
          if (disabled) return;
          setOpen(false);
          runItem(id);
        }}
        className={cn(
          dropdownMenuPlainItemClassName(),
          "font-medium whitespace-nowrap",
          disabled ? "cursor-not-allowed text-[#A1A1AA] hover:bg-white" : "text-[#141414]",
        )}
      >
        {itemIcon(id)}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      </button>
    );
  }

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
          {activityItems.map(renderItem)}
          <div role="separator" aria-hidden className="-mx-1 my-0.5 h-px shrink-0 bg-[#E4E4E7]" />
          {createItems.map(renderItem)}
        </div>
      </TopbarDropdownPortal>
    </div>
  );
}
