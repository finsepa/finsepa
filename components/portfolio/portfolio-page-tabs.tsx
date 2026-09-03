"use client";

import { UnderlineTabs } from "@/components/screener/market-tabs";
import type { SecondaryTabItem } from "@/components/ui/secondary-tabs";
import { cn } from "@/lib/utils";

export const portfolioViewTabs = [
  "Overview",
  "Insights",
  "Goal",
  "Dividends",
  "Cash",
  "Transactions",
] as const;
export type PortfolioViewTab = (typeof portfolioViewTabs)[number];

/** Visible tab label (internal tab id stays `Goal` for routing/state). */
export function portfolioViewTabLabel(tab: PortfolioViewTab): string {
  return tab === "Goal" ? "My Goal" : tab;
}

export type OverviewHoldingsSubTab = "assets" | "allocation" | "slices" | "earnings";

export const PORTFOLIO_HOLDINGS_SUB_TAB_ITEMS = [
  { id: "assets", label: "Assets" },
  { id: "earnings", label: "Earnings" },
  { id: "allocation", label: "Allocation" },
  { id: "slices", label: "Slices" },
] as const satisfies readonly SecondaryTabItem<OverviewHoldingsSubTab>[];

/** Community `/portfolios/[id]` read-only view — no Cash tab. */
export const publicPortfolioViewTabs = [
  "Overview",
  "Insights",
  "Dividends",
  "Transactions",
] as const satisfies readonly PortfolioViewTab[];

/** `?tab=` query value for Next.js router (shareable deep links). */
export function portfolioViewTabFromSearchParam(value: string | null): PortfolioViewTab {
  if (!value) return "Overview";
  switch (value.toLowerCase()) {
    case "insights":
    case "performance": // legacy deep link
      return "Insights";
    case "my-goal":
    case "mygoal":
    case "goal":
      return "Goal";
    case "metrics":
      return "Overview";
    case "dividends":
      return "Dividends";
    case "cash":
      return "Cash";
    case "slices":
      return "Overview";
    case "transactions":
      return "Transactions";
    case "overview":
    default:
      return "Overview";
  }
}

export function overviewHoldingsSubTabFromSearchParam(
  tab: string | null,
  view: string | null,
): OverviewHoldingsSubTab {
  if (tab?.toLowerCase() === "slices") return "slices";
  switch (view?.toLowerCase()) {
    case "allocation":
      return "allocation";
    case "slices":
      return "slices";
    case "earnings":
      return "earnings";
    default:
      return "assets";
  }
}

export function searchParamFromOverviewHoldingsSubTab(view: OverviewHoldingsSubTab): string {
  return view;
}

export function searchParamFromPortfolioViewTab(tab: PortfolioViewTab): string {
  switch (tab) {
    case "Insights":
      return "insights";
    case "Goal":
      return "goal";
    case "Dividends":
      return "dividends";
    case "Cash":
      return "cash";
    case "Transactions":
      return "transactions";
    case "Overview":
    default:
      return "overview";
  }
}

export function portfolioPageSearchHref(
  tabBasePath: string,
  tab: PortfolioViewTab,
  holdingsSubTab: OverviewHoldingsSubTab = "assets",
): string {
  const q = searchParamFromPortfolioViewTab(tab);
  if (tab === "Overview") {
    return `${tabBasePath}?tab=${q}&view=${searchParamFromOverviewHoldingsSubTab(holdingsSubTab)}`;
  }
  return `${tabBasePath}?tab=${q}`;
}

/** Update `?tab=` / `?view=` without a Next.js navigation (avoids a Suspense skeleton flash). */
export function replacePortfolioPageUrl(href: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(href, window.location.href);
  const next = `${url.pathname}${url.search}`;
  if (`${window.location.pathname}${window.location.search}` === next) return;
  window.history.replaceState(window.history.state, "", next);
}

/** Uses the same `UnderlineTabs` component as Screener primary market tabs. */
export function PortfolioPageTabs({
  active,
  onChange,
  publicView = false,
}: {
  active: PortfolioViewTab;
  onChange: (tab: PortfolioViewTab) => void;
  /** Hides Cash (and related deep links) on `/portfolios/[id]`. */
  publicView?: boolean;
}) {
  const tabList = publicView ? publicPortfolioViewTabs : portfolioViewTabs;
  return (
    <UnderlineTabs
      tabs={tabList.map((t) => ({ value: t, label: portfolioViewTabLabel(t) }))}
      active={active}
      onChange={onChange}
      ariaLabel="Portfolio"
      className={cn(
        // 16px below tabs → content on mobile; keep 20px (`mb-5`) desktop.
        "mb-4 md:mb-5",
        "max-md:sticky max-md:top-[var(--mobile-topbar-offset)] max-md:z-40 max-md:-mx-4 max-md:bg-canvas max-md:px-4 max-md:pt-1",
      )}
    />
  );
}
