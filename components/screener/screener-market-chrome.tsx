"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MarketTabs, type MarketTab } from "@/components/screener/market-tabs";
import { useRegisterMarketsTabHost } from "@/components/screener/markets-tab-host-context";
import { UsMarketsSessionLabel } from "@/components/screener/us-markets-session-label";
import {
  SCREENER_MARKET_QUERY,
  screenerMarketTabLabelFromParam,
  screenerMarketTabParamFromLabel,
  type ScreenerMarketTabParam,
} from "@/lib/screener/screener-market-url";
import { SCREENER_INDUSTRY_QUERY, SCREENER_INDUSTRY_SECTOR_QUERY } from "@/lib/screener/screener-industry-url";
import { SCREENER_SECTOR_QUERY } from "@/lib/screener/screener-sector-url";
import { SCREENER_STOCKS_SUB_TAB_QUERY } from "@/lib/screener/screener-stocks-sub-tab-url";

/**
 * Screener market tabs chrome — paints from the URL without waiting for the tab payload.
 * Tab changes soft-navigate so nested Suspense can stream the new market body.
 */
export function ScreenerMarketChrome({
  market,
}: {
  market: ScreenerMarketTabParam;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = screenerMarketTabLabelFromParam(market);
  const [displayTab, setDisplayTab] = useState<MarketTab>(tabFromUrl);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDisplayTab(screenerMarketTabLabelFromParam(market));
  }, [market]);

  const setMarketTab = useCallback(
    (next: MarketTab) => {
      if (next === displayTab) return;
      setDisplayTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "Stocks") {
        params.delete(SCREENER_MARKET_QUERY);
      } else {
        params.set(SCREENER_MARKET_QUERY, screenerMarketTabParamFromLabel(next));
      }
      if (next !== "Stocks") {
        params.delete(SCREENER_SECTOR_QUERY);
        params.delete(SCREENER_INDUSTRY_QUERY);
        params.delete(SCREENER_INDUSTRY_SECTOR_QUERY);
        params.delete(SCREENER_STOCKS_SUB_TAB_QUERY);
      }
      const q = params.toString();
      const href = q ? `${pathname}?${q}` : pathname;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [displayTab, pathname, router, searchParams, startTransition],
  );

  useRegisterMarketsTabHost(displayTab, setMarketTab);

  return (
    <MarketTabs
      active={displayTab}
      onChange={setMarketTab}
      trailing={
        <UsMarketsSessionLabel
          className="hidden md:inline-flex"
          market={displayTab === "Crypto" ? "crypto" : "us-equity"}
        />
      }
    />
  );
}
