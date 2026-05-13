"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  protectedNavSectionHasActive,
  type ProtectedNavItem,
} from "@/components/layout/protected-nav-config";
import { dropdownMenuPanelBodyClassName, dropdownMenuSurfaceClassName } from "@/components/design-system/dropdown-menu-styles";
import { cn } from "@/lib/utils";

// Sheet sits above the floating bottom nav (see `--mobile-bottom-nav-sheet-bottom` in globals.css).
const MOBILE_NAV_SHEET_BOTTOM = "var(--mobile-bottom-nav-sheet-bottom)";

type SheetId = "markets" | "calendar" | "data" | "community";

const soonBadgeClass =
  "ml-auto shrink-0 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#71717A]";

function MobileNavSheetRow({ item, pathname, onNavigate }: { item: ProtectedNavItem; pathname: string; onNavigate: () => void }) {
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
      <Link prefetch={false} href={item.href} className={rowClass} onClick={onNavigate}>
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
            <MobileNavSheetRow key={item.label} item={item} pathname={pathname} onNavigate={onClose} />
          ))}
        </nav>
      </div>
    </>
  );
}

type TabConfig = {
  id: SheetId;
  label: string;
  Icon: typeof Globe;
  items: readonly ProtectedNavItem[];
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

export function MobileBottomNav() {
  const pathname = usePathname();
  const [openSheet, setOpenSheet] = useState<SheetId | null>(null);

  const closeSheet = useCallback(() => setOpenSheet(null), []);

  useEffect(() => {
    closeSheet();
  }, [pathname, closeSheet]);

  useEffect(() => {
    if (!openSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSheet, closeSheet]);

  const portfolioActive =
    pathname === "/portfolio" ||
    pathname.startsWith("/portfolio/") ||
    pathname === "/portfolios" ||
    pathname.startsWith("/portfolios/");

  const openItems = useMemo(() => sheetItemsFor(openSheet), [openSheet]);

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
        className={cn(
          "fixed left-4 right-4 z-[43] flex items-stretch md:hidden",
          /** 16px float from screen edges + above home indicator; pill reads clearly over scrolling content. */
          "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]",
          "rounded-full border border-[#E4E4E7]/90 bg-white/90 py-2 px-2",
          "shadow-[0_10px_40px_-12px_rgba(15,23,42,0.14),0_2px_12px_rgba(15,23,42,0.08)]",
          "backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/78",
        )}
        aria-label="Primary"
      >
        {TABS.map((tab) => {
          const sectionActive = protectedNavSectionHasActive(tab.items, pathname);
          const sheetOpen = openSheet === tab.id;
          const Icon = tab.Icon;
          return (
            <div key={tab.id} className="flex min-w-0 flex-1 flex-col items-stretch">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-full py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  sectionActive || sheetOpen ? "bg-[#09090B]/[0.05]" : "active:bg-[#09090B]/[0.04]",
                )}
                aria-expanded={sheetOpen}
                aria-controls={openSheet === tab.id ? `mobile-nav-sheet-${tab.id}` : undefined}
                onClick={() => setOpenSheet((s) => (s === tab.id ? null : tab.id))}
              >
                <Icon
                  className={cn("h-6 w-6", sectionActive || sheetOpen ? "text-[#09090B]" : "text-[#A1A1AA]")}
                  weight={sectionActive || sheetOpen ? "fill" : "regular"}
                  aria-hidden
                />
                <span className={cn(sectionActive || sheetOpen ? "text-[#09090B]" : "text-[#A1A1AA]")}>
                  {tab.label}
                </span>
              </button>
            </div>
          );
        })}

        <div className="flex min-w-0 flex-1 flex-col items-stretch">
          <Link
            prefetch={false}
            href="/portfolio"
            className={cn(
              "flex w-full flex-col items-center gap-1 rounded-full py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              portfolioActive ? "bg-[#09090B]/[0.05]" : "active:bg-[#09090B]/[0.04]",
            )}
            onClick={closeSheet}
          >
            <ChartPieSlice
              className={cn("h-6 w-6", portfolioActive ? "text-[#09090B]" : "text-[#A1A1AA]")}
              weight={portfolioActive ? "fill" : "regular"}
              aria-hidden
            />
            <span className={cn(portfolioActive ? "text-[#09090B]" : "text-[#A1A1AA]")}>Portfolio</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
