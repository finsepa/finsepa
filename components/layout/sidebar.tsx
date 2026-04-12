"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  ChartColumn,
  Compass,
  Flame,
  LayoutGrid,
  Newspaper,
  PanelLeft,
  PanelLeftOpen,
  PanelsTopLeft,
  Globe,
  Wallet,
} from "lucide-react";

import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import { NAV_EARNINGS_ENABLED, NAV_MACRO_ENABLED, NAV_NEWS_ENABLED } from "@/lib/features/nav-flags";
import { cn } from "@/lib/utils";

const soonBadgeClass =
  "shrink-0 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#71717A]";

const marketItems = [
  { label: "Screener", icon: Globe, href: "/screener", available: true },
  { label: "Heatmaps", icon: LayoutGrid, href: "/heatmaps", available: false },
  { label: "News", icon: Newspaper, href: "/news", available: NAV_NEWS_ENABLED },
];

const calendarItems = [
  { label: "Earnings", icon: CalendarDays, href: "/earnings", available: NAV_EARNINGS_ENABLED },
  { label: "Economy", icon: BookOpen, href: "/economy", available: false },
];

const dataItems = [
  { label: "Macro", icon: Compass, href: "/macro", available: NAV_MACRO_ENABLED },
  { label: "Charting", icon: ChartColumn, href: "/charting", available: true },
  { label: "Comparison", icon: PanelsTopLeft, href: "/comparison", available: false },
];

const communityItems = [
  { label: "Superinvestors", icon: Flame, href: "/superinvestors", available: false },
  { label: "Portfolios", icon: Wallet, href: "/portfolios", available: true },
  { label: "Posts", icon: Briefcase, href: "/posts", available: false },
];

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  available: boolean;
};

function SidebarRow({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const Icon = item.icon;
  const isActive = item.available && pathname === item.href;
  const tooltipLabel = item.available ? item.label : `${item.label} (Soon)`;

  const rowClass = cn(
    "flex shrink-0 items-center rounded-lg text-sm font-medium leading-5 transition-all duration-100",
    collapsed ? "h-9 w-9 justify-center px-0 py-0" : "h-9 gap-2 px-4 py-2",
    item.available ? "text-[#09090B]" : "cursor-not-allowed text-[#A1A1AA] select-none",
    item.available && (isActive ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]"),
  );

  const iconClass = cn("h-5 w-5 shrink-0", item.available ? "text-[#09090B]" : "text-[#A1A1AA]");

  const content =
    item.available ? (
      <Link prefetch={false} href={item.href} className={rowClass}>
        <Icon className={iconClass} />
        {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
      </Link>
    ) : (
      <div className={rowClass} aria-disabled="true">
        <Icon className={iconClass} />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className={soonBadgeClass}>Soon</span>
          </>
        ) : null}
      </div>
    );

  if (!collapsed) {
    return content;
  }

  return (
    <div className="group relative flex justify-center">
      {content}
      <span
        className="pointer-events-none absolute left-full top-1/2 z-[100] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#09090B] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        role="tooltip"
      >
        {tooltipLabel}
      </span>
    </div>
  );
}

function SidebarSection({
  title,
  items,
  pathname,
  collapsed,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className={cn(!collapsed && "px-2")}>
      {!collapsed ? (
        <p className="mb-1.5 text-sm font-semibold leading-5 text-[#52525B]">{title}</p>
      ) : null}
      <div className="space-y-0.5">
        {items.map((item) => (
          <SidebarRow key={item.label} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

const toggleButtonClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/20";

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebarLayout();

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col rounded-[4px] bg-white py-5 transition-[width] duration-200 ease-out",
        collapsed ? "w-full overflow-x-visible overflow-y-hidden" : "w-[240px] overflow-y-auto",
      )}
    >
      {collapsed ? (
        <div className="group relative mb-6 flex justify-center px-1">
          <button
            type="button"
            className={toggleButtonClass}
            onClick={toggleCollapsed}
            aria-expanded={false}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <span
            className="pointer-events-none absolute left-full top-1/2 z-[100] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#09090B] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            role="tooltip"
          >
            Expand sidebar
          </span>
        </div>
      ) : (
        <div className="mb-7 flex items-center justify-between gap-2 px-3">
          <img src="/logo.svg" alt="Finsepa" width={32} height={32} />
          <button
            type="button"
            className={toggleButtonClass}
            onClick={toggleCollapsed}
            aria-expanded
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          collapsed ? "overflow-y-auto overflow-x-visible" : "",
          collapsed ? "space-y-4" : "space-y-6",
        )}
      >
        <SidebarSection title="Markets" items={marketItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Calendar" items={calendarItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Data" items={dataItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Community" items={communityItems} pathname={pathname} collapsed={collapsed} />
      </div>
    </aside>
  );
}
