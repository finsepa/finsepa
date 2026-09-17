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
  portfolioIsCombined,
  portfolioIsDemo,
  portfolioIsLiveBrokerage,
} from "@/components/portfolio/portfolio-types";
import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import {
  addCashMenuIconAnimation,
  connectBrokerageMenuIconAnimation,
  importTransactionsMenuIconAnimation,
  newTradeMenuIconAnimation,
} from "@/lib/lottie/quick-add-menu-animations";
import { cn } from "@/lib/utils";

type QuickAddItemId = "trade" | "cash" | "connectBrokerage" | "import";

/**
 * (+) quick menu — used on the Portfolio page header (activity actions only).
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
    openConnectBrokerageToSelected,
    openImportTransactions,
    selectedPortfolioReadOnly,
    selectedPortfolioId,
  } = usePortfolioWorkspace();
  const plan = usePlanAccessOptional();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId) ?? null;
  const selectedPortfolioName = selectedPortfolio?.name.trim() || null;
  const canConnectBrokerage = plan?.canConnectBrokerage !== false;
  const connectBrokerageDisabled =
    selectedPortfolioId == null ||
    selectedPortfolioReadOnly ||
    portfolioIsCombined(selectedPortfolio) ||
    portfolioIsDemo(selectedPortfolio) ||
    portfolioIsLiveBrokerage(selectedPortfolio);

  const activityItems: Array<{
    id: QuickAddItemId;
    label: string;
    disabled: boolean;
    title?: string;
    showProBadge?: boolean;
  }> = [
    {
      id: "trade",
      label: "Add Manual Transaction",
      disabled: selectedPortfolioReadOnly,
    },
    {
      id: "cash",
      label: "Manage Cash",
      disabled: selectedPortfolioReadOnly,
    },
    {
      id: "connectBrokerage",
      label: "Connect Brokerage",
      disabled: connectBrokerageDisabled,
      showProBadge: !canConnectBrokerage,
      title:
        portfolioIsLiveBrokerage(selectedPortfolio) ?
          "This portfolio is already connected to a brokerage"
        : portfolioIsCombined(selectedPortfolio) || portfolioIsDemo(selectedPortfolio) ?
          "Connect brokerage on a standard portfolio"
        : selectedPortfolioReadOnly ?
          "This portfolio is read-only"
        : !canConnectBrokerage ?
          "Brokerage connection is available on Pro only"
        : undefined,
    },
    {
      id: "import",
      label: "Import CSV File",
      disabled: selectedPortfolioReadOnly || selectedPortfolioId == null,
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
    else if (id === "connectBrokerage") void openConnectBrokerageToSelected();
    else openImportTransactions();
  }

  function itemIcon(id: QuickAddItemId) {
    const playing = playingId === id;
    if (id === "trade") {
      return <DropdownMenuLottieIcon animationData={newTradeMenuIconAnimation} playing={playing} />;
    }
    if (id === "cash") {
      return <DropdownMenuLottieIcon animationData={addCashMenuIconAnimation} playing={playing} />;
    }
    if (id === "connectBrokerage") {
      return (
        <DropdownMenuLottieIcon animationData={connectBrokerageMenuIconAnimation} playing={playing} />
      );
    }
    return (
      <DropdownMenuLottieIcon animationData={importTransactionsMenuIconAnimation} playing={playing} />
    );
  }

  function renderItem(item: (typeof activityItems)[number]) {
    const { id, label, disabled, title, showProBadge } = item;
    /** Pro-gated rows stay interactive so Free users can open View Plans. */
    const hardDisabled = disabled && !showProBadge;
    return (
      <button
        key={id}
        type="button"
        role="menuitem"
        aria-disabled={hardDisabled}
        title={title}
        onMouseEnter={() => setPlayingId(id)}
        onMouseLeave={() => setPlayingId(null)}
        onFocus={() => setPlayingId(id)}
        onBlur={() => setPlayingId(null)}
        onClick={() => {
          if (hardDisabled) return;
          setOpen(false);
          runItem(id);
        }}
        className={cn(
          dropdownMenuPlainItemClassName(),
          "font-medium whitespace-nowrap",
          hardDisabled ? "cursor-not-allowed opacity-40 hover:bg-surface" : null,
        )}
      >
        {itemIcon(id)}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {showProBadge ? (
          <ProFeatureBadge label="Brokerage sync is available on Pro only" />
        ) : null}
      </button>
    );
  }

  const resolvedTriggerChrome =
    triggerClassName ??
    (showDesktopLabel
      ? `${topbarSquircleTextButtonClass} justify-center w-9 gap-0 px-0 md:w-auto md:gap-1.5 md:px-3.5`
      : `${topbarSquircleIconClass} justify-center`);
  const triggerClassNameResolved = open
    ? `quick-add-trigger ${resolvedTriggerChrome} ${topbarSquircleActiveClass}`
    : `quick-add-trigger ${resolvedTriggerChrome}`;

  const trigger = (
    <button
      type="button"
      data-open={open ? "true" : "false"}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={ariaLabel}
      suppressHydrationWarning
      onClick={() => setOpen((v) => !v)}
      className={triggerClassNameResolved}
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
          {selectedPortfolioName ? (
            <div className="px-3 py-1.5 text-xs font-medium leading-4 text-fg-muted">
              {selectedPortfolioName}
            </div>
          ) : null}
          {activityItems.map(renderItem)}
        </div>
      </TopbarDropdownPortal>
    </div>
  );
}
