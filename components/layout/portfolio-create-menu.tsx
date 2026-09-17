"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase } from "@/lib/icons";

import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";

import {
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import {
  topbarSquircleActiveClass,
  topbarSquircleIconClass,
} from "@/components/design-system/topbar-control-classes";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import {
  createCombinedPortfolioMenuIconAnimation,
  createPortfolioMenuIconAnimation,
} from "@/lib/lottie/portfolio-menu-animations";
import { cn } from "@/lib/utils";

type CreateItemId = "createPortfolio" | "createCombined";

/**
 * Portfolio toolbar control — Create New / Create Combined (moved out of the + quick-add menu).
 * Pro-gated rows stay clickable (badge kept) and open View Plans via workspace handlers.
 */
export function PortfolioCreateMenu({
  "aria-label": ariaLabel = "Create portfolio",
}: {
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [playingId, setPlayingId] = useState<CreateItemId | null>(null);
  const { portfolios, openCreatePortfolio, openCreateCombinedPortfolio } = usePortfolioWorkspace();
  const plan = usePlanAccessOptional();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const hasEnoughSourcesForCombined = portfolios.filter((p) => p.kind !== "combined").length >= 2;
  const createPortfolioProLocked = Boolean(plan?.isFree && !plan.canCreatePortfolio);
  const createCombinedProLocked = Boolean(plan && !plan.canCreateCombinedPortfolio);
  /** Only hard-disable when the action cannot run even after upgrading (need 2 books). */
  const createCombinedDisabled = !hasEnoughSourcesForCombined;

  const items: Array<{
    id: CreateItemId;
    label: string;
    disabled: boolean;
    title?: string;
    showProBadge?: boolean;
  }> = [
    {
      id: "createPortfolio",
      label: "Create New Portfolio",
      disabled: false,
      showProBadge: createPortfolioProLocked,
      title: createPortfolioProLocked
        ? "Free includes 1 manual portfolio — upgrade to Pro to add more"
        : undefined,
    },
    {
      id: "createCombined",
      label: "Create Combined Portfolio",
      disabled: createCombinedDisabled,
      showProBadge: createCombinedProLocked,
      title: createCombinedDisabled
        ? "Create at least two portfolios to combine them"
        : createCombinedProLocked
          ? "Combined portfolios are available on Pro only"
          : undefined,
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

  function runItem(id: CreateItemId) {
    if (id === "createPortfolio") openCreatePortfolio();
    else openCreateCombinedPortfolio();
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        data-open={open ? "true" : "false"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          topbarSquircleIconClass,
          "justify-center hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2",
          open && topbarSquircleActiveClass,
        )}
      >
        <Briefcase className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>

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
          {items.map((item) => {
            const playing = playingId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                aria-disabled={item.disabled}
                title={item.title}
                onMouseEnter={() => setPlayingId(item.id)}
                onMouseLeave={() => setPlayingId(null)}
                onFocus={() => setPlayingId(item.id)}
                onBlur={() => setPlayingId(null)}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  runItem(item.id);
                }}
                className={cn(
                  dropdownMenuPlainItemClassName(),
                  "font-medium whitespace-nowrap",
                  item.disabled ? "cursor-not-allowed opacity-40 hover:bg-surface" : null,
                )}
              >
                <DropdownMenuLottieIcon
                  animationData={
                    item.id === "createPortfolio" ?
                      createPortfolioMenuIconAnimation
                    : createCombinedPortfolioMenuIconAnimation
                  }
                  playing={playing}
                />
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                {item.showProBadge ? (
                  <ProFeatureBadge
                    label={
                      item.id === "createCombined"
                        ? "Combined portfolios are available on Pro only"
                        : "Free includes 1 manual portfolio — upgrade to Pro to add more"
                    }
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </TopbarDropdownPortal>
    </div>
  );
}
