"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChartColumn,
  Globe,
  MessagesSquare,
  PieChart,
} from "lucide-react";

import {
  protectedCalendarItems,
  protectedCommunityItems,
  protectedDataItems,
  protectedMarketItems,
  protectedNavItemIsActive,
  protectedNavSectionHasActive,
  type ProtectedNavItem,
} from "@/components/layout/protected-nav-config";
import { cn } from "@/lib/utils";

const MOBILE_NAV_SHEET_BOTTOM = "calc(3.5rem + env(safe-area-inset-bottom, 0px))";

type SheetId = "markets" | "calendar" | "data" | "community";

const soonBadgeClass =
  "ml-auto shrink-0 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#71717A]";

function MobileNavSheetRow({ item, pathname, onNavigate }: { item: ProtectedNavItem; pathname: string; onNavigate: () => void }) {
  const Icon = item.icon;
  const active = protectedNavItemIsActive(item, pathname);
  const rowClass = cn(
    "flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-[15px] font-medium leading-5 transition-colors",
    item.available ? "text-[#09090B]" : "cursor-not-allowed text-[#A1A1AA]",
    item.available && (active ? "bg-[#F4F4F5]" : "active:bg-neutral-100"),
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
        className="fixed inset-0 z-[41] bg-black/25 md:hidden"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        id={`mobile-nav-sheet-${sheetId}`}
        className="fixed inset-x-0 z-[42] border-t border-[#E4E4E7] bg-white shadow-[0_-4px_24px_rgba(10,10,10,0.08)] md:hidden"
        style={{ bottom: MOBILE_NAV_SHEET_BOTTOM }}
        role="dialog"
        aria-modal="true"
        aria-label="Submenu"
      >
        <nav className="max-h-[min(52vh,420px)] overflow-y-auto py-1">
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
  { id: "calendar", label: "Calendar", Icon: CalendarDays, items: protectedCalendarItems },
  { id: "data", label: "Data", Icon: ChartColumn, items: protectedDataItems },
  { id: "community", label: "Community", Icon: MessagesSquare, items: protectedCommunityItems },
];

function sheetItemsFor(id: SheetId | null): readonly ProtectedNavItem[] {
  if (id === "markets") return protectedMarketItems;
  if (id === "calendar") return protectedCalendarItems;
  if (id === "data") return protectedDataItems;
  if (id === "community") return protectedCommunityItems;
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
        className="fixed inset-x-0 bottom-0 z-[43] flex w-full items-stretch border-t border-[#E4E4E7] bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
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
                className="flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors"
                aria-expanded={sheetOpen}
                aria-controls={openSheet === tab.id ? `mobile-nav-sheet-${tab.id}` : undefined}
                onClick={() => setOpenSheet((s) => (s === tab.id ? null : tab.id))}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    sectionActive || sheetOpen ? "text-[#09090B]" : "text-[#A1A1AA]",
                  )}
                  strokeWidth={1.75}
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
            className="flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors"
            onClick={closeSheet}
          >
            <PieChart
              className={cn("h-6 w-6", portfolioActive ? "text-[#09090B]" : "text-[#A1A1AA]")}
              strokeWidth={1.75}
              aria-hidden
            />
            <span className={cn(portfolioActive ? "text-[#09090B]" : "text-[#A1A1AA]")}>Portfolio</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
