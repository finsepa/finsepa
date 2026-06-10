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
  SIDEBAR_OUTER_COLLAPSED_PX,
  SIDEBAR_OUTER_EXPANDED_PX,
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
      className={cn(enabled && "relative flex w-full")}
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
  const isActive = protectedNavItemIsActive(item, pathname);
  const Icon = item.icon;
  const tooltipLabel = item.available ? item.label : `${item.label} (Soon)`;

  const rowClass = cn(
    "flex h-9 shrink-0 items-center gap-2 overflow-hidden rounded-lg py-2 text-sm font-medium leading-5",
    SIDEBAR_CONTENT_MOTION_CLASS,
    collapsed ? "w-[calc(100%+5px)] -mr-[5px] pl-4 pr-[11px]" : "w-full px-4",
    item.available ? "text-[#09090B]" : "cursor-not-allowed text-[#A1A1AA] select-none",
    item.available &&
      (isActive ? "bg-white" : "opacity-70 hover:bg-[#EBEBEB]"),
  );

  const labelWrapClass = cn(
    "flex min-w-0 items-center gap-2 overflow-hidden",
    SIDEBAR_CONTENT_MOTION_CLASS,
    collapsed ? "max-w-0 flex-none opacity-0" : "max-w-[12rem] flex-1 opacity-100",
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

/** Nav content width in the fully collapsed rail (72px shell − 12px ×2 padding). */
const SECTION_TITLE_COLLAPSED_CONTENT_PX = SIDEBAR_OUTER_COLLAPSED_PX - 24;
/** Rail width where section titles begin crossfading toward "-". */
const SECTION_TITLE_DASH_START_PX = 108;

function sectionTitleDashBlend(widthPx: number): number {
  if (widthPx >= SECTION_TITLE_DASH_START_PX) return 0;
  if (widthPx <= SECTION_TITLE_COLLAPSED_CONTENT_PX) return 1;
  return (
    (SECTION_TITLE_DASH_START_PX - widthPx) /
    (SECTION_TITLE_DASH_START_PX - SECTION_TITLE_COLLAPSED_CONTENT_PX)
  );
}

function SidebarSectionTitle({ title, collapsed }: { title: string; collapsed: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => setWidth(el.getBoundingClientRect().width);
    sync();

    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = width ?? (collapsed ? SECTION_TITLE_COLLAPSED_CONTENT_PX : SIDEBAR_OUTER_EXPANDED_PX);
  const dashBlend = sectionTitleDashBlend(w);
  const showDashOnly = dashBlend >= 1;
  const centerDash = dashBlend > 0.5;

  return (
    <p
      ref={ref}
      className={cn(
        "relative mb-1.5 max-h-8 overflow-hidden text-sm font-semibold leading-5 text-[#52525B]",
        centerDash ? "text-center" : "pl-4",
      )}
      aria-label={title}
    >
      {!showDashOnly ? (
        <span
          className="block truncate transition-opacity duration-75 motion-reduce:transition-none"
          style={{ opacity: 1 - dashBlend }}
          aria-hidden={dashBlend > 0.92}
        >
          {title}
        </span>
      ) : null}
      <span
        className={cn(
          "transition-opacity duration-75 motion-reduce:transition-none",
          showDashOnly
            ? "block text-center"
            : "pointer-events-none absolute inset-0 flex items-center justify-center",
        )}
        style={{ opacity: showDashOnly ? 1 : dashBlend }}
        aria-hidden={!showDashOnly && dashBlend < 0.08}
      >
        -
      </span>
    </p>
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
      <SidebarSectionTitle title={title} collapsed={collapsed} />
      <div className="space-y-0.5">
        {items.map((item) => (
          <SidebarRow key={item.label} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

const LOGO_WIDTH_PX = 32;
/** Header width where the logo begins fading out during collapse. */
const LOGO_HIDE_START_PX = 148;
/** Header width where the logo is fully hidden. */
const LOGO_HIDE_END_PX = 104;

function sidebarLogoHideBlend(widthPx: number): number {
  if (widthPx >= LOGO_HIDE_START_PX) return 0;
  if (widthPx <= LOGO_HIDE_END_PX) return 1;
  return (LOGO_HIDE_START_PX - widthPx) / (LOGO_HIDE_START_PX - LOGO_HIDE_END_PX);
}

function SidebarChromeHeader({
  collapsed,
  toggleCollapsed,
}: {
  collapsed: boolean;
  toggleCollapsed: () => void;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerWidth, setHeaderWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const sync = () => setHeaderWidth(el.getBoundingClientRect().width);
    sync();

    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = headerWidth ?? SIDEBAR_OUTER_EXPANDED_PX;
  const logoHideBlend = sidebarLogoHideBlend(w);
  const logoVisible = 1 - logoHideBlend;
  const collapsedHeaderLayout = logoHideBlend > 0.98;

  return (
    <div
      ref={headerRef}
      suppressHydrationWarning
      className={cn(
        "mb-3 flex shrink-0 items-center md:mb-3 md:h-[var(--shell-chrome-header-height)] md:py-3",
        SIDEBAR_CONTENT_MOTION_CLASS,
        collapsedHeaderLayout ? "justify-center px-3" : "justify-between gap-2 pl-7 pr-3",
      )}
    >
      <div
        className="shrink-0 overflow-hidden transition-[opacity,max-width,margin] duration-75 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
        style={{
          maxWidth: `${logoVisible * LOGO_WIDTH_PX}px`,
          opacity: logoVisible,
          marginRight: logoVisible > 0.02 ? undefined : 0,
        }}
        aria-hidden={logoHideBlend > 0.92}
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
      <SidebarChromeHeader collapsed={collapsed} toggleCollapsed={toggleCollapsed} />

      <div
        role="navigation"
        aria-label="Main"
        suppressHydrationWarning
        className={cn(
          "flex min-h-0 flex-1 flex-col space-y-3 px-3 pb-1 pt-0",
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
