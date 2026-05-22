"use client";

import { UnderlineTabs } from "@/components/screener/market-tabs";

const tabs = ["Overview", "Performance", "Metrics", "Cash", "Slices", "Transactions"] as const;
export type PortfolioViewTab = (typeof tabs)[number];

/** Community `/portfolios/[id]` read-only view — no Cash tab. */
export const publicPortfolioViewTabs = [
  "Overview",
  "Performance",
  "Metrics",
  "Slices",
  "Transactions",
] as const satisfies readonly PortfolioViewTab[];

/** `?tab=` query value for Next.js router (shareable deep links). */
export function portfolioViewTabFromSearchParam(value: string | null): PortfolioViewTab {
  if (!value) return "Overview";
  switch (value.toLowerCase()) {
    case "performance":
      return "Performance";
    case "metrics":
      return "Metrics";
    case "cash":
      return "Cash";
    case "slices":
      return "Slices";
    case "transactions":
      return "Transactions";
    case "overview":
    default:
      return "Overview";
  }
}

export function searchParamFromPortfolioViewTab(tab: PortfolioViewTab): string {
  switch (tab) {
    case "Performance":
      return "performance";
    case "Metrics":
      return "metrics";
    case "Cash":
      return "cash";
    case "Slices":
      return "slices";
    case "Transactions":
      return "transactions";
    case "Overview":
    default:
      return "overview";
  }
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
  const tabList = publicView ? publicPortfolioViewTabs : tabs;
  return <UnderlineTabs tabs={tabList} active={active} onChange={onChange} ariaLabel="Portfolio" />;
}
