"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import { SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
import { IndexCards } from "@/components/screener/index-cards";
import { MarketTabs, type MarketTab } from "@/components/screener/market-tabs";
import { ScreenerTabs, type StocksSubTab } from "@/components/screener/screener-tabs";
import { ScreenerTable } from "@/components/screener/screener-table";
import { CryptoTable } from "@/components/screener/crypto-table";
import { IndicesTable } from "@/components/screener/indices-table";
import { StocksTableSkeleton } from "@/components/markets/markets-skeletons";
import type { CryptoTop10Row } from "@/lib/market/crypto-top10";
import type { IndexTableRow } from "@/lib/market/indices-top10";
import type { IndexCardData } from "@/lib/screener/indices-today";

function marketTabFromUrl(searchParams: URLSearchParams): MarketTab {
  const raw = searchParams.get(SCREENER_MARKET_QUERY)?.trim().toLowerCase() ?? "";
  if (raw === "crypto") return "Crypto";
  if (raw === "indices") return "Indices";
  return "Stocks";
}

export function MarketsSection({
  stockRows,
  cryptoRows,
  indicesRows,
  indexCards,
}: {
  stockRows: ScreenerTableRow[];
  cryptoRows: CryptoTop10Row[];
  indicesRows: IndexTableRow[];
  indexCards: IndexCardData[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => marketTabFromUrl(searchParams), [searchParams]);

  const setMarketTab = useCallback(
    (next: MarketTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "Stocks") {
        params.delete(SCREENER_MARKET_QUERY);
      } else {
        params.set(SCREENER_MARKET_QUERY, next === "Crypto" ? "crypto" : "indices");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [stocksSubTab, setStocksSubTab] = useState<StocksSubTab>("Companies");
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesPageSize] = useState(20);
  const [companiesTotal] = useState(stockRows.length);
  const [companiesRows] = useState<ScreenerTableRow[]>(stockRows);
  const [companiesLoading] = useState(false);
  const [companiesError] = useState<string | null>(null);

  const gainersLosers = useMemo(() => {
    const valid = stockRows.filter((r) => r.change1D != null && Number.isFinite(r.change1D));
    const by1dDesc = [...valid].sort((a, b) => (b.change1D ?? 0) - (a.change1D ?? 0));
    const by1dAsc = [...valid].sort((a, b) => (a.change1D ?? 0) - (b.change1D ?? 0));
    return {
      gainers: by1dDesc.slice(0, 3),
      losers: by1dAsc.slice(0, 3),
    };
  }, [stockRows]);

  const totalPages = Math.max(1, Math.ceil(companiesTotal / companiesPageSize));
  const safeCompaniesPage = Math.min(totalPages, Math.max(1, companiesPage));

  // Static mock data: no companies API calls.

  return (
    <div>
      <MarketTabs active={tab} onChange={setMarketTab} />

      {tab === "Stocks" ? (
        <>
          <IndexCards initialCards={indexCards} />
          <div className="mb-5">
            <ScreenerTabs active={stocksSubTab} onChange={setStocksSubTab} />
          </div>
          {stocksSubTab === "Companies" ? (
            <div>
              {companiesLoading && !companiesRows ? <StocksTableSkeleton rows={20} /> : null}

              {!companiesLoading && companiesError ? (
                <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
                  {companiesError}
                </div>
              ) : null}

                      {companiesRows ? (
                <ScreenerTable rows={companiesRows} rankOffset={(safeCompaniesPage - 1) * companiesPageSize} />
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCompaniesPage((p) => Math.max(1, p - 1))}
                  disabled={safeCompaniesPage <= 1 || companiesLoading}
                  className="h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>

                <div className="text-sm font-medium text-[#71717A]">
                  Page <span className="font-semibold text-[#09090B]">{safeCompaniesPage}</span> of{" "}
                  <span className="font-semibold text-[#09090B]">{totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCompaniesPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCompaniesPage >= totalPages || companiesLoading}
                  className="h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
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

      {tab === "Crypto" ? <CryptoTable initialRows={cryptoRows} /> : null}
      {tab === "Indices" ? <IndicesTable initialRows={indicesRows} /> : null}
    </div>
  );
}

