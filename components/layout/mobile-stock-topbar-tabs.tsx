"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { UnderlineTabs } from "@/components/screener/market-tabs";
import { useStockDetailTabHost } from "@/components/stock/stock-detail-tab-host-context";
import { parseStockDetailTabQuery, type StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { STOCK_DETAIL_TAB_ITEMS } from "@/lib/stock/stock-detail-tab-items";
import { ETF_STOCK_DETAIL_TAB_IDS } from "@/lib/stock/stock-etf";

/** Stock section tabs in the fixed mobile top bar — matches {@link MobileMarketsTopbarTabs} on `/screener`. */
export function MobileStockTopbarTabs() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registration } = useStockDetailTabHost();

  const urlTab = useMemo(
    () => parseStockDetailTabQuery(searchParams.get("tab")) ?? "overview",
    [searchParams],
  );
  const activeTab = registration?.activeTab ?? urlTab;
  const isEtf = registration?.isEtf ?? false;

  const tabOptions = useMemo(() => {
    const items =
      isEtf
        ? STOCK_DETAIL_TAB_ITEMS.filter((t) => (ETF_STOCK_DETAIL_TAB_IDS as readonly string[]).includes(t.id))
        : STOCK_DETAIL_TAB_ITEMS;
    return items.map((t) => ({ value: t.id, label: t.label }));
  }, [isEtf]);

  const onChange = useCallback(
    (next: StockDetailTabId) => {
      if (registration) {
        registration.setActiveTab(next);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("tab");
      else params.set("tab", next);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, registration, router, searchParams],
  );

  return (
    <div className="w-full shrink-0 bg-transparent px-4 pb-[calc(var(--mobile-markets-tabs-gap)+var(--mobile-stock-topbar-content-gap))] md:hidden">
      <UnderlineTabs
        tabs={tabOptions}
        active={activeTab}
        onChange={onChange}
        ariaLabel="Stock sections"
        className="mb-0 border-b border-solid border-[#E4E4E7] md:mb-0"
      />
    </div>
  );
}
