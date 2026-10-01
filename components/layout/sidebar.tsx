"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { FinsepaLogo } from "@/components/brand/finsepa-logo";
import { OverlayScrollArea } from "@/components/design-system/overlay-scroll-area";
import { DWELL_TOOLTIP_DELAY_MS } from "@/components/layout/topbar-delayed-tooltip";
import { tooltipDwellSurfaceClassName } from "@/components/design-system/tooltip-surface-styles";
import {
  protectedPortfolioHomeItem,
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
import { PortfolioListLogo } from "@/components/portfolio/portfolio-brokerage-logo";
import { usePortfolioWorkspace } from "@/components/portfolio/portfolio-workspace-context";
import { requestAgentHomeIfAlreadyThere } from "@/lib/agents/agent-home-nav";
import { ChevronDown } from "@/lib/icons";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
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

function SidebarRow({
  item,
  pathname,
  collapsed,
  activeOverride,
  trailing,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  activeOverride?: boolean;
  /** Control drawn over the row's right edge (outside the link, so it gets its own click). */
  trailing?: React.ReactNode;
}) {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Defer active styling until after mount so SSR and the first client paint match when
  // `usePathname()` differs (rewrites / soft routing). Avoids Link className hydration errors.
  const isActive = hasMounted && (activeOverride ?? protectedNavItemIsActive(item, pathname));
  const showTrailing = trailing != null && !collapsed;
  const Icon = item.icon;
  const tooltipLabel = item.available ? item.label : `${item.label} (Soon)`;

  const rowClass = cn(
    "flex h-9 shrink-0 items-center gap-2 overflow-hidden rounded-lg py-2 text-sm font-medium leading-5",
    SIDEBAR_CONTENT_MOTION_CLASS,
    collapsed ? "w-[calc(100%+5px)] -mr-[5px] pl-4 pr-[11px]" : showTrailing ? "w-full pl-4 pr-9" : "w-full px-4",
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
      {showTrailing ? (
        <div className="relative w-full">
          {content}
          {trailing}
        </div>
      ) : (
        content
      )}
    </CollapsedRailTooltip>
  );
}

const HOME_PORTFOLIOS_OPEN_KEY = "finsepa.sidebar.homePortfoliosOpen";
const HOME_PORTFOLIOS_OPEN_EVENT = "finsepa:sidebar-home-portfolios-open";

function readHomePortfoliosOpen(): boolean {
  try {
    return localStorage.getItem(HOME_PORTFOLIOS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHomePortfoliosOpen(open: boolean) {
  try {
    localStorage.setItem(HOME_PORTFOLIOS_OPEN_KEY, open ? "1" : "0");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(HOME_PORTFOLIOS_OPEN_EVENT));
}

function subscribeHomePortfoliosOpen(onChange: () => void) {
  window.addEventListener(HOME_PORTFOLIOS_OPEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(HOME_PORTFOLIOS_OPEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function portfolioHomeHref(id: string): string {
  return `/home/${id}`;
}

/** Home row + caret that expands the user's portfolios underneath (each opens `/home/[id]`). */
function SidebarHomeGroup({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  const { portfolios } = usePortfolioWorkspace();
  const open = useSyncExternalStore(subscribeHomePortfoliosOpen, readHomePortfoliosOpen, () => false);
  const toggle = useCallback(() => writeHomePortfoliosOpen(!readHomePortfoliosOpen()), []);

  const showChildren = open && !collapsed && portfolios.length > 0;
  const activeChildId = portfolios.find((p) => pathname === portfolioHomeHref(p.id))?.id ?? null;
  const homeActive = pathname === "/home" || (activeChildId != null && !showChildren);

  return (
    <div className="w-full">
      <SidebarRow
        item={protectedPortfolioHomeItem}
        pathname={pathname}
        collapsed={collapsed}
        activeOverride={homeActive}
        trailing={
          portfolios.length > 0 ? (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={open ? "Hide portfolios" : "Show portfolios"}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-black/5 hover:text-fg dark:hover:bg-dropdown-item-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
            >
              <ChevronDown
                className="size-4 transition-transform duration-200 motion-reduce:transition-none"
                style={{ transform: open ? "rotate(180deg)" : undefined }}
                strokeWidth={2}
                aria-hidden
              />
            </button>
          ) : null
        }
      />
      {showChildren ? (
        <ul className="m-0 mt-0.5 flex list-none flex-col gap-0.5 p-0">
          {portfolios.map((p) => {
            const active = p.id === activeChildId;
            return (
              <li key={p.id}>
                <Link
                  prefetch={false}
                  href={portfolioHomeHref(p.id)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 overflow-hidden rounded-lg pl-11 pr-3 text-sm font-medium leading-5 text-fg",
                    active
                      ? "bg-[var(--fs-sidebar-nav-active)]"
                      : "opacity-70 hover:bg-[var(--fs-sidebar-nav-active)]/70 dark:hover:bg-[var(--fs-sidebar-nav-active)] dark:hover:opacity-100",
                  )}
                >
                  <PortfolioListLogo portfolio={p} className="h-5 w-5 rounded-md" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
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
      <Link
        href={PATH_APP_ENTRY}
        aria-label="Finsepa home — Home"
        className="absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-md text-fg outline-none focus-visible:ring-2 focus-visible:ring-fg/15"
        style={{ left: leftPx }}
      >
        <FinsepaLogo size={LOGO_SIZE_PX} className="h-8 w-8" title="" />
      </Link>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebarLayout();

  const content = (
    <>
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
          <SidebarHomeGroup pathname={pathname} collapsed={collapsed} />
        </div>
        <SidebarSection title="Markets" items={protectedMarketItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Calendar" items={protectedCalendarItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Data" items={protectedDataItems} pathname={pathname} collapsed={collapsed} />
        <SidebarSection title="Community" items={protectedCommunityItems} pathname={pathname} collapsed={collapsed} />
      </div>
    </>
  );

  return (
    <aside
      suppressHydrationWarning
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col bg-nav max-md:rounded-[4px] max-md:py-2 md:rounded-none md:pb-2 md:pt-[var(--shell-desktop-padding-top)]",
        SIDEBAR_WIDTH_MOTION_CLASS,
        collapsed ? "w-full overflow-visible" : "w-[240px] overflow-hidden",
      )}
    >
      {collapsed ? (
        content
      ) : (
        <OverlayScrollArea className="flex-1" viewportClassName="flex flex-1 flex-col overflow-x-hidden">
          {content}
        </OverlayScrollArea>
      )}
    </aside>
  );
}
