import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  ChartColumn,
  Compass,
  FileText,
  LayoutGrid,
  Newspaper,
  PanelsTopLeft,
  Globe,
  Wallet,
} from "lucide-react";

import { NAV_EARNINGS_ENABLED, NAV_ECONOMY_ENABLED, NAV_MACRO_ENABLED, NAV_NEWS_ENABLED } from "@/lib/features/nav-flags";

export type ProtectedNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  available: boolean;
  /** When true, item is active for any path that starts with `href` (e.g. nested routes). */
  activePathPrefix?: boolean;
  /** Additional path roots (exact or nested) that keep this item active — e.g. asset pages opened from Screener. */
  activePathPrefixes?: readonly string[];
};

export const protectedMarketItems: ProtectedNavItem[] = [
  {
    label: "Screener",
    icon: Globe,
    href: "/screener",
    available: true,
    activePathPrefixes: ["/screener", "/stock", "/crypto", "/index"],
  },
  { label: "Heatmaps", icon: LayoutGrid, href: "/heatmaps", available: true },
  { label: "News", icon: Newspaper, href: "/news", available: NAV_NEWS_ENABLED },
];

export const protectedCalendarItems: ProtectedNavItem[] = [
  { label: "Earnings", icon: CalendarDays, href: "/earnings", available: NAV_EARNINGS_ENABLED },
  { label: "Economy", icon: BookOpen, href: "/economy", available: NAV_ECONOMY_ENABLED },
];

export const protectedDataItems: ProtectedNavItem[] = [
  { label: "Macro", icon: Compass, href: "/macro", available: NAV_MACRO_ENABLED },
  { label: "Charting", icon: ChartColumn, href: "/charting", available: true },
  {
    label: "Comparison",
    icon: PanelsTopLeft,
    href: "/comparison",
    available: true,
    activePathPrefix: true,
  },
];

export const protectedCommunityItems: ProtectedNavItem[] = [
  {
    label: "Superinvestors",
    icon: Briefcase,
    href: "/superinvestors",
    available: true,
    activePathPrefix: true,
  },
  { label: "Portfolios", icon: Wallet, href: "/portfolios", available: true },
  { label: "Posts", icon: FileText, href: "/posts", available: false },
];

/** Community entries for the mobile bottom-nav sheet only (omit unreleased teasers). */
export const protectedCommunityMobileNavItems: ProtectedNavItem[] = protectedCommunityItems.filter(
  (item) => item.href !== "/posts",
);

function pathnameMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Same active rule as desktop `SidebarRow`. */
export function protectedNavItemIsActive(item: ProtectedNavItem, pathname: string): boolean {
  if (!item.available) return false;
  const extra = item.activePathPrefixes;
  if (extra?.length) {
    return extra.some((p) => pathnameMatchesPrefix(pathname, p));
  }
  return item.activePathPrefix
    ? pathnameMatchesPrefix(pathname, item.href)
    : pathname === item.href;
}

export function protectedNavSectionHasActive(items: readonly ProtectedNavItem[], pathname: string): boolean {
  return items.some((item) => protectedNavItemIsActive(item, pathname));
}

export type MobilePrimaryNavTab = "markets" | "calendar" | "data" | "community" | "portfolio";

/** Which bottom-nav pill is active for the current route (used to sync optimistic mobile tab UI). */
export function mobilePrimaryNavTabFromPathname(pathname: string): MobilePrimaryNavTab {
  if (
    pathname === "/portfolio" ||
    pathname.startsWith("/portfolio/") ||
    pathname === "/portfolios" ||
    pathname.startsWith("/portfolios/")
  ) {
    return "portfolio";
  }
  if (protectedNavSectionHasActive(protectedMarketItems, pathname)) return "markets";
  if (protectedNavSectionHasActive(protectedCalendarItems, pathname)) return "calendar";
  if (protectedNavSectionHasActive(protectedDataItems, pathname)) return "data";
  if (protectedNavSectionHasActive(protectedCommunityMobileNavItems, pathname)) return "community";
  return "markets";
}
