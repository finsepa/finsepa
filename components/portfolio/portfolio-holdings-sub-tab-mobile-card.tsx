"use client";

import type { ReactNode } from "react";

import {
  PORTFOLIO_HOLDINGS_SUB_TAB_ITEMS,
  type OverviewHoldingsSubTab,
} from "@/components/portfolio/portfolio-page-tabs";
import {
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

/** Mobile holdings card: pill tabs (active grey fill, inactive transparent). */
export function PortfolioHoldingsSubTabMobileToggle({
  active,
  onChange,
}: {
  active: OverviewHoldingsSubTab;
  onChange: (tab: OverviewHoldingsSubTab) => void;
}) {
  return (
    <div
      className="mobile-scroll-x flex flex-nowrap items-center gap-1 md:overflow-visible md:pb-0 md:mb-0"
      role="tablist"
      aria-label="Holdings view"
    >
      {PORTFOLIO_HOLDINGS_SUB_TAB_ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium leading-5 transition-colors duration-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15 focus-visible:ring-offset-2",
              isActive ? "bg-[#F4F4F5] text-[#09090B]" : "bg-transparent text-[#71717A]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Mobile Overview holdings shell — tabs stay fixed; Assets / Allocation / Slices swap below. */
export function PortfolioHoldingsSubTabMobileCard({
  active,
  onChange,
  trailing,
  children,
}: {
  active: OverviewHoldingsSubTab;
  onChange: (tab: OverviewHoldingsSubTab) => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full bg-white",
        SCREENER_TABLE_OUTER_BORDER_CLASS,
        SCREENER_TABLE_MOBILE_SURFACE_CLASS,
        "max-md:overflow-hidden max-md:rounded-2xl md:contents",
      )}
    >
      <div className="overflow-hidden px-4 py-2 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <PortfolioHoldingsSubTabMobileToggle active={active} onChange={onChange} />
          {trailing}
        </div>
      </div>
      {children}
    </div>
  );
}
