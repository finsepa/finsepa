"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  CalendarBlank,
  ChartBar,
  ChatsCircle,
  Globe,
  ChartPieSlice,
} from "@phosphor-icons/react";

import {
  protectedCalendarItems,
  protectedCommunityMobileNavItems,
  protectedDataItems,
  protectedMarketItems,
  protectedNavItemIsActive,
  mobilePrimaryNavTabFromPathname,
  type MobilePrimaryNavTab,
  type ProtectedNavItem,
} from "@/components/layout/protected-nav-config";
import { dropdownMenuPanelBodyClassName, dropdownMenuSurfaceClassName } from "@/components/design-system/dropdown-menu-styles";
import { HapticButton } from "@/components/haptic-button";
import { useMobileBottomNavScrollHide } from "@/lib/layout/use-mobile-bottom-nav-scroll-hide";
import { cn } from "@/lib/utils";

// Sheet sits above the floating bottom nav (see `--mobile-bottom-nav-sheet-bottom` in globals.css).
const MOBILE_NAV_SHEET_BOTTOM = "var(--mobile-bottom-nav-sheet-bottom)";

const TAB_MOTION_MS = 280;
const TAB_MOTION_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

type SheetId = "markets" | "calendar" | "data" | "community";

const soonBadgeClass =
  "ml-auto shrink-0 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#71717A]";

