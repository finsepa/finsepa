"use client";

import type { ReactNode } from "react";

import { ScreenerStocksSubTabMobileToggle, type StocksSubTab } from "@/components/screener/screener-tabs";
import {
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

/** Mobile stocks sub-tab shell — toggle stays fixed; table body swaps below. */
export function ScreenerStocksSubTabMobileCard({
  active,
  onChange,
  children,
}: {
  active: StocksSubTab;
  onChange: (tab: StocksSubTab) => void;
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
      <div className="overflow-hidden border-b border-solid border-[#E4E4E7] px-4 py-2 max-md:border-b-[0.5px] md:hidden">
        <ScreenerStocksSubTabMobileToggle active={active} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}
