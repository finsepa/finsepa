"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useMarketsTabHost } from "@/components/screener/markets-tab-host-context";
import { MARKET_TAB_ITEMS, UnderlineTabs } from "@/components/screener/market-tabs";
import {
  screenerMarketTabFromSearchParams,
  screenerMarketTabHref,
} from "@/lib/screener/screener-market-tab-url-state";

/** Compact market tabs rendered inside the fixed mobile top bar on `/screener`. */
export function MobileMarketsTopbarTabs() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registration } = useMarketsTabHost();

  const urlTab = useMemo(
    () => screenerMarketTabFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const activeTab = registration?.activeTab ?? urlTab;

  const onChange = useCallback(
    (next: typeof activeTab) => {
      if (registration) {
        registration.setActiveTab(next);
        return;
      }
      router.replace(screenerMarketTabHref(pathname, new URLSearchParams(searchParams.toString()), next), {
        scroll: false,
      });
    },
    [pathname, registration, router, searchParams],
  );

  return (
    <div className="w-full shrink-0 bg-transparent px-4 pb-[var(--mobile-markets-tabs-gap)] md:hidden">
      <UnderlineTabs
        tabs={MARKET_TAB_ITEMS}
        active={activeTab}
        onChange={onChange}
        ariaLabel="Markets"
        className="mb-0 border-b border-solid border-[#E4E4E7] md:mb-0"
      />
    </div>
  );
}
