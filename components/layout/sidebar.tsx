"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  {
    label: "Superinvestors",
    icon: Flame,
    href: "/superinvestors",
    available: true,
    activePathPrefix: true,
  },
  { label: "Portfolios", icon: Wallet, href: "/portfolios", available: true },
  { label: "Posts", icon: Briefcase, href: "/posts", available: false },
];

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  available: boolean;
  /** When true, item is active for any path that starts with `href` (e.g. nested routes). */
  activePathPrefix?: boolean;
};

const TOOLTIP_HIDE_MS = 100;

function CollapsedRailTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: r.right + 6, top: r.top + r.height / 2 });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  const show = useCallback(() => {
    clearHideTimer();
    updatePosition();
    setOpen(true);
  }, [clearHideTimer, updatePosition]);

  const hide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setOpen(false), TOOLTIP_HIDE_MS);
  }, [clearHideTimer]);

  const tooltip =
    open && mounted ? (
      <div
        className="pointer-events-none fixed z-[200] flex -translate-y-1/2 items-center shadow-[0px_8px_20px_0px_rgba(10,10,10,0.12)]"
        style={{ left: pos.left, top: pos.top }}
        role="tooltip"
      >
        <span
          className="h-0 w-0 shrink-0 self-center border-y-[5px] border-r-[6px] border-y-transparent border-r-[#09090B]"
          aria-hidden
        />
        <span className="whitespace-nowrap rounded-md bg-[#09090B] px-2.5 py-1.5 text-xs font-medium leading-4 text-white">
          {label}
        </span>
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className="relative flex justify-center"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {mounted && tooltip ? createPortal(tooltip, document.body) : null}
    </div>
  );
}

function SidebarRow({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const Icon = item.icon;
  const isActive =
    item.available &&
    (item.activePathPrefix ? pathname === item.href || pathname.startsWith(`${item.href}/`) : pathname === item.href);
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

  return <CollapsedRailTooltip label={tooltipLabel}>{content}</CollapsedRailTooltip>;
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
        <p className="mb-1.5 pl-4 text-sm font-semibold leading-5 text-[#52525B]">{title}</p>
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
        collapsed ? "w-full overflow-visible" : "w-[240px] overflow-y-auto",
      )}
    >
      {collapsed ? (
        <div className="mb-6 flex justify-center px-1">
          <CollapsedRailTooltip label="Expand sidebar">
            <button
              type="button"
              className={toggleButtonClass}
              onClick={toggleCollapsed}
              aria-expanded={false}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </CollapsedRailTooltip>
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
          "flex min-h-0 flex-1 flex-col space-y-4",
          collapsed ? "overflow-y-auto overflow-x-visible" : "",
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
