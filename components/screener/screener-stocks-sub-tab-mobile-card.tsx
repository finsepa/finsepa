"use client";

import type { ReactNode } from "react";

import {
  SCREENER_TABLE_MOBILE_SURFACE_CLASS,
  SCREENER_TABLE_OUTER_BORDER_CLASS,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

/**
 * Mobile stocks table shell — card chrome only.
 * Sub-tabs (Companies / …) sit above this card (same as web SecondaryTabs).
 */
export function ScreenerStocksSubTabMobileCard({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full bg-surface",
        SCREENER_TABLE_OUTER_BORDER_CLASS,
        SCREENER_TABLE_MOBILE_SURFACE_CLASS,
        "max-md:overflow-hidden max-md:rounded-2xl md:contents",
      )}
    >
      {children}
    </div>
  );
}
