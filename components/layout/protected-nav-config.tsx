import {
  BarChartSquare01,
  BookOpen01,
  Briefcase01,
  Calendar,
  Globe01,
  Globe04,
  Grid01,
  IntersectCircle,
  Rows01,
  Users01,
  type AppIcon,
} from "@/lib/icons";
import { NAV_EARNINGS_ENABLED, NAV_ECONOMY_ENABLED, NAV_MACRO_ENABLED, NAV_NEWS_ENABLED } from "@/lib/features/nav-flags";

export type ProtectedNavIcon = AppIcon;

export type ProtectedNavItem = {
  label: string;
  icon: ProtectedNavIcon;
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
    icon: Globe01,
    href: "/screener",
    available: true,
    activePathPrefixes: ["/screener", "/stock", "/crypto", "/index"],
  },
  { label: "Heatmaps", icon: Grid01, href: "/heatmaps", available: true },
  {
    label: "News",
    icon: BookOpen01,
    href: "/news",
    available: NAV_NEWS_ENABLED,
  },
];

export const protectedCalendarItems: ProtectedNavItem[] = [
  {
    label: "Earnings",
    icon: IntersectCircle,
    href: "/earnings",
    available: NAV_EARNINGS_ENABLED,
  },
  {
    label: "Economy",
    icon: Calendar,
    href: "/economy",
    available: NAV_ECONOMY_ENABLED,
  },
];

export const protectedDataItems: ProtectedNavItem[] = [
  {
    label: "Macro",
    icon: Globe04,
    href: "/macro",
    available: NAV_MACRO_ENABLED,
  },
  {
    label: "Charting",
    icon: BarChartSquare01,
    href: "/charting",
    available: true,
  },
  {
    label: "Comparison",
    icon: Rows01,
    href: "/comparison",
    available: true,
    activePathPrefix: true,
  },
];

export const protectedCommunityItems: ProtectedNavItem[] = [
  {
    label: "Superinvestors",
    icon: Briefcase01,
    href: "/superinvestors",
    available: true,
    activePathPrefix: true,
  },
  {
    label: "Portfolios",
    icon: Users01,
    href: "/portfolios",
    available: true,
  },
];

/** Community entries for the mobile bottom-nav sheet (same as desktop). */
export const protectedCommunityMobileNavItems: ProtectedNavItem[] = protectedCommunityItems;

function itemByLabel(items: readonly ProtectedNavItem[], label: string): ProtectedNavItem | undefined {
  return items.find((i) => i.label === label);
}

/** Mobile bottom-nav “More” menu — same order as desktop sidebar extras. */
export const protectedMobileMoreNavItems: ProtectedNavItem[] = (
  [
    "Heatmaps",
    "News",
    "Earnings",
    "Economy",
    "Macro",
    "Charting",
    "Comparison",
    "Superinvestors",
    "Portfolios",
  ] as const
).map((label) => {
  const item =
    itemByLabel(protectedMarketItems, label) ??
    itemByLabel(protectedCalendarItems, label) ??
    itemByLabel(protectedDataItems, label) ??
    itemByLabel(protectedCommunityItems, label);
  if (!item) throw new Error(`Missing mobile more nav item: ${label}`);
  return item;
});

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

export type MobilePrimaryNavTab = "markets" | "portfolio" | "watchlist" | "more";

/** Which bottom-nav pill is active for the current route (used to sync optimistic mobile tab UI). */
export function mobilePrimaryNavTabFromPathname(pathname: string): MobilePrimaryNavTab {
  if (pathname === "/portfolio" || pathname.startsWith("/portfolio/")) {
    return "portfolio";
  }
  if (pathname === "/watchlist" || pathname.startsWith("/watchlist/")) {
    return "watchlist";
  }
  if (protectedNavSectionHasActive(protectedMobileMoreNavItems, pathname)) return "more";
  if (protectedNavSectionHasActive(protectedMarketItems, pathname)) return "markets";
  return "markets";
}

/** Large mobile top-bar title (Linear-style) for the current primary section. */
export function mobileTopbarTitleFromPathname(pathname: string): string {
  const tab = mobilePrimaryNavTabFromPathname(pathname);
  if (tab === "portfolio") return "Portfolio";
  if (tab === "watchlist") return "Watchlist";
  if (tab === "more") {
    const active = protectedMobileMoreNavItems.find((item) => protectedNavItemIsActive(item, pathname));
    return active?.label ?? "More";
  }
  return "Markets";
}
