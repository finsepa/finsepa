"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { FinsepaLogo } from "@/components/brand/finsepa-logo";
import { DWELL_TOOLTIP_DELAY_MS } from "@/components/layout/topbar-delayed-tooltip";
import { tooltipDwellSurfaceClassName } from "@/components/design-system/tooltip-surface-styles";
import {
  protectedAgentItem,
  protectedPortfolioItem,
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
import { requestAgentHomeIfAlreadyThere } from "@/lib/agents/agent-home-nav";
import { cn } from "@/lib/utils";

const soonBadgeClass =
  "shrink-0 rounded-md border border-stroke bg-surface-muted px-1.5 text-[11px] font-medium leading-4 normal-case text-fg-muted";

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
        className="pointer-events-none fixed z-[200] -translate-y-1/2 shadow-[0px_8px_20px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-12))]"
        style={{ left: pos.left, top: pos.top }}
        role="tooltip"
      >
        <span className={cn(tooltipDwellSurfaceClassName, "whitespace-nowrap")}>{label}</span>
      </div>
    ) : null;

  return (
    <div
      ref={enabled ? rootRef : undefined}
      className={enabled ? "relative flex w-full" : undefined}
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
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Defer active styling until after mount so SSR and the first client paint match when
  // `usePathname()` differs (rewrites / soft routing). Avoids Link className hydration errors.
  const isActive = hasMounted && protectedNavItemIsActive(item, pathname);
  const Icon = item.icon;
  const tooltipLabel = item.available ? item.label : `${item.label} (Soon)`;

  const rowClass = cn(
    "flex h-9 shrink-0 items-center gap-2 overflow-hidden rounded-lg py-2 text-sm font-medium leading-5",
    SIDEBAR_CONTENT_MOTION_CLASS,
    collapsed ? "w-[calc(100%+5px)] -mr-[5px] pl-4 pr-[11px]" : "w-full px-4",
    item.available ? "text-fg" : "cursor-not-allowed text-fg-subtle select-none",
    item.available &&
      (isActive
        ? "bg-[var(--fs-sidebar-nav-active)]"
        : "opacity-70 hover:bg-[var(--fs-sidebar-nav-active)]/70 dark:hover:bg-[var(--fs-sidebar-nav-active)] dark:hover:opacity-100"),
  );

  const labelWrapClass = cn(
    "flex min-w-0 items-center gap-2 overflow-hidden",
    SIDEBAR_CONTENT_MOTION_CLASS,
    collapsed ? "max-w-0 flex-none opacity-0" : "max-w-[12rem] flex-1 opacity-100",
  );

  const iconClass = cn("h-5 w-5 shrink-0", item.available ? "text-fg" : "text-fg-subtle");

  const content =
    item.available ? (
      <Link
        prefetch={false}
        href={item.href}
        className={rowClass}
        suppressHydrationWarning
        onClick={(event) => requestAgentHomeIfAlreadyThere(event, pathname, item.href)}
      >
        <Icon className={iconClass} suppressHydrationWarning />
        <span className={labelWrapClass} suppressHydrationWarning>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span
              className={cn(
                soonBadgeClass,
                SIDEBAR_CONTENT_MOTION_CLASS,
                collapsed ? "max-w-0 opacity-0" : "max-w-[3rem] opacity-100",
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </span>
      </Link>
    ) : (
      <div className={rowClass} aria-disabled="true" suppressHydrationWarning>
        <Icon className={iconClass} suppressHydrationWarning />
        <span className={labelWrapClass} suppressHydrationWarning>
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
      suppressHydrationWarning
      className={cn(
        "relative mb-1.5 max-h-8 overflow-hidden text-sm font-semibold leading-5 text-fg-muted",
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

const LOGO_SIZE_PX = 32;
/** Expanded header: `pl-7` (28px). Collapsed: centered in the 72px rail. */
const LOGO_LEFT_EXPANDED_PX = 28;
const LOGO_LEFT_COLLAPSED_PX = (SIDEBAR_OUTER_COLLAPSED_PX - LOGO_SIZE_PX) / 2;

function SidebarChromeHeader() {
  const { collapsed } = useSidebarLayout();
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

  const w = headerWidth ?? (collapsed ? SIDEBAR_OUTER_COLLAPSED_PX : SIDEBAR_OUTER_EXPANDED_PX);
  const span = SIDEBAR_OUTER_EXPANDED_PX - SIDEBAR_OUTER_COLLAPSED_PX;
  const t = Math.min(1, Math.max(0, (SIDEBAR_OUTER_EXPANDED_PX - w) / span));
  // Tracks rail width: collapsed → centered; expanded → slight right (pl-7). No justify snap = no bounce.
  const leftPx = LOGO_LEFT_EXPANDED_PX + t * (LOGO_LEFT_COLLAPSED_PX - LOGO_LEFT_EXPANDED_PX);

  return (
    <div
      ref={headerRef}
      suppressHydrationWarning
      className="relative mb-3 shrink-0 md:mb-3 md:h-[var(--shell-chrome-header-height)] md:py-3"
    >
      <FinsepaLogo
        size={LOGO_SIZE_PX}
        className="absolute top-1/2 h-8 w-8 -translate-y-1/2"
        style={{ left: leftPx }}
      />
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebarLayout();

  return (
    <aside
      suppressHydrationWarning
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col bg-nav max-md:rounded-[4px] max-md:py-2 md:rounded-none md:pb-2 md:pt-[var(--shell-desktop-padding-top)]",
        SIDEBAR_WIDTH_MOTION_CLASS,
        collapsed ? "w-full overflow-visible" : "w-[240px] overflow-y-auto overflow-x-hidden",
      )}
    >
      <SidebarChromeHeader />

      <div
        role="navigation"
        aria-label="Main"
        suppressHydrationWarning
        className={cn(
          "flex min-h-0 flex-1 flex-col space-y-4 px-3 pb-1 pt-0",
          collapsed ? "overflow-y-auto overflow-x-visible" : "",
        )}
      >
        <div className={cn("space-y-0.5", collapsed && "flex flex-col items-center")}>
          <SidebarRow item={protectedPortfolioItem} pathname={pathname} collapsed={collapsed} />
          <SidebarRow item={protectedAgentItem} pathname={pathname} collapsed={collapsed} />
        </div>
        <SidebarSection title="Markets" items={protectedMarketItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Calendar" items={protectedCalendarItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Data" items={protectedDataItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Community" items={protectedCommunityItems} pathname={pathname} collapsed={collapsed} />
      </div>
    </aside>
  );
}
