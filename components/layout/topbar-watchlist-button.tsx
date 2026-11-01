"use client";

import { usePathname } from "next/navigation";

import {
  topbarSquircleActiveClass,
  topbarSquircleIconClass,
} from "@/components/design-system/topbar-control-classes";
import { watchlistRailAvailable } from "@/components/layout/watchlist-rail";
import { useWatchlistRailLayout } from "@/components/layout/watchlist-rail-layout-context";
import { Star } from "@/lib/icons";
import { cn } from "@/lib/utils";

import { TopbarDelayedTooltip } from "./topbar-delayed-tooltip";

/** Desktop topbar toggle for the shell watchlist rail (hidden where the page has its own watchlist). */
export function TopbarWatchlistButton() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useWatchlistRailLayout();
  if (!watchlistRailAvailable(pathname)) return null;

  const label = collapsed ? "Show watchlist" : "Hide watchlist";
  return (
    <TopbarDelayedTooltip label={label} className="hidden shrink-0 md:inline-flex">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={label}
        aria-pressed={!collapsed}
        className={cn(topbarSquircleIconClass, !collapsed && topbarSquircleActiveClass)}
      >
        <Star className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </TopbarDelayedTooltip>
  );
}
