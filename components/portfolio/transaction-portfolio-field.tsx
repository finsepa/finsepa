"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pencil, Plus } from "lucide-react";

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
  } = usePortfolioWorkspace();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? null;
  const hasPortfolio = selected != null;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const dropdownAlign =
    variant === "compact"
      ? compactMenuAlign === "trailing"
        ? "right-0 left-auto w-max min-w-[min(calc(100vw-2rem),280px)] max-w-[min(calc(100vw-2rem),320px)]"
        : "left-0 right-auto w-max min-w-[min(calc(100vw-2rem),280px)] max-w-[min(calc(100vw-2rem),320px)]"
      : "left-0 right-0";

  const zDropdown = variant === "compact" ? "z-[80]" : "z-10";

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
      {open ? (
        <div
          className={cn(
            "absolute top-[calc(100%+4px)] overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]",
            dropdownAlign,
            zDropdown,
          )}
          role="presentation"
        >
          <div className="divide-y divide-[#E4E4E7]">
            {portfolios.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-1 text-sm text-[#09090B]",
                  p.id === selectedPortfolioId ? "bg-[#FAFAFA]" : "",
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPortfolioId(p.id);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 truncate px-4 py-3 text-left transition-colors hover:bg-[#F4F4F5]"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    openEditPortfolio(p.id);
                  }}
                  className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
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
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm text-[#09090B] transition-colors hover:bg-[#F4F4F5]"
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>Create New Portfolio</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
