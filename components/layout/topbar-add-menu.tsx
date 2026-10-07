"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import {
  dropdownMenuCompositeRowClassName,
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  primaryButtonGradientStrokeClass,
  whiteSurfaceButtonShadowClass,
} from "@/components/design-system/secondary-button-styles";
import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";
import { portfolioAcceptsTransactions } from "@/components/layout/portfolio-quick-add-menu";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { ManagePortfoliosModal } from "@/components/portfolio-home/manage-portfolios-modal";
import { PortfolioListLogo } from "@/components/portfolio/portfolio-brokerage-logo";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import {
  portfolioIsDemo,
  portfolioIsLiveBrokerage,
  portfolioKindSubtext,
  type PortfolioEntry,
} from "@/components/portfolio/portfolio-types";
import { ChevronLeft, ChevronRight, Layers2, Lock, Plus, Settings, X } from "@/lib/icons";
import {
  createCombinedPortfolioMenuIconAnimation,
  createPortfolioMenuIconAnimation,
} from "@/lib/lottie/portfolio-menu-animations";
import {
  addCashMenuIconAnimation,
  connectBrokerageMenuIconAnimation,
  importTransactionsMenuIconAnimation,
  newTradeMenuIconAnimation,
} from "@/lib/lottie/quick-add-menu-animations";
import { cn } from "@/lib/utils";

type ActionId =
  | "trade"
  | "cash"
  | "connectBrokerage"
  | "import"
  | "demo"
  | "createPortfolio"
  | "createCombined"
  | "manage";

/** iOS `PortfolioAddAction` titles and order. */
const ACTIONS: ReadonlyArray<{
  id: "trade" | "cash" | "connectBrokerage" | "import";
  title: string;
  animation: object;
}> = [
  { id: "trade", title: "Add Manual Transaction", animation: newTradeMenuIconAnimation },
  { id: "cash", title: "Manage Cash", animation: addCashMenuIconAnimation },
  { id: "connectBrokerage", title: "Connect Brokerage", animation: connectBrokerageMenuIconAnimation },
  { id: "import", title: "Import CSV File", animation: importTransactionsMenuIconAnimation },
];

/** Long portfolio lists scroll inside the menu so the sections below stay in view. */
const PICKER_LIST_STYLE = { maxHeight: "min(50vh, 400px)", overflowY: "auto" } as const;

const SECTION_LABEL_CLASS = "px-3 py-1.5 text-xs font-medium leading-4 text-fg-muted";
const SEPARATOR_CLASS = "-mx-1 my-0.5 h-px shrink-0 bg-stroke";

/** `quick-add-trigger` drives the + → × rotation (globals.css) via `data-open`. */
const TRIGGER_CLASS = `quick-add-trigger flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-stroke-muted bg-fg text-surface ${whiteSurfaceButtonShadowClass} ${primaryButtonGradientStrokeClass} transition-opacity duration-100 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15`;
const TRIGGER_STYLE = { gap: 6, paddingLeft: 12, paddingRight: 14 } as const;
const TRIGGER_ICON_STYLE = { width: 16, height: 16 } as const;

/**
 * Top bar “+ Add”: add a transaction (pick a portfolio, then the type), create a portfolio,
 * or manage portfolios.
 */
