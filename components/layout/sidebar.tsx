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

const marketItems = [
  { label: "Screener", icon: Globe, href: "/screener" },
  { label: "Heatmaps", icon: LayoutGrid, href: "/heatmaps" },
  { label: "News", icon: Newspaper, href: "/news" },
];

const calendarItems = [
  { label: "Earnings", icon: CalendarDays, href: "/earnings" },
  { label: "Economy", icon: BookOpen, href: "/economy" },
];

const dataItems = [
  { label: "Macro", icon: Compass, href: "/macro" },
  { label: "Charting", icon: ChartColumn, href: "/charting" },
  { label: "Comparison", icon: PanelsTopLeft, href: "/comparison" },
];

const communityItems = [
  { label: "Superinvestors", icon: Flame, href: "/superinvestors" },
  { label: "Portfolios", icon: Wallet, href: "/portfolios" },
  { label: "Posts", icon: Briefcase, href: "/posts" },
];

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

function SidebarSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-sm font-semibold leading-5 text-[#52525B]">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex h-9 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium leading-5 text-[#09090B] transition-all duration-100 ${
                isActive ? "bg-[#F4F4F5]" : "hover:bg-[#F4F4F5]"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0 text-[#09090B]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-full w-[240px] shrink-0 flex-col px-2 py-5">
      <div className="mb-7 px-3">
        <img src="/logo.svg" alt="Finsepa" width={32} height={32} />
      </div>

      <div className="flex-1 space-y-6">
        <SidebarSection title="Markets" items={marketItems} pathname={pathname} />
        <SidebarSection title="Calendar" items={calendarItems} pathname={pathname} />
        <SidebarSection title="Data" items={dataItems} pathname={pathname} />
        <SidebarSection title="Community" items={communityItems} pathname={pathname} />
      </div>

      <div className="mt-6 border-t border-neutral-200/80 px-0 pt-4">
        <div className="space-y-0.5">
          {["For Business", "Get Mobile App"].map((label) => (
            <div
              key={label}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold leading-5 text-neutral-400 transition-all duration-100 hover:bg-neutral-200/40 hover:text-neutral-700"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
