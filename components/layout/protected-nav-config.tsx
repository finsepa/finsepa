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

import { NAV_EARNINGS_ENABLED, NAV_MACRO_ENABLED, NAV_NEWS_ENABLED } from "@/lib/features/nav-flags";

export type ProtectedNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  available: boolean;
  /** When true, item is active for any path that starts with `href` (e.g. nested routes). */
  activePathPrefix?: boolean;
};

export const protectedMarketItems: ProtectedNavItem[] = [
  { label: "Screener", icon: Globe, href: "/screener", available: true },
  { label: "Heatmaps", icon: LayoutGrid, href: "/heatmaps", available: false },
  { label: "News", icon: Newspaper, href: "/news", available: NAV_NEWS_ENABLED },
];

export const protectedCalendarItems: ProtectedNavItem[] = [
  { label: "Earnings", icon: CalendarDays, href: "/earnings", available: NAV_EARNINGS_ENABLED },
  { label: "Economy", icon: BookOpen, href: "/economy", available: false },
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

/** Same active rule as desktop `SidebarRow`. */
export function protectedNavItemIsActive(item: ProtectedNavItem, pathname: string): boolean {
  if (!item.available) return false;
  return item.activePathPrefix
    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
    : pathname === item.href;
}

export function protectedNavSectionHasActive(items: readonly ProtectedNavItem[], pathname: string): boolean {
  return items.some((item) => protectedNavItemIsActive(item, pathname));
}
