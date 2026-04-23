"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PanelLeft, PanelLeftOpen } from "lucide-react";

import { DWELL_TOOLTIP_DELAY_MS, TopbarDelayedTooltip } from "@/components/layout/topbar-delayed-tooltip";
import {
  protectedCalendarItems,
  protectedCommunityItems,
  protectedDataItems,
  protectedMarketItems,
  protectedNavItemIsActive,
  type ProtectedNavItem,
} from "@/components/layout/protected-nav-config";
import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import { cn } from "@/lib/utils";

const soonBadgeClass =
  "shrink-0 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#71717A]";

type NavItem = ProtectedNavItem;

const TOOLTIP_HIDE_MS = 100;

function CollapsedRailTooltip({ label, children }: { label: string; children: React.ReactNode }) {
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
    clearHideTimer();
    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      updatePosition();
      setOpen(true);
    }, DWELL_TOOLTIP_DELAY_MS);
  }, [clearHideTimer, clearShowTimer, updatePosition]);

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
      onPointerEnter={scheduleShow}
      onPointerLeave={hide}
      onPointerDown={cancelPendingAndHide}
      onFocusCapture={scheduleShow}
      onBlurCapture={hide}
    >
      {children}
      {mounted && tooltip ? createPortal(tooltip, document.body) : null}
    </div>
  );
}

function SidebarRow({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const Icon = item.icon;
  const isActive = protectedNavItemIsActive(item, pathname);
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
          <TopbarDelayedTooltip label="Expand Menu">
            <button
              type="button"
              className={toggleButtonClass}
              onClick={toggleCollapsed}
              aria-expanded={false}
              aria-label="Expand Menu"
            >
              <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </TopbarDelayedTooltip>
        </div>
      ) : (
        <div className="mb-7 flex items-center justify-between gap-2 px-3">
          <img src="/logo.svg" alt="Finsepa" width={32} height={32} />
          <TopbarDelayedTooltip label="Collapse Menu">
            <button
              type="button"
              className={toggleButtonClass}
              onClick={toggleCollapsed}
              aria-expanded
              aria-label="Collapse Menu"
            >
              <PanelLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </TopbarDelayedTooltip>
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col space-y-4",
          collapsed ? "overflow-y-auto overflow-x-visible" : "",
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