function MobileNavSheetRow({
  item,
  pathname,
  onNavigate,
}: {
  item: ProtectedNavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = protectedNavItemIsActive(item, pathname);
  const rowClass = cn(
    "flex min-h-[48px] w-full items-center gap-3 px-5 text-left text-[15px] font-medium leading-5 transition-colors",
    item.available ? "text-[#09090B]" : "cursor-not-allowed text-[#A1A1AA]",
    item.available && (active ? "rounded-[10px] bg-[#F4F4F5]" : "active:bg-neutral-100"),
  );
  const iconClass = cn("h-5 w-5 shrink-0", item.available ? "text-[#09090B]" : "text-[#A1A1AA]");

  if (item.available) {
    return (
      <Link
        prefetch={false}
        href={item.href}
        className={rowClass}
        onClick={() => onNavigate()}
      >
        <Icon className={iconClass} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }
  return (
    <div className={rowClass} aria-disabled="true">
      <Icon className={iconClass} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <span className={soonBadgeClass}>Soon</span>
    </div>
  );
}

function MobileNavSheet({
  open,
  items,
  sheetId,
  pathname,
  onClose,
}: {
  open: boolean;
  items: readonly ProtectedNavItem[];
  sheetId: SheetId | null;
  pathname: string;
  onClose: () => void;
}) {
  if (!open || !sheetId) return null;
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[41] bg-transparent md:hidden"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        id={`mobile-nav-sheet-${sheetId}`}
        className={cn(
          "mobile-bottom-nav-sheet-enter fixed left-4 right-4 z-[42] overflow-hidden md:hidden",
          dropdownMenuSurfaceClassName(),
        )}
        style={{ bottom: MOBILE_NAV_SHEET_BOTTOM }}
        role="dialog"
        aria-modal="true"
        aria-label="Submenu"
      >
        <nav
          className={cn(
            dropdownMenuPanelBodyClassName,
            "max-h-[min(52vh,420px)] overflow-y-auto pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
          )}
        >
          {items.map((item) => (
            <MobileNavSheetRow
              key={item.label}
              item={item}
              pathname={pathname}
              onNavigate={onClose}
            />
          ))}
        </nav>
      </div>
    </>
  );
}

type TabConfig = {
  id: MobilePrimaryNavTab;
  label: string;
  Icon: typeof Globe;
  items?: readonly ProtectedNavItem[];
};

const TABS: TabConfig[] = [
  { id: "markets", label: "Markets", Icon: Globe, items: protectedMarketItems },
  { id: "calendar", label: "Calendar", Icon: CalendarBlank, items: protectedCalendarItems },
  { id: "data", label: "Data", Icon: ChartBar, items: protectedDataItems },
  { id: "community", label: "Community", Icon: ChatsCircle, items: protectedCommunityMobileNavItems },
];

function sheetItemsFor(id: SheetId | null): readonly ProtectedNavItem[] {
  if (id === "markets") return protectedMarketItems;
  if (id === "calendar") return protectedCalendarItems;
  if (id === "data") return protectedDataItems;
  if (id === "community") return protectedCommunityMobileNavItems;
  return [];
}

function isSheetTab(id: MobilePrimaryNavTab): id is SheetId {
  return id !== "portfolio";
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const urlTab = useMemo(() => mobilePrimaryNavTabFromPathname(pathname), [pathname]);
  const [displayTab, setDisplayTab] = useState<MobilePrimaryNavTab>(urlTab);
  const [openSheet, setOpenSheet] = useState<SheetId | null>(null);
  const [, startTransition] = useTransition();
  const scrollHidden = useMobileBottomNavScrollHide(openSheet == null, pathname);

  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<MobilePrimaryNavTab, HTMLDivElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, height: 0 });

  useEffect(() => {
    setDisplayTab(urlTab);
  }, [urlTab]);

  const indicatorTab =
    displayTab === "portfolio" && urlTab !== "portfolio" ? "portfolio" : urlTab;

  const measureIndicator = useCallback(() => {
    const nav = navRef.current;
    const cell = tabRefs.current.get(indicatorTab);
    if (!nav || !cell) return;
    const navRect = nav.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    setIndicator({
      left: cellRect.left - navRect.left,
      width: cellRect.width,
      height: cellRect.height,
    });
  }, [indicatorTab]);

  useLayoutEffect(() => {
    measureIndicator();
  }, [measureIndicator, indicatorTab, openSheet]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(measureIndicator);
    ro.observe(nav);
    window.addEventListener("resize", measureIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator]);

  const closeSheet = useCallback(() => {
    setOpenSheet(null);
  }, []);

  const selectTab = useCallback((tab: MobilePrimaryNavTab) => {
    setDisplayTab(tab);
  }, []);

  useEffect(() => {
    setOpenSheet(null);
  }, [pathname]);

  useEffect(() => {
    if (!openSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSheet, closeSheet]);

  const openItems = useMemo(() => sheetItemsFor(openSheet), [openSheet]);

  const goToPortfolio = useCallback(() => {
    if (displayTab === "portfolio" && urlTab === "portfolio") return;
    selectTab("portfolio");
    setOpenSheet(null);
    startTransition(() => {
      router.push("/portfolio");
    });
  }, [displayTab, urlTab, router, selectTab]);

  return (
    <>
      <MobileNavSheet
        open={openSheet != null}
        items={openItems}
        sheetId={openSheet}
        pathname={pathname}
        onClose={closeSheet}
      />
      <nav
        ref={navRef}
        className={cn(
          "mobile-bottom-nav-pill fixed left-4 right-4 z-[43] flex h-[60px] items-center md:hidden",
          "rounded-full border border-[#E4E4E7] bg-white/90 px-1 shadow-sm",
          "backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/78",
          scrollHidden && "mobile-bottom-nav-pill--hidden",
        )}
        aria-label="Primary"
      >
        <span
          className="pointer-events-none absolute top-1/2 z-0 -translate-y-1/2 rounded-full bg-[#09090B]/[0.05] motion-reduce:transition-none"
          style={{
            left: indicator.left,
            width: indicator.width,
            height: indicator.height || undefined,
            transitionProperty: "left, width, height",
            transitionDuration: `${TAB_MOTION_MS}ms`,
            transitionTimingFunction: TAB_MOTION_EASE,
          }}
          aria-hidden
        />
        {TABS.map((tab) => {
          const routeActive = urlTab === tab.id;
          const sheetOpen = isSheetTab(tab.id) && openSheet === tab.id;
          const sheetPeek = sheetOpen && !routeActive;
          const Icon = tab.Icon;
          return (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              className="relative z-[1] flex min-w-0 flex-1 flex-col items-stretch"
            >
              <HapticButton
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] leading-[14px] font-semibold uppercase tracking-wide transition-[color,opacity,background-color] duration-100",
                  routeActive ? "text-[#09090B] opacity-100" : sheetPeek ? "bg-[#F4F4F5] text-[#09090B] opacity-100" : "text-[#A1A1AA] opacity-80 active:opacity-100",
                )}
                aria-expanded={sheetOpen}
                aria-controls={sheetOpen ? `mobile-nav-sheet-${tab.id}` : undefined}
                onClick={() => {
                  if (!isSheetTab(tab.id)) return;
                  setOpenSheet((s) => (s === tab.id ? null : (tab.id as SheetId)));
                }}
              >
                <Icon
                  className="h-6 w-6"
                  weight={routeActive ? "fill" : "regular"}
                  aria-hidden
                />
                <span>{tab.label}</span>
              </HapticButton>
            </div>
          );
        })}

        <div
          ref={(el) => {
            if (el) tabRefs.current.set("portfolio", el);
            else tabRefs.current.delete("portfolio");
          }}
          className="relative z-[1] flex min-w-0 flex-1 flex-col items-stretch"
        >
          <HapticButton
            className={cn(
              "flex w-full flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] leading-[14px] font-semibold uppercase tracking-wide transition-[color,opacity] duration-100",
              urlTab === "portfolio" || displayTab === "portfolio" ? "text-[#09090B] opacity-100" : "text-[#A1A1AA] opacity-80 active:opacity-100",
            )}
            onClick={goToPortfolio}
          >
            <ChartPieSlice
              className="h-6 w-6"
              weight={urlTab === "portfolio" || displayTab === "portfolio" ? "fill" : "regular"}
              aria-hidden
            />
            <span>Portfolio</span>
          </HapticButton>
        </div>
      </nav>
    </>
  );
}
