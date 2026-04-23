"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, GitMerge, Pencil, Plus } from "lucide-react";

import {
  dropdownMenuCompositeRowClassName,
  dropdownMenuPanelClassName,
  dropdownMenuPlainItemClassName,
} from "@/components/design-system/dropdown-menu-styles";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { cn } from "@/lib/utils";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";

type Variant = "field" | "compact";

/** `leading`: menu grows right (portfolio title). `trailing`: menu aligns to trigger’s right edge (top bar). */
export type CompactMenuAlign = "leading" | "trailing";

/**
 * Portfolio picker — shared by New Transaction and top bar / portfolio page.
 * `compact`: chevron-only trigger (e.g. next to balance in the top bar).
 */
export function TransactionPortfolioField({
  variant = "field",
  compactMenuAlign = "leading",
}: {
  variant?: Variant;
  compactMenuAlign?: CompactMenuAlign;
}) {
  const {
    portfolios,
    selectedPortfolioId,
    setSelectedPortfolioId,
    openEditPortfolio,
    openCreatePortfolio,
    openCreateCombinedPortfolio,
  } = usePortfolioWorkspace();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const selected =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? null;
  const hasPortfolio = selected != null;

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

  const dropdownAlign =
    variant === "compact"
      ? compactMenuAlign === "trailing"
        ? "right-0 left-auto w-max min-w-[min(calc(100vw-2rem),280px)] max-w-[min(calc(100vw-2rem),320px)]"
        : "left-0 right-auto w-max min-w-[min(calc(100vw-2rem),280px)] max-w-[min(calc(100vw-2rem),320px)]"
      : "left-0 right-0";

  const zDropdown = variant === "field" ? "z-10" : undefined;

  const menuPanel = (
    <>
      {portfolios.map((p) => (
        <div
          key={p.id}
          className={cn(
            dropdownMenuCompositeRowClassName,
            p.id === selectedPortfolioId && "bg-[#F4F4F5]",
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPortfolioId(p.id);
              setOpen(false);
            }}
            className="min-h-10 min-w-0 flex-1 truncate px-4 py-2 text-left text-sm transition-colors hover:bg-transparent"
          >
            {p.name}
          </button>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center self-center" aria-hidden>
            {p.id === selectedPortfolioId ? (
              <Check className="h-4 w-4 text-[#09090B]" strokeWidth={2} />
            ) : null}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              openEditPortfolio(p.id);
            }}
            className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            aria-label={`Edit ${p.name}`}
          >
            <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          openCreatePortfolio();
        }}
        className={dropdownMenuPlainItemClassName()}
      >
        <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span>Create New Portfolio</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          openCreateCombinedPortfolio();
        }}
        className={dropdownMenuPlainItemClassName()}
      >
        <GitMerge className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span>Create combined portfolio</span>
      </button>
    </>
  );

  return (
    <div ref={containerRef} className={cn("relative", variant === "compact" && "flex shrink-0")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={variant === "compact" ? "Portfolio menu" : undefined}
        className={
          variant === "compact"
            ? "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-50"
            : "flex h-9 w-full items-center justify-between gap-2 rounded-[10px] bg-[#F4F4F5] px-4 text-left text-sm transition-colors hover:bg-[#EBEBEB]"
        }
      >
        {variant === "field" ? (
          <>
            <span
              className={cn("min-w-0 truncate", hasPortfolio ? "text-[#09090B]" : "text-[#71717A]")}
            >
              {hasPortfolio ? selected.name : "No portfolio"}
            </span>
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-[#09090B] transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </>
        ) : (
          <ChevronDown
            className={cn("h-5 w-5 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        )}
      </button>
      {open && variant === "compact" ? (
        <TopbarDropdownPortal
          open={open}
          anchorRef={containerRef}
          ref={menuPortalRef}
          align={compactMenuAlign === "trailing" ? "trailing" : "leading"}
          className="w-max min-w-[min(calc(100vw-2rem),280px)] max-w-[min(calc(100vw-2rem),320px)]"
        >
          <div className={dropdownMenuPanelClassName()} role="presentation">
            {menuPanel}
          </div>
        </TopbarDropdownPortal>
      ) : null}
      {open && variant === "field" ? (
        <div
          className={cn(
            dropdownMenuPanelClassName(),
            "absolute top-[calc(100%+4px)]",
            dropdownAlign,
            zDropdown,
          )}
          role="presentation"
        >
          {menuPanel}
        </div>
      ) : null}
    </div>
  );
}
