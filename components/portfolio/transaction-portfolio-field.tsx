"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe, Lock, Pencil } from "@/lib/icons";

import { DropdownMenuLottieIcon } from "@/components/icons/dropdown-menu-lottie-icon";

import {
  ChevronsUpDownIcon,
  type ChevronsUpDownIconHandle,
} from "@/components/chevrons-up-down-icon";
import { usePlanAccessOptional } from "@/components/account/plan-access-provider";
import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import {
  dropdownMenuCompositeRowClassName,
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { whiteSurfaceButtonChromeClass } from "@/components/design-system";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { PortfolioListLogo } from "@/components/portfolio/portfolio-brokerage-logo";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { portfolioKindSubtext, type PortfolioPrivacy } from "@/components/portfolio/portfolio-types";
import {
  createCombinedPortfolioMenuIconAnimation,
  createPortfolioMenuIconAnimation,
} from "@/lib/lottie/portfolio-menu-animations";
import { dropdownTriggerFieldClassName } from "@/components/design-system/text-input-styles";
import { cn } from "@/lib/utils";

function PrivacyGlyph({ privacy }: { privacy: PortfolioPrivacy }) {
  const Icon = privacy === "public" ? Globe : Lock;
  return <Icon className="h-4 w-4 shrink-0 text-fg" strokeWidth={2} aria-hidden />;
}

type Variant = "field" | "compact" | "toolbar" | "titleGhost";

const toolbarTriggerClass = cn(
  "inline-flex h-9 max-w-[min(52vw,220px)] shrink-0 cursor-pointer items-center gap-2 rounded-[10px] px-3 text-left text-sm font-medium text-fg transition-all duration-100 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
  whiteSurfaceButtonChromeClass,
);

const titleGhostTriggerClass =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** `leading`: menu grows right (portfolio title). `trailing`: menu aligns to trigger’s right edge (top bar). */
export type CompactMenuAlign = "leading" | "trailing";

/**
 * Portfolio picker — shared by New Transaction and top bar / portfolio page.
 * - `field`: full-width gray trigger (forms).
 * - `compact`: chevron-only (top bar next to balance).
 * - `toolbar`: bordered white trigger with privacy icon + name + chevron (portfolio header actions).
 * - `titleGhost`: chevron-only ghost button (inline after the page title).
 */
export function TransactionPortfolioField({
  variant = "field",
  compactMenuAlign = "leading",
  /** Import modal: list portfolios only — no create/connect actions or row edit/sync controls. */
  portfoliosOnly = false,
}: {
  variant?: Variant;
  compactMenuAlign?: CompactMenuAlign;
  portfoliosOnly?: boolean;
}) {
  const {
    portfolios,
    selectedPortfolioId,
    setSelectedPortfolioId,
    isFreePortfolioAccessible,
    openEditPortfolio,
    openCreatePortfolio,
    openCreateCombinedPortfolio,
  } = usePortfolioWorkspace();
  const plan = usePlanAccessOptional();

  const [open, setOpen] = useState(false);
  const [createPortfolioIconPlaying, setCreatePortfolioIconPlaying] = useState(false);
  const [combinedPortfolioIconPlaying, setCombinedPortfolioIconPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const chevronsRef = useRef<ChevronsUpDownIconHandle>(null);
  const selected =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? null;
  const hasPortfolio = selected != null;
  const hasEnoughSourcesForCombined =
    portfolios.filter((p) => p.kind !== "combined").length >= 2;
  const combinedLockedOnFree = Boolean(plan && !plan.canCreateCombinedPortfolio);
  const canCreateCombinedPortfolio = hasEnoughSourcesForCombined && !combinedLockedOnFree;

  useEffect(() => {
    if (!open) {
      setCreatePortfolioIconPlaying(false);
      setCombinedPortfolioIconPlaying(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
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

  useEffect(() => {
    if (open) chevronsRef.current?.startAnimation();
    else chevronsRef.current?.stopAnimation();
  }, [open]);

  const chevronClass =
    variant === "toolbar" ? "h-4 w-4 shrink-0 text-icon" : "h-5 w-5 shrink-0 text-icon";

  const menuPanel = (
    <>
      {portfolios.length > 0 ? (
        <div className="px-3 py-1.5 text-xs font-medium leading-4 text-fg-muted">My portfolios</div>
      ) : null}
      {portfolios.map((p) => {
        const isSelected = p.id === selectedPortfolioId;
        const isLockedOnFree = !isFreePortfolioAccessible(p.id);
        return (
          <div
            key={p.id}
            className={cn(
              dropdownMenuCompositeRowClassName,
              "group",
              isSelected && "bg-surface-muted",
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPortfolioId(p.id);
                setOpen(false);
              }}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-4 text-left transition-colors hover:bg-transparent",
                portfoliosOnly && "pr-10",
              )}
            >
              <PortfolioListLogo portfolio={p} />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0">
                <span className="w-full truncate text-sm font-medium leading-5 text-fg">{p.name}</span>
                <span className="text-xs leading-4 text-fg-muted">{portfolioKindSubtext(p)}</span>
              </span>
            </button>
            {portfoliosOnly ? (
              <span className="mr-3 flex h-4 w-4 shrink-0 items-center justify-center self-center" aria-hidden>
                {isSelected ? (
                  <Check className="h-4 w-4 text-fg" strokeWidth={2} />
                ) : isLockedOnFree ? (
                  <Lock className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} />
                ) : null}
              </span>
            ) : isLockedOnFree ? (
              <span className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center self-center" aria-hidden>
                <Lock className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} />
              </span>
            ) : (
              <span className="relative mr-1 flex h-9 w-9 shrink-0 items-center justify-center self-center">
                {isSelected ? (
                  <Check
                    className="h-4 w-4 text-fg group-hover:invisible group-focus-within:invisible"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    openEditPortfolio(p.id);
                  }}
                  className="absolute inset-0 flex items-center justify-center rounded-lg text-fg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-surface-hover focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/10"
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </span>
            )}
          </div>
        );
      })}
      {!portfoliosOnly ? (
        <>
          <div
            role="separator"
            aria-hidden
            className="-mx-1 my-0.5 h-px shrink-0 bg-dropdown-divider"
          />
          <button
            type="button"
            onMouseEnter={() => setCreatePortfolioIconPlaying(true)}
            onMouseLeave={() => setCreatePortfolioIconPlaying(false)}
            onFocus={() => setCreatePortfolioIconPlaying(true)}
            onBlur={() => setCreatePortfolioIconPlaying(false)}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              openCreatePortfolio();
            }}
            className={dropdownMenuPlainItemClassName()}
          >
            <DropdownMenuLottieIcon
              animationData={createPortfolioMenuIconAnimation}
              playing={createPortfolioIconPlaying}
            />
            <span>Create New Portfolio</span>
          </button>
          <button
            type="button"
            aria-disabled={!canCreateCombinedPortfolio}
            title={
              combinedLockedOnFree
                ? "Combined portfolios are available on Pro only"
                : hasEnoughSourcesForCombined
                  ? undefined
                  : "Create at least two portfolios to combine them"
            }
            onMouseEnter={() => setCombinedPortfolioIconPlaying(true)}
            onMouseLeave={() => setCombinedPortfolioIconPlaying(false)}
            onFocus={() => setCombinedPortfolioIconPlaying(true)}
            onBlur={() => setCombinedPortfolioIconPlaying(false)}
            onClick={(e) => {
              e.stopPropagation();
              if (!canCreateCombinedPortfolio) return;
              setOpen(false);
              openCreateCombinedPortfolio();
            }}
            className={cn(
              dropdownMenuPlainItemClassName(),
              !canCreateCombinedPortfolio && "cursor-not-allowed opacity-40 hover:bg-surface",
            )}
          >
            <DropdownMenuLottieIcon
              animationData={createCombinedPortfolioMenuIconAnimation}
              playing={combinedPortfolioIconPlaying}
            />
            <span className="min-w-0 flex-1 truncate text-left">Create Combined Portfolio</span>
            {combinedLockedOnFree ? (
              <ProFeatureBadge label="Combined portfolios are available on Pro only" />
            ) : null}
          </button>
        </>
      ) : null}
    </>
  );

  // Stable class strings for topbar compact (avoids cn/twMerge SSR class-order mismatch).
  const containerClassName =
    variant === "compact" || variant === "toolbar" || variant === "titleGhost"
      ? "relative flex shrink-0"
      : "relative w-full";

  return (
    <div ref={containerRef} className={containerClassName}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={
          variant === "compact" || variant === "toolbar" || variant === "titleGhost" ? "Portfolio menu" : undefined
        }
        className={
          variant === "toolbar" ?
            toolbarTriggerClass
          : variant === "titleGhost" ?
            titleGhostTriggerClass
          : variant === "compact" ?
            "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-icon transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          : cn(
              // Match TransactionDateField / Operation field chrome + hover stroke.
              "flex w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 text-left text-sm font-normal text-fg",
              dropdownTriggerFieldClassName,
            )
        }
      >
        {variant === "field" ? (
          <>
            <span
              className={cn("min-w-0 truncate", hasPortfolio ? "text-fg" : "text-fg-muted")}
            >
              {hasPortfolio ? selected.name : "No portfolio"}
            </span>
            <ChevronsUpDownIcon ref={chevronsRef} className={chevronClass} />
          </>
        ) : variant === "toolbar" ? (
          <>
            {hasPortfolio && selected ? <PrivacyGlyph privacy={selected.privacy} /> : null}
            <span className={cn("min-w-0 flex-1 truncate", hasPortfolio ? "text-fg" : "text-fg-muted")}>
              {hasPortfolio ? selected.name : "No portfolio"}
            </span>
            <ChevronsUpDownIcon ref={chevronsRef} className={chevronClass} />
          </>
        ) : (
          <ChevronsUpDownIcon ref={chevronsRef} className={chevronClass} />
        )}
      </button>
      {open ? (
        <TopbarDropdownPortal
          open={open}
          anchorRef={containerRef}
          ref={menuPortalRef}
          align={
            variant === "field" || compactMenuAlign === "leading" ? "leading" : "trailing"
          }
          matchAnchorWidth={variant === "field"}
          className={
            variant === "field" ?
              undefined
            : "w-max min-w-[min(calc(100vw-2rem),280px)] max-w-[min(calc(100vw-2rem),320px)]"
          }
        >
          <div className={dropdownMenuPanelClassName()} role="presentation">
            {menuPanel}
          </div>
        </TopbarDropdownPortal>
      ) : null}
    </div>
  );
}
