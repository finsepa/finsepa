"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { UnderlineTabs } from "@/components/screener/market-tabs";
import { useStockDetailTabHost } from "@/components/stock/stock-detail-tab-host-context";
import { parseStockDetailTabQuery, type StockDetailTabId } from "@/lib/stock/stock-detail-tab";
import { stockDetailTabItemsFor } from "@/lib/stock/stock-etf";

const subscribeNoop = () => () => {};

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
  // This Suspense-wrapped bar can hydrate after the page registered itself; keep the hydration pass equal to SSR.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const hostRegistration = hydrated ? registration : null;
  const activeTab = hostRegistration?.activeTab ?? urlTab;
  const isEtf = hostRegistration?.isEtf ?? false;

  const tabOptions = useMemo(() => {
    const items = stockDetailTabItemsFor(isEtf);
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
        className="mb-0 border-b border-solid border-stroke-subtle md:mb-0"
      />
    </div>
  );
}