export function TopbarAddMenu() {
  const {
    portfolios,
    setSelectedPortfolioId,
    isFreePortfolioAccessible,
    openNewTransaction,
    openAddCash,
    openConnectBrokerageToSelected,
    openImportTransactions,
    openTryDemoPortfolio,
    openCreatePortfolio,
    openCreateCombinedPortfolio,
  } = usePortfolioWorkspace();
  const plan = usePlanAccessOptional();
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<ActionId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const books = portfolios.filter((p) => portfolioAcceptsTransactions(p, plan?.isFree === true));
  const isLocked = (p: PortfolioEntry) => Boolean(plan?.isFree && !isFreePortfolioAccessible(p.id));
  const target = targetId ? (books.find((p) => p.id === targetId) ?? null) : null;

  const canConnectBrokerage = plan?.canConnectBrokerage !== false;
  const offersDemo = !portfolios.some(portfolioIsDemo);
  const createPortfolioProLocked = Boolean(plan?.isFree && !plan.canCreatePortfolio);
  const createCombinedProLocked = Boolean(plan && !plan.canCreateCombinedPortfolio);
  const createCombinedDisabled = portfolios.filter((p) => p.kind !== "combined").length < 2;

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  /** Locked Free books: the setter shows the upgrade prompt and keeps the old selection. */
  function pick(p: PortfolioEntry) {
    setSelectedPortfolioId(p.id);
    if (isLocked(p)) {
      setMenuOpen(false);
      return;
    }
    setTargetId(p.id);
  }

  function onTriggerClick() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    setTargetId(null);
    setMenuOpen(true);
  }

  function run(id: ActionId) {
    setMenuOpen(false);
    if (id === "trade") openNewTransaction();
    else if (id === "cash") openAddCash();
    else if (id === "connectBrokerage") void openConnectBrokerageToSelected();
    else if (id === "import") openImportTransactions();
    else if (id === "createPortfolio") openCreatePortfolio();
    else if (id === "createCombined") openCreateCombinedPortfolio();
    else if (id === "manage") setManageOpen(true);
    else openTryDemoPortfolio();
  }

  function actionRow({
    id,
    title,
    icon,
    disabled = false,
    disabledTitle,
    proBadge,
  }: {
    id: ActionId;
    title: string;
    icon: ReactNode;
    disabled?: boolean;
    disabledTitle?: string;
    /** Pro badge tooltip; Pro-gated rows stay clickable and open View Plans. */
    proBadge?: string;
  }) {
    return (
      <button
        key={id}
        type="button"
        role="menuitem"
        aria-disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onMouseEnter={() => setPlayingId(id)}
        onMouseLeave={() => setPlayingId(null)}
        onFocus={() => setPlayingId(id)}
        onBlur={() => setPlayingId(null)}
        onClick={() => {
          if (!disabled) run(id);
        }}
        className={cn(
          dropdownMenuPlainItemClassName(),
          "font-medium whitespace-nowrap",
          disabled ? "cursor-not-allowed opacity-40 hover:bg-surface" : null,
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-left">{title}</span>
        {proBadge ? <ProFeatureBadge label={proBadge} /> : null}
      </button>
    );
  }

  function staticIcon(icon: ReactNode) {
    return <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>;
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        data-open={menuOpen ? "true" : "false"}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        suppressHydrationWarning
        onClick={onTriggerClick}
        className={cn(TRIGGER_CLASS, menuOpen && "opacity-90")}
        style={TRIGGER_STYLE}
      >
        <span className="quick-add-trigger-icons" style={TRIGGER_ICON_STYLE} aria-hidden>
          <Plus strokeWidth={2} className="h-5 w-5 quick-add-trigger-plus" style={TRIGGER_ICON_STYLE} />
          <X strokeWidth={2} className="h-5 w-5 quick-add-trigger-close" style={TRIGGER_ICON_STYLE} />
        </span>
        <span className="text-[13px] font-semibold leading-5">Add</span>
      </button>

      <TopbarDropdownPortal
        open={menuOpen}
        anchorRef={rootRef}
        ref={menuPortalRef}
        align="trailing"
        className="w-max min-w-[min(calc(100vw-2rem),280px)] max-w-[min(calc(100vw-2rem),320px)]"
      >
        <div
          role="menu"
          aria-label={target ? "Add transaction" : "Add"}
          className={dropdownMenuPanelClassName()}
        >
          {target ? (
            <>
              <button
                type="button"
                onClick={() => setTargetId(null)}
                className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium leading-4 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg dark:hover:bg-dropdown-item-hover"
              >
                <ChevronLeft className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="truncate">{target.name.trim() || "Untitled portfolio"}</span>
              </button>
              <div className="flex flex-col gap-1">
                {ACTIONS.map((a) =>
                  actionRow({
                    id: a.id,
                    title: a.title,
                    icon: <DropdownMenuLottieIcon animationData={a.animation} playing={playingId === a.id} />,
                    ...(a.id === "connectBrokerage"
                      ? {
                          disabled: portfolioIsLiveBrokerage(target),
                          disabledTitle: "This portfolio is already connected to a brokerage",
                          proBadge: canConnectBrokerage ? undefined : "Brokerage sync is available on Pro only",
                        }
                      : {}),
                  }),
                )}
                {offersDemo ? (
                  <>
                    <div role="separator" aria-hidden className={SEPARATOR_CLASS} />
                    {actionRow({
                      id: "demo",
                      title: "Try Demo Portfolio",
                      icon: staticIcon(<Layers2 className="size-4" strokeWidth={2} aria-hidden />),
                    })}
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {books.length > 0 ? (
                <>
                  <div className={SECTION_LABEL_CLASS}>Add transaction</div>
                  <div className="flex flex-col gap-1" style={PICKER_LIST_STYLE}>
                    {books.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="menuitem"
                        onClick={() => pick(p)}
                        className={cn(dropdownMenuCompositeRowClassName, "shrink-0 gap-3 py-2 pl-3 pr-3 text-left")}
                      >
                        <PortfolioListLogo portfolio={p} />
                        <span className="flex min-w-0 flex-1 flex-col items-start gap-0">
                          <span className="w-full truncate text-sm font-medium leading-5 text-fg">
                            {p.name.trim() || "Untitled portfolio"}
                          </span>
                          <span className="text-xs leading-4 text-fg-muted">{portfolioKindSubtext(p)}</span>
                        </span>
                        {isLocked(p) ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} aria-label="Locked" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                        )}
                      </button>
                    ))}
                  </div>
                  <div role="separator" aria-hidden className={SEPARATOR_CLASS} />
                </>
              ) : null}
              <div className={SECTION_LABEL_CLASS}>Create portfolio</div>
              {actionRow({
                id: "createPortfolio",
                title: "Create New Portfolio",
                icon: (
                  <DropdownMenuLottieIcon
                    animationData={createPortfolioMenuIconAnimation}
                    playing={playingId === "createPortfolio"}
                  />
                ),
                proBadge: createPortfolioProLocked
                  ? "Free includes 1 manual portfolio — upgrade to Pro to add more"
                  : undefined,
              })}
              {actionRow({
                id: "createCombined",
                title: "Create Combined Portfolio",
                icon: (
                  <DropdownMenuLottieIcon
                    animationData={createCombinedPortfolioMenuIconAnimation}
                    playing={playingId === "createCombined"}
                  />
                ),
                disabled: createCombinedDisabled,
                disabledTitle: "Create at least two portfolios to combine them",
                proBadge: createCombinedProLocked ? "Combined portfolios are available on Pro only" : undefined,
              })}
              {portfolios.length > 0 ? (
                <>
                  <div role="separator" aria-hidden className={SEPARATOR_CLASS} />
                  {actionRow({
                    id: "manage",
                    title: "Manage portfolios",
                    icon: staticIcon(<Settings className="size-4" strokeWidth={2} aria-hidden />),
                  })}
                </>
              ) : null}
            </>
          )}
        </div>
      </TopbarDropdownPortal>

      <ManagePortfoliosModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
