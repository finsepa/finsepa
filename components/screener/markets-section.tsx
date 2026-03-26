"use client";

import { useMemo, useState } from "react";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import { IndexCards } from "@/components/screener/index-cards";
import { MarketTabs, type MarketTab } from "@/components/screener/market-tabs";
import { ScreenerTabs, type StocksSubTab } from "@/components/screener/screener-tabs";
import { ScreenerTable } from "@/components/screener/screener-table";
import { CryptoTable } from "@/components/screener/crypto-table";
import { IndicesTable } from "@/components/screener/indices-table";

export function MarketsSection({ stockRows }: { stockRows: ScreenerTableRow[] }) {
  const [tab, setTab] = useState<MarketTab>("Stocks");
  const [stocksSubTab, setStocksSubTab] = useState<StocksSubTab>("Companies");

  const gainersLosers = useMemo(() => {
    const sorted = [...stockRows].sort((a, b) => b.change1D - a.change1D);
    const gainers = sorted.slice(0, 5);
    const losers = [...sorted].reverse().slice(0, 5);
    return { gainers, losers };
  }, [stockRows]);

  return (
    <div>
      <MarketTabs active={tab} onChange={setTab} />

      {tab === "Stocks" ? (
        <>
          <IndexCards />
          <div className="mb-5">
            <ScreenerTabs active={stocksSubTab} onChange={setStocksSubTab} />
          </div>
          {stocksSubTab === "Companies" ? (
            <ScreenerTable rows={stockRows} />
          ) : (
            <div className="space-y-6">
              <div>
                <div className="mb-3 text-[14px] font-semibold leading-5 text-[#71717A]">Top gainers (1D %)</div>
                <ScreenerTable rows={gainersLosers.gainers} />
              </div>
              <div>
                <div className="mb-3 text-[14px] font-semibold leading-5 text-[#71717A]">Top losers (1D %)</div>
                <ScreenerTable rows={gainersLosers.losers} />
              </div>
            </div>
          )}
        </>
      ) : null}

      {tab === "Crypto" ? <CryptoTable /> : null}
      {tab === "Indices" ? <IndicesTable /> : null}
    </div>
  );
}

