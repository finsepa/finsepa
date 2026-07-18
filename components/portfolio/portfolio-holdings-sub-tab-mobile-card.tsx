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
  assetCount,
}: {
  active: OverviewHoldingsSubTab;
  onChange: (tab: OverviewHoldingsSubTab) => void;
  /** When set, shown as a small badge on the Assets tab. */
  assetCount?: number;
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
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium leading-5 transition-colors duration-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F0F0F]/15 focus-visible:ring-offset-2",
              isActive ? "bg-[#F4F4F5] text-[#0F0F0F]" : "bg-transparent text-[#71717A]",
            )}
          >
            {item.label}
            {item.id === "assets" && assetCount != null ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[6px] text-[11px] font-medium tabular-nums leading-none text-[#0F0F0F] transition-colors duration-100",
                  isActive ? "bg-white" : "bg-[#E4E4E7]",
                )}
              >
                {assetCount}
              </span>
            ) : null}
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
  assetCount,
  children,
}: {
  active: OverviewHoldingsSubTab;
  onChange: (tab: OverviewHoldingsSubTab) => void;
  trailing?: ReactNode;
  assetCount?: number;
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
          <PortfolioHoldingsSubTabMobileToggle
            active={active}
            onChange={onChange}
            assetCount={assetCount}
          />
          {trailing}
        </div>
      </div>
      {children}
    </div>
  );
}
