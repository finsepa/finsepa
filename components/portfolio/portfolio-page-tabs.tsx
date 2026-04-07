"use client";

import { UnderlineTabs } from "@/components/screener/market-tabs";

const tabs = ["Overview", "Cash", "Transactions"] as const;
export type PortfolioViewTab = (typeof tabs)[number];

/** `?tab=` query value for Next.js router (shareable deep links). */
export function portfolioViewTabFromSearchParam(value: string | null): PortfolioViewTab {
  if (!value) return "Overview";
  switch (value.toLowerCase()) {
    case "cash":
      return "Cash";
    case "transactions":
      return "Transactions";
    case "overview":
    default:
      return "Overview";
  }
}

export function searchParamFromPortfolioViewTab(tab: PortfolioViewTab): string {
  switch (tab) {
    case "Cash":
      return "cash";
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
}: {
  active: PortfolioViewTab;
  onChange: (tab: PortfolioViewTab) => void;
}) {
  return <UnderlineTabs tabs={tabs} active={active} onChange={onChange} ariaLabel="Portfolio" />;
}
