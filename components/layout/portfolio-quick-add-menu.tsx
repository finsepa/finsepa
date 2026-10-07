"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Plus, X } from "@/lib/icons";

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
import {
  primaryButtonGradientStrokeClass,
  whiteSurfaceButtonShadowClass,
} from "@/components/design-system/secondary-button-styles";
import { TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import {
  portfolioIsCombined,
  portfolioIsDemo,
  portfolioIsLiveBrokerage,
  portfolioIsOfflineBrokerage,
  type PortfolioEntry,
} from "@/components/portfolio/portfolio-types";
import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import {
  addCashMenuIconAnimation,
  connectBrokerageMenuIconAnimation,
  importTransactionsMenuIconAnimation,
  newTradeMenuIconAnimation,
} from "@/lib/lottie/quick-add-menu-animations";
import { deleteMenuIconAnimation, renameMenuIconAnimation } from "@/lib/lottie/watchlist-menu-animations";
import { cn } from "@/lib/utils";

type ActivityItemId = "trade" | "cash" | "connectBrokerage" | "import";
type ManageItemId = "edit" | "delete";

const PRIMARY_TRIGGER_CLASS = `flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-stroke-muted bg-fg text-surface ${whiteSurfaceButtonShadowClass} ${primaryButtonGradientStrokeClass} transition-opacity duration-100 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15`;
const GHOST_TRIGGER_CLASS =
  "flex size-7 shrink-0 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15";

/** Same rules as the workspace's read-only flag, so every listed book has working actions. */
export function portfolioAcceptsTransactions(p: PortfolioEntry, isFreePlan: boolean): boolean {
  return (
    !portfolioIsCombined(p) &&
    !portfolioIsDemo(p) &&
    !portfolioIsOfflineBrokerage(p) &&
    !(isFreePlan && p.snaptrade)
  );
}

/**
 * (+) quick menu — transaction actions for the selected portfolio; creating portfolios lives in
 * {@link PortfolioCreateMenu}.
 */
export function PortfolioQuickAddMenu({
  triggerClassName,
  variant = "default",
  showDesktopLabel = false,
  desktopLabel = "Add",
  "aria-label": ariaLabel = "Quick add",
  dwellTooltipLabel,
  portfolioId,
  manageActions = false,
  onOpenChange,
}: {
  /** Target this portfolio instead of the current selection (selects it when the menu opens). */
  portfolioId?: string;
  /**
   * Row “…” menu: adds Edit / Delete below the transaction actions (only those for demo books)
   * and swaps the (+) trigger for a “…” icon. Requires `portfolioId`.
   */
  manageActions?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  /**
   * `primary` — inverted fill (black on light / white on dark), like primary CTAs.
   * `ghost` — small borderless icon button for inline row actions.
   */
  variant?: "default" | "primary" | "ghost";
  /** Icon + label on `md+` (top bar); mobile stays icon-only. */
  showDesktopLabel?: boolean;
  desktopLabel?: string;
  "aria-label"?: string;
  /** Shown on mobile when `showDesktopLabel` is true; suppressed on touch via tooltip helper. */
  dwellTooltipLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [playingId, setPlayingId] = useState<ActivityItemId | ManageItemId | null>(null);
  const {
    portfolios,
    openEditPortfolio,
    openDeletePortfolio,
    openNewTransaction,
    openAddCash,
    openConnectBrokerageToSelected,
    openImportTransactions,
    selectedPortfolioReadOnly,
    selectedPortfolioId,
    setSelectedPortfolioId,
    isFreePortfolioAccessible,
  } = usePortfolioWorkspace();
  const plan = usePlanAccessOptional();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId) ?? null;
  /** Row menus (e.g. Home list) name the portfolio they act on; page menus already show it in the title. */
  const menuPortfolioLabel = portfolioId != null ? selectedPortfolio?.name.trim() || null : null;
  const canConnectBrokerage = plan?.canConnectBrokerage !== false;
  const connectBrokerageDisabled =
    selectedPortfolioId == null ||
    selectedPortfolioReadOnly ||
    portfolioIsCombined(selectedPortfolio) ||
    portfolioIsDemo(selectedPortfolio) ||
    portfolioIsLiveBrokerage(selectedPortfolio);

  const activityItems: Array<{
    id: ActivityItemId;
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
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  function toggleOpen() {
    if (!open && portfolioId != null && portfolioId !== selectedPortfolioId) {
      setSelectedPortfolioId(portfolioId);
      /** Free-locked books: the setter shows the upgrade prompt and keeps the old selection. */
      if (plan?.isFree && !isFreePortfolioAccessible(portfolioId)) return;
    }
    setOpen((v) => !v);
  }

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
  const targetPortfolio =
    portfolioId != null ? (portfolios.find((p) => p.id === portfolioId) ?? null) : null;
  const showActivityItems = !manageActions || !portfolioIsDemo(targetPortfolio);

  function renderManageItem(id: ManageItemId) {
    const isDelete = id === "delete";
    return (
      <button
        key={id}
        type="button"
        role="menuitem"
        onMouseEnter={() => setPlayingId(id)}
        onMouseLeave={() => setPlayingId(null)}
        onFocus={() => setPlayingId(id)}
        onBlur={() => setPlayingId(null)}
        onClick={() => {
          if (portfolioId == null) return;
          setOpen(false);
          if (isDelete) openDeletePortfolio(portfolioId);
          else openEditPortfolio(portfolioId);
        }}
        className={cn(
          dropdownMenuPlainItemClassName(),
          "font-medium whitespace-nowrap",
          isDelete ? "text-down hover:bg-down-soft hover:text-down" : null,
        )}
      >
        <DropdownMenuLottieIcon
          animationData={isDelete ? deleteMenuIconAnimation : renameMenuIconAnimation}
          playing={playingId === id}
        />
        <span className="min-w-0 flex-1 truncate text-left">{isDelete ? "Delete" : "Edit"}</span>
      </button>
    );
  }

  function runItem(id: ActivityItemId) {
    if (id === "trade") openNewTransaction();
    else if (id === "cash") openAddCash();
    else if (id === "connectBrokerage") void openConnectBrokerageToSelected();
    else openImportTransactions();
  }

  function itemIcon(id: ActivityItemId) {
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
        {showProBadge ? <ProFeatureBadge label="Brokerage sync is available on Pro only" /> : null}
      </button>
    );
  }

  const resolvedTriggerChrome =
    triggerClassName ??
    (variant === "primary"
      ? showDesktopLabel
        ? PRIMARY_TRIGGER_CLASS.replace("w-9", "w-auto")
        : PRIMARY_TRIGGER_CLASS
      : variant === "ghost"
        ? GHOST_TRIGGER_CLASS
        : showDesktopLabel
          ? `${topbarSquircleTextButtonClass} justify-center w-9 gap-0 px-0 md:w-auto md:gap-1.5 md:px-3.5`
          : `${topbarSquircleIconClass} justify-center`);
  const openTriggerClass =
    variant === "primary" ? "opacity-90"
    : variant === "ghost" ? "bg-surface-muted text-fg"
    : topbarSquircleActiveClass;
  const primaryWithLabel = variant === "primary" && showDesktopLabel;
  const iconSizeStyle =
    variant === "ghost" || primaryWithLabel ? { width: 16, height: 16 } : undefined;
  const triggerClassNameResolved = open
    ? `quick-add-trigger ${resolvedTriggerChrome} ${openTriggerClass}`
    : `quick-add-trigger ${resolvedTriggerChrome}`;

  const trigger = (
    <button
      type="button"
      data-open={open ? "true" : "false"}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={ariaLabel}
      suppressHydrationWarning
      onClick={toggleOpen}
      className={triggerClassNameResolved}
      style={primaryWithLabel ? { gap: 6, paddingLeft: 12, paddingRight: 14 } : undefined}
    >
      {manageActions ? (
        <MoreHorizontal strokeWidth={2} className="h-5 w-5" style={iconSizeStyle} aria-hidden />
      ) : (
        <span className="quick-add-trigger-icons" style={iconSizeStyle} aria-hidden>
          <Plus strokeWidth={2} className="h-5 w-5 quick-add-trigger-plus" style={iconSizeStyle} />
          <X strokeWidth={2} className="h-5 w-5 quick-add-trigger-close" style={iconSizeStyle} />
        </span>
      )}
      {primaryWithLabel ? (
        <span className="text-[13px] font-semibold leading-5">{desktopLabel}</span>
      ) : showDesktopLabel ? (
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
        align={variant === "ghost" ? "auto" : "trailing"}
        className="w-max min-w-[260px] max-w-[min(calc(100vw-2rem),320px)]"
      >
        <div
          role="menu"
          className={cn(
            dropdownMenuPanelClassName(),
            variant === "ghost" ? "origin-top-left" : "origin-top-right",
            "[animation:quick-add-dropdown-in_220ms_ease-out_both] motion-reduce:[animation:none]",
          )}
        >
          {menuPortfolioLabel ? (
            <div className="px-3 py-1.5 text-xs font-medium leading-4 text-fg-muted">{menuPortfolioLabel}</div>
          ) : null}
          {showActivityItems ? activityItems.map(renderItem) : null}
          {manageActions ? (
            <>
              {showActivityItems ? (
                <div role="separator" aria-hidden className="-mx-1 my-0.5 h-px shrink-0 bg-stroke" />
              ) : null}
              {renderManageItem("edit")}
              {renderManageItem("delete")}
            </>
          ) : null}
        </div>
      </TopbarDropdownPortal>
    </div>
  );
}
