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
  PanelsTopLeft,
  Globe,
  Wallet,
} from "lucide-react";

import { NAV_EARNINGS_ENABLED, NAV_MACRO_ENABLED, NAV_NEWS_ENABLED } from "@/lib/features/nav-flags";

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
  { label: "Charting", icon: ChartColumn, href: "/charting", available: false },
  { label: "Comparison", icon: PanelsTopLeft, href: "/comparison", available: false },
];

const communityItems = [
  { label: "Superinvestors", icon: Flame, href: "/superinvestors", available: false },
  { label: "Portfolios", icon: Wallet, href: "/portfolios", available: false },
  { label: "Posts", icon: Briefcase, href: "/posts", available: false },
];

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  available: boolean;
};

function SidebarRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = item.available && pathname === item.href;

  if (item.available) {
    return (
      <Link
        prefetch={false}
        href={item.href}
        className={`flex h-9 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium leading-5 text-[#09090B] transition-all duration-100 ${
          isActive ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0 text-[#09090B]" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div
      className="flex h-9 cursor-not-allowed items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium leading-5 text-[#A1A1AA] select-none"
      aria-disabled="true"
    >
      <Icon className="h-5 w-5 shrink-0 text-[#A1A1AA]" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <span className={soonBadgeClass}>Soon</span>
    </div>
  );
}

function SidebarSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-sm font-semibold leading-5 text-[#52525B]">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <SidebarRow key={item.label} item={item} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col overflow-y-auto rounded-[4px] bg-white px-2 py-5">
      <div className="mb-7 px-3">
        <img src="/logo.svg" alt="Finsepa" width={32} height={32} />
      </div>

      <div className="flex-1 space-y-6">
        <SidebarSection title="Markets" items={marketItems} pathname={pathname} />
        <SidebarSection title="Calendar" items={calendarItems} pathname={pathname} />
        <SidebarSection title="Data" items={dataItems} pathname={pathname} />
        <SidebarSection title="Community" items={communityItems} pathname={pathname} />
      </div>
    </aside>
  );
}
