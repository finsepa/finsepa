"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PanelLeft, PanelLeftOpen } from "@/lib/icons";

import { DWELL_TOOLTIP_DELAY_MS, TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import {
  protectedCalendarItems,
  protectedCommunityItems,
  protectedDataItems,
  protectedMarketItems,
  protectedNavItemIsActive,
  type ProtectedNavItem,
} from "@/components/layout/protected-nav-config";
import {
  SIDEBAR_CONTENT_MOTION_CLASS,
  SIDEBAR_WIDTH_MOTION_CLASS,
  useSidebarLayout,
} from "@/components/layout/sidebar-layout-context";
import { shellChromeToggleButtonClass } from "@/components/layout/shell-chrome-toggle-button";
import { cn } from "@/lib/utils";

const soonBadgeClass =
  "shrink-0 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-[#71717A]";

type NavItem = ProtectedNavItem;

const TOOLTIP_HIDE_MS = 100;

function CollapsedRailTooltip({
  label,
  children,
  enabled,
}: {
  label: string;
  children: React.ReactNode;
  enabled: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearHideTimer();
      clearShowTimer();
    };
  }, [clearHideTimer, clearShowTimer]);

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

  const scheduleShow = useCallback(() => {
    if (!enabled) return;
    clearHideTimer();
    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      updatePosition();
      setOpen(true);
    }, DWELL_TOOLTIP_DELAY_MS);
  }, [clearHideTimer, clearShowTimer, enabled, updatePosition]);

  const hide = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setOpen(false), TOOLTIP_HIDE_MS);
  }, [clearHideTimer, clearShowTimer]);

  const cancelPendingAndHide = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    setOpen(false);
  }, [clearHideTimer, clearShowTimer]);

  const tooltip =
    enabled && open && mounted ? (
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
      ref={enabled ? rootRef : undefined}
      className={cn(enabled && "relative flex w-full justify-center")}
      onPointerEnter={enabled ? scheduleShow : undefined}
      onPointerLeave={enabled ? hide : undefined}
      onPointerDown={enabled ? cancelPendingAndHide : undefined}
      onFocusCapture={enabled ? scheduleShow : undefined}
      onBlurCapture={enabled ? hide : undefined}
    >
      {children}
      {enabled && mounted && tooltip ? createPortal(tooltip, document.body) : null}
    </div>
  );
}

function SidebarRow({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const Icon = item.icon;
  const isActive = protectedNavItemIsActive(item, pathname);
  const tooltipLabel = item.available ? item.label : `${item.label} (Soon)`;

  const rowClass = cn(
    "flex shrink-0 items-center overflow-hidden rounded-lg text-sm font-medium leading-5",
    SIDEBAR_CONTENT_MOTION_CLASS,
    collapsed ? "h-9 w-9 justify-center gap-0 px-0 py-0" : "h-9 gap-2 px-4 py-2",
    item.available ? "text-[#09090B]" : "cursor-not-allowed text-[#A1A1AA] select-none",
    item.available &&
      (isActive ? "bg-white" : "opacity-70 hover:bg-[#EBEBEB]"),
  );

  const labelWrapClass = cn(
    "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
    SIDEBAR_CONTENT_MOTION_CLASS,
    collapsed ? "max-w-0 opacity-0" : "max-w-[12rem] opacity-100",
  );

  const iconClass = cn("h-5 w-5 shrink-0", item.available ? "text-[#09090B]" : "text-[#A1A1AA]");

  const content =
    item.available ? (
      <Link prefetch={false} href={item.href} className={rowClass}>
        <Icon className={iconClass} />
        <span className={labelWrapClass}>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </span>
      </Link>
    ) : (
      <div className={rowClass} aria-disabled="true">
        <Icon className={iconClass} />
        <span className={labelWrapClass}>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span
            className={cn(
              soonBadgeClass,
              SIDEBAR_CONTENT_MOTION_CLASS,
              collapsed ? "max-w-0 opacity-0" : "max-w-[3rem] opacity-100",
            )}
          >
            Soon
          </span>
        </span>
      </div>
    );

  return (
    <CollapsedRailTooltip label={tooltipLabel} enabled={collapsed}>
      {content}
    </CollapsedRailTooltip>
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
    <div className={cn(SIDEBAR_CONTENT_MOTION_CLASS, collapsed && "w-full")}>
      <p
        className={cn(
          "overflow-hidden pl-4 text-sm font-semibold leading-5 text-[#52525B]",
          SIDEBAR_CONTENT_MOTION_CLASS,
          collapsed ? "mb-0 max-h-0 opacity-0" : "mb-1.5 max-h-8 opacity-100",
        )}
      >
        {title}
      </p>
      <div className={cn("space-y-0.5", collapsed && "w-full")}>
        {items.map((item) => (
          <SidebarRow key={item.label} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebarLayout();

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col bg-[#F4F4F5] max-md:rounded-[4px] max-md:py-2 md:rounded-none md:pb-2 md:pt-[var(--shell-desktop-padding-top)]",
        SIDEBAR_WIDTH_MOTION_CLASS,
        collapsed ? "w-full overflow-visible" : "w-[240px] overflow-y-auto overflow-x-hidden",
      )}
    >
      <div
        suppressHydrationWarning
        className={cn(
          "mb-3 flex shrink-0 items-center md:mb-3 md:h-[var(--shell-chrome-header-height)] md:py-3",
          SIDEBAR_CONTENT_MOTION_CLASS,
          collapsed ? "justify-center px-3" : "justify-between gap-2 pl-7 pr-3",
        )}
      >
        <div
          className={cn(
            "overflow-hidden",
            SIDEBAR_CONTENT_MOTION_CLASS,
            collapsed ? "max-w-0 opacity-0" : "max-w-8 opacity-100",
          )}
          aria-hidden={collapsed}
        >
          <img src="/logo.svg" alt="Finsepa" width={32} height={32} className="h-8 w-8 shrink-0" />
        </div>
        <TopbarDelayedTooltip label={collapsed ? "Expand Menu" : "Collapse Menu"} placement="right">
          <button
            type="button"
            className={cn(shellChromeToggleButtonClass, "hover:bg-[#EBEBEB]")}
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand Menu" : "Collapse Menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <PanelLeft className="h-5 w-5" strokeWidth={1.75} />
            )}
          </button>
        </TopbarDelayedTooltip>
      </div>

      <div
        role="navigation"
        aria-label="Main"
        suppressHydrationWarning
        className={cn(
          "flex min-h-0 flex-1 flex-col space-y-3 px-3 pb-1 pt-0",
          collapsed ? "items-center overflow-y-auto overflow-x-visible" : "",
        )}
      >
        <SidebarSection title="Markets" items={protectedMarketItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Calendar" items={protectedCalendarItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Data" items={protectedDataItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Community" items={protectedCommunityItems} pathname={pathname} collapsed={collapsed} />
      </div>
    </aside>
  );
}
